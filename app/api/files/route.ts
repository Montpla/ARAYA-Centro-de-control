import { env } from "cloudflare:workers";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../../../db";
import {
  documentDataProposals,
  documentTemplates,
  fileActivity,
  ingestionAgentRuns,
  uploadedFiles,
  unmappedFieldCandidates,
} from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { resolveSourceCurrency } from "../../../lib/currency";
import {
  canonicalizeFinancialUpdates,
  numericBeforeAfter,
  validateFinancialPublication,
  type FinancialValidationResult,
} from "../../../lib/financial-governance";
import {
  areaLabels,
  classifyUpload,
  inferUploadAreaFromContent,
  isUploadArea,
  safeFileName,
  uploadAreas,
} from "../../../lib/file-routing";
import { analyzeDocument, archiveDocumentsForAI, extractStructuredUpdates } from "../../../lib/ingestion";
import { CURRENT_INGESTION_VERSION } from "../../../lib/ingestion-version";
import {
  buildDynamicSectionBlock,
  documentTemplateFingerprint,
  reconcileIngestionUpdates,
  templateMappingFromUpdates,
} from "../../../lib/ingestion-agent";
import {
  partitionChangedLiveUpdates,
  planDynamicSectionSlots,
  resolveNormalizedUpdateConfidences,
} from "../../../lib/ingestion-change-set";
import {
  canAutomaticallyPublishExtraction,
  extractDocumentWithAI,
  INGESTION_ESCALATION_MODEL,
  INGESTION_PRIMARY_MODEL,
  shouldEscalateDocumentExtraction,
} from "../../../lib/ai-document-extraction";
import { getAiUsageSnapshot } from "../../../lib/ai-usage";
import {
  financeProtectedAreaValues,
  financeProtectedDocumentTypeValues,
  isCommercialLiveKey,
  isFinancialLiveKey,
  materializeLiveRoot,
  namingToken,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "../../../lib/live-data";
import { urbanismReportAreas } from "../../../app/june-report-data";
import { cubicacionCaratula } from "../../../app/demo-data";
import {
  decodeFileRegistryCursor,
  encodeFileRegistryCursor,
  latestFileRegistryCursor,
  normalizeFilePageSize,
} from "../../../lib/file-registry-pagination";
import { scheduleNotificationDispatch } from "../../../lib/notification-dispatch";
import { emitMissingNotifications } from "../../../lib/notifications";
import {
  D1JsonDatabase,
  selectLivePointValues,
  upsertDocumentProposalRows,
} from "../../../lib/d1-json-bulk";
import { assertLiveDataContracts, getContractRootsSnapshot, validateLiveDataContract } from "../../../lib/live-data-contract";
import { normalizeLiveDataUpdates, publishLiveDataUpdates } from "../../../lib/publish-live-data";
import { publicationKeyConflict } from "../../../lib/live-data-publication-recovery";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { resolveSpatialIdentityUpdates } from "../../../lib/spatial-identity-upsert";
import { nothingExtractedMessage } from "../../../lib/upload-messages";
import { triggerMppConversion } from "../../../lib/mpp-conversion-trigger";
import { triggerDeferredUploadRetry } from "../../../lib/deferred-upload-retry-trigger";
import { readUploadAgentToken, resolveUploadAgentToken } from "../../../lib/upload-agent-auth";
import {
  proposalPointerWasCommitted,
  stagedGenerationMayBeDeleted,
  uploadInsertWasCommitted,
} from "../../../lib/upload-commit-recovery";

export const runtime = "edge";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const PROVISIONAL_DOCUMENT_TYPE = "clasificacion_pendiente";
const EXTRACTION_LEASE_MS = 5 * 60 * 1_000;
const BACKGROUND_PROCESSING_HEADER = "x-araya-background-processing";
const BACKGROUND_PROCESSING_ATTEMPTS = 3;
const allowedExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "dwg",
  "jpeg",
  "jpg",
  "json",
  "mpp",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "xml",
  "zip",
]);
const inlinePreviewExtensions = new Set([
  "csv",
  "jpeg",
  "jpg",
  "json",
  "pdf",
  "png",
]);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function backgroundUploadForm(
  source: FormData,
  bytes: ArrayBuffer,
  fileName: string,
  mimeType: string,
) {
  const next = new FormData();
  for (const [key, value] of source.entries()) {
    if (key !== "file" && typeof value === "string") next.append(key, value);
  }
  next.set("file", new File([bytes], fileName, { type: mimeType }));
  next.set("processNow", "true");
  return next;
}

function scheduleBackgroundUploadProcessing(input: {
  request: Request;
  formData: FormData;
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileId: string;
  uploaderEmail: string;
  uploaderName: string;
}) {
  const task = (async () => {
    const db = getDb();
    let lastError = "";
    for (let attempt = 1; attempt <= BACKGROUND_PROCESSING_ATTEMPTS; attempt += 1) {
      const attemptAt = new Date().toISOString();
      await db.update(uploadedFiles).set({
        processingAttempts: attempt,
        nextRetryAt: "",
        lastProcessingError: "",
        updatedAt: attemptAt,
      }).where(eq(uploadedFiles.id, input.fileId)).catch(() => undefined);
      try {
        const headers = new Headers({ [BACKGROUND_PROCESSING_HEADER]: "1" });
        for (const name of ["cookie", "authorization"]) {
          const value = input.request.headers.get(name);
          if (value) headers.set(name, value);
        }
        const response = await POST(new Request(input.request.url, {
          method: "POST",
          headers,
          body: backgroundUploadForm(input.formData, input.bytes, input.fileName, input.mimeType),
        }));
        const payload = await response.clone().json().catch(() => ({})) as {
          error?: string;
          receipt?: { outcome?: string };
        };
        const observed = payload.receipt?.outcome === "observed";
        if (response.ok && !observed) {
          await db.update(uploadedFiles).set({
            nextRetryAt: "",
            lastProcessingError: "",
            updatedAt: new Date().toISOString(),
          }).where(eq(uploadedFiles.id, input.fileId)).catch(() => undefined);
          return;
        }
        lastError = payload.error || (observed ? "El intento terminó observado." : `Respuesta ${response.status}.`);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Fallo técnico de procesamiento.";
      }
      if (attempt < BACKGROUND_PROCESSING_ATTEMPTS) {
        const retryAt = new Date(Date.now() + (attempt === 1 ? 500 : 1_500)).toISOString();
        await db.update(uploadedFiles).set({
          nextRetryAt: retryAt,
          lastProcessingError: lastError.slice(0, 300),
          processingSummary: `Reintento automático ${attempt + 1} de ${BACKGROUND_PROCESSING_ATTEMPTS} programado.`,
          updatedAt: new Date().toISOString(),
        }).where(eq(uploadedFiles.id, input.fileId)).catch(() => undefined);
        await wait(attempt === 1 ? 500 : 1_500);
      }
    }
    await db.update(uploadedFiles).set({
      nextRetryAt: "",
      lastProcessingError: lastError.slice(0, 300),
      processingSummary: "El original está protegido. Los intentos automáticos terminaron y el equipo validador ha recibido el diagnóstico.",
      updatedAt: new Date().toISOString(),
    }).where(eq(uploadedFiles.id, input.fileId)).catch(() => undefined);
    await notifyUploaderOfProcessingResult({
      fileId: input.fileId,
      uploaderEmail: input.uploaderEmail,
      uploaderName: input.uploaderName,
      updatedAt: new Date().toISOString(),
      outcome: "attention",
    });
    scheduleNotificationDispatch();
  })();
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  else void task;
}

async function notifyUploaderOfProcessingResult(input: {
  fileId: string;
  uploaderEmail: string;
  uploaderName: string;
  updatedAt: string;
  outcome: "completed" | "attention";
}) {
  const completed = input.outcome === "completed";
  await emitMissingNotifications([{
    kind: completed ? "own_upload_completed" : "own_upload_attention",
    area: "direccion",
    audience: `user:${input.uploaderEmail}`,
    actorEmail: input.uploaderEmail,
    actorName: input.uploaderName,
    subjectType: "uploaded_file_result",
    subjectId: `${input.fileId}:${input.updatedAt}`,
    title: completed ? "Tu archivo ha terminado de procesarse" : "Tu archivo necesita una comprobación",
    body: completed
      ? "El expediente está sincronizado. Si contiene Finanzas, sus cifras siguen visibles únicamente para personas autorizadas."
      : "El original está protegido y no debes volver a subirlo. El equipo validador tiene disponible el diagnóstico.",
    view: "fuentes",
    payload: { fileId: input.fileId, outcome: input.outcome },
  }]).catch(() => undefined);
  scheduleNotificationDispatch();
}
const canonicalMimeByExtension: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dwg: "image/vnd.dwg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  mpp: "application/vnd.ms-project",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
};

type StoredObject = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type FileBucket = {
  put: (
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
  get: (
    key: string,
    options?: { range?: { offset: number; length: number } },
  ) => Promise<StoredObject | null>;
  delete: (key: string) => Promise<void>;
};

function getFileBucket() {
  const bucket = (env as unknown as { FILES?: FileBucket }).FILES;
  if (!bucket) {
    throw new Error("La vinculación R2 `FILES` no está disponible.");
  }
  return bucket;
}

function getD1JsonDatabase() {
  const database = (env as unknown as { DB?: D1JsonDatabase }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  return database;
}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function hexDigest(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asciiFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180) || "documento";
}

function parseByteRange(value: string | null, size: number) {
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return "invalid" as const;
  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return "invalid" as const;
  let start: number;
  let end: number;
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid" as const;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return "invalid" as const;
  }
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, start, end };
}

function isSafeLiveValue(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (value === null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 10_000;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) {
    return value.length <= 1_000 && value.every((item) => isSafeLiveValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length <= 500 && entries.every(([key, item]) =>
      !["__proto__", "constructor", "prototype"].includes(key) &&
      /^[A-Za-z][A-Za-z0-9_ -]{0,127}$/.test(key) &&
      isSafeLiveValue(item, depth + 1));
  }
  return false;
}

// Códigos de los edificios que existen ahora mismo, en la forma normalizada con
// la que se comparan los nombres. Se derivan del modelo de partida en vez de
// escribirse a mano para que un edificio nuevo entre solo.
function knownBuildingTokens() {
  const roots = getContractRootsSnapshot();
  const lista = Array.isArray(roots.buildings) ? roots.buildings : [];
  const tokens = new Set<string>();
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    for (const campo of ["shortName", "id", "code"]) {
      const valor = record[campo];
      if (typeof valor === "string" && valor) tokens.add(namingToken(valor));
    }
  }
  return tokens;
}

function isSafeAutomaticStructuredUpdate(update: ReturnType<typeof normalizeLiveDataUpdates>[number]) {
  const path = update.key.split(".");
  if (path.length < 1 || path.length > 8 || !update.cutoff.trim()) return false;
  if (path.some((segment) => /^\d+$/.test(segment) && Number(segment) > 500)) return false;
  try {
    const value = JSON.parse(update.valueJson) as unknown;
    return isSafeLiveValue(value);
  } catch {
    return false;
  }
}

function automaticContractIsSafe(
  updates: ReturnType<typeof normalizeLiveDataUpdates>,
  currentValues: Awaited<ReturnType<typeof readEffectiveLiveData>>["values"],
) {
  try {
    assertLiveDataContracts(updates, currentValues);
    return true;
  } catch {
    return false;
  }
}

// Un solo campo huérfano dentro de un lote (p. ej. una propuesta con una clave
// que el modelo no reconoce) no debe arrastrar al resto: se valida cada
// actualización por separado, así las que sí encajan en el contrato se
// publican solas y solo la que falla se queda pendiente de revisión.
function individualUpdateContractIsSafe(
  update: ReturnType<typeof normalizeLiveDataUpdates>[number],
  currentValues: Awaited<ReturnType<typeof readEffectiveLiveData>>["values"],
) {
  try {
    return validateLiveDataContract(update.key, update.valueJson, currentValues).valid;
  } catch {
    return false;
  }
}

