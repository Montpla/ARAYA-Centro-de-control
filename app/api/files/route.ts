import { env } from "cloudflare:workers";
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
  fileActivity,
  uploadedFiles,
  unmappedFieldCandidates,
} from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { resolveSourceCurrency } from "../../../lib/currency";
import { areaLabels, classifyUpload, safeFileName, uploadAreas } from "../../../lib/file-routing";
import { analyzeDocument, extractStructuredUpdates } from "../../../lib/ingestion";
import {
  canAutomaticallyPublishExtraction,
  extractDocumentWithAI,
} from "../../../lib/ai-document-extraction";
import {
  financeProtectedAreaValues,
  financeProtectedDocumentTypeValues,
  isCommercialLiveKey,
  isFinancialLiveKey,
  namingToken,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "../../../lib/live-data";
import {
  decodeFileRegistryCursor,
  encodeFileRegistryCursor,
  latestFileRegistryCursor,
  normalizeFilePageSize,
} from "../../../lib/file-registry-pagination";
import { scheduleNotificationDispatch } from "../../../lib/notification-dispatch";
import {
  D1JsonDatabase,
  selectLivePointValues,
  upsertDocumentProposalRows,
} from "../../../lib/d1-json-bulk";
import { assertLiveDataContracts, getContractRootsSnapshot, validateLiveDataContract } from "../../../lib/live-data-contract";
import { normalizeLiveDataUpdates, publishLiveDataUpdates } from "../../../lib/publish-live-data";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { resolveSpatialIdentityUpdates } from "../../../lib/spatial-identity-upsert";
import { nothingExtractedMessage } from "../../../lib/upload-messages";
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

function publicFileRow(
  row: typeof uploadedFiles.$inferSelect,
  user?: { email: string; role: string },
) {
  return {
    id: row.id,
    originalName: row.originalName,
    area: row.area,
    areaLabel: areaLabels[row.area as keyof typeof areaLabels] ?? row.area,
    section: row.section,
    description: row.description,
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
    classificationReason: row.classificationReason,
    processingStage: row.processingStage,
    processingProgress: row.processingProgress,
    processingSummary: row.processingSummary,
    requiresReview: row.requiresReview,
    projectId: row.projectId,
    documentType: row.documentType,
    detectedPeriod: row.detectedPeriod,
    extractionMode: row.extractionMode,
    extractionConfidence: row.extractionConfidence,
    extractionSummary: row.extractionSummary,
    discrepancyCount: row.discrepancyCount,
    reviewStatus: row.reviewStatus,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    publicationRevision: row.publicationRevision,
    publishedAt: row.publishedAt,
    deletedAt: row.deletedAt,
    deletedByName: row.deletedByName,
    deleteReason: row.deleteReason,
    restoredAt: row.restoredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canManage: Boolean(user && (user.role === "admin" || user.email === row.uploaderEmail)),
    downloadUrl: `/api/files?download=${encodeURIComponent(row.id)}`,
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
    : and(
        notInArray(uploadedFiles.area, financeProtectedAreaValues()),
        notInArray(uploadedFiles.documentType, financeProtectedDocumentTypeValues()),
      );
  const deletedCondition = !includeDeleted
    ? eq(uploadedFiles.deletedAt, "")
    : user.role === "admin"
      ? sql`1 = 1`
      : or(
          eq(uploadedFiles.deletedAt, ""),
          eq(uploadedFiles.uploaderEmail, user.email),
        );
  return and(financeCondition, deletedCondition);
}

function fileRegistryRowVisible(
  row: Pick<typeof uploadedFiles.$inferSelect, "area" | "documentType" | "deletedAt" | "uploaderEmail">,
  user: FileRegistryUser,
  includeDeleted: boolean,
) {
  if (!user.financeAccess && fileRequiresFinanceAccess(row)) return false;
  if (!row.deletedAt) return true;
  return includeDeleted && (user.role === "admin" || row.uploaderEmail === user.email);
}

async function fileRegistrySummary(user: FileRegistryUser, includeDeleted: boolean) {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' then 1 else 0 end), 0)`,
      deleted: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} <> '' then 1 else 0 end), 0)`,
      pendingReview: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.requiresReview} = 1 then 1 else 0 end), 0)`,
      synchronized: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.processingProgress} >= 100 then 1 else 0 end), 0)`,
      observed: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' and ${uploadedFiles.status} in ('observado', 'rechazado') then 1 else 0 end), 0)`,
      averageProgress: sql<number>`coalesce(round(avg(case when ${uploadedFiles.deletedAt} = '' then ${uploadedFiles.processingProgress} end)), 0)`,
      discrepancies: sql<number>`coalesce(sum(case when ${uploadedFiles.deletedAt} = '' then ${uploadedFiles.discrepancyCount} else 0 end), 0)`,
      lastUploadAt: sql<string>`coalesce(max(case when ${uploadedFiles.deletedAt} = '' then ${uploadedFiles.createdAt} end), '')`,
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
    if (!auth.user) return auth.response;
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
  const automaticPublicationRequested = formData.get("autoPublish") === "true";
  // Un reproceso es una repetición pedida a propósito: vuelve a pasar por la
  // ingesta actual un expediente que ya se archivó (y quizá ya se publicó), para
  // que recoja las mejoras de un lector cuando el archivo se subió antes de que
  // ese lector existiera. No crea otra copia —reusa la misma fila y el mismo
  // original— y publica una revisión nueva encima. Sin esta señal explícita, un
  // archivo idéntico ya publicado se queda como está.
  const reprocessRequested = formData.get("reprocess") === "true";
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
  if (requiresFinanceAccessForArea(classification.area) && !user.financeAccess) {
    return Response.json({ error: "No tienes permiso para cargar documentos financieros o comerciales." }, { status: 403 });
  }
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
  let initiallyProtectedUpload = requiresFinanceAccessForDocument(
    classification.area,
    analysis.documentType,
  );
  if (initiallyProtectedUpload && !user.financeAccess) {
    return Response.json({ error: "El contenido detectado requiere acceso financiero y comercial." }, { status: 403 });
  }
  const sha256 = hexDigest(await crypto.subtle.digest("SHA-256", bytes));
  const db = getDb();

  const [duplicate] = await db
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.sha256, sha256), eq(uploadedFiles.deletedAt, "")))
    .limit(1);
  let resumedRow: typeof uploadedFiles.$inferSelect | null = null;
  let reprocessing = false;
  if (duplicate) {
    const provisionalOwnedByUser = duplicate.documentType === PROVISIONAL_DOCUMENT_TYPE &&
      duplicate.uploaderEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
    if (fileRequiresFinanceAccess(duplicate) && !user.financeAccess && !provisionalOwnedByUser) {
      return Response.json({ error: "No tienes acceso al expediente ya registrado." }, { status: 403 });
    }
    const canResume = duplicate.publicationRevision === null &&
      (duplicate.reviewStatus === "pendiente_extraccion" || duplicate.reviewStatus === "cambios_solicitados") &&
      duplicate.status !== "integrado" &&
      duplicate.status !== "rechazado";
    // El reproceso reclama incluso un expediente ya publicado, siempre que quien
    // lo pide tenga el acceso que ese contenido exige. Un archivo rechazado no
    // se reabre por esta vía: esa decisión es deliberada y se respeta.
    const canReprocess = reprocessRequested &&
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
        processingStage: "extraccion_en_curso",
        processingProgress: 45,
        processingSummary: classification.confidence > 0
          ? `${analysis.summary} Original archivado; interpretación en curso.`
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

  let resolvedArea = row.area;
  let resolvedDocumentType = row.documentType === PROVISIONAL_DOCUMENT_TYPE
    ? analysis.documentType
    : row.documentType;
  let financeProtectedUpload = true;
  let protectionResolved = false;
  let publicationStarted = false;
  let publicationCompleted = false;
  let extractionGeneration = "";
  let extractionCommitted = false;
  try {
    const deterministicExtraction = await extractStructuredUpdates(bytes, extension, {
      area: classification.area,
      cutoff: effectiveCutoff,
      sourceCurrency: sourceCurrency === "USD" ? "USD" : "DOP",
      sourceName: candidate.name,
      // Los edificios que existen ahora mismo. Sin esta lista, una tarea del
      // plan rotulada "TH-99" daría de alta un edificio fantasma en la
      // implantación; con ella, simplemente se deja fuera y se avisa.
      knownBuildingTokens: knownBuildingTokens(),
    });
    let extraction: Awaited<ReturnType<typeof extractDocumentWithAI>> = {
      ...deterministicExtraction,
      updateConfidences: deterministicExtraction.updates.map(() => 1),
      confidence: deterministicExtraction.updates.length ? 1 : 0,
      model: "deterministic",
      promptVersion: "structured-file-v1",
      unmappedCandidates: [],
    };
    // Se lee antes de llamar a la IA (no solo para validar el contrato
    // después) porque también se le pasa como referencia de esquema: sin ver
    // los nombres de campo reales ya existentes, el modelo inventaba claves
    // plausibles pero distintas (p. ej. "physicalProgressExecuted" en vez de
    // "overallProgress"), y el contrato las rechazaba en silencio.
    const currentLiveData = await readEffectiveLiveData(true);
    // Un informe en PowerPoint, Word o PDF es narrativo: un lector propio saca
    // sus cifras con fiabilidad, pero un mismo documento puede traer varias
    // áreas y ningún lector las cubre todas (el Informe Ejecutivo lleva ventas,
    // obra, seguridad y finanzas en 37 láminas). Antes, si el lector encontraba
    // algo, la IA no corría, y lo que el lector no cubría se quedaba sin
    // actualizar. Ahora el lector manda y la IA COMPLETA los huecos: se ejecuta
    // también cuando el lector sólo cubrió parte de un documento narrativo, y
    // sólo se quedan de la IA las claves que ningún lector tocó. Un Excel o un
    // plan de Project se leen enteros y no necesitan ese complemento.
    const documentoNarrativo = ["pptx", "docx", "pdf"].includes(extension);
    const lecturaParcial = deterministicExtraction.updates.length > 0 && documentoNarrativo;
    if (!deterministicExtraction.updates.length || lecturaParcial) {
      const iaExtraction = await extractDocumentWithAI({
        bytes,
        fileName: candidate.name,
        mimeType: candidate.type || canonicalMimeByExtension[extension] || "application/octet-stream",
        extension,
        area: classification.area,
        cutoff: effectiveCutoff,
        sourceCurrency: sourceCurrency === "USD" ? "USD" : "DOP",
        apiKey: process.env.OPENAI_API_KEY ?? "",
        currentValues: currentLiveData.values,
        knownAreas: uploadAreas,
        schemaReference: getContractRootsSnapshot(),
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
    }
    // Las colecciones de partida permiten traducir a posición el nombre de una
    // entidad en cualquier lista del modelo, no sólo en las espaciales: las
    // económicas no tienen id y sólo se distinguen por su nombre. Si la
    // traducción tropezara con una entrada rara, se sigue con las claves tal
    // cual en vez de tumbar toda la ingesta: la normalización posterior ya
    // descarta dato a dato lo que no encaje.
    let identityResolvedUpdates = extraction.updates;
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
    // Cuántos bloques descubiertos hay ya: los nuevos se añaden al final, y
    // escribir un índice ocupado sobrescribiría el bloque de otro documento.
    const existingDiscoveredCount = Array.isArray(currentLiveData.values.discoveredSections)
      ? currentLiveData.values.discoveredSections.length
      : 0;

    // Un bloque que la lectura descubre y para el que no existe ningún campo ya
    // no espera aprobación: se publica como sección descubierta, con su
    // procedencia, su confianza y la evidencia del documento a la vista. Antes
    // se quedaba apartado indefinidamente y nadie llegaba a verlo — el informe
    // de ventas de julio pasó así dos bloques enteros.
    //
    // Sólo se crea cuando quien sube tiene autorización financiera: el
    // contenido descubierto puede ser cualquier cosa, incluidas cifras de
    // ventas, y no se sabe qué es hasta mirarlo. Sin esa condición, una carga
    // de obra podría publicar contenido comercial sin querer.
    const seccionesDescubiertas = user.financeAccess
      ? extraction.unmappedCandidates.map((candidato, posicion) => {
          let valores: Array<{ label: string; value: string }> = [];
          try {
            const contenido = JSON.parse(candidato.valueJson) as unknown;
            if (Array.isArray(contenido)) {
              valores = contenido.slice(0, 40).map((fila, indice) => ({
                label: typeof fila === "object" && fila !== null && "label" in fila
                  ? String((fila as Record<string, unknown>).label).slice(0, 120)
                  : `Dato ${indice + 1}`,
                value: typeof fila === "object" && fila !== null && "value" in fila
                  ? String((fila as Record<string, unknown>).value).slice(0, 200)
                  : String(fila).slice(0, 200),
              }));
            } else if (contenido && typeof contenido === "object") {
              valores = Object.entries(contenido as Record<string, unknown>)
                .slice(0, 40)
                .map(([clave, valor]) => ({
                  label: clave.slice(0, 120),
                  value: String(valor).slice(0, 200),
                }));
            }
          } catch {
            // Sin valor estructurado queda la evidencia, que es lo que de
            // verdad contiene el dato cuando la extracción no lo estructuró.
          }
          return {
            key: `discoveredSections.${existingDiscoveredCount + posicion}`,
            value: {
              id: `descubierto-${id}-${posicion}`,
              title: candidato.label.slice(0, 160),
              description: candidato.description.slice(0, 400),
              area: candidato.suggestedArea || resolvedArea,
              evidence: candidato.evidence.slice(0, 600),
              confidence: candidato.confidence,
              sourceName: candidate.name,
              detectedAt: new Date().toISOString(),
              values: valores,
            },
            area: resolvedArea,
            cutoff: effectiveCutoff,
            sourceCurrency: (sourceCurrency === "USD" ? "USD" : "DOP") as "USD" | "DOP",
            sourceName: candidate.name,
          };
        })
      : [];

    const normalizacion = identityResolvedUpdates.length || seccionesDescubiertas.length
      ? normalizeIngestedUpdatesResilient(
          [
            ...identityResolvedUpdates.map((update) => ({
              ...update,
              sourceFileId: id,
              sourceName: candidate.name,
            })),
            ...seccionesDescubiertas.map((update) => ({ ...update, sourceFileId: id })),
          ],
          {
            area: classification.area,
            cutoff: effectiveCutoff,
            sourceFileId: id,
            sourceName: candidate.name,
          },
        )
      : { normalized: [], descartadas: 0 };
    const extractedUpdates = normalizacion.normalized;
    if (normalizacion.descartadas > 0) {
      extraction = {
        ...extraction,
        warnings: [
          ...extraction.warnings,
          `${normalizacion.descartadas} dato(s) no encajaban en el modelo vivo y se descartaron; el resto se conservó.`,
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
    const normalizedUpdates = financeProtectedUpload
      ? extractedUpdates.map((update) => ({ ...update, area: resolvedArea }))
      : extractedUpdates;
    extractionGeneration = `ingest:${crypto.randomUUID()}`;
    const existingPoints = await selectLivePointValues(
      getD1JsonDatabase(),
      normalizedUpdates.map((update) => update.key),
    );
    const previousByKey = new Map(existingPoints.map((point) => [point.key, point.valueJson]));
    const discrepancyCount = normalizedUpdates.filter((update) => {
      const previous = previousByKey.get(update.key);
      return previous !== undefined && previous !== update.valueJson;
    }).length;
    const extractionSummary = [
      analysis.summary,
      extraction.summary,
      extraction.model !== "deterministic" ? `Análisis documental: ${extraction.model}.` : "",
      extraction.warnings.length ? `${extraction.warnings.length} advertencias de estructura.` : "",
      extraction.unmappedCandidates.length
        ? `${extraction.unmappedCandidates.length} propuestas de sección nueva detectadas.`
        : "",
    ].filter(Boolean).join(" ");

    const proposalsUpdatedAt = new Date().toISOString();
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
          confidence: extraction.updateConfidences[index] ?? 0,
          discrepancy: previousValueJson !== null && previousValueJson !== update.valueJson,
          status: "pendiente",
          notes: extraction.warnings.join(" ").slice(0, 1000),
          createdByEmail: user.email,
          createdByName: user.displayName,
          updatedAt: proposalsUpdatedAt,
        };
      }),
    );
    if (extraction.unmappedCandidates.length) {
      // notify_unmapped_field_candidate_created (migración 0020) genera la
      // notificación al insertar; esta ruta solo escribe la fila y programa
      // el despacho, igual que el resto de rutas propiedad de un trigger.
      await db.insert(unmappedFieldCandidates).values(
        extraction.unmappedCandidates.map((candidate) => ({
          id: crypto.randomUUID(),
          fileId: id,
          label: candidate.label,
          description: candidate.description,
          valueJson: candidate.valueJson,
          suggestedArea: candidate.suggestedArea,
          evidence: candidate.evidence,
          confidence: candidate.confidence,
        })),
      ).catch(() => undefined);
    }
    const classifiedAt = new Date().toISOString();
    let classifiedFile: { id: string } | undefined;
    try {
      [classifiedFile] = await db.update(uploadedFiles).set({
        area: resolvedArea,
        documentType: resolvedDocumentType,
        classificationConfidence: financeProtectedUpload
          ? Math.max(classification.confidence, extraction.confidence)
          : classification.confidence,
        classificationReason: financeProtectedUpload && !initiallyProtectedUpload
          ? `${classification.reason} El contenido extraído elevó el expediente a acceso financiero/comercial.`
          : classification.reason,
        processingStage: normalizedUpdates.length ? "contraste" : classification.confidence > 0 ? "extraccion_pendiente" : "clasificado",
        processingProgress: normalizedUpdates.length ? 75 : classification.confidence > 0 ? 40 : 20,
        processingSummary: classification.confidence > 0
          ? extractionSummary
          : "Original recibido. Requiere asignación de área antes de normalizar sus datos.",
        extractionMode: extraction.model === "deterministic" ? analysis.extractionMode : "openai_responses",
        extractionConfidence: normalizedUpdates.length ? extraction.confidence : analysis.confidence,
        extractionSummary,
        discrepancyCount,
        proposalGeneration: extractionGeneration,
        reviewStatus: normalizedUpdates.length ? "listo_revision" : "pendiente_extraccion",
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
        : `Archivo dirigido a ${areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea}. El original permanece disponible y la interpretación no modifica datos sin propuestas válidas.`,
      actorEmail: user.email,
      actorName: user.displayName,
    }).catch(() => undefined);
    let automaticMessage = "";
    const canPublishInArea = !financeProtectedUpload || user.financeAccess;
    const extractionConfidenceIsSafe = canAutomaticallyPublishExtraction({
      model: extraction.model,
      confidence: extraction.confidence,
      updateConfidences: extraction.updateConfidences,
      warnings: extraction.warnings,
      // El recuento se cuenta sobre las confianzas de la extracción, no sobre lo
      // que sobrevive a la normalización: si ésta descarta un dato que no encaja
      // en el modelo, el lote no debe fallar la comprobación de longitud y
      // perder también los datos buenos.
      updateCount: extraction.updateConfidences.length,
    });
    const liveValues = currentLiveData?.values ?? {};
    // Condiciones del lote: valen para todos los datos por igual (se pidió
    // publicar solo, el área permite publicar, hay datos y contexto vivo).
    const batchPreconditions =
      automaticPublicationRequested &&
      canPublishInArea &&
      resolvedArea !== "sin_clasificar" &&
      extractionConfidenceIsSafe &&
      normalizedUpdates.length > 0 &&
      Boolean(currentLiveData);
    // Condiciones de cada dato: su área coincide, quien sube puede publicarlo y
    // encaja en el contrato vivo. Antes esto se comprobaba con un `.every` que
    // bloqueaba TODO el lote si un solo dato fallaba —justo lo que hacía que un
    // informe con un dato dudoso de relleno no actualizara ninguna cifra. Ahora
    // decide dato a dato: los que encajan se publican solos y el resto va a
    // revisión.
    const updateIsAutoPublishable = (update: ReturnType<typeof normalizeLiveDataUpdates>[number]) =>
      update.area === resolvedArea &&
      (user.financeAccess || !isFinancialLiveKey(update.key)) &&
      isSafeAutomaticStructuredUpdate(update) &&
      individualUpdateContractIsSafe(update, liveValues);
    // Si todo el lote encaja (además, como lote atómico en el contrato), se
    // publica entero —cero cambio de comportamiento cuando todo cuadra—. Si no,
    // se publican los datos que individualmente son seguros y el resto queda
    // para revisión, en vez de bloquear el informe completo.
    const wholeBatchSafe = batchPreconditions &&
      normalizedUpdates.every(updateIsAutoPublishable) &&
      automaticContractIsSafe(normalizedUpdates, liveValues);
    const autoPublishable = wholeBatchSafe
      ? normalizedUpdates
      : batchPreconditions
        ? normalizedUpdates.filter(updateIsAutoPublishable)
        : [];
    if (autoPublishable.length) {
      publicationStarted = true;
      const isFullBatch = autoPublishable.length === normalizedUpdates.length;
      const publication = await publishLiveDataUpdates({
        normalized: autoPublishable,
        actor: user,
        area: resolvedArea,
        cutoff: effectiveCutoff,
        sourceFileId: id,
        sourceName: candidate.name,
        message: `${autoPublishable.length} datos estructurados publicados automáticamente desde ${candidate.name}.`,
        ...(isFullBatch ? {
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
            note: "Publicación automática de hechos explícitos con alta confianza, validados por el contrato vivo y los permisos del usuario.",
            proposalCount: autoPublishable.length,
          },
        } : {}),
      });
      publicationCompleted = true;
      automaticMessage = isFullBatch
        ? `${autoPublishable.length} datos se han actualizado automáticamente en la revisión ${publication.id}; las cifras y gráficas se refrescarán en menos de 5 segundos.`
        : `${autoPublishable.length} de ${normalizedUpdates.length} datos se han actualizado automáticamente en la revisión ${publication.id}; ${normalizedUpdates.length - autoPublishable.length} no encajan en un campo conocido todavía y siguen pendientes de revisión manual.`;
      if (!isFullBatch) {
        // publishLiveDataUpdates marca el archivo como aprobado/sin revisión
        // pendiente de forma incondicional (no depende de reviewClosure). En
        // un lote parcial eso es falso — todavía queda al menos una propuesta
        // sin publicar — así que se corrige aparte, sin tocar la transacción
        // atómica.
        await db.update(uploadedFiles).set({
          requiresReview: true,
          reviewStatus: "listo_revision",
          processingSummary: `${extractionSummary} ${autoPublishable.length} de ${normalizedUpdates.length} datos ya están publicados en la revisión ${publication.id}; el resto necesita revisión manual.`,
          updatedAt: new Date().toISOString(),
        }).where(eq(uploadedFiles.id, id)).catch(() => undefined);
      }
    }
    let currentRow = row;
    try {
      const [freshRow] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
      if (freshRow) currentRow = freshRow;
    } catch {
      // La fila inicial durable permite responder aunque falle esta lectura auxiliar.
    }
    if (financeProtectedUpload && !user.financeAccess) {
      return Response.json({
        restricted: true,
        message: "El contenido se ha archivado y dirigido a Finanzas/Ventas. Solo las personas autorizadas pueden verlo o publicar sus datos.",
      }, { status: 202 });
    }
    return Response.json(
      {
        file: publicFileRow(currentRow, user),
        message: automaticMessage || (normalizedUpdates.length
          ? `Archivo registrado en ${areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea}. Se han preparado ${normalizedUpdates.length} cambios para revisión.`
          : nothingExtractedMessage(
              areaLabels[resolvedArea as keyof typeof areaLabels] ?? resolvedArea,
              extension,
              extraction.warnings,
            )),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("file extraction/publication failed", id, error);
    // Sólo el texto del error (nombre + mensaje), acotado. Los errores de esta
    // fase son mensajes descriptivos del contrato/publicación o del motor D1
    // (nombres de restricción), nunca valores de negocio.
    const debugDetail = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 600);
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
    if (fileRequiresFinanceAccess(currentRow) && !user.financeAccess) {
      return Response.json({
        restricted: true,
        message: "El original está archivado de forma confidencial y queda pendiente de revisión por una persona autorizada.",
      }, { status: 202 });
    }
    return Response.json({
      file: publicFileRow(currentRow, user),
      message: processingSummary,
      ...(debugRequested && user.financeAccess ? { debug: debugDetail } : {}),
    }, { status: 201 });
  }
}
