import { env } from "cloudflare:workers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  documentDataProposals,
  fileActivity,
  fileReviews,
  liveDataPoints,
  uploadedFiles,
} from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { resolveSourceCurrency } from "../../../lib/currency";
import { areaLabels, classifyUpload, safeFileName } from "../../../lib/file-routing";
import { analyzeDocument, extractStructuredUpdates } from "../../../lib/ingestion";
import { isFinancialLiveKey } from "../../../lib/live-data";
import { normalizeLiveDataUpdates, publishLiveDataUpdates } from "../../../lib/publish-live-data";

export const runtime = "edge";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
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

function isSafeAutomaticStructuredUpdate(update: ReturnType<typeof normalizeLiveDataUpdates>[number]) {
  const path = update.key.split(".");
  if (path.length < 2 || path.length > 8 || !update.cutoff.trim()) return false;
  if (path.some((segment) => /^\d+$/.test(segment) && Number(segment) > 500)) return false;
  if (!(["number", "string", "boolean"] as string[]).includes(update.valueType)) return false;
  try {
    const value = JSON.parse(update.valueJson) as unknown;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.length <= 10_000;
    return typeof value === "boolean";
  } catch {
    return false;
  }
}

function publicFileRow(row: typeof uploadedFiles.$inferSelect) {
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    downloadUrl: `/api/files?download=${encodeURIComponent(row.id)}`,
  };
}

async function authenticatedUser() {
  const auth = await requireApiUser();
  return { response: auth.response, user: auth.user };
}