function parseProcessingReceipt(value: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function publicFileRow(
  row: typeof uploadedFiles.$inferSelect,
  user?: { email: string; role: string; financeAccess?: boolean },
) {
  const isOwnUpload = Boolean(user && user.email === row.uploaderEmail);
  const statusOnly = Boolean(
    user && !user.financeAccess && fileRequiresFinanceAccess(row) && isOwnUpload,
  );
  return {
    id: row.id,
    originalName: row.originalName,
    area: row.area,
    areaLabel: areaLabels[row.area as keyof typeof areaLabels] ?? row.area,
    section: row.section,
    description: statusOnly ? "" : row.description,
    mimeType: row.mimeType,
    extension: row.extension,
    sizeBytes: row.sizeBytes,
    source: row.source,
    sourceCurrency: row.sourceCurrency,
    status: row.status,
    uploaderName: row.uploaderName,
    version: row.version,
    declaredCutoff: row.declaredCutoff,
    classificationConfidence: row.classificationConfidence,
    classificationReason: statusOnly ? "Clasificado en el buzón financiero protegido." : row.classificationReason,
    processingStage: row.processingStage,
    processingProgress: row.processingProgress,
    processingSummary: statusOnly
      ? row.processingProgress >= 100
        ? "La entrega ha terminado de procesarse. Las cifras permanecen protegidas."
        : "La entrega se está procesando en el buzón financiero protegido."
      : row.processingSummary,
    processingReceipt: statusOnly ? null : parseProcessingReceipt(row.processingReceiptJson),
    processingAttempts: row.processingAttempts,
    nextRetryAt: row.nextRetryAt,
    lastProcessingError: statusOnly ? "" : row.lastProcessingError,
    requiresReview: row.requiresReview,
    projectId: row.projectId,
    documentType: row.documentType,
    detectedPeriod: row.detectedPeriod,
    extractionMode: row.extractionMode,
    extractionConfidence: row.extractionConfidence,
    extractionSummary: statusOnly ? "" : row.extractionSummary,
    discrepancyCount: row.discrepancyCount,
    ingestionVersion: row.ingestionVersion,
    processedAt: row.processedAt,
    derivedFromFileId: row.derivedFromFileId,
    automationKind: row.automationKind,
    reviewStatus: row.reviewStatus,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt,
    reviewNote: statusOnly ? "" : row.reviewNote,
    publicationRevision: row.publicationRevision,
    publishedAt: row.publishedAt,
    deletedAt: row.deletedAt,
    deletedByName: row.deletedByName,
    deleteReason: row.deleteReason,
    restoredAt: row.restoredAt,
    supersededByFileId: row.supersededByFileId,
    supersededAt: row.supersededAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canManage: Boolean(user && (user.role === "admin" || user.email === row.uploaderEmail)),
    isOwnUpload,
    statusOnly,
    downloadUrl: statusOnly ? "" : `/api/files?download=${encodeURIComponent(row.id)}`,
  };
}

async function authenticatedUser() {
  const auth = await requireApiUser();
  return { response: auth.response, user: auth.user };
}

function fileRequiresFinanceAccess(
  row: Pick<typeof uploadedFiles.$inferSelect, "area" | "documentType">,
) {
  return requiresFinanceAccessForDocument(row.area, row.documentType);
}

type FileRegistryUser = NonNullable<Awaited<ReturnType<typeof requireApiUser>>["user"]>;

function fileRegistryVisibilityCondition(
  user: FileRegistryUser,
  includeDeleted: boolean,
) {
  const financeCondition = user.financeAccess
    ? sql`1 = 1`
    : or(
        and(
          notInArray(uploadedFiles.area, financeProtectedAreaValues()),
          notInArray(uploadedFiles.documentType, financeProtectedDocumentTypeValues()),
        ),
        eq(uploadedFiles.uploaderEmail, user.email),
      );
  const deletedCondition = !includeDeleted
    ? and(
        eq(uploadedFiles.deletedAt, ""),
        eq(uploadedFiles.supersededByFileId, ""),
      )
    : user.role === "admin"
      ? sql`1 = 1`
      : or(
          eq(uploadedFiles.deletedAt, ""),
          eq(uploadedFiles.uploaderEmail, user.email),
        );
  return and(financeCondition, deletedCondition);
}

function fileRegistryRowVisible(
  row: Pick<typeof uploadedFiles.$inferSelect, "area" | "documentType" | "deletedAt" | "uploaderEmail" | "supersededByFileId">,
  user: FileRegistryUser,
  includeDeleted: boolean,
) {
  if (!user.financeAccess && fileRequiresFinanceAccess(row) && row.uploaderEmail !== user.email) return false;
  if (!row.deletedAt && (!row.supersededByFileId || includeDeleted)) return true;
  return includeDeleted && (user.role === "admin" || row.uploaderEmail === user.email);
}

async function fileRegistrySummary(user: FileRegistryUser, includeDeleted: boolean) {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' then 1 else 0 end), 0)`,
      deleted: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} <> '' then 1 else 0 end), 0)`,
      pendingReview: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' and ${uploadedFiles.requiresReview} = 1 then 1 else 0 end), 0)`,
      synchronized: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' and ${uploadedFiles.processingProgress} >= 100 then 1 else 0 end), 0)`,
      observed: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' and ${uploadedFiles.status} in ('observado', 'rechazado') then 1 else 0 end), 0)`,
      averageProgress: sql<number>`coalesce(round(avg(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' then ${uploadedFiles.processingProgress} end)), 0)`,
      discrepancies: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' then ${uploadedFiles.discrepancyCount} else 0 end), 0)`,
      lastUploadAt: sql<string>`coalesce(max(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.supersededByFileId} = '' then ${uploadedFiles.createdAt} end), '')`,
    })
    .from(uploadedFiles)
    .where(fileRegistryVisibilityCondition(user, includeDeleted));
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    deleted: Number(row?.deleted ?? 0),
    pendingReview: Number(row?.pendingReview ?? 0),
    synchronized: Number(row?.synchronized ?? 0),
    observed: Number(row?.observed ?? 0),
    averageProgress: Number(row?.averageProgress ?? 0),
    discrepancies: Number(row?.discrepancies ?? 0),
    lastUploadAt: row?.lastUploadAt ?? "",
  };
}

