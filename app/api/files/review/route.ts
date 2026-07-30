import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  documentDataProposals,
  fileActivity,
  fileReviews,
  liveDataPoints,
  uploadedFiles,
} from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { areaLabels, isUploadArea } from "../../../../lib/file-routing";
import { LiveDataUpdate, isFinancialLiveKey } from "../../../../lib/live-data";
import {
  normalizeLiveDataUpdates,
  publishLiveDataUpdates,
} from "../../../../lib/publish-live-data";

export const runtime = "edge";

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

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const fileId = new URL(request.url).searchParams.get("file")?.trim() ?? "";
  if (!fileId) return Response.json({ error: "Falta el identificador del archivo." }, { status: 400 });
  const file = await findFile(fileId);
  if (!file) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  if (file.area === "finanzas" && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes acceso a la revisión financiera." }, { status: 403 });
  }
  const db = getDb();
  const [proposals, reviews, activity] = await Promise.all([
    db.select().from(documentDataProposals).where(eq(documentDataProposals.fileId, fileId)).orderBy(documentDataProposals.key),
    db.select().from(fileReviews).where(eq(fileReviews.fileId, fileId)).orderBy(desc(fileReviews.id)).limit(20),
    db.select().from(fileActivity).where(eq(fileActivity.fileId, fileId)).orderBy(desc(fileActivity.id)).limit(30),
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
    permissions: {
      canReview: auth.user.role === "admin",
      canAccessFinance: auth.user.financeAccess,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;
  let payload: {
    action?: "prepare" | "approve" | "observe" | "reject" | "reopen";
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
  const fileId = String(payload.fileId ?? "").trim();
  const action = payload.action;
  if (!fileId || !action) return Response.json({ error: "Indica archivo y acción de revisión." }, { status: 400 });
  const file = await findFile(fileId);
  if (!file) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  if (file.area === "finanzas" && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes acceso a la revisión financiera." }, { status: 403 });
  }
  const db = getDb();
  const requestKey = String(payload.requestKey ?? crypto.randomUUID()).slice(0, 100);
  const [existingReview] = await db.select().from(fileReviews).where(eq(fileReviews.requestKey, requestKey)).limit(1);
  if (existingReview) {
    return Response.json({ duplicate: true, review: existingReview, message: "Esta decisión ya estaba registrada." });
  }
  const now = new Date().toISOString();
  const note = String(payload.note ?? "").trim().slice(0, 1000);
  if ((file.reviewStatus === "aprobado" || file.reviewStatus === "rechazado") && action !== "reopen") {
    return Response.json({ error: "El expediente está cerrado. Reábrelo antes de registrar otra decisión." }, { status: 409 });
  }
  if (action === "approve" && file.reviewStatus !== "listo_revision" && file.reviewStatus !== "cambios_solicitados") {
    return Response.json({ error: "Prepara primero la validación y confirma los cambios que se van a publicar." }, { status: 409 });
  }

  if (action === "prepare") {
    const requestedArea = String(payload.area ?? file.area);
    const nextArea = isUploadArea(requestedArea) && requestedArea !== "auto" && requestedArea !== "sin_clasificar"
      ? requestedArea
      : file.area;
    if (nextArea === "finanzas" && !auth.user.financeAccess) {
      return Response.json({ error: "No tienes permiso para preparar datos financieros." }, { status: 403 });
    }
    let normalized = [] as ReturnType<typeof normalizeLiveDataUpdates>;
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
      if (normalized.some((update) => isFinancialLiveKey(update.key)) && !auth.user.financeAccess) {
        return Response.json({ error: "No tienes permiso para preparar datos financieros." }, { status: 403 });
      }
    }
    await db.delete(documentDataProposals).where(eq(documentDataProposals.fileId, file.id));
    const existingPoints = normalized.length
      ? await db.select().from(liveDataPoints).where(inArray(liveDataPoints.key, normalized.map((update) => update.key)))
      : [];
    const previousByKey = new Map(existingPoints.map((point) => [point.key, point.valueJson]));
    let discrepancyCount = 0;
    for (const update of normalized) {
      const previousValueJson = previousByKey.get(update.key) ?? null;
      const discrepancy = previousValueJson !== null && previousValueJson !== update.valueJson;
      if (discrepancy) discrepancyCount += 1;
      await db.insert(documentDataProposals).values({
        id: crypto.randomUUID(),
        fileId: file.id,
        key: update.key,
        label: update.key,
        valueJson: update.valueJson,
        previousValueJson,
        valueType: update.valueType,
        area: update.area,
        sourceCurrency: update.sourceCurrency,
        cutoff: update.cutoff,
        confidence: 1,
        discrepancy,
        status: "pendiente",
        notes: note,
        createdByEmail: auth.user.email,
        createdByName: auth.user.displayName,
        updatedAt: now,
      });
    }
    const extractionSummary = String(
      payload.extractionSummary ??
      (normalized.length
        ? `${normalized.length} cambios preparados; ${discrepancyCount} modifican un valor ya publicado.`
        : "Documento preparado para validación documental, sin cambios de datos propuestos."),
    ).slice(0, 1000);
    await db.update(uploadedFiles).set({
      area: nextArea,
      declaredCutoff: String(payload.cutoff ?? file.declaredCutoff).slice(0, 40),
      detectedPeriod: String(payload.cutoff ?? file.detectedPeriod).slice(0, 40),
      documentType: String(payload.documentType ?? file.documentType).slice(0, 80),
      extractionSummary,
      extractionConfidence: normalized.length ? 1 : file.extractionConfidence,
      discrepancyCount,
      reviewStatus: "listo_revision",
      status: "pendiente_revision",
      processingStage: "contraste",
      processingProgress: 75,
      processingSummary: extractionSummary,
      requiresReview: true,
      updatedAt: now,
    }).where(eq(uploadedFiles.id, file.id));
    const [review] = await db.insert(fileReviews).values({
      fileId: file.id,
      action: "preparado",
      note: note || extractionSummary,
      proposalCount: normalized.length,
      requestKey,
      actorEmail: auth.user.email,
      actorName: auth.user.displayName,
      createdAt: now,
    }).returning();
    await db.insert(fileActivity).values({
      fileId: file.id,
      eventType: "revision_preparada",
      message: extractionSummary,
      actorEmail: auth.user.email,
      actorName: auth.user.displayName,
      createdAt: now,
    });
    return Response.json({ review, proposalCount: normalized.length, discrepancyCount, message: "Revisión preparada para decisión final." }, { status: 201 });
  }

  if (action === "approve") {
    const proposals = await db
      .select()
      .from(documentDataProposals)
      .where(and(eq(documentDataProposals.fileId, file.id), eq(documentDataProposals.status, "pendiente")));
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
    if (normalized.length) {
      const event = await publishLiveDataUpdates({
        normalized,
        actor: auth.user,
        area: file.area,
        cutoff: file.detectedPeriod || file.declaredCutoff,
        sourceFileId: file.id,
        sourceName: file.originalName,
        message: note || `${normalized.length} cambios aprobados desde la bandeja de validación.`,
      });
      publicationRevision = event.id;
      await db.update(documentDataProposals).set({ status: "publicado", updatedAt: now }).where(eq(documentDataProposals.fileId, file.id));
    } else {
      await db.update(uploadedFiles).set({
        status: "integrado",
        processingStage: "sincronizado",
        processingProgress: 100,
        processingSummary: "Documento validado y catalogado; no modifica indicadores vivos.",
        requiresReview: false,
        reviewStatus: "aprobado",
        reviewedByEmail: auth.user.email,
        reviewedByName: auth.user.displayName,
        reviewedAt: now,
        reviewNote: note,
        publishedAt: now,
        updatedAt: now,
      }).where(eq(uploadedFiles.id, file.id));
      await db.insert(fileActivity).values({
        fileId: file.id,
        eventType: "documento_validado",
        message: "Documento validado y catalogado sin cambios de datos.",
        actorEmail: auth.user.email,
        actorName: auth.user.displayName,
        createdAt: now,
      });
    }
    await db.update(uploadedFiles).set({
      reviewStatus: "aprobado",
      reviewedByEmail: auth.user.email,
      reviewedByName: auth.user.displayName,
      reviewedAt: now,
      reviewNote: note,
      publicationRevision,
      publishedAt: now,
      updatedAt: now,
    }).where(eq(uploadedFiles.id, file.id));
    const [review] = await db.insert(fileReviews).values({
      fileId: file.id,
      action: "aprobado",
      note,
      proposalCount: proposals.length,
      publicationRevision,
      requestKey,
      actorEmail: auth.user.email,
      actorName: auth.user.displayName,
      createdAt: now,
    }).returning();
    return Response.json({
      review,
      publicationRevision,
      message: proposals.length
        ? `${proposals.length} cambios aprobados y publicados en la revisión ${publicationRevision}.`
        : "Documento aprobado y catalogado sin alterar indicadores.",
    }, { status: 201 });
  }

  if ((action === "observe" || action === "reject") && !note) {
    return Response.json({ error: "Escribe el motivo para conservar una decisión auditable." }, { status: 400 });
  }
  const rejected = action === "reject";
  const reopened = action === "reopen";
  await db.update(uploadedFiles).set({
    status: reopened ? "pendiente_revision" : rejected ? "rechazado" : "observado",
    processingStage: reopened ? (file.discrepancyCount ? "contraste" : "clasificado") : "observado",
    processingProgress: reopened ? (file.discrepancyCount ? 75 : 35) : rejected ? 100 : 80,
    processingSummary: reopened ? "Revisión reabierta para nueva extracción o contraste." : note,
    requiresReview: reopened || !rejected,
    reviewStatus: reopened ? "pendiente_extraccion" : rejected ? "rechazado" : "cambios_solicitados",
    reviewedByEmail: auth.user.email,
    reviewedByName: auth.user.displayName,
    reviewedAt: now,
    reviewNote: note,
    updatedAt: now,
  }).where(eq(uploadedFiles.id, file.id));
  const actionLabel = reopened ? "reabierto" : rejected ? "rechazado" : "observado";
  const [review] = await db.insert(fileReviews).values({
    fileId: file.id,
    action: actionLabel,
    note,
    proposalCount: file.discrepancyCount,
    requestKey,
    actorEmail: auth.user.email,
    actorName: auth.user.displayName,
    createdAt: now,
  }).returning();
  await db.insert(fileActivity).values({
    fileId: file.id,
    eventType: `documento_${actionLabel}`,
    message: note || "La revisión vuelve a estar abierta.",
    actorEmail: auth.user.email,
    actorName: auth.user.displayName,
    createdAt: now,
  });
  return Response.json({ review, message: `Documento ${actionLabel}; la decisión queda en el historial.` }, { status: 201 });
}