export async function GET(request: Request) {
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
    if (row.area === "finanzas" && !user.financeAccess) {
      return Response.json({ error: "No tienes acceso a documentos financieros." }, { status: 403 });
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

  const rows = await db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt));
  return Response.json({
    files: rows.filter((row) => user.financeAccess || row.area !== "finanzas").map(publicFileRow),
    refreshedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const auth = await authenticatedUser();
  if (!auth.user) return auth.response;
  const user = auth.user;

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
  const classification = classifyUpload({
    fileName: candidate.name,
    description,
    declaredArea: String(formData.get("area") ?? "auto"),
  });
  if (classification.area === "finanzas" && !user.financeAccess) {
    return Response.json({ error: "No tienes permiso para cargar documentos financieros." }, { status: 403 });
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
  const sha256 = hexDigest(await crypto.subtle.digest("SHA-256", bytes));
  const db = getDb();

  const [duplicate] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.sha256, sha256)).limit(1);
  if (duplicate) {
    return Response.json({
      duplicate: true,
      message: "Este mismo archivo ya estaba registrado; se mantiene una sola copia.",
      file: publicFileRow(duplicate),
    });
  }

  const previousVersions = await db
    .select({ id: uploadedFiles.id })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.safeName, safeName), eq(uploadedFiles.area, classification.area)));
  const version = previousVersions.length + 1;
  const id = crypto.randomUUID();
  const now = new Date();
  const storageKey = [
    "araya",
    classification.area,
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${id}-${safeName}`,
  ].join("/");
  const mimeType = candidate.type || "application/octet-stream";
  const bucket = getFileBucket();
  const extraction = extractStructuredUpdates(bytes, extension, {
    area: classification.area,
    cutoff: analysis.detectedPeriod || declaredCutoff,
    sourceCurrency: sourceCurrency === "USD" ? "USD" : "DOP",
    sourceName: candidate.name,
  });
  const normalizedUpdates = extraction.updates.length
    ? normalizeLiveDataUpdates({
        updates: extraction.updates.map((update) => ({
          ...update,
          sourceFileId: id,
          sourceName: candidate.name,
        })),
        area: classification.area,
        cutoff: analysis.detectedPeriod || declaredCutoff,
        sourceFileId: id,
        sourceName: candidate.name,
      })
    : [];
  const existingPoints = normalizedUpdates.length
    ? await db.select().from(liveDataPoints).where(inArray(liveDataPoints.key, normalizedUpdates.map((update) => update.key)))
    : [];
  const previousByKey = new Map(existingPoints.map((point) => [point.key, point.valueJson]));
  const discrepancyCount = normalizedUpdates.filter((update) => {
    const previous = previousByKey.get(update.key);
    return previous !== undefined && previous !== update.valueJson;
  }).length;
  const extractionSummary = [
    analysis.summary,
    extraction.summary,
    extraction.warnings.length ? `${extraction.warnings.length} advertencias de estructura.` : "",
  ].filter(Boolean).join(" ");

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

  try {
    const [row] = await db
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
        processingStage: normalizedUpdates.length ? "contraste" : classification.confidence > 0 ? "extraccion_pendiente" : "clasificado",
        processingProgress: normalizedUpdates.length ? 75 : classification.confidence > 0 ? 40 : 20,
        processingSummary: classification.confidence > 0
          ? extractionSummary
          : "Original recibido. Requiere asignación de área antes de normalizar sus datos.",
        requiresReview: true,
        projectId: "araya",
        documentType: analysis.documentType,
        detectedPeriod: analysis.detectedPeriod,
        extractionMode: analysis.extractionMode,
        extractionConfidence: normalizedUpdates.length ? 1 : analysis.confidence,
        extractionSummary,
        discrepancyCount,
        reviewStatus: normalizedUpdates.length ? "listo_revision" : "pendiente_extraccion",
      })
      .returning();
    for (const update of normalizedUpdates) {
      const previousValueJson = previousByKey.get(update.key) ?? null;
      await db.insert(documentDataProposals).values({
        id: crypto.randomUUID(),
        fileId: id,
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
        notes: extraction.warnings.join(" ").slice(0, 1000),
        createdByEmail: user.email,
        createdByName: user.displayName,
      });
    }
    await db.insert(fileActivity).values({
      fileId: id,
      eventType: "archivo_recibido",
      message: normalizedUpdates.length
        ? `${normalizedUpdates.length} cambios extraídos y enviados a contraste en ${areaLabels[classification.area]}.`
        : `Archivo dirigido a ${areaLabels[classification.area]}. En cola de extracción; todo dato publicado conservará fuente, corte, moneda y versión.`,
      actorEmail: user.email,
      actorName: user.displayName,
    });
    let automaticMessage = "";
    const canPublishAutomatically =
      automaticPublicationRequested &&
      user.role === "admin" &&
      (extension === "csv" || extension === "json") &&
      classification.area !== "sin_clasificar" &&
      extraction.warnings.length === 0 &&
      normalizedUpdates.length > 0 &&
      normalizedUpdates.every((update) =>
        update.area === classification.area &&
        (user.financeAccess || !isFinancialLiveKey(update.key)) &&
        isSafeAutomaticStructuredUpdate(update),
      );
    if (canPublishAutomatically) {
      try {
        const publication = await publishLiveDataUpdates({
          normalized: normalizedUpdates,
          actor: user,
          area: classification.area,
          cutoff: analysis.detectedPeriod || declaredCutoff,
          sourceFileId: id,
          sourceName: candidate.name,
          message: `${normalizedUpdates.length} datos estructurados publicados automáticamente desde ${candidate.name}.`,
        });
        await db
          .update(documentDataProposals)
          .set({ status: "publicado", updatedAt: new Date().toISOString() })
          .where(eq(documentDataProposals.fileId, id));
        await db.insert(fileReviews).values({
          fileId: id,
          action: "aprobado_automatico",
          note: "Publicación automática administrativa de valores escalares, explícitos y validados por el contrato vivo.",
          proposalCount: normalizedUpdates.length,
          publicationRevision: publication.id,
          requestKey: `auto:${id}`,
          actorEmail: user.email,
          actorName: user.displayName,
        });
        automaticMessage = `${normalizedUpdates.length} datos se han actualizado automáticamente en la revisión ${publication.id}; las cifras y gráficas se refrescarán en menos de 5 segundos.`;
      } catch {
        await db.update(uploadedFiles).set({
          status: "pendiente_revision",
          processingStage: "contraste",
          processingProgress: 75,
          processingSummary: "Los datos se extrajeron, pero la publicación automática no se completó. El original y las propuestas permanecen disponibles para revisión.",
          requiresReview: true,
          reviewStatus: "listo_revision",
          updatedAt: new Date().toISOString(),
        }).where(eq(uploadedFiles.id, id));
        automaticMessage = "El archivo y sus cambios quedaron guardados, pero necesitan una revisión administrativa antes de actualizar el dashboard.";
      }
    }
    const [currentRow] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
    return Response.json(
      {
        file: publicFileRow(currentRow ?? row),
        message: automaticMessage || (normalizedUpdates.length
          ? `Archivo registrado en ${areaLabels[classification.area]}. Se han preparado ${normalizedUpdates.length} cambios para revisión.`
          : `Archivo registrado en ${areaLabels[classification.area]}. El original aparece de inmediato y queda pendiente de interpretación; todavía no modifica cifras ni gráficas.`),
      },
      { status: 201 },
    );
  } catch {
    await db.delete(documentDataProposals).where(eq(documentDataProposals.fileId, id));
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
    await bucket.delete(storageKey);
    return Response.json({ error: "No se pudo completar el registro del archivo." }, { status: 500 });
  }
}