function privateJson(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function knownFileIds(value: string | null) {
  if (!value) return [];
  const ids = [...new Set(value.split(",").filter(Boolean))];
  if (
    ids.length > 100 ||
    ids.some((id) => id.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(id))
  ) return null;
  return ids;
}

function resolveExtractedProtection(input: {
  area: string;
  documentType: string;
  summary: string;
  warnings: string[];
  updates: ReturnType<typeof normalizeLiveDataUpdates>;
}) {
  const extractedText = `${input.summary} ${input.warnings.join(" ")}`;
  const commercial = input.documentType === "ventas_cobranza" ||
    input.area === "comercial" ||
    input.updates.some((update) =>
      isCommercialLiveKey(update.key) || update.area === "comercial") ||
    /\b(?:ventas?|cobranza|morosidad|reservas?|desistimientos?)\b/i.test(extractedText);
  const financial = commercial ||
    input.documentType === "estado_financiero" ||
    input.area === "finanzas" ||
    input.updates.some((update) =>
      isFinancialLiveKey(update.key) || requiresFinanceAccessForArea(update.area)) ||
    /\b(?:finanzas?|financiero|fideicomiso|balance|estado de resultados|cuentas por pagar|presupuesto|flujo de caja)\b/i.test(extractedText);
  if (commercial) {
    return { area: "comercial", documentType: "ventas_cobranza", protected: true } as const;
  }
  if (financial) {
    return { area: "finanzas", documentType: "estado_financiero", protected: true } as const;
  }
  return {
    area: input.area,
    documentType: input.documentType,
    protected: false,
  } as const;
}

// Una ingesta automática no puede caerse entera porque una sola clave no encaje
// en el modelo. normalizeLiveDataUpdates valida el lote completo y lanza ante la
// primera clave inválida (p. ej. un nombre de modelo comercial que el resolutor
// no supo llevar a su posición, o un campo que ese día no existe). Eso mandaba
// todo el expediente a revisión manual y se perdían también los 25 datos que sí
// eran correctos. Aquí se prueba el lote y, si algo falla, se normaliza dato a
// dato y se descartan sólo los que no encajan, conservando los buenos. Es la
// misma tolerancia que la IA ya aplica a sus candidatos: el dato sólido del
// lector no se pierde por culpa de uno dudoso. La bandeja de revisión sigue
// siendo estricta —esto solo afecta a la ingesta automática, no a lo que una
// persona envía a mano.
function normalizeIngestedUpdatesResilient(
  updates: Parameters<typeof normalizeLiveDataUpdates>[0]["updates"],
  context: { area: string; cutoff: string; sourceFileId: string; sourceName: string },
): { normalized: ReturnType<typeof normalizeLiveDataUpdates>; descartadas: number } {
  try {
    return { normalized: normalizeLiveDataUpdates({ updates, ...context }), descartadas: 0 };
  } catch {
    const normalized: ReturnType<typeof normalizeLiveDataUpdates> = [];
    let descartadas = 0;
    for (const update of updates) {
      try {
        normalized.push(...normalizeLiveDataUpdates({ updates: [update], ...context }));
      } catch {
        // Clave ajena al modelo o valor no admitido: se descarta este dato y se
        // sigue con el resto, en vez de perder toda la extracción.
        descartadas += 1;
      }
    }
    return { normalized, descartadas };
  }
}

// Norma estructural: la publicación rechaza mezclar en un mismo lote una lista
// entera con una ruta hija suya (`collectionTargets` y `collectionTargets.0.…`)
// o una clave repetida. Ese choque —venga del lector, de la IA de relleno o de
// dos lectores a la vez— tumbaba todo el informe. En la ingesta automática se
// resuelve aquí, con el MISMO detector que usa la publicación, quedándose con
// la representación más específica: si hay una lista y una fila suya, gana la
// fila (la del lector determinista); si hay un duplicado exacto, la primera.
// Así el error de mezcla nunca puede llegar a publicarse. La bandeja de
// revisión manual conserva su validación estricta —esto sólo afecta a lo
// automático.
function resolvePublicationKeyConflicts(
  updates: ReturnType<typeof normalizeLiveDataUpdates>,
): { resueltas: ReturnType<typeof normalizeLiveDataUpdates>; descartadas: number } {
  let vigentes = updates;
  let descartadas = 0;
  // publicationKeyConflict devuelve un choque cada vez; se repite hasta que no
  // quede ninguno. La guarda por longitud evita cualquier bucle infinito.
  for (let intento = 0; intento <= updates.length; intento += 1) {
    const conflict = publicationKeyConflict(vigentes.map((update) => update.key));
    if (!conflict) break;
    if (conflict.duplicate) {
      let conservado = false;
      vigentes = vigentes.filter((update) => {
        if (update.key !== conflict.duplicate) return true;
        if (conservado) return false;
        conservado = true;
        return true;
      });
    } else {
      vigentes = vigentes.filter((update) => update.key !== conflict.ancestor);
    }
    descartadas += 1;
  }
  return { resueltas: vigentes, descartadas };
}

export async function GET(request: Request) {
  const requestStartedAt = new Date().toISOString();
  const auth = await authenticatedUser();
  if (!auth.user) return auth.response;
  const user = auth.user;

  const searchParams = new URL(request.url).searchParams;
  const previewId = searchParams.get("preview");
  const downloadId = searchParams.get("download");
  const requestedFileId = previewId || downloadId;
  const db = getDb();
  if (requestedFileId) {
    const [row] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, requestedFileId)).limit(1);
    if (!row) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
    if (row.deletedAt && user.role !== "admin" && row.uploaderEmail !== user.email) {
      return Response.json({ error: "Este archivo está eliminado." }, { status: 410 });
    }
    if (fileRequiresFinanceAccess(row) && !user.financeAccess) {
      return Response.json({ error: "No tienes acceso a documentos financieros o comerciales." }, { status: 403 });
    }

    const extension = row.extension.toLowerCase();
    const requestedRange = previewId && extension === "pdf"
      ? parseByteRange(request.headers.get("range"), row.sizeBytes)
      : null;
    if (requestedRange === "invalid") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${row.sizeBytes}` },
      });
    }
    const object = await getFileBucket().get(
      row.storageKey,
      requestedRange ? { range: { offset: requestedRange.offset, length: requestedRange.length } } : undefined,
    );
    if (!object) return Response.json({ error: "El original no está disponible en el almacenamiento." }, { status: 404 });
    const storedContentType = object.httpMetadata?.contentType || row.mimeType;
    const contentType = previewId
      ? canonicalMimeByExtension[extension] ?? storedContentType
      : storedContentType;
    const inlinePreview = Boolean(previewId && (
      inlinePreviewExtensions.has(extension) ||
      contentType === "text/plain" ||
      /^image\/(?:png|jpe?g|webp|gif)$/i.test(contentType)
    ));
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `${inlinePreview ? "inline" : "attachment"}; filename="${asciiFileName(row.originalName)}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(requestedRange ? requestedRange.length : row.sizeBytes),
    });
    if (extension === "pdf") headers.set("Accept-Ranges", "bytes");
    if (requestedRange) headers.set("Content-Range", `bytes ${requestedRange.start}-${requestedRange.end}/${row.sizeBytes}`);
    return new Response(object.body, { headers, status: requestedRange ? 206 : 200 });
  }

  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const pageSize = normalizeFilePageSize(searchParams.get("limit"));
  const mode = searchParams.get("mode") === "changes" ? "changes" : "page";

  if (mode === "changes") {
    const afterValue = searchParams.get("after");
    const after = decodeFileRegistryCursor(afterValue);
    if (!afterValue || !after) {
      return privateJson({ error: "El cursor de cambios no es válido." }, 400);
    }
    const knownIds = knownFileIds(searchParams.get("known"));
    if (knownIds === null) {
      return privateJson({ error: "La reconciliación documental solicitada no es válida." }, 400);
    }
    const summaryPromise = fileRegistrySummary(user, includeDeleted);
    const [changedRows, knownRows] = await Promise.all([
      db
        .select()
        .from(uploadedFiles)
        .where(and(
          fileRegistryVisibilityCondition(user, includeDeleted),
          or(
            gt(uploadedFiles.updatedAt, after.timestamp),
            and(eq(uploadedFiles.updatedAt, after.timestamp), gt(uploadedFiles.id, after.id)),
          ),
        ))
        .orderBy(asc(uploadedFiles.updatedAt), asc(uploadedFiles.id))
        .limit(pageSize + 1),
      knownIds.length
        ? db
            .select({
              id: uploadedFiles.id,
              area: uploadedFiles.area,
              documentType: uploadedFiles.documentType,
              deletedAt: uploadedFiles.deletedAt,
              uploaderEmail: uploadedFiles.uploaderEmail,
              supersededByFileId: uploadedFiles.supersededByFileId,
            })
            .from(uploadedFiles)
            .where(inArray(uploadedFiles.id, knownIds))
        : Promise.resolve([]),
    ]);
    const hasMore = changedRows.length > pageSize;
    const pageRows = changedRows.slice(0, pageSize);
    const last = pageRows.at(-1);
    const idleWatermark = { timestamp: requestStartedAt, id: "" };
    const nextWatermark = hasMore && last
      ? { timestamp: last.updatedAt, id: last.id }
      : last
        ? latestFileRegistryCursor(
            { timestamp: last.updatedAt, id: last.id },
            idleWatermark,
          )
        : idleWatermark;
    const visibleKnownIds = new Set(
      knownRows
        .filter((row) => fileRegistryRowVisible(row, user, includeDeleted))
        .map((row) => row.id),
    );
    const removedIds = knownIds.filter((id) => !visibleKnownIds.has(id));
    return privateJson({
      mode,
      files: pageRows.map((row) => publicFileRow(row, user)),
      removedIds,
      hasMore,
      nextChangeCursor: encodeFileRegistryCursor(nextWatermark),
      summary: await summaryPromise,
      refreshedAt: new Date().toISOString(),
    });
  }

  const cursorValue = searchParams.get("cursor");
  const cursor = decodeFileRegistryCursor(cursorValue);
  if (cursorValue && !cursor) {
    return privateJson({ error: "El cursor de página no es válido." }, 400);
  }
  const summaryPromise = fileRegistrySummary(user, includeDeleted);
  const pageCondition = cursor
    ? and(
        fileRegistryVisibilityCondition(user, includeDeleted),
        or(
          lt(uploadedFiles.createdAt, cursor.timestamp),
          and(eq(uploadedFiles.createdAt, cursor.timestamp), lt(uploadedFiles.id, cursor.id)),
        ),
      )
    : fileRegistryVisibilityCondition(user, includeDeleted);
  const rows = await db
    .select()
    .from(uploadedFiles)
    .where(pageCondition)
    .orderBy(desc(uploadedFiles.createdAt), desc(uploadedFiles.id))
    .limit(pageSize + 1);
  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const last = pageRows.at(-1);
  return privateJson({
    mode,
    files: pageRows.map((row) => publicFileRow(row, user)),
    hasMore,
    nextCursor: hasMore && last
      ? encodeFileRegistryCursor({ timestamp: last.createdAt, id: last.id })
      : null,
    changeCursor: encodeFileRegistryCursor({ timestamp: requestStartedAt, id: "" }),
    summary: await summaryPromise,
    refreshedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  // La carga admite dos identidades: la sesión de una persona en el navegador y
  // un token de carga automática, que es lo que permite que el corte mensual
  // llegue solo desde el equipo de la oficina sin que nadie inicie sesión.
  //
  // El token no es un usuario ni tiene permisos propios: se resuelve a la
  // persona que lo emitió y a partir de ahí el recorrido es exactamente el
  // mismo —clasificación, extracción, contrato, publicación y auditoría—, así
  // que una carga automática no puede hacer nada que su responsable no pudiera
  // hacer a mano, ni se salta ninguna comprobación.
  const agentToken = readUploadAgentToken(request);
  let user: FileRegistryUser;
  if (agentToken) {
    const agent = await resolveUploadAgentToken(agentToken);
    if (!agent) {
      return Response.json(
        { error: "El token de carga automática no es válido, ha caducado o se ha revocado." },
        { status: 401 },
      );
    }
    user = agent.user;
  } else {
    const auth = await authenticatedUser();
    if (!auth.user) {
      return auth.response ?? Response.json({ error: "No autorizado." }, { status: 401 });
    }
    user = auth.user;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "La solicitud de carga no es válida." }, { status: 400 });
  }

  const candidate = formData.get("file");
  if (!(candidate instanceof File)) {
    return Response.json({ error: "Selecciona un archivo." }, { status: 400 });
  }
  if (candidate.size === 0) {
    return Response.json({ error: "El archivo está vacío." }, { status: 400 });
  }
  if (candidate.size > MAX_FILE_SIZE) {
    return Response.json({ error: "El archivo supera el límite de 50 MB." }, { status: 413 });
  }

  const extension = extensionOf(candidate.name);
  if (!allowedExtensions.has(extension)) {
    return Response.json(
      { error: "Formato no admitido. Usa Excel, CSV/JSON, PowerPoint, PDF, Word, MPP, DWG, imagen o ZIP." },
      { status: 415 },
    );
  }

  const description = String(formData.get("description") ?? "").trim().slice(0, 800);
  const section = String(formData.get("section") ?? "").trim().slice(0, 120);
  const source = formData.get("source") === "agent" ? "agent" : "dashboard";
  const sourceCurrency = resolveSourceCurrency({
    declaredCurrency: String(formData.get("sourceCurrency") ?? "auto"),
    fileName: candidate.name,
    description,
  });
  const declaredCutoff = String(formData.get("declaredCutoff") ?? "").trim().slice(0, 40);
  // Una carga normal publica por defecto. `false` sólo existe para pruebas o
  // mantenimiento explícito; así una cámara, un token de obra o un formulario
  // mínimo no dejan el expediente a medias por omitir este campo técnico.
  const automaticPublicationRequested = formData.get("autoPublish") !== "false";
  // Un reproceso es una repetición pedida a propósito: vuelve a pasar por la
  // ingesta actual un expediente que ya se archivó (y quizá ya se publicó), para
  // que recoja las mejoras de un lector cuando el archivo se subió antes de que
  // ese lector existiera. No crea otra copia —reusa la misma fila y el mismo
  // original— y publica una revisión nueva encima. Sin esta señal explícita, un
  // archivo idéntico ya publicado se queda como está.
  const reprocessRequested = formData.get("reprocess") === "true";
  const backgroundProcessing = request.headers.get(BACKGROUND_PROCESSING_HEADER) === "1";
  const reprocessFileId = String(formData.get("reprocessFileId") ?? "").trim().slice(0, 160);
  if (reprocessFileId && (!reprocessRequested || user.role !== "admin")) {
    return Response.json({
      error: "Sólo un administrador puede dirigir un reproceso al expediente exacto.",
    }, { status: 403 });
  }
  const derivedFromFileId = String(formData.get("derivedFromFileId") ?? "").trim().slice(0, 160);
  const automationKind = String(formData.get("automationKind") ?? "").trim().slice(0, 80);
  const deferProcessingRequested =
    !backgroundProcessing &&
    !reprocessRequested &&
    !derivedFromFileId &&
    formData.get("processNow") !== "true" &&
    source === "dashboard";
  if (Boolean(derivedFromFileId) !== Boolean(automationKind)) {
    return Response.json({ error: "Una conversión automática debe indicar origen y tipo de automatización." }, { status: 400 });
  }
  if (derivedFromFileId && user.role !== "admin") {
    return Response.json({ error: "Sólo un administrador puede registrar archivos derivados automáticamente." }, { status: 403 });
  }
  // Diagnóstico acotado: cuando quien sube lo pide expresamente y tiene acceso,
  // la respuesta incluye el mensaje del error que dejó el expediente en
  // «observado». Es sólo el texto del error (nunca cifras), para localizar qué
  // comprobación de integridad falló sin tener el log del servidor delante.
  const debugRequested = formData.get("debug") === "1";
  const classification = classifyUpload({
    fileName: candidate.name,
    description,
    declaredArea: String(formData.get("area") ?? "auto"),
  });
  const safeName = safeFileName(candidate.name);
  const bytes = await candidate.arrayBuffer();
  const analysis = analyzeDocument({
    fileName: candidate.name,
    description,
    extension,
    declaredCutoff,
    area: classification.area,
    classificationConfidence: classification.confidence,
  });
  const templateIdentity = await documentTemplateFingerprint({
    fileName: candidate.name,
    extension,
    area: classification.area,
    documentType: analysis.documentType,
  });
  let initiallyProtectedUpload = requiresFinanceAccessForDocument(
    classification.area,
    analysis.documentType,
  );
  if (initiallyProtectedUpload && !user.financeUploadAccess) {
    return Response.json({
      error: "Tu usuario puede cargar documentación general, pero no tiene habilitada la entrega financiera. Pide al administrador que active «Entregar documentos financieros».",
    }, { status: 403 });
  }
  const sha256 = hexDigest(await crypto.subtle.digest("SHA-256", bytes));
  const db = getDb();

  if (derivedFromFileId) {
    const [parent] = await db.select().from(uploadedFiles)
      .where(and(eq(uploadedFiles.id, derivedFromFileId), eq(uploadedFiles.deletedAt, "")))
      .limit(1);
    if (!parent) {
      return Response.json({ error: "El archivo de origen de la conversión no existe o está retirado." }, { status: 400 });
    }
    if (fileRequiresFinanceAccess(parent) && !user.financeAccess) {
      return Response.json({ error: "No tienes permiso para convertir ese archivo de origen." }, { status: 403 });
    }
  }

  let duplicate: typeof uploadedFiles.$inferSelect | undefined;
  if (reprocessFileId) {
    [duplicate] = await db
      .select()
      .from(uploadedFiles)
      .where(and(eq(uploadedFiles.id, reprocessFileId), eq(uploadedFiles.deletedAt, "")))
      .limit(1);
    if (!duplicate) {
      return Response.json({ error: "El expediente indicado para reproceso no está activo." }, { status: 404 });
    }
    if (duplicate.sha256 !== sha256) {
      return Response.json({
        error: "El original descargado no coincide con el expediente indicado para reproceso.",
      }, { status: 409 });
    }
  } else {
    [duplicate] = await db
      .select()
      .from(uploadedFiles)
      .where(and(eq(uploadedFiles.sha256, sha256), eq(uploadedFiles.deletedAt, "")))
      .limit(1);
  }
  let resumedRow: typeof uploadedFiles.$inferSelect | null = null;
  let reprocessing = false;
  if (duplicate) {
    const provisionalOwnedByUser = duplicate.documentType === PROVISIONAL_DOCUMENT_TYPE &&
      duplicate.uploaderEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
    if (fileRequiresFinanceAccess(duplicate) && !user.financeAccess && !provisionalOwnedByUser) {
      return Response.json({
        duplicate: true,
        restricted: true,
        receipt: {
          outcome: "already_registered",
          area: "finanzas",
          areaLabel: "Buzón financiero protegido",
          publishedCount: 0,
          unchangedCount: 0,
          ignoredCount: 0,
          warningCount: 0,
          warnings: [],
          newSectionCount: 0,
          requiresAction: false,
          nextAction: "No tienes que volver a subirlo. El expediente existente continúa siendo la copia válida.",
        },
        message: "Este mismo archivo ya estaba registrado en el buzón financiero. No se ha creado otra copia y no necesitas hacer nada.",
      }, { status: 202 });
    }
    const canResume = duplicate.publicationRevision === null &&
      (duplicate.reviewStatus === "pendiente_extraccion" || duplicate.reviewStatus === "cambios_solicitados") &&
      duplicate.status !== "integrado" &&
      duplicate.status !== "rechazado";
    // El reproceso reclama incluso un expediente ya publicado, siempre que quien
    // lo pide tenga el acceso que ese contenido exige. Un archivo rechazado no
    // se reabre por esta vía: esa decisión es deliberada y se respeta.
    const canReprocess = reprocessRequested &&
      !duplicate.supersededAt &&
      duplicate.status !== "rechazado" &&
      (user.financeAccess || !fileRequiresFinanceAccess(duplicate));
    if (!canResume && !canReprocess) {
      return Response.json({
        duplicate: true,
        message: "Este mismo archivo ya estaba registrado; se mantiene una sola copia.",
        file: publicFileRow(duplicate, user),
      });
    }
    // Sólo es «reproceso» cuando el expediente ya había publicado una revisión;
    // reanudar uno que nunca llegó a publicar sigue el camino de siempre.
    reprocessing = !canResume && duplicate.publicationRevision !== null;
    const leaseStartedAt = Date.parse(duplicate.updatedAt);
    const leaseIsActive = duplicate.processingStage === "extraccion_en_curso" &&
      Number.isFinite(leaseStartedAt) &&
      Date.now() - leaseStartedAt < EXTRACTION_LEASE_MS;
    if (leaseIsActive) {
      return Response.json({
        duplicate: true,
        processing: true,
        message: "Este archivo ya se está procesando. El mismo expediente continuará sin crear otra copia.",
      }, { status: 202 });
    }
    const leaseAt = new Date().toISOString();
    const [claimedRow] = await db
      .update(uploadedFiles)
      .set({
        processingStage: "extraccion_en_curso",
        processingProgress: Math.max(45, duplicate.processingProgress),
        processingSummary: "Reprocesamiento idempotente del expediente ya archivado.",
        updatedAt: leaseAt,
      })
      .where(and(
        eq(uploadedFiles.id, duplicate.id),
        eq(uploadedFiles.deletedAt, ""),
        eq(uploadedFiles.updatedAt, duplicate.updatedAt),
      ))
      .returning();
    if (!claimedRow) {
      return Response.json({
        duplicate: true,
        processing: true,
        message: "Otra solicitud acaba de reanudar este expediente; no se creará una copia.",
      }, { status: 202 });
    }
    resumedRow = claimedRow;
    if (claimedRow.documentType !== PROVISIONAL_DOCUMENT_TYPE) {
      initiallyProtectedUpload ||= requiresFinanceAccessForDocument(
        claimedRow.area,
        claimedRow.documentType,
      );
    }
  }

  const previousVersions = resumedRow
    ? []
    : await db
      .select({ id: uploadedFiles.id })
      .from(uploadedFiles)
      .where(and(eq(uploadedFiles.safeName, safeName), eq(uploadedFiles.area, classification.area)));
  const version = resumedRow?.version ?? previousVersions.length + 1;
  const id = resumedRow?.id ?? crypto.randomUUID();
  const now = new Date();
  const storageKey = resumedRow?.storageKey ?? [
    "araya",
    classification.area,
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${id}-${safeName}`,
  ].join("/");
  const mimeType = candidate.type || "application/octet-stream";
  const bucket = getFileBucket();
  const effectiveCutoff = analysis.detectedPeriod || declaredCutoff || new Date().toISOString().slice(0, 10);
  try {
    if (!resumedRow) {
    await bucket.put(storageKey, bytes, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        originalName: candidate.name,
        area: classification.area,
        uploader: user.email,
        sha256,
        sourceCurrency,
      },
    });
    }
  } catch {
    return Response.json({ error: "No se pudo archivar el original." }, { status: 500 });
  }

  let row: typeof uploadedFiles.$inferSelect;
  try {
    if (resumedRow) {
      row = resumedRow;
    } else {
    const [createdRow] = await db
      .insert(uploadedFiles)
      .values({
        id,
        originalName: candidate.name.slice(0, 255),
        safeName,
        area: classification.area,
        section,
        description,
        mimeType,
        extension,
        sizeBytes: candidate.size,
        sha256,
        storageKey,
        source,
        sourceCurrency,
        status: "pendiente_revision",
        uploaderEmail: user.email,
        uploaderName: user.displayName,
        version,
        declaredCutoff,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
        processingStage: deferProcessingRequested ? "recibido" : "extraccion_en_curso",
        processingProgress: deferProcessingRequested ? 15 : 45,
        processingSummary: classification.confidence > 0
          ? `${analysis.summary} Original archivado; ${deferProcessingRequested ? "procesamiento en segundo plano preparado" : "interpretación en curso"}.`
          : "Original recibido. Requiere asignación de área antes de normalizar sus datos.",
        requiresReview: true,
        projectId: "araya",
        // A row exists before the potentially slow Office/PDF/image analysis
        // completes. Keep that provisional record fail-closed at every reader.
        documentType: PROVISIONAL_DOCUMENT_TYPE,
        detectedPeriod: analysis.detectedPeriod,
        extractionMode: analysis.extractionMode,
        extractionConfidence: analysis.confidence,
        extractionSummary: analysis.summary,
        discrepancyCount: 0,
        ingestionVersion: CURRENT_INGESTION_VERSION,
        processedAt: "",
        derivedFromFileId,
        automationKind,
        reviewStatus: "pendiente_extraccion",
      })
      .returning();
    if (!createdRow) throw new Error("La fila inicial no se pudo crear.");
    row = createdRow;
    }
  } catch {
    // D1 may commit the insert and lose its response. Resolve that ambiguity
    // before touching R2; deleting first would leave a durable row without its
    // original object.
    let exactRow: typeof uploadedFiles.$inferSelect | undefined;
    let concurrentDuplicate: typeof uploadedFiles.$inferSelect | undefined;
    try {
      [[exactRow], [concurrentDuplicate]] = await Promise.all([
        db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1),
        db.select().from(uploadedFiles)
          .where(and(eq(uploadedFiles.sha256, sha256), eq(uploadedFiles.deletedAt, "")))
          .limit(1),
      ]);
    } catch {
      return Response.json({
        error: "El original está archivado, pero no se pudo confirmar su registro. Reintenta sin volver a cargar otra copia.",
      }, { status: 503 });
    }
    const insertWasCommitted = uploadInsertWasCommitted({
      row: exactRow,
      id,
      sha256,
      storageKey,
    });
    if (insertWasCommitted && exactRow) {
      row = exactRow;
    } else {
      // Only the losing upload owns this key (the generated id is embedded in
      // it), and the authoritative id lookup proved that no row references it.
      if (!exactRow && !resumedRow) await bucket.delete(storageKey).catch(() => undefined);
      if (concurrentDuplicate) {
        if (fileRequiresFinanceAccess(concurrentDuplicate) && !user.financeAccess) {
          return Response.json({
            duplicate: true,
            processing: true,
            message: "El mismo original ya está archivado y se procesa de forma confidencial.",
          }, { status: 202 });
        }
        return Response.json({
          duplicate: true,
          processing: concurrentDuplicate.reviewStatus !== "aprobado",
          message: "Una carga simultánea ya registró este mismo archivo; no se ha creado otra copia.",
          file: publicFileRow(concurrentDuplicate, user),
        }, { status: concurrentDuplicate.reviewStatus === "aprobado" ? 200 : 202 });
      }
      return Response.json({
        error: exactRow
          ? "El identificador del archivo ya existe con otro original; no se ha eliminado ningún objeto."
          : "Otra versión del mismo expediente se registró a la vez. Reintenta la carga para continuar sin duplicados.",
      }, { status: exactRow ? 503 : 409 });
    }
  }

  await db.insert(fileActivity).values({
    fileId: id,
    eventType: resumedRow ? "extraccion_reanudada" : "archivo_recibido",
    message: resumedRow
      ? "El expediente existente se ha reclamado con un lease idempotente para reanudar su extracción."
      : `Original archivado en ${areaLabels[classification.area]}; la interpretación de datos continúa sobre el expediente durable.`,
    actorEmail: user.email,
    actorName: user.displayName,
  }).catch(() => undefined);
  scheduleNotificationDispatch();
  // El .mpp no se lee dentro del Worker: pide la conversión ahora mismo al
  // runner de GitHub en vez de esperar al siguiente tick del cron (ver
  // triggerMppConversion). Sin GITHUB_ACTIONS_TOKEN configurado, no hace
  // nada y el cron programado sigue siendo la única vía, como hasta ahora.
  if (extension === "mpp") triggerMppConversion(id);

  if (deferProcessingRequested && !resumedRow) {
    scheduleBackgroundUploadProcessing({
      request,
      formData,
      bytes,
      fileName: candidate.name,
      mimeType,
      fileId: id,
      uploaderEmail: row.uploaderEmail,
      uploaderName: row.uploaderName,
    });
    // El reintento de fondo de arriba corre dentro de esta misma petición vía
    // waitUntil, que Cloudflare no garantiza que sobreviva si el Worker se
    // recicla antes de terminar -sin ningún error visible: el expediente se
    // queda en "recibido" hasta que algo lo reclame. Este disparo pide el
    // mismo reintento a un runner externo, no sujeto a ese ciclo de vida.
    triggerDeferredUploadRetry(id);
    return Response.json({
      processing: true,
      file: publicFileRow(row, user),
      receipt: {
        outcome: "accepted",
        area: classification.area,
        areaLabel: initiallyProtectedUpload
          ? "Buzón financiero protegido"
          : areaLabels[classification.area],
        publishedCount: 0,
        unchangedCount: 0,
        ignoredCount: 0,
        warningCount: 0,
        warnings: [],
        newSectionCount: 0,
        requiresAction: false,
        nextAction: "No tienes que esperar ni volver a subirlo. Consulta «Mis cargas» para ver el resultado.",
      },
      message: "Archivo recibido y protegido. El análisis continúa automáticamente en segundo plano y te avisaremos al terminar.",
    }, { status: 202 });
  }

  let resolvedArea = row.area;
  let resolvedClassificationConfidence = classification.confidence;
  let resolvedClassificationReason = classification.reason;
  let resolvedDocumentType = row.documentType === PROVISIONAL_DOCUMENT_TYPE
    ? analysis.documentType
    : row.documentType;
  let financeProtectedUpload = true;
  let protectionResolved = false;
  let publicationStarted = false;
  let publicationCompleted = false;
  let extractionGeneration = "";
  let extractionCommitted = false;
  let agentRunId = "";
  let matchedTemplateId = "";
  let agentValidation: ReturnType<typeof reconcileIngestionUpdates> = {
    safe: true,
    issues: [],
    checkedKeys: 0,
    percentageKeys: 0,
    conflictingKeys: [],
    invalidKeys: [],
  };
  let agentModel = "deterministic";
  let agentPromptVersion = "structured-file-v1";
  let agentIterations = 0;
  let agentTrace: Array<{ name: string; ok: boolean; iteration: number; durationMs: number; summary: string }> = [];
  let agentInputTokens = 0;
  let agentCachedInputTokens = 0;
  let agentCacheWriteInputTokens = 0;
  let agentOutputTokens = 0;
  let agentEstimatedCostUsdMicros = 0;
  let agentProposedCount = 0;
  let agentPublishedCount = 0;
  try {
    const templateHints = await db.select().from(documentTemplates)
      .where(or(
        eq(documentTemplates.fingerprint, templateIdentity.fingerprint),
        and(
          eq(documentTemplates.extension, extension),
          eq(documentTemplates.area, classification.area),
          eq(documentTemplates.documentType, analysis.documentType),
        ),
      ))
      .orderBy(desc(documentTemplates.successCount), desc(documentTemplates.lastRunAt))
      .limit(5);
    matchedTemplateId = templateHints.find(
      (template) => template.fingerprint === templateIdentity.fingerprint,
    )?.id ?? "";
    agentRunId = crypto.randomUUID();
    await db.insert(ingestionAgentRuns).values({
      id: agentRunId,
      fileId: id,
      templateId: matchedTemplateId,
      fingerprint: templateIdentity.fingerprint,
      status: "running",
    });
    // Se lee antes de extraer (y no solo para validar el contrato después)
    // porque el lector de planes de Project necesita el avance de urbanismo
    // ya publicado: un plan parcial (p. ej. "Urbanismo fase I") solo debe
    // adelantar una disciplina, nunca retrasarla con una cifra de alcance
    // menor. Ver extractProjectXmlUpdates.
    const currentLiveData = await readEffectiveLiveData(true);
    const deterministicExtraction = await extractStructuredUpdates(bytes, extension, {
      area: classification.area,
      cutoff: effectiveCutoff,
      sourceCurrency: sourceCurrency === "USD" ? "USD" : "DOP",
      sourceName: candidate.name,
      // Los edificios que existen ahora mismo. Sin esta lista, una tarea del
      // plan rotulada "TH-99" daría de alta un edificio fantasma en la
      // implantación; con ella, simplemente se deja fuera y se avisa.
      knownBuildingTokens: knownBuildingTokens(),
      currentUrbanismReportAreas: materializeLiveRoot(
        "urbanismReportAreas",
        urbanismReportAreas,
        currentLiveData.values,
      ),
      currentCubicacionCaratula: materializeLiveRoot(
        "cubicacionCaratula",
        cubicacionCaratula,
        currentLiveData.values,
      ),
    });
    let extraction: Awaited<ReturnType<typeof extractDocumentWithAI>> = {
      ...deterministicExtraction,
      updateConfidences: deterministicExtraction.updates.map(() => 1),
      confidence: deterministicExtraction.updates.length ? 1 : 0,
      model: "deterministic",
      promptVersion: "structured-file-v1",
      unmappedCandidates: [],
      agentTrace: [],
      agentIterations: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      estimatedCostUsdMicros: 0,
    };
    // currentLiveData ya se leyó antes de extraer (ver arriba); también se le
    // pasa a la IA como referencia de esquema: sin ver los nombres de campo
    // reales ya existentes, el modelo inventaba claves plausibles pero
    // distintas (p. ej. "physicalProgressExecuted" en vez de
    // "overallProgress"), y el contrato las rechazaba en silencio.
    // Un informe en PowerPoint, Word o PDF es narrativo: un lector propio saca
    // sus cifras con fiabilidad, pero un mismo documento puede traer varias
    // áreas y ningún lector las cubre todas (el Informe Ejecutivo lleva ventas,
    // obra, seguridad y finanzas en 37 láminas). Antes, si el lector encontraba
    // algo, la IA no corría, y lo que el lector no cubría se quedaba sin
    // actualizar. Ahora el lector manda y la IA COMPLETA los huecos: se ejecuta
    // también cuando el lector sólo cubrió parte de un documento narrativo, y
    // sólo se quedan de la IA las claves que ningún lector tocó. Un Excel o un
    // plan de Project se leen enteros y no necesitan ese complemento.
    let aiDocuments = [{
      bytes,
      fileName: candidate.name,
      mimeType: candidate.type || canonicalMimeByExtension[extension] || "application/octet-stream",
      extension,
    }];
    if (extension === "zip") {
      try {
        aiDocuments = await archiveDocumentsForAI(bytes);
      } catch (archiveError) {
        extraction = {
          ...extraction,
          warnings: [
            ...extraction.warnings,
            archiveError instanceof Error ? archiveError.message : "El ZIP no pudo abrirse de forma segura.",
          ],
        };
        aiDocuments = [];
      }
    }
    const extensionesNarrativas = new Set(["ppt", "pptx", "doc", "docx", "pdf", "jpg", "jpeg", "png"]);
    const documentosNarrativos = aiDocuments.filter((document) => extensionesNarrativas.has(document.extension));
    const documentoNarrativo = documentosNarrativos.length > 0;
    const lecturaParcial = deterministicExtraction.updates.length > 0 && documentoNarrativo;
    const aiBudget = await getAiUsageSnapshot();
    if (documentoNarrativo && (!deterministicExtraction.updates.length || lecturaParcial) && !aiBudget.blocked) {
      const aiResults: Awaited<ReturnType<typeof extractDocumentWithAI>>[] = [];
      const aiSourceCurrency: "DOP" | "USD" = sourceCurrency === "USD" ? "USD" : "DOP";
      for (const document of documentosNarrativos) {
        const commonInput = {
          ...document,
          area: classification.area,
          cutoff: effectiveCutoff,
          sourceCurrency: aiSourceCurrency,
          apiKey: process.env.OPENAI_API_KEY ?? "",
          currentValues: currentLiveData.values,
          knownAreas: uploadAreas,
          schemaReference: getContractRootsSnapshot(),
          templateHints,
        };
        const primary = await extractDocumentWithAI({
          ...commonInput,
          model: INGESTION_PRIMARY_MODEL,
          maxAgentIterations: 2,
          maxAgentToolCalls: 16,
          maxOutputTokens: 8_000,
          imageDetail: "low",
        });
        if (shouldEscalateDocumentExtraction(primary, {
          classificationConfidence: classification.confidence,
          hasDeterministicUpdates: deterministicExtraction.updates.length > 0,
        })) {
          const advanced = await extractDocumentWithAI({
            ...commonInput,
            model: INGESTION_ESCALATION_MODEL,
            maxAgentIterations: 3,
            maxAgentToolCalls: 24,
            maxOutputTokens: 12_000,
            imageDetail: "high",
          });
          const mergedByKey = new Map(primary.updates.map((update, index) => [
            update.key,
            { update, confidence: primary.updateConfidences[index] ?? primary.confidence },
          ]));
          advanced.updates.forEach((update, index) => mergedByKey.set(update.key, {
            update,
            confidence: advanced.updateConfidences[index] ?? advanced.confidence,
          }));
          const mergedUpdates = [...mergedByKey.values()];
          aiResults.push({
            updates: mergedUpdates.map((entry) => entry.update),
            updateConfidences: mergedUpdates.map((entry) => entry.confidence),
            summary: `${primary.summary} Escalado automático: ${advanced.summary}`.trim(),
            warnings: [...primary.warnings, ...advanced.warnings],
            confidence: Math.max(primary.confidence, advanced.confidence),
            model: `${INGESTION_ESCALATION_MODEL} (escalado desde ${INGESTION_PRIMARY_MODEL})`,
            promptVersion: advanced.promptVersion,
            unmappedCandidates: [...primary.unmappedCandidates, ...advanced.unmappedCandidates],
            agentTrace: [...primary.agentTrace, ...advanced.agentTrace],
            agentIterations: primary.agentIterations + advanced.agentIterations,
            inputTokens: primary.inputTokens + advanced.inputTokens,
            cachedInputTokens: primary.cachedInputTokens + advanced.cachedInputTokens,
            cacheWriteInputTokens: primary.cacheWriteInputTokens + advanced.cacheWriteInputTokens,
            outputTokens: primary.outputTokens + advanced.outputTokens,
            estimatedCostUsdMicros: primary.estimatedCostUsdMicros + advanced.estimatedCostUsdMicros,
          });
        } else {
          aiResults.push(primary);
        }
      }
      const iaExtraction = aiResults.reduce<Awaited<ReturnType<typeof extractDocumentWithAI>>>((merged, result) => ({
        updates: [...merged.updates, ...result.updates],
        updateConfidences: [...merged.updateConfidences, ...result.updateConfidences],
        summary: [merged.summary, result.summary].filter(Boolean).join(" "),
        warnings: [...merged.warnings, ...result.warnings],
        confidence: Math.max(merged.confidence, result.confidence),
        model: result.model || merged.model,
        promptVersion: result.promptVersion || merged.promptVersion,
        unmappedCandidates: [...merged.unmappedCandidates, ...result.unmappedCandidates],
        agentTrace: [...merged.agentTrace, ...result.agentTrace],
        agentIterations: merged.agentIterations + result.agentIterations,
        inputTokens: merged.inputTokens + result.inputTokens,
        cachedInputTokens: merged.cachedInputTokens + result.cachedInputTokens,
        cacheWriteInputTokens: merged.cacheWriteInputTokens + result.cacheWriteInputTokens,
        outputTokens: merged.outputTokens + result.outputTokens,
        estimatedCostUsdMicros: merged.estimatedCostUsdMicros + result.estimatedCostUsdMicros,
      }), {
        updates: [],
        updateConfidences: [],
        summary: "",
        warnings: [],
        confidence: 0,
        model: "openai_responses",
        promptVersion: "archive-multi-document-v1",
        unmappedCandidates: [],
        agentTrace: [],
        agentIterations: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        outputTokens: 0,
        estimatedCostUsdMicros: 0,
      });
      if (!deterministicExtraction.updates.length) {
        extraction = iaExtraction;
      } else {
        // El lector determinista gana: de la IA sólo entran las claves que
        // ningún lector cubrió. Así el complemento nunca pisa un dato leído
        // directamente, que es el que da la garantía.
        const clavesDeterministas = deterministicExtraction.updates.map((update) => update.key);
        // Una clave de la IA choca con el lector no sólo si es idéntica, sino
        // también si es antepasada o descendiente de una suya: la publicación
        // rechaza mezclar una lista entera (p. ej. `collectionTargets`) con una
        // ruta hija suya (`collectionTargets.0.targetUsd`), y el lector emite las
        // hijas. Si la IA manda la lista entera, se descarta a favor de las
        // hijas del lector.
        const complementoChocaConLector = (aiKey: string) =>
          clavesDeterministas.some((clave) =>
            clave === aiKey ||
            clave.startsWith(`${aiKey}.`) ||
            aiKey.startsWith(`${clave}.`));
        // Del complemento sólo entran claves nuevas (sin choque con el lector) y
        // con confianza positiva: un dato que la IA ni afirma no debe publicarse
        // solo ni contar para la comprobación de confianza del lote, que exige
        // que todos tengan confianza > 0. Sin este filtro, un único dato dudoso
        // de relleno bloqueaba la publicación automática de todo el informe.
        const complemento = iaExtraction.updates
          .map((update, indice) => ({ update, confianza: iaExtraction.updateConfidences[indice] ?? iaExtraction.confidence }))
          .filter(({ update, confianza }) =>
            !complementoChocaConLector(update.key) && Number.isFinite(confianza) && confianza > 0);
        extraction = {
          ...iaExtraction,
          updates: [...deterministicExtraction.updates, ...complemento.map(({ update }) => update)],
          updateConfidences: [
            ...deterministicExtraction.updates.map(() => 1),
            ...complemento.map(({ confianza }) => confianza),
          ],
          confidence: 1,
          summary: `${deterministicExtraction.summary} La IA completó ${complemento.length} dato(s) que el lector no cubría.`,
          warnings: [...deterministicExtraction.warnings, ...iaExtraction.warnings],
        };
      }
    } else if (documentoNarrativo && (!deterministicExtraction.updates.length || lecturaParcial) && aiBudget.blocked) {
      extraction = {
        ...extraction,
        summary: deterministicExtraction.updates.length
          ? deterministicExtraction.summary
          : "El original se conservó; el análisis IA se aplazó por el límite mensual configurado.",
        warnings: [
          ...extraction.warnings,
          "Presupuesto mensual de IA alcanzado. Los lectores internos siguieron funcionando sin coste.",
        ],
      };
    }
    agentModel = extraction.model;
    agentPromptVersion = extraction.promptVersion;
    agentIterations = extraction.agentIterations;
    agentTrace = extraction.agentTrace;
    agentInputTokens = extraction.inputTokens;
    agentCachedInputTokens = extraction.cachedInputTokens;
    agentCacheWriteInputTokens = extraction.cacheWriteInputTokens;
    agentOutputTokens = extraction.outputTokens;
    agentEstimatedCostUsdMicros = extraction.estimatedCostUsdMicros;
    // Las colecciones de partida permiten traducir a posición el nombre de una
    // entidad en cualquier lista del modelo, no sólo en las espaciales: las
    // económicas no tienen id y sólo se distinguen por su nombre. Si la
    // traducción tropezara con una entrada rara, se sigue con las claves tal
    // cual en vez de tumbar toda la ingesta: la normalización posterior ya
    // descarta dato a dato lo que no encaje.
    let identityResolvedUpdates = extraction.updates;
    // Una cubicación puede traer importes en la carátula y el avance físico de
    // varios edificios en otra hoja. El lector devuelve el alcance que vio y
    // aquí se comprueba que cada edificio nombrado haya generado al menos su
    // progreso o una fase. Si falta alguno, los datos reconocidos sí pueden
    // publicarse, pero el expediente no se cierra falsamente como completo.
    const expectedBuildingCodes = deterministicExtraction.expectedBuildingCodes ?? [];
    const extractedBuildingCodes = new Set(
      extraction.updates.flatMap((update) => {
        const match = update.key.match(/^buildings\.(TH-\d+)\.(?:progress|phases(?:\.|$))/i);
        return match ? [match[1].toUpperCase()] : [];
      }),
    );
    const missingExpectedBuildingCodes = expectedBuildingCodes.filter(
      (code) => !extractedBuildingCodes.has(code.toUpperCase()),
    );
    const buildingScopeIncomplete = missingExpectedBuildingCodes.length > 0;
    if (buildingScopeIncomplete) {
      extraction = {
        ...extraction,
        warnings: [
          ...extraction.warnings,
          `El documento nombra ${missingExpectedBuildingCodes.join(", ")}, pero no se extrajo un avance físico verificable para esas entidades; el diagnóstico quedará visible sin bloquear los demás datos.`,
        ],
      };
    }
    if (currentLiveData) {
      try {
        identityResolvedUpdates = resolveSpatialIdentityUpdates(
          extraction.updates,
          currentLiveData.values,
          getContractRootsSnapshot(),
        );
      } catch {
        identityResolvedUpdates = extraction.updates;
      }
    }
    // Un bloque que la lectura descubre y para el que no existe ningún campo ya
    // no espera aprobación: se publica como sección descubierta, con su
    // procedencia, su confianza y la evidencia del documento a la vista. Antes
    // se quedaba apartado indefinidamente y nadie llegaba a verlo — el informe
    // de ventas de julio pasó así dos bloques enteros.
    //
    // Cada candidato sin campo conocido se convierte en un bloque provisional
    // visible en Centro de datos. Su área conserva la misma privacidad que el
    // resto del sistema; el servicio puede incorporarlo aunque el cargador no
    // tenga permiso de lectura sobre la pantalla financiera resultante.
    const contentClassification = inferUploadAreaFromContent({
      initialArea: classification.area,
      initialConfidence: classification.confidence,
      documentType: analysis.documentType,
      updateKeys: extraction.updates.map((update) => update.key),
      suggestedAreas: extraction.unmappedCandidates.map((candidate) => candidate.suggestedArea),
    });
    resolvedArea = contentClassification.area;
    resolvedClassificationConfidence = contentClassification.confidence;
    resolvedClassificationReason = contentClassification.reason;

    const candidatosProvisionales = extraction.unmappedCandidates
      .map((candidato) => {
        const suggested = candidato.suggestedArea.trim().toLowerCase();
        const candidateArea = isUploadArea(suggested) && !["auto", "sin_clasificar"].includes(suggested)
          ? suggested
          : resolvedArea;
        return { candidato, candidateArea };
      });
    const dynamicSectionSlots = planDynamicSectionSlots(
      candidatosProvisionales.map(({ candidato, candidateArea }) => ({
        title: candidato.label,
        area: candidateArea,
      })),
      currentLiveData.values,
    );
    const seccionesDescubiertas = candidatosProvisionales
      .map(({ candidato, candidateArea }, posicion) => {
          const slot = dynamicSectionSlots[posicion];
          return {
            key: slot.key,
            value: buildDynamicSectionBlock({
              id: `descubierto-${id}-${posicion}`,
              existingId: slot.existingId,
              title: candidato.label,
              description: candidato.description,
              area: candidateArea,
              evidence: candidato.evidence,
              confidence: candidato.confidence,
              sourceName: candidate.name,
              detectedAt: new Date().toISOString(),
              valueJson: candidato.valueJson,
            }),
            // La sección vive en el área que su propio contenido identifica,
            // aunque el documento contenedor tenga otra clasificación.
            area: candidateArea,
            cutoff: effectiveCutoff,
            sourceCurrency: (sourceCurrency === "USD" ? "USD" : "DOP") as "USD" | "DOP",
            sourceName: candidate.name,
          };
        });

    const ingestionCandidates = [
      ...identityResolvedUpdates.map((update, index) => ({
        update: {
          ...update,
          sourceFileId: id,
          sourceName: candidate.name,
        },
        confidence: extraction.updateConfidences[index] ?? extraction.confidence,
      })),
      ...seccionesDescubiertas.map((update, index) => ({
        update: { ...update, sourceFileId: id },
        confidence: candidatosProvisionales[index]?.candidato.confidence ?? extraction.confidence,
      })),
    ];
    const normalizacion = ingestionCandidates.length
      ? normalizeIngestedUpdatesResilient(
          ingestionCandidates.map(({ update }) => update),
          {
            // La segunda clasificación ya conoce el contenido real. Usar aquí
            // el área inicial volvería a marcar como `sin_clasificar` las
            // actualizaciones de un archivo con nombre neutro y bloquearía su
            // publicación, aunque el lector hubiese identificado Obra,
            // Seguridad, Compras, etc. con certeza.
            area: resolvedArea,
            cutoff: effectiveCutoff,
            sourceFileId: id,
            sourceName: candidate.name,
          },
        )
      : { normalized: [], descartadas: 0 };
    // Se resuelve el choque lista/fila (y los duplicados) antes de seguir, para
    // que nunca llegue a la publicación desde la ingesta automática.
    const sinChoques = resolvePublicationKeyConflicts(normalizacion.normalized);
    const extractedUpdates = sinChoques.resueltas;
    const extractedUpdateConfidences = resolveNormalizedUpdateConfidences(
      extractedUpdates,
      ingestionCandidates.map(({ update, confidence }) => ({
        key: update.key,
        valueJson: JSON.stringify(update.value),
        confidence,
      })),
      extraction.model === "deterministic" ? 1 : 0,
    );
    agentValidation = reconcileIngestionUpdates(extractedUpdates.flatMap((update) => {
      try {
        return [{ key: update.key, value: JSON.parse(update.valueJson) }];
      } catch {
        return [];
      }
    }));
    if (!agentValidation.safe) {
      extraction = {
        ...extraction,
        warnings: [...extraction.warnings, ...agentValidation.issues],
      };
    }
    const datosDescartados = normalizacion.descartadas + sinChoques.descartadas;
    if (datosDescartados > 0) {
      extraction = {
        ...extraction,
        warnings: [
          ...extraction.warnings,
          `${datosDescartados} dato(s) no encajaban en el modelo vivo o duplicaban otra representación y se descartaron; el resto se conservó.`,
        ],
      };
    }
    const protection = resolveExtractedProtection({
      area: resolvedArea,
      documentType: resolvedDocumentType,
      summary: extraction.summary,
      warnings: extraction.warnings,
      updates: extractedUpdates,
    });
    const affirmativeContentClassification = extractedUpdates.length > 0;
    if (protection.protected || initiallyProtectedUpload) {
      // Any financial/commercial signal elevates immediately, even when the
      // extraction is incomplete or low confidence.
      resolvedArea = protection.area;
      resolvedDocumentType = protection.documentType;
      financeProtectedUpload = true;
      protectionResolved = true;
    } else if (affirmativeContentClassification) {
      resolvedArea = protection.area;
      resolvedDocumentType = protection.documentType;
      financeProtectedUpload = false;
      protectionResolved = true;
    } else {
      // Missing API credentials, unsupported formats, operational failures and
      // empty/zero-confidence results are not proof that a document is public.
      resolvedDocumentType = PROVISIONAL_DOCUMENT_TYPE;
      financeProtectedUpload = true;
      protectionResolved = false;
    }
    // Once content has elevated a document to Finanzas or Ventas, every
    // proposal inherits that protected area. Later metadata edits cannot make
    // the persisted document public again.
    const preparedUpdatesBeforeCurrency = financeProtectedUpload
      ? extractedUpdates.map((update) =>
          /^buildings\./.test(update.key) && !isFinancialLiveKey(update.key)
            ? { ...update, area: "obra" }
            : { ...update, area: resolvedArea })
      : extractedUpdates;
    const currencyPreparation = canonicalizeFinancialUpdates(preparedUpdatesBeforeCurrency);
    const preparedUpdates = currencyPreparation.updates;
    const confidenceByPreparedKey = new Map(extractedUpdates.map((update, index) => [
      update.key,
      extractedUpdateConfidences[index] ?? extraction.confidence,
    ]));
    const preparedUpdateConfidences = preparedUpdates.map((update) =>
      confidenceByPreparedKey.get(update.key) ?? (extraction.model === "deterministic" ? 1 : 0));
    const financialValidation: FinancialValidationResult = validateFinancialPublication({
      updates: preparedUpdates,
      currentValues: currentLiveData.values,
      currentPoints: currentLiveData.points,
      baselineValues: getContractRootsSnapshot(),
      monetaryAudit: currencyPreparation.audit,
    });
    if (financialValidation.warnings.length) {
      extraction = {
        ...extraction,
        warnings: [
          ...extraction.warnings,
          ...financialValidation.warnings.map((warning) => `Control financiero: ${warning}`),
        ],
      };
    }
    agentProposedCount = preparedUpdates.length;
    extractionGeneration = `ingest:${crypto.randomUUID()}`;
    const existingPoints = await selectLivePointValues(
      getD1JsonDatabase(),
      preparedUpdates.map((update) => update.key),
    );
    const changeSet = partitionChangedLiveUpdates(preparedUpdates, existingPoints);
    const normalizedUpdates = changeSet.changed;
    const unchangedCount = changeSet.unchanged.length;
    const normalizedUpdateConfidences = resolveNormalizedUpdateConfidences(
      normalizedUpdates,
      preparedUpdates.map((update, index) => ({
        key: update.key,
        valueJson: update.valueJson,
        confidence: preparedUpdateConfidences[index] ?? extraction.confidence,
      })),
      extraction.model === "deterministic" ? 1 : 0,
    );
    const previousByKey = new Map(existingPoints.map((point) => [point.key, point.valueJson]));
    const financialBeforeAfter = numericBeforeAfter({
      updates: normalizedUpdates.filter((update) => isFinancialLiveKey(update.key)),
      currentPoints: currentLiveData.points,
    });
    const discrepancyCount = normalizedUpdates.filter((update) => previousByKey.has(update.key)).length;
    const extractionSummary = [
      analysis.summary,
      extraction.summary,
      extraction.model !== "deterministic" ? `Análisis documental: ${extraction.model}.` : "",
      extraction.warnings.length ? `${extraction.warnings.length} advertencias de estructura.` : "",
      unchangedCount ? `${unchangedCount} dato(s) ya coincidían con el Centro de Control y no generaron otra revisión.` : "",
      extraction.unmappedCandidates.length
        ? `${extraction.unmappedCandidates.length} propuestas de sección nueva detectadas.`
        : "",
    ].filter(Boolean).join(" ");

    const proposalsUpdatedAt = new Date().toISOString();
    if (normalizedUpdates.length) {
      await upsertDocumentProposalRows(
        getD1JsonDatabase(),
        normalizedUpdates.map((update, index) => {
        const previousValueJson = previousByKey.get(update.key) ?? null;
        return {
          id: crypto.randomUUID(),
          fileId: id,
          generation: extractionGeneration,
          key: update.key,
          label: update.key,
          valueJson: update.valueJson,
          previousValueJson,
          valueType: update.valueType,
          area: update.area,
          sourceCurrency: update.sourceCurrency,
          cutoff: update.cutoff,
          confidence: normalizedUpdateConfidences[index] ?? 0,
          discrepancy: previousValueJson !== null,
          status: "pendiente",
          notes: extraction.warnings.join(" ").slice(0, 1000),
          createdByEmail: user.email,
          createdByName: user.displayName,
          updatedAt: proposalsUpdatedAt,
        };
        }),
      );
    }
    // Cerramos únicamente los candidatos pendientes de una lectura anterior.
    // Los nuevos se insertan después de publicar: así nunca se etiqueta como
    // "adaptado" un bloque que el contrato vivo haya rechazado.
    await db.update(unmappedFieldCandidates).set({
      status: "superado",
      reviewedByEmail: user.email,
      reviewedByName: user.displayName,
      reviewedAt: proposalsUpdatedAt,
      reviewNote: "Sustituido por una generación documental posterior.",
    }).where(and(
      eq(unmappedFieldCandidates.fileId, id),
      eq(unmappedFieldCandidates.status, "pendiente"),
    )).catch(() => undefined);
    const classifiedAt = new Date().toISOString();
    let classifiedFile: { id: string } | undefined;
    try {
      [classifiedFile] = await db.update(uploadedFiles).set({
        area: resolvedArea,
        documentType: resolvedDocumentType,
        classificationConfidence: financeProtectedUpload
          ? Math.max(resolvedClassificationConfidence, extraction.confidence)
          : resolvedClassificationConfidence,
        classificationReason: financeProtectedUpload && !initiallyProtectedUpload
          ? `${resolvedClassificationReason} El contenido extraído elevó el expediente a acceso financiero/comercial.`
          : resolvedClassificationReason,
        status: normalizedUpdates.length ? "pendiente_revision" : "integrado",
        processingStage: normalizedUpdates.length ? "contraste" : "sincronizado",
        processingProgress: normalizedUpdates.length ? 75 : 100,
        processingSummary: normalizedUpdates.length
          ? extractionSummary
          : preparedUpdates.length
            ? `${extractionSummary} Los ${unchangedCount} datos verificables ya estaban vigentes; no se alteró ninguna cifra.`
            : `${extractionSummary} El original quedó catalogado y no contiene cambios aplicables al modelo vivo.`,
        extractionMode: extraction.model === "deterministic" ? analysis.extractionMode : "openai_responses",
        extractionConfidence: normalizedUpdates.length ? extraction.confidence : analysis.confidence,
        extractionSummary,
        discrepancyCount,
        ingestionVersion: CURRENT_INGESTION_VERSION,
        processedAt: classifiedAt,
        proposalGeneration: extractionGeneration,
        requiresReview: normalizedUpdates.length > 0,
        reviewStatus: normalizedUpdates.length ? "listo_revision" : "sin_cambios",
        reviewedByEmail: normalizedUpdates.length ? "" : user.email,
        reviewedByName: normalizedUpdates.length ? "" : user.displayName,
        reviewedAt: normalizedUpdates.length ? "" : classifiedAt,
        updatedAt: classifiedAt,
      }).where(and(
        eq(uploadedFiles.id, id),
        eq(uploadedFiles.deletedAt, ""),
        eq(uploadedFiles.processingStage, "extraccion_en_curso"),
        eq(uploadedFiles.updatedAt, row.updatedAt),
      )).returning({ id: uploadedFiles.id });
    } catch (error) {
      const [settledFile] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
      if (settledFile?.deletedAt === "" && proposalPointerWasCommitted({
        row: settledFile,
        generation: extractionGeneration,
        committedAt: classifiedAt,
      })) {
        classifiedFile = { id: settledFile.id };
      } else {
        throw error;
      }
    }
    if (!classifiedFile) {
      throw new Error("CONFLICT: el expediente cambió durante la extracción.");
    }
    extractionCommitted = true;
    scheduleNotificationDispatch();
    await db.delete(documentDataProposals).where(and(
      eq(documentDataProposals.fileId, id),
      ne(documentDataProposals.generation, extractionGeneration),
    )).catch(() => undefined);
    await db.insert(fileActivity).values({
      fileId: id,
      eventType: "extraccion_preparada",
      message: normalizedUpdates.length
        ? `${normalizedUpdates.length} cambios extraídos y enviados a contraste en ${areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea}.`
        : unchangedCount
          ? `${unchangedCount} datos contrastados: ya estaban vigentes y el archivo se cerró sin crear una revisión duplicada.`
          : `Archivo dirigido a ${areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea}. Quedó catalogado sin cambios aplicables al modelo vivo.`,
      actorEmail: user.email,
      actorName: user.displayName,
    }).catch(() => undefined);
    let automaticMessage = unchangedCount
      ? `${unchangedCount} datos se comprobaron y ya coincidían con el Centro de Control; el archivo quedó sincronizado sin alterar cifras ni crear una revisión duplicada.`
      : "";
    let automaticallyDiscardedCount = 0;
    // El servicio de ingesta puede escribir un hecho financiero validado sin
    // conceder al cargador permiso para leer Finanzas. La autoría sigue siendo
    // la persona que subió el archivo y todas las pantallas protegidas continúan
    // aplicando su control de acceso habitual.
    const publicationActor = automaticPublicationRequested
      ? { ...user, financeAccess: true }
      : user;
    const canPublishInArea = automaticPublicationRequested || !financeProtectedUpload || user.financeAccess;
    const extractionConfidenceIsSafe = canAutomaticallyPublishExtraction({
      model: extraction.model,
      confidence: extraction.confidence,
      updateConfidences: normalizedUpdateConfidences,
      warnings: extraction.warnings,
      updateCount: normalizedUpdateConfidences.length,
    });
    const liveValues = currentLiveData?.values ?? {};
    const confidenceByKey = new Map(
      normalizedUpdates.map((update, index) => [update.key, normalizedUpdateConfidences[index] ?? 0]),
    );
    const unsafeAgentKeys = new Set([
      ...agentValidation.conflictingKeys,
      ...agentValidation.invalidKeys,
      ...financialValidation.blockingKeys,
    ]);
    // Condiciones del lote: valen para todos los datos por igual (se pidió
    // publicar solo, el área permite publicar, hay datos y contexto vivo).
    const batchPreconditions =
      automaticPublicationRequested &&
      canPublishInArea &&
      resolvedArea !== "sin_clasificar" &&
      normalizedUpdates.length > 0 &&
      Boolean(currentLiveData);
    // Condiciones de cada dato: su área coincide, quien sube puede publicarlo y
    // encaja en el contrato vivo. Antes esto se comprobaba con un `.every` que
    // bloqueaba TODO el lote si un solo dato fallaba —justo lo que hacía que un
    // informe con un dato dudoso de relleno no actualizara ninguna cifra. Ahora
    // decide dato a dato: los que encajan se publican solos y el resto queda
    // aislado con diagnóstico, sin bloquear el expediente.
    const updateIsAutoPublishable = (update: ReturnType<typeof normalizeLiveDataUpdates>[number]) =>
      (update.area === resolvedArea || (
        financeProtectedUpload &&
        !requiresFinanceAccessForArea(update.area) &&
        !isFinancialLiveKey(update.key)
      )) &&
      (publicationActor.financeAccess || !isFinancialLiveKey(update.key)) &&
      !unsafeAgentKeys.has(update.key) &&
      (confidenceByKey.get(update.key) ?? 0) > 0 &&
      isSafeAutomaticStructuredUpdate(update) &&
      individualUpdateContractIsSafe(update, liveValues);
    // Si todo el lote encaja (además, como lote atómico en el contrato), se
    // publica entero —cero cambio de comportamiento cuando todo cuadra—. Si no,
    // se publican los datos que individualmente son seguros y el resto se
    // cierra como diagnóstico, en vez de bloquear el informe completo.
    const wholeBatchSafe = batchPreconditions &&
      extractionConfidenceIsSafe &&
      agentValidation.safe &&
      normalizedUpdates.every(updateIsAutoPublishable) &&
      automaticContractIsSafe(normalizedUpdates, liveValues);
    const autoPublishable = wholeBatchSafe
      ? normalizedUpdates
      : batchPreconditions
        ? normalizedUpdates.filter(updateIsAutoPublishable)
        : [];
    let publicationVerification: Awaited<ReturnType<typeof publishLiveDataUpdates>>["verification"] | null = null;
    if (autoPublishable.length) {
      publicationStarted = true;
      const isFullBatch = autoPublishable.length === normalizedUpdates.length;
      const publication = await publishLiveDataUpdates({
        normalized: autoPublishable,
        actor: publicationActor,
        area: resolvedArea,
        cutoff: effectiveCutoff,
        sourceFileId: id,
        sourceName: candidate.name,
        message: `${autoPublishable.length} datos estructurados publicados automáticamente desde ${candidate.name}.`,
        financialValidation,
        monetaryAudit: currencyPreparation.audit.filter((entry) =>
          autoPublishable.some((update) => update.key === entry.key)),
        sourceAuthority: financialValidation.authority.filter((decision) =>
          autoPublishable.some((update) => update.key === decision.key)),
        affectedViews: financialValidation.affectedViews,
        reviewClosure: {
          mode: "insert" as const,
          fileId: id,
          proposalGeneration: extractionGeneration,
          // Un reproceso publica una revisión más sobre un expediente que ya
          // tenía un cierre `auto:${id}`. La clave idempotente lleva la
          // generación para no chocar con ese cierre anterior; una primera
          // publicación conserva la clave estable de siempre.
          requestKey: reprocessing ? `auto:${id}:${extractionGeneration}` : `auto:${id}`,
          completedAction: "aprobado_automatico",
          note: isFullBatch
            ? "Publicación automática de hechos explícitos con confianza positiva, validados por el contrato vivo."
            : "Publicación automática parcial: los hechos válidos se publicaron y las entradas rechazadas se aislaron sin bloquear el expediente.",
          proposalCount: normalizedUpdates.length,
          ...(isFullBatch ? {} : { publishedKeys: autoPublishable.map((update) => update.key) }),
        },
      });
      publicationCompleted = true;
      publicationVerification = publication.verification;
      agentPublishedCount = autoPublishable.length;
      automaticMessage = isFullBatch
        ? `${autoPublishable.length} datos se han actualizado automáticamente en la revisión ${publication.id}; las cifras y gráficas se refrescarán en menos de 5 segundos.`
        : `${autoPublishable.length} de ${normalizedUpdates.length} cambios válidos se han actualizado automáticamente en la revisión ${publication.id}; los demás quedaron diagnosticados y cerrados sin bloquear el expediente.`;
      if (isFullBatch && buildingScopeIncomplete) {
        await db.update(uploadedFiles).set({
          reviewStatus: "aprobado_con_alertas",
          processingSummary: `${extractionSummary} Los datos verificables se publicaron en la revisión ${publication.id}. No se inventó avance para ${missingExpectedBuildingCodes.join(", ")}; la ausencia quedó registrada como diagnóstico.`,
          updatedAt: new Date().toISOString(),
        }).where(eq(uploadedFiles.id, id)).catch(() => undefined);
      }
      if (!isFullBatch) {
        const resolvedAt = new Date().toISOString();
        const discarded = normalizedUpdates.length - autoPublishable.length;
        automaticallyDiscardedCount += discarded;
        await db.update(uploadedFiles).set({
          status: "integrado",
          processingStage: "sincronizado",
          processingProgress: 100,
          requiresReview: false,
          reviewStatus: "aprobado_con_alertas",
          processingSummary: `${extractionSummary} ${autoPublishable.length} cambios se publicaron en la revisión ${publication.id}; ${discarded} entradas no válidas se aislaron automáticamente sin bloquear los datos correctos.${buildingScopeIncomplete ? ` El lector no encontró avance verificable para ${missingExpectedBuildingCodes.join(", ")}.` : ""}`,
          updatedAt: resolvedAt,
        }).where(eq(uploadedFiles.id, id)).catch(() => undefined);
      }
    }
    if (normalizedUpdates.length && !publicationCompleted && automaticPublicationRequested) {
      const resolvedAt = new Date().toISOString();
      automaticallyDiscardedCount = normalizedUpdates.length;
      await db.update(documentDataProposals).set({
        status: "descartado_automatico",
        updatedAt: resolvedAt,
      }).where(and(
        eq(documentDataProposals.fileId, id),
        eq(documentDataProposals.generation, extractionGeneration),
        eq(documentDataProposals.status, "pendiente"),
      ));
      await db.update(uploadedFiles).set({
        status: "integrado",
        processingStage: "sincronizado",
        processingProgress: 100,
        requiresReview: false,
        reviewStatus: "procesado_con_alertas",
        reviewedByEmail: user.email,
        reviewedByName: user.displayName,
        reviewedAt: resolvedAt,
        processingSummary: `${extractionSummary} Ningún cambio superó las validaciones del modelo; el original y el diagnóstico quedan archivados y ninguna cifra vigente se modificó.`,
        updatedAt: resolvedAt,
      }).where(eq(uploadedFiles.id, id));
      automaticMessage = `El archivo quedó procesado con diagnóstico. Ningún dato seguro requería modificar el Centro de Control y no queda pendiente de revisión.`;
    }
    if (extraction.unmappedCandidates.length) {
      const materializedDynamicKeys = new Set([
        ...changeSet.unchanged.map((update) => update.key),
        ...(publicationCompleted ? autoPublishable.map((update) => update.key) : []),
      ]);
      // notify_unmapped_field_candidate_created (migración 0020) genera la
      // notificación al insertar. El estado refleja el resultado real de la
      // publicación, no solo la intención del agente.
      await db.insert(unmappedFieldCandidates).values(
        extraction.unmappedCandidates.map((candidate, index) => {
          const materialized = materializedDynamicKeys.has(seccionesDescubiertas[index]?.key ?? "");
          return {
            id: crypto.randomUUID(),
            fileId: id,
            label: candidate.label,
            description: candidate.description,
            valueJson: candidate.valueJson,
            suggestedArea: candidate.suggestedArea,
            evidence: candidate.evidence,
            confidence: candidate.confidence,
            status: materialized ? "adaptado" : "pendiente",
            reviewedByEmail: materialized ? user.email : "",
            reviewedByName: materialized ? user.displayName : "",
            reviewedAt: materialized ? proposalsUpdatedAt : "",
            reviewNote: materialized
              ? "Convertido automáticamente en una sección visual trazable durante la ingesta."
              : "La sección quedó preparada para reintento automático; todavía no se ha publicado.",
          };
        }),
      ).catch(() => undefined);
    }
    const templateSucceeded = publicationCompleted || unchangedCount > 0;
    const learnedUpdates = publicationCompleted ? autoPublishable : preparedUpdates;
    if (templateSucceeded) {
      const templateId = matchedTemplateId || crypto.randomUUID();
      const [storedTemplate] = await db.insert(documentTemplates).values({
        id: templateId,
        fingerprint: templateIdentity.fingerprint,
        namePattern: templateIdentity.namePattern,
        extension,
        area: resolvedArea,
        documentType: resolvedDocumentType,
        mappingJson: JSON.stringify(templateMappingFromUpdates(learnedUpdates)),
        visualizationJson: JSON.stringify(seccionesDescubiertas.map((section) => ({
          key: section.key,
          visualization: section.value.visualization,
          unit: section.value.unit,
        }))),
        promptVersion: agentPromptVersion,
        confidence: extraction.confidence,
        successCount: 1,
        lastSourceFileId: id,
        lastRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: documentTemplates.fingerprint,
        set: {
          area: resolvedArea,
          documentType: resolvedDocumentType,
          mappingJson: JSON.stringify(templateMappingFromUpdates(learnedUpdates)),
          visualizationJson: JSON.stringify(seccionesDescubiertas.map((section) => ({
            key: section.key,
            visualization: section.value.visualization,
            unit: section.value.unit,
          }))),
          promptVersion: agentPromptVersion,
          confidence: extraction.confidence,
          successCount: sql`${documentTemplates.successCount} + 1`,
          lastSourceFileId: id,
          lastRunAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }).returning({ id: documentTemplates.id });
      matchedTemplateId = storedTemplate?.id ?? templateId;
    } else if (matchedTemplateId && !preparedUpdates.length) {
      await db.update(documentTemplates).set({
        failureCount: sql`${documentTemplates.failureCount} + 1`,
        lastRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(documentTemplates.id, matchedTemplateId)).catch(() => undefined);
    }
    if (agentRunId) {
      await db.update(ingestionAgentRuns).set({
        templateId: matchedTemplateId,
        status: publicationCompleted
          ? "published"
          : unchangedCount
            ? "verified_unchanged"
            : automaticallyDiscardedCount
              ? "resolved_with_alerts"
              : normalizedUpdates.length ? "prepared" : "no_data",
        model: agentModel,
        promptVersion: agentPromptVersion,
        iterations: agentIterations,
        toolCallsJson: JSON.stringify(agentTrace.slice(0, 20)),
        validationJson: JSON.stringify(agentValidation),
        proposedCount: agentProposedCount,
        publishedCount: agentPublishedCount,
        inputTokens: agentInputTokens,
        cachedInputTokens: agentCachedInputTokens,
        cacheWriteInputTokens: agentCacheWriteInputTokens,
        outputTokens: agentOutputTokens,
        estimatedCostUsdMicros: agentEstimatedCostUsdMicros,
        completedAt: new Date().toISOString(),
      }).where(eq(ingestionAgentRuns.id, agentRunId));
      await db.insert(fileActivity).values({
        fileId: id,
        eventType: "agente_ingesta_completado",
        message: publicationCompleted
          ? `El agente contrastó ${agentProposedCount} dato(s), publicó ${agentPublishedCount} y memorizó la plantilla documental.`
          : unchangedCount
            ? `El agente contrastó ${agentProposedCount} dato(s): ya estaban vigentes y cerró el archivo sin duplicar revisiones.`
            : automaticallyDiscardedCount
              ? `El agente aisló ${automaticallyDiscardedCount} entrada(s) no válidas, preservó los valores vigentes y cerró el diagnóstico.`
              : `El agente contrastó ${agentProposedCount} dato(s); el original y el diagnóstico quedan trazados.`,
        actorEmail: user.email,
        actorName: user.displayName,
      }).catch(() => undefined);
    }
    const financialReceipt = financeProtectedUpload ? {
      status: financialValidation.status,
      checks: financialValidation.checks.map((check) => ({
        id: check.id,
        label: check.label,
        status: check.status,
        actual: check.actual,
        expected: check.expected,
        difference: check.difference,
        tolerance: check.tolerance,
        message: check.message,
      })),
      authority: {
        accepted: financialValidation.authority.filter((decision) =>
          !["stale", "lower_authority"].includes(decision.status)).length,
        isolated: financialValidation.authority.filter((decision) =>
          ["stale", "lower_authority"].includes(decision.status)).length,
        decisions: financialValidation.authority,
      },
      currency: {
        sourceCurrency,
        convertedFieldCount: currencyPreparation.audit.reduce((sum, entry) => sum + entry.convertedFieldCount, 0),
        usdToDop: currencyPreparation.audit[0]?.usdToDop ?? null,
        rateCutoff: currencyPreparation.audit[0]?.rateCutoff ?? "",
        audit: currencyPreparation.audit,
      },
      affectedViews: financialValidation.affectedViews,
      changes: financialBeforeAfter,
      verification: publicationVerification,
    } : null;
    const storedReceipt = {
      outcome: publicationCompleted
        ? "published"
        : unchangedCount
          ? "unchanged"
          : automaticallyDiscardedCount
            ? "diagnosed"
            : "catalogued",
      publishedCount: agentPublishedCount,
      unchangedCount,
      ignoredCount: automaticallyDiscardedCount,
      warningCount: extraction.warnings.length,
      newSectionCount: extraction.unmappedCandidates.length,
      financial: financialReceipt,
      createdAt: new Date().toISOString(),
    };
    await db.update(uploadedFiles).set({
      processingReceiptJson: JSON.stringify(storedReceipt),
    }).where(eq(uploadedFiles.id, id)).catch(() => undefined);
    let currentRow = row;
    try {
      const [freshRow] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
      if (freshRow) currentRow = freshRow;
    } catch {
      // La fila inicial durable permite responder aunque falle esta lectura auxiliar.
    }
    await notifyUploaderOfProcessingResult({
      fileId: currentRow.id,
      uploaderEmail: currentRow.uploaderEmail,
      uploaderName: currentRow.uploaderName,
      updatedAt: currentRow.updatedAt,
      outcome: "completed",
    });
    if (financeProtectedUpload && !user.financeAccess) {
      return Response.json({
        restricted: true,
        receipt: {
          outcome: publicationCompleted ? "published" : unchangedCount ? "unchanged" : "catalogued",
          area: resolvedArea,
          areaLabel: "Área financiera/comercial protegida",
          publishedCount: agentPublishedCount,
          unchangedCount,
          ignoredCount: automaticallyDiscardedCount,
          warningCount: extraction.warnings.length,
          warnings: extraction.warnings.length
            ? ["El análisis terminó con observaciones protegidas que puede consultar una persona autorizada de Finanzas."]
            : [],
          newSectionCount: extraction.unmappedCandidates.length,
          requiresAction: false,
          nextAction: "No tienes que hacer nada. Las cifras quedan visibles sólo para las personas autorizadas.",
        },
        message: "El contenido se ha archivado y procesado en Finanzas/Ventas. Solo las personas autorizadas pueden consultar sus cifras o abrir el expediente.",
      }, { status: 202 });
    }
    return Response.json(
      {
        file: publicFileRow(currentRow, user),
        receipt: {
          outcome: publicationCompleted
            ? "published"
            : unchangedCount
              ? "unchanged"
              : automaticallyDiscardedCount
                ? "diagnosed"
                : "catalogued",
          area: resolvedArea,
          areaLabel: areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea,
          publishedCount: agentPublishedCount,
          unchangedCount,
          ignoredCount: automaticallyDiscardedCount,
          warningCount: extraction.warnings.length,
          warnings: extraction.warnings.slice(0, 4),
          newSectionCount: extraction.unmappedCandidates.length,
          financial: financialReceipt,
          requiresAction: Boolean(currentRow.requiresReview),
          nextAction: currentRow.requiresReview
            ? "Abre el expediente para resolver la comprobación indicada."
            : publicationCompleted
              ? "No tienes que hacer nada: el Centro de Control ya está sincronizado."
              : "El original quedó archivado y los valores vigentes se conservaron.",
        },
        message: automaticMessage || (normalizedUpdates.length
          ? `Archivo registrado en ${areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea}. Se han preparado ${normalizedUpdates.length} cambios para revisión.`
          : nothingExtractedMessage(
              areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea,
              extension,
              [extraction.summary, ...extraction.warnings],
            )),
        ...(debugRequested && user.financeAccess ? {
          diagnostic: {
            expectedBuildingCodes,
            buildingUpdates: extraction.updates
              .filter((update) => /^buildings\.TH-\d+\.(?:progress|phases(?:\.|$))/i.test(update.key))
              .map((update) => ({ key: update.key, value: update.value })),
          },
        } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("file extraction/publication failed", id, error);
    // Sólo el texto del error (nombre + mensaje), acotado. Los errores de esta
    // fase son mensajes descriptivos del contrato/publicación o del motor D1
    // (nombres de restricción), nunca valores de negocio.
    const debugDetail = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 600);
    if (agentRunId) {
      await db.update(ingestionAgentRuns).set({
        templateId: matchedTemplateId,
        status: publicationCompleted ? "published_with_close_error" : "failed",
        model: agentModel,
        promptVersion: agentPromptVersion,
        iterations: agentIterations,
        toolCallsJson: JSON.stringify(agentTrace.slice(0, 20)),
        validationJson: JSON.stringify(agentValidation),
        proposedCount: agentProposedCount,
        publishedCount: agentPublishedCount,
        inputTokens: agentInputTokens,
        cachedInputTokens: agentCachedInputTokens,
        cacheWriteInputTokens: agentCacheWriteInputTokens,
        outputTokens: agentOutputTokens,
        estimatedCostUsdMicros: agentEstimatedCostUsdMicros,
        error: debugDetail,
        completedAt: new Date().toISOString(),
      }).where(eq(ingestionAgentRuns.id, agentRunId)).catch(() => undefined);
    }
    if (matchedTemplateId && !publicationCompleted) {
      await db.update(documentTemplates).set({
        failureCount: sql`${documentTemplates.failureCount} + 1`,
        lastRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(documentTemplates.id, matchedTemplateId)).catch(() => undefined);
    }
    let authoritativePointerReadSucceeded = false;
    if (!extractionCommitted && extractionGeneration) {
      try {
        const [authoritativeFile] = await db.select().from(uploadedFiles)
          .where(eq(uploadedFiles.id, id))
          .limit(1);
        authoritativePointerReadSucceeded = true;
        extractionCommitted = proposalPointerWasCommitted({
          row: authoritativeFile,
          generation: extractionGeneration,
        });
      } catch {
        // Unknown means preserve. A retry can safely reconcile the staged rows.
      }
    }
    if (extractionGeneration && stagedGenerationMayBeDeleted({
      authoritativeReadSucceeded: authoritativePointerReadSucceeded,
      pointerCommitted: extractionCommitted,
    })) {
      await db.delete(documentDataProposals).where(and(
        eq(documentDataProposals.fileId, id),
        eq(documentDataProposals.generation, extractionGeneration),
      )).catch(() => undefined);
    }
    const processingSummary = publicationCompleted
      ? "Los datos llegaron a publicarse, pero el cierre administrativo quedó incompleto. El original, el historial y las propuestas se conservan para conciliación."
      : publicationStarted
        ? "La publicación automática no pudo confirmarse por completo. El original y todas las evidencias permanecen archivados para revisión."
        : "El original quedó archivado, pero su extracción o preparación de propuestas necesita revisión manual.";
    await db.update(uploadedFiles).set({
      status: "observado",
      processingStage: "observado",
      processingProgress: publicationCompleted ? 95 : 60,
      processingSummary,
      requiresReview: true,
      reviewStatus: "cambios_solicitados",
      // If classification never completed, the provisional document type
      // remains protected and can only be resolved by an authorized retry.
      documentType: protectionResolved ? resolvedDocumentType : PROVISIONAL_DOCUMENT_TYPE,
      ingestionVersion: CURRENT_INGESTION_VERSION,
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(extractionCommitted
      ? and(
          eq(uploadedFiles.id, id),
          eq(uploadedFiles.deletedAt, ""),
          eq(uploadedFiles.proposalGeneration, extractionGeneration),
          isNull(uploadedFiles.publicationRevision),
        )
      : and(
          eq(uploadedFiles.id, id),
          eq(uploadedFiles.deletedAt, ""),
          eq(uploadedFiles.processingStage, "extraccion_en_curso"),
          eq(uploadedFiles.updatedAt, row.updatedAt),
        )).catch(() => undefined);
    scheduleNotificationDispatch();
    await db.insert(fileActivity).values({
      fileId: id,
      eventType: "procesamiento_observado",
      message: processingSummary,
      actorEmail: user.email,
      actorName: user.displayName,
    }).catch(() => undefined);
    let currentRow = row;
    try {
      const [freshRow] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
      if (freshRow) currentRow = freshRow;
    } catch {
      // Conserva como respuesta la fila obtenida en el alta inicial.
    }
    if (!backgroundProcessing) {
      await notifyUploaderOfProcessingResult({
        fileId: currentRow.id,
        uploaderEmail: currentRow.uploaderEmail,
        uploaderName: currentRow.uploaderName,
        updatedAt: currentRow.updatedAt,
        outcome: "attention",
      });
    }
    if (fileRequiresFinanceAccess(currentRow) && !user.financeAccess) {
      return Response.json({
        restricted: true,
        receipt: {
          outcome: "observed",
          area: "protegida",
          areaLabel: "Área financiera/comercial protegida",
          publishedCount: 0,
          unchangedCount: 0,
          ignoredCount: 0,
          warningCount: 1,
          warnings: ["El equipo autorizado recibirá el diagnóstico del procesamiento."],
          newSectionCount: 0,
          requiresAction: false,
          nextAction: "No vuelvas a subir otra copia; el original ya está conservado.",
        },
        message: "El original está archivado de forma confidencial y queda pendiente de revisión por una persona autorizada.",
      }, { status: 202 });
    }
    return Response.json({
      file: publicFileRow(currentRow, user),
      receipt: {
        outcome: "observed",
        area: currentRow.area,
        areaLabel: areaLabels[currentRow.area as keyof typeof areaLabels] ?? currentRow.area,
        publishedCount: publicationCompleted ? agentPublishedCount : 0,
        unchangedCount: 0,
        ignoredCount: 0,
        warningCount: 1,
        warnings: [processingSummary],
        newSectionCount: 0,
        requiresAction: true,
        nextAction: "Abre el expediente observado; el original ya está guardado y no debes subir otra copia.",
      },
      message: processingSummary,
      ...(debugRequested && user.financeAccess ? { debug: debugDetail } : {}),
    }, { status: 201 });
  }
}
