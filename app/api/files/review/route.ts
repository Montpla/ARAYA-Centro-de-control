import { env } from "cloudflare:workers";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  documentDataProposals,
  fileActivity,
  fileReviews,
  uploadedFiles,
  unmappedFieldCandidates,
} from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { areaLabels, isUploadArea } from "../../../../lib/file-routing";
import {
  LiveDataUpdate,
  isCommercialLiveKey,
  isFinancialLiveKey,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "../../../../lib/live-data";
import { scheduleNotificationDispatch } from "../../../../lib/notification-dispatch";
import {
  D1JsonDatabase,
  deleteExpiredReviewReservations,
  selectLivePointValues,
  upsertDocumentProposalRows,
} from "../../../../lib/d1-json-bulk";
import { reviewReservationMayBeDeleted } from "../../../../lib/review-cancel-recovery";
import {
  normalizeLiveDataUpdates,
  publishLiveDataUpdates,
} from "../../../../lib/publish-live-data";

export const runtime = "edge";

type D1Bindable = string | number | null;

type AtomicD1Statement = {
  bind: (...values: D1Bindable[]) => AtomicD1Statement;
};

type AtomicD1Database = {
  prepare: (sql: string) => AtomicD1Statement;
  batch: (statements: AtomicD1Statement[]) => Promise<unknown[]>;
};

function atomicStatement(database: AtomicD1Database, sql: string, ...values: D1Bindable[]) {
  return database.prepare(sql).bind(...values);
}

function getD1JsonDatabase() {
  const database = (env as unknown as { DB?: D1JsonDatabase }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  return database;
}

function failedReviewInvariant(
  database: AtomicD1Database,
  reservationId: number,
  conditionSql: string,
  ...values: D1Bindable[]
) {
  return atomicStatement(
    database,
    `INSERT INTO file_reviews (id, file_id, action, request_key, actor_email, actor_name)
     SELECT ?, '', '', '', '', ''
     WHERE NOT (${conditionSql})`,
    reservationId,
    ...values,
  );
}

async function commitReviewDecision(input: {
  fileId: string;
  processingAction: string;
  claimedAt: string;
  fileSetSql: string;
  fileSetValues: D1Bindable[];
  expectedReviewStatus: string;
  expectedUpdatedAt: string;
  expectedProposalGeneration?: string;
  reservationId: number;
  completedAction: string;
  note: string;
  proposalCount: number;
}) {
  const database = (env as unknown as { DB?: AtomicD1Database }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  const expectedGenerationSql = input.expectedProposalGeneration === undefined
    ? ""
    : " AND proposal_generation = ?";
  const expectedGenerationValues = input.expectedProposalGeneration === undefined
    ? []
    : [input.expectedProposalGeneration];
  const statements = [
    atomicStatement(
      database,
      `UPDATE uploaded_files SET ${input.fileSetSql}
       WHERE id = ? AND deleted_at = '' AND review_status = ? AND updated_at = ?`,
      ...input.fileSetValues,
      input.fileId,
      input.processingAction,
      input.claimedAt,
    ),
    atomicStatement(
      database,
      `UPDATE file_reviews
       SET action = ?, note = ?, proposal_count = ?, claimed_at = '', lease_expires_at = ''
       WHERE id = ? AND file_id = ? AND action = ?`,
      input.completedAction,
      input.note,
      input.proposalCount,
      input.reservationId,
      input.fileId,
      input.processingAction,
    ),
    failedReviewInvariant(
      database,
      input.reservationId,
      `EXISTS (
         SELECT 1 FROM uploaded_files
         WHERE id = ? AND deleted_at = '' AND review_status = ? AND updated_at = ?${expectedGenerationSql}
       )`,
      input.fileId,
      input.expectedReviewStatus,
      input.expectedUpdatedAt,
      ...expectedGenerationValues,
    ),
    failedReviewInvariant(
      database,
      input.reservationId,
      "EXISTS (SELECT 1 FROM file_reviews WHERE id = ? AND file_id = ? AND action = ?)",
      input.reservationId,
      input.fileId,
      input.completedAction,
    ),
  ];
  try {
    await database.batch(statements);
  } catch (error) {
    // A Worker can lose the response after D1 has committed the batch. The
    // durable file + review state is authoritative, so do not roll it back.
    const db = getDb();
    const [[settledFile], [settledReview]] = await Promise.all([
      db.select().from(uploadedFiles).where(eq(uploadedFiles.id, input.fileId)).limit(1),
      db.select().from(fileReviews).where(eq(fileReviews.id, input.reservationId)).limit(1),
    ]);
    const generationMatches = input.expectedProposalGeneration === undefined ||
      settledFile?.proposalGeneration === input.expectedProposalGeneration;
    if (settledFile?.reviewStatus === input.expectedReviewStatus &&
        settledFile.updatedAt === input.expectedUpdatedAt &&
        generationMatches &&
        settledReview?.action === input.completedAction) {
      return;
    }
    throw error;
  }
}

function parseStoredValue(value: string | null) {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function findFile(fileId: string) {
  const [file] = await getDb().select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  return file;
}

function fileRequiresFinanceAccess(
  file: Pick<typeof uploadedFiles.$inferSelect, "area" | "documentType">,
) {
  return requiresFinanceAccessForDocument(file.area, file.documentType);
}

const REVIEW_ACTIONS = ["prepare", "approve", "observe", "reject", "reopen"] as const;
type ReviewAction = (typeof REVIEW_ACTIONS)[number];

function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === "string" && REVIEW_ACTIONS.some((action) => action === value);
}

function completedActionLabel(action: ReviewAction) {
  if (action === "prepare") return "preparado";
  if (action === "approve") return "aprobado";
  if (action === "observe") return "observado";
  if (action === "reject") return "rechazado";
  return "reabierto";
}

function processingActionLabel(action: ReviewAction) {
  return `procesando_${action}`;
}

async function cancelReviewReservation(input: {
  reservationId: number;
  processingAction: string;
  fileId: string;
  claimedAt?: string;
  previousReviewStatus?: string;
  previousUpdatedAt?: string;
}) {
  const db = getDb();
  const claimWasTaken = Boolean(input.claimedAt) &&
    input.previousReviewStatus !== undefined &&
    input.previousUpdatedAt !== undefined;
  let rollbackConfirmed = !claimWasTaken;
  if (claimWasTaken) {
    const claimedAt = input.claimedAt!;
    const previousReviewStatus = input.previousReviewStatus!;
    const previousUpdatedAt = input.previousUpdatedAt!;
    try {
      const [restoredFile] = await db.update(uploadedFiles).set({
        reviewStatus: previousReviewStatus,
        updatedAt: previousUpdatedAt,
      }).where(and(
        eq(uploadedFiles.id, input.fileId),
        eq(uploadedFiles.deletedAt, ""),
        eq(uploadedFiles.reviewStatus, input.processingAction),
        eq(uploadedFiles.updatedAt, claimedAt),
      )).returning({ id: uploadedFiles.id });
      rollbackConfirmed = Boolean(restoredFile);
    } catch {
      // Resolve a possible commit-then-throw. If this read also fails, retain
      // the reservation: it is the only durable handle for lease recovery.
    }
    if (!rollbackConfirmed) {
      try {
        const [authoritativeFile] = await db.select().from(uploadedFiles)
          .where(eq(uploadedFiles.id, input.fileId))
          .limit(1);
        rollbackConfirmed = authoritativeFile?.reviewStatus === previousReviewStatus &&
          authoritativeFile.updatedAt === previousUpdatedAt;
      } catch {
        rollbackConfirmed = false;
      }
    }
  }
  if (!reviewReservationMayBeDeleted({ claimWasTaken, rollbackConfirmed })) {
    return;
  }
  await db.delete(fileReviews).where(and(
    eq(fileReviews.id, input.reservationId),
    eq(fileReviews.action, input.processingAction),
  )).catch(() => undefined);
}

async function finalizeReviewReservation(input: {
  reservationId: number;
  processingAction: string;
  action: string;
  note: string;
  proposalCount: number;
  publicationRevision?: number | null;
}) {
  const [review] = await getDb().update(fileReviews).set({
    action: input.action,
    note: input.note,
    proposalCount: input.proposalCount,
    publicationRevision: input.publicationRevision ?? null,
    claimedAt: "",
    leaseExpiresAt: "",
  }).where(and(
    eq(fileReviews.id, input.reservationId),
    eq(fileReviews.action, input.processingAction),
  )).returning();
  if (!review) throw new Error("La reserva idempotente de la decisión ya no está disponible.");
  return review;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const fileId = new URL(request.url).searchParams.get("file")?.trim() ?? "";
  if (!fileId) return Response.json({ error: "Falta el identificador del archivo." }, { status: 400 });
  const file = await findFile(fileId);
  if (!file) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  if (fileRequiresFinanceAccess(file) && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes acceso a la revisión financiera o comercial." }, { status: 403 });
  }
  const db = getDb();
  const [proposals, reviews, activity, unmappedCandidates] = await Promise.all([
    db.select().from(documentDataProposals).where(and(
      eq(documentDataProposals.fileId, fileId),
      eq(documentDataProposals.generation, file.proposalGeneration),
    )).orderBy(documentDataProposals.key),
    db.select().from(fileReviews).where(eq(fileReviews.fileId, fileId)).orderBy(desc(fileReviews.id)).limit(20),
    db.select().from(fileActivity).where(eq(fileActivity.fileId, fileId)).orderBy(desc(fileActivity.id)).limit(30),
    db.select().from(unmappedFieldCandidates).where(eq(unmappedFieldCandidates.fileId, fileId))
      .orderBy(desc(unmappedFieldCandidates.createdAt)),
  ]);
  return Response.json({
    file: {
      id: file.id,
      originalName: file.originalName,
      area: file.area,
      areaLabel: areaLabels[file.area as keyof typeof areaLabels] ?? file.area,
      documentType: file.documentType,
      detectedPeriod: file.detectedPeriod,
      extractionMode: file.extractionMode,
      extractionConfidence: file.extractionConfidence,
      extractionSummary: file.extractionSummary,
      discrepancyCount: file.discrepancyCount,
      reviewStatus: file.reviewStatus,
      reviewNote: file.reviewNote,
      reviewedByName: file.reviewedByName,
      reviewedAt: file.reviewedAt,
      publicationRevision: file.publicationRevision,
      publishedAt: file.publishedAt,
      deletedAt: file.deletedAt,
      status: file.status,
      sourceCurrency: file.sourceCurrency,
      declaredCutoff: file.declaredCutoff,
      classificationReason: file.classificationReason,
      processingSummary: file.processingSummary,
      downloadUrl: `/api/files?download=${encodeURIComponent(file.id)}`,
    },
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      key: proposal.key,
      label: proposal.label,
      value: parseStoredValue(proposal.valueJson),
      previousValue: parseStoredValue(proposal.previousValueJson),
      valueType: proposal.valueType,
      area: proposal.area,
      sourceCurrency: proposal.sourceCurrency,
      cutoff: proposal.cutoff,
      confidence: proposal.confidence,
      discrepancy: proposal.discrepancy,
      status: proposal.status,
      notes: proposal.notes,
    })),
    reviews,
    activity,
    unmappedCandidates: unmappedCandidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      description: candidate.description,
      value: parseStoredValue(candidate.valueJson),
      suggestedArea: candidate.suggestedArea,
      suggestedAreaLabel: areaLabels[candidate.suggestedArea as keyof typeof areaLabels] ?? candidate.suggestedArea,
      evidence: candidate.evidence,
      confidence: candidate.confidence,
      status: candidate.status,
      reviewedByName: candidate.reviewedByName,
      reviewedAt: candidate.reviewedAt,
      reviewNote: candidate.reviewNote,
      createdAt: candidate.createdAt,
    })),
    permissions: {
      canReview: auth.user.role === "admin" && !file.deletedAt,
      canAccessFinance: auth.user.financeAccess,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;
  let payload: {
    action?: unknown;
    fileId?: string;
    requestKey?: string;
    note?: string;
    area?: string;
    cutoff?: string;
    documentType?: string;
    extractionSummary?: string;
    updates?: LiveDataUpdate[];
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La revisión no contiene un JSON válido." }, { status: 400 });
  }
  const fileId = String(payload.fileId ?? "").trim().slice(0, 80);
  if (!fileId || !isReviewAction(payload.action)) {
    return Response.json({ error: "Indica un archivo y una acción prepare, approve, observe, reject o reopen." }, { status: 400 });
  }
  const action = payload.action;
  let file = await findFile(fileId);
  if (!file) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  const db = getDb();
  if (fileRequiresFinanceAccess(file) && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes acceso a la revisión financiera o comercial." }, { status: 403 });
  }
  if (file.deletedAt) {
    return Response.json({ error: "El archivo está eliminado. Restáuralo antes de revisarlo." }, { status: 410 });
  }
  const rawRequestKey = String(payload.requestKey ?? "").trim();
  if (rawRequestKey.length > 100) {
    return Response.json({ error: "La clave idempotente supera 100 caracteres." }, { status: 400 });
  }
  const processingLabels = REVIEW_ACTIONS.map(processingActionLabel);
  await deleteExpiredReviewReservations(getD1JsonDatabase(), {
    fileId: file.id,
    processingActions: processingLabels,
    expiredAt: new Date().toISOString(),
    previousReviewStatus: file.reviewStatus,
    previousUpdatedAt: file.updatedAt,
  });
  if (file.reviewStatus.startsWith("procesando_")) {
    const [claim] = await db.select().from(fileReviews).where(and(
      eq(fileReviews.fileId, file.id),
      eq(fileReviews.action, file.reviewStatus),
    )).orderBy(desc(fileReviews.id)).limit(1);
    const leaseExpired = Boolean(claim?.leaseExpiresAt) &&
      Date.parse(claim!.leaseExpiresAt) <= Date.now();
    if (!claim || !leaseExpired) {
      const sameRequest = claim?.requestKey === rawRequestKey && rawRequestKey !== "";
      return Response.json({
        duplicate: sameRequest,
        processing: true,
        error: sameRequest
          ? "Esta decisión ya se está procesando."
          : "Otra decisión mantiene un lease activo sobre el expediente.",
      }, { status: 409 });
    }
    const [restoredFile] = await db.update(uploadedFiles).set({
      reviewStatus: claim.previousReviewStatus,
      updatedAt: claim.previousUpdatedAt,
    }).where(and(
      eq(uploadedFiles.id, file.id),
      eq(uploadedFiles.reviewStatus, claim.action),
      eq(uploadedFiles.updatedAt, claim.claimedAt),
    )).returning();
    if (restoredFile) {
      await db.delete(documentDataProposals).where(and(
        eq(documentDataProposals.fileId, file.id),
        eq(documentDataProposals.generation, claim.requestKey),
      ));
      await db.delete(fileReviews).where(and(
        eq(fileReviews.id, claim.id),
        eq(fileReviews.action, claim.action),
      ));
    }
    const refreshedFile = await findFile(file.id);
    if (!refreshedFile) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
    file = refreshedFile;
  }
  if (rawRequestKey) {
    const [existing] = await db.select().from(fileReviews)
      .where(eq(fileReviews.requestKey, rawRequestKey))
      .limit(1);
    if (existing) {
      const processingAction = processingActionLabel(action);
      const sameOperation = existing.fileId === file.id &&
        existing.actorEmail === auth.user.email &&
        (existing.action === processingAction || existing.action === completedActionLabel(action));
      if (!sameOperation) {
        return Response.json({ error: "La clave idempotente ya pertenece a otra decisión." }, { status: 409 });
      }
      if (existing.action !== processingAction) {
        return Response.json({ duplicate: true, review: existing, message: "Esta decisión ya estaba registrada." });
      }
      const finalStateReached =
        (action === "prepare" && file.reviewStatus === "listo_revision") ||
        (action === "approve" && file.reviewStatus === "aprobado") ||
        (action === "observe" && file.reviewStatus === "cambios_solicitados") ||
        (action === "reject" && file.reviewStatus === "rechazado") ||
        (action === "reopen" && file.reviewStatus === "pendiente_extraccion");
      if (finalStateReached && file.reviewStatus !== existing.previousReviewStatus) {
        const proposals = await db.select().from(documentDataProposals)
          .where(and(
            eq(documentDataProposals.fileId, file.id),
            eq(documentDataProposals.generation, file.proposalGeneration),
          ));
        if (action === "approve") {
          await db.update(documentDataProposals).set({
            status: "publicado",
            updatedAt: new Date().toISOString(),
          }).where(and(
            eq(documentDataProposals.fileId, file.id),
            eq(documentDataProposals.generation, file.proposalGeneration),
            eq(documentDataProposals.status, "pendiente"),
          ));
        }
        const review = await finalizeReviewReservation({
          reservationId: existing.id,
          processingAction,
          action: completedActionLabel(action),
          note: existing.note,
          proposalCount: proposals.length,
          publicationRevision: file.publicationRevision,
        });
        return Response.json({
          duplicate: true,
          recovered: true,
          review,
          publicationRevision: file.publicationRevision,
          message: "La decisión ya se había aplicado; su cierre auditable ha sido recuperado.",
        });
      }
      const orphanedReservation = Boolean(existing.leaseExpiresAt) &&
        Date.parse(existing.leaseExpiresAt) <= Date.now();
      if (orphanedReservation) {
        await db.delete(fileReviews).where(and(
          eq(fileReviews.id, existing.id),
          eq(fileReviews.action, processingAction),
        ));
      } else {
        return Response.json({ duplicate: true, processing: true, message: "Esta decisión ya se está procesando." }, { status: 409 });
      }
    }
  }
  const closed = file.reviewStatus === "aprobado" || file.reviewStatus === "rechazado";
  if (closed && action !== "reopen") {
    return Response.json({ error: "El expediente está cerrado. Reábrelo antes de registrar otra decisión." }, { status: 409 });
  }
  if (action === "reopen" && !closed) {
    return Response.json({ error: "Solo se puede reabrir un expediente aprobado o rechazado." }, { status: 409 });
  }
  if (action === "approve" && file.reviewStatus !== "listo_revision" && file.reviewStatus !== "cambios_solicitados") {
    return Response.json({ error: "Prepara primero la validación y confirma los cambios que se van a publicar." }, { status: 409 });
  }
  const note = String(payload.note ?? "").trim().slice(0, 1_000);
  if ((action === "observe" || action === "reject") && !note) {
    return Response.json({ error: "Escribe el motivo para conservar una decisión auditable." }, { status: 400 });
  }
  let preparePlan: null | {
    nextArea: string;
    nextDocumentType: string;
    nextFileProtected: boolean;
    normalized: ReturnType<typeof normalizeLiveDataUpdates>;
    previousByKey: Map<string, string>;
    discrepancyCount: number;
    extractionSummary: string;
  } = null;
  if (action === "prepare") {
    const requestedArea = String(payload.area ?? file.area);
    let nextArea = isUploadArea(requestedArea) && requestedArea !== "auto" && requestedArea !== "sin_clasificar"
      ? requestedArea
      : file.area;
    let nextDocumentType = String(payload.documentType ?? file.documentType).slice(0, 80);
    const irreversiblyProtected = file.documentType !== "clasificacion_pendiente" && fileRequiresFinanceAccess(file);
    if (irreversiblyProtected && !requiresFinanceAccessForDocument(nextArea, nextDocumentType)) {
      nextArea = file.area;
      nextDocumentType = file.documentType;
    }
    let normalized: ReturnType<typeof normalizeLiveDataUpdates> = [];
    if (Array.isArray(payload.updates) && payload.updates.length) {
      try {
        normalized = normalizeLiveDataUpdates({
          updates: payload.updates.map((update) => ({
            ...update,
            area: nextArea,
            cutoff: update.cutoff ?? payload.cutoff ?? file.detectedPeriod ?? file.declaredCutoff,
            sourceCurrency: update.sourceCurrency ?? (file.sourceCurrency === "USD" ? "USD" : "DOP"),
            sourceFileId: file.id,
            sourceName: file.originalName,
          })),
          area: nextArea,
          cutoff: String(payload.cutoff ?? file.detectedPeriod ?? file.declaredCutoff),
          sourceFileId: file.id,
          sourceName: file.originalName,
        });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Los cambios propuestos no son válidos." }, { status: 400 });
      }
    }
    const commercial = normalized.some((update) => isCommercialLiveKey(update.key));
    const financial = commercial || normalized.some((update) =>
      isFinancialLiveKey(update.key) || requiresFinanceAccessForArea(update.area));
    if (commercial) {
      nextArea = "comercial";
      nextDocumentType = "ventas_cobranza";
    } else if (financial) {
      nextArea = "finanzas";
      nextDocumentType = "estado_financiero";
    }
    const nextFileProtected = requiresFinanceAccessForDocument(nextArea, nextDocumentType);
    if (nextFileProtected && !auth.user.financeAccess) {
      return Response.json({ error: "No tienes permiso para preparar datos financieros o comerciales." }, { status: 403 });
    }
    if (nextFileProtected) normalized = normalized.map((update) => ({ ...update, area: nextArea }));
    const existingPoints = await selectLivePointValues(
      getD1JsonDatabase(),
      normalized.map((update) => update.key),
    );
    const previousByKey = new Map(existingPoints.map((point) => [point.key, point.valueJson]));
    const discrepancyCount = normalized.filter((update) => {
      const previous = previousByKey.get(update.key);
      return previous !== undefined && previous !== update.valueJson;
    }).length;
    const extractionSummary = String(payload.extractionSummary ?? (
      normalized.length
        ? `${normalized.length} cambios preparados; ${discrepancyCount} modifican un valor ya publicado.`
        : "Documento preparado para validación documental, sin cambios de datos propuestos."
    )).slice(0, 1_000);
    preparePlan = {
      nextArea,
      nextDocumentType,
      nextFileProtected,
      normalized,
      previousByKey,
      discrepancyCount,
      extractionSummary,
    };
  }

  // No se puede convertir en "sincronizado 100%" una cubicación que declaró
  // edificios pero no generó su avance. El reproceso correcto sustituirá este
  // resumen y entonces la aprobación normal volverá a estar disponible.
  if (
    action === "approve" &&
    /Falta el avance físico de TH-\d/i.test(file.processingSummary ?? "")
  ) {
    return Response.json({
      error: "La cubicación está incompleta: primero hay que reprocesar el avance de los edificios indicados.",
    }, { status: 409 });
  }

  const requestKey = rawRequestKey || crypto.randomUUID();
  const processingAction = processingActionLabel(action);
  const startedAt = new Date().toISOString();
  const claimedAt = startedAt;
  const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1_000).toISOString();
  const [reservation] = await db.insert(fileReviews).values({
    fileId: file.id,
    action: processingAction,
    note: note || preparePlan?.extractionSummary || "",
    proposalCount: preparePlan?.normalized.length ?? 0,
    requestKey,
    previousReviewStatus: file.reviewStatus,
    previousUpdatedAt: file.updatedAt,
    claimedAt,
    leaseExpiresAt,
    actorEmail: auth.user.email,
    actorName: auth.user.displayName,
    createdAt: startedAt,
  }).onConflictDoNothing({ target: fileReviews.requestKey }).returning();
  if (!reservation) {
    const [existing] = await db.select().from(fileReviews).where(eq(fileReviews.requestKey, requestKey)).limit(1);
    const sameOperation = existing?.fileId === file.id &&
      existing.actorEmail === auth.user.email &&
      (existing.action === processingAction || existing.action === completedActionLabel(action));
    if (!sameOperation) {
      return Response.json({ error: "La clave idempotente ya pertenece a otra decisión." }, { status: 409 });
    }
    if (existing.action === processingAction) {
      return Response.json({ duplicate: true, processing: true, message: "Esta decisión ya se está procesando." }, { status: 409 });
    }
    return Response.json({ duplicate: true, review: existing, message: "Esta decisión ya estaba registrada." });
  }

  const [claimedFile] = await db.update(uploadedFiles).set({
    reviewStatus: processingAction,
    updatedAt: claimedAt,
  }).where(and(
    eq(uploadedFiles.id, file.id),
    eq(uploadedFiles.deletedAt, ""),
    eq(uploadedFiles.reviewStatus, file.reviewStatus),
    eq(uploadedFiles.updatedAt, file.updatedAt),
  )).returning({ id: uploadedFiles.id });
  if (!claimedFile) {
    await cancelReviewReservation({
      reservationId: reservation.id,
      processingAction,
      fileId: file.id,
    });
    return Response.json({ error: "El expediente cambió mientras se tomaba la decisión; actualiza y reintenta." }, { status: 409 });
  }
  const cancel = () => cancelReviewReservation({
    reservationId: reservation.id,
    processingAction,
    fileId: file.id,
    claimedAt,
    previousReviewStatus: file.reviewStatus,
    previousUpdatedAt: file.updatedAt,
  });
  const decisionAt = new Date().toISOString();
  let committedState = false;
  let committedPublicationRevision: number | null = null;
  let committedProposalCount = preparePlan?.normalized.length ?? file.discrepancyCount;

  try {
    if (action === "prepare" && preparePlan) {
      await upsertDocumentProposalRows(
        getD1JsonDatabase(),
        preparePlan.normalized.map((update) => {
          const previousValueJson = preparePlan.previousByKey.get(update.key) ?? null;
          return {
            id: crypto.randomUUID(),
            fileId: file.id,
            generation: requestKey,
            key: update.key,
            label: update.key,
            valueJson: update.valueJson,
            previousValueJson,
            valueType: update.valueType,
            area: update.area,
            sourceCurrency: update.sourceCurrency,
            cutoff: update.cutoff,
            confidence: 1,
            discrepancy: previousValueJson !== null && previousValueJson !== update.valueJson,
            status: "pendiente",
            notes: note,
            createdByEmail: auth.user.email,
            createdByName: auth.user.displayName,
            updatedAt: decisionAt,
          };
        }),
      );
      const completedNote = note || preparePlan.extractionSummary;
      await commitReviewDecision({
        fileId: file.id,
        processingAction,
        claimedAt,
        fileSetSql: `area = ?, declared_cutoff = ?, detected_period = ?, document_type = ?,
          extraction_summary = ?, extraction_confidence = ?, discrepancy_count = ?,
          proposal_generation = ?, review_status = 'listo_revision', status = 'pendiente_revision',
          processing_stage = 'contraste', processing_progress = 75, processing_summary = ?,
          requires_review = 1, updated_at = ?`,
        fileSetValues: [
          preparePlan.nextArea,
          String(payload.cutoff ?? file.declaredCutoff).slice(0, 40),
          String(payload.cutoff ?? file.detectedPeriod).slice(0, 40),
          preparePlan.nextDocumentType,
          preparePlan.extractionSummary,
          preparePlan.normalized.length ? 1 : file.extractionConfidence,
          preparePlan.discrepancyCount,
          requestKey,
          preparePlan.extractionSummary,
          decisionAt,
        ],
        expectedReviewStatus: "listo_revision",
        expectedUpdatedAt: decisionAt,
        expectedProposalGeneration: requestKey,
        reservationId: reservation.id,
        completedAction: "preparado",
        note: completedNote,
        proposalCount: preparePlan.normalized.length,
      });
      committedState = true;
      committedProposalCount = preparePlan.normalized.length;
      const [review] = await db.select().from(fileReviews).where(and(
        eq(fileReviews.id, reservation.id),
        eq(fileReviews.action, "preparado"),
      )).limit(1);
      if (!review) throw new Error("El cierre auditable de la preparación no está disponible.");
      await db.delete(documentDataProposals).where(and(
        eq(documentDataProposals.fileId, file.id),
        ne(documentDataProposals.generation, requestKey),
      )).catch(() => undefined);
      await db.insert(fileActivity).values({
        fileId: file.id,
        eventType: "revision_preparada",
        message: preparePlan.extractionSummary,
        actorEmail: auth.user.email,
        actorName: auth.user.displayName,
        createdAt: decisionAt,
      }).catch(() => undefined);
      scheduleNotificationDispatch();
      return Response.json({
        review,
        proposalCount: preparePlan.normalized.length,
        discrepancyCount: preparePlan.discrepancyCount,
        message: "Revisión preparada para decisión final.",
      }, { status: 201 });
    }

    if (action === "approve") {
      const proposals = await db.select().from(documentDataProposals).where(and(
        eq(documentDataProposals.fileId, file.id),
        eq(documentDataProposals.generation, file.proposalGeneration),
        eq(documentDataProposals.status, "pendiente"),
      ));
      const normalized = proposals.map((proposal) => ({
        area: proposal.area,
        cutoff: proposal.cutoff,
        key: proposal.key,
        sourceCurrency: proposal.sourceCurrency === "USD" ? "USD" as const : "DOP" as const,
        sourceFileId: file.id,
        sourceName: file.originalName,
        valueJson: proposal.valueJson,
        valueType: proposal.valueType,
      }));
      let publicationRevision: number | null = null;
      let review: typeof fileReviews.$inferSelect | undefined;
      if (normalized.length) {
        const event = await publishLiveDataUpdates({
          normalized,
          actor: auth.user,
          area: file.area,
          cutoff: file.detectedPeriod || file.declaredCutoff,
          sourceFileId: file.id,
          sourceName: file.originalName,
          message: note || `${normalized.length} cambios aprobados desde la bandeja de validación.`,
          reviewClosure: {
            mode: "reservation",
            fileId: file.id,
            proposalGeneration: file.proposalGeneration,
            reservationId: reservation.id,
            processingAction,
            completedAction: "aprobado",
            note,
            proposalCount: proposals.length,
          },
        });
        publicationRevision = event.id;
        committedState = true;
        committedPublicationRevision = publicationRevision;
        committedProposalCount = proposals.length;
        [review] = await db.select().from(fileReviews).where(and(
          eq(fileReviews.id, reservation.id),
          eq(fileReviews.action, "aprobado"),
        )).limit(1);
      } else {
        await commitReviewDecision({
          fileId: file.id,
          processingAction,
          claimedAt,
          fileSetSql: `status = 'integrado', processing_stage = 'sincronizado', processing_progress = 100,
            processing_summary = ?, requires_review = 0, review_status = 'aprobado',
            reviewed_by_email = ?, reviewed_by_name = ?, reviewed_at = ?, review_note = ?,
            published_at = ?, updated_at = ?`,
          fileSetValues: [
            "Documento validado y catalogado; no modifica indicadores vivos.",
            auth.user.email,
            auth.user.displayName,
            decisionAt,
            note,
            decisionAt,
            decisionAt,
          ],
          expectedReviewStatus: "aprobado",
          expectedUpdatedAt: decisionAt,
          reservationId: reservation.id,
          completedAction: "aprobado",
          note,
          proposalCount: 0,
        });
        committedState = true;
        committedProposalCount = 0;
        [review] = await db.select().from(fileReviews).where(and(
          eq(fileReviews.id, reservation.id),
          eq(fileReviews.action, "aprobado"),
        )).limit(1);
        await db.insert(fileActivity).values({
          fileId: file.id,
          eventType: "documento_validado",
          message: "Documento validado y catalogado sin cambios de datos.",
          actorEmail: auth.user.email,
          actorName: auth.user.displayName,
          createdAt: decisionAt,
        }).catch(() => undefined);
      }
      if (!review) throw new Error("El cierre auditable de la aprobación no está disponible.");
      if (!proposals.length) scheduleNotificationDispatch();
      return Response.json({
        review,
        publicationRevision,
        message: proposals.length
          ? `${proposals.length} cambios aprobados y publicados en la revisión ${publicationRevision}.`
          : "Documento aprobado y catalogado sin alterar indicadores.",
      }, { status: 201 });
    }

    const rejected = action === "reject";
    const reopened = action === "reopen";
    const actionLabel = completedActionLabel(action);
    const nextReviewStatus = reopened ? "pendiente_extraccion" : rejected ? "rechazado" : "cambios_solicitados";
    await commitReviewDecision({
      fileId: file.id,
      processingAction,
      claimedAt,
      fileSetSql: `status = ?, processing_stage = ?, processing_progress = ?, processing_summary = ?,
        requires_review = ?, review_status = ?, reviewed_by_email = ?, reviewed_by_name = ?,
        reviewed_at = ?, review_note = ?, updated_at = ?`,
      fileSetValues: [
        reopened ? "pendiente_revision" : rejected ? "rechazado" : "observado",
        reopened ? (file.discrepancyCount ? "contraste" : "clasificado") : "observado",
        reopened ? (file.discrepancyCount ? 75 : 35) : rejected ? 100 : 80,
        reopened ? "Revisión reabierta para nueva extracción o contraste." : note,
        reopened || !rejected ? 1 : 0,
        nextReviewStatus,
        auth.user.email,
        auth.user.displayName,
        decisionAt,
        note,
        decisionAt,
      ],
      expectedReviewStatus: nextReviewStatus,
      expectedUpdatedAt: decisionAt,
      reservationId: reservation.id,
      completedAction: actionLabel,
      note,
      proposalCount: file.discrepancyCount,
    });
    committedState = true;
    committedProposalCount = file.discrepancyCount;
    const [review] = await db.select().from(fileReviews).where(and(
      eq(fileReviews.id, reservation.id),
      eq(fileReviews.action, actionLabel),
    )).limit(1);
    if (!review) throw new Error("El cierre auditable de la decisión no está disponible.");
    await db.insert(fileActivity).values({
      fileId: file.id,
      eventType: `documento_${actionLabel}`,
      message: note || "La revisión vuelve a estar abierta.",
      actorEmail: auth.user.email,
      actorName: auth.user.displayName,
      createdAt: decisionAt,
    }).catch(() => undefined);
    scheduleNotificationDispatch();
    return Response.json({ review, message: `Documento ${actionLabel}; la decisión queda en el historial.` }, { status: 201 });
  } catch (error) {
    // An invisible staged generation is intentionally retained when the
    // atomic commit outcome is unknown. A later successful preparation removes
    // obsolete generations; deleting here could erase an active generation
    // after D1 committed but the Worker lost both the response and verify read.
    if (committedState) {
      try {
        const [completedReview] = await db.select().from(fileReviews).where(and(
          eq(fileReviews.id, reservation.id),
          eq(fileReviews.action, completedActionLabel(action)),
        )).limit(1);
        if (completedReview) {
          return Response.json({
            recovered: true,
            review: completedReview,
            publicationRevision: committedPublicationRevision ?? completedReview.publicationRevision,
            message: "La decisión ya estaba aplicada y su cierre auditable permanece íntegro.",
          }, { status: 201 });
        }
        if (action === "approve") {
          await db.update(documentDataProposals).set({
            status: "publicado",
            updatedAt: new Date().toISOString(),
          }).where(and(
            eq(documentDataProposals.fileId, file.id),
            eq(documentDataProposals.generation, file.proposalGeneration),
            eq(documentDataProposals.status, "pendiente"),
          ));
        }
        const review = await finalizeReviewReservation({
          reservationId: reservation.id,
          processingAction,
          action: completedActionLabel(action),
          note: reservation.note,
          proposalCount: committedProposalCount,
          publicationRevision: committedPublicationRevision,
        });
        scheduleNotificationDispatch();
        return Response.json({
          recovered: true,
          review,
          publicationRevision: committedPublicationRevision,
          message: "La decisión se aplicó y su cierre auditable se recuperó de forma idempotente.",
        }, { status: 201 });
      } catch {
        // Preserve the processing reservation. Replaying the same requestKey
        // completes the audit without reapplying or republishing the decision.
        return Response.json({
          error: "La decisión ya se aplicó, pero su cierre auditable sigue pendiente. Reintenta con la misma clave idempotente.",
        }, { status: 503 });
      }
    }
    await cancel();
    const message = error instanceof Error ? error.message : "La decisión no pudo completarse.";
    return Response.json({
      error: message.replace(/^CONFLICT:\s*/, ""),
    }, { status: message.startsWith("CONFLICT:") ? 409 : 500 });
  }
}
