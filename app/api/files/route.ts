import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { fileActivity, uploadedFiles } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { resolveSourceCurrency } from "../../../lib/currency";
import { areaLabels, classifyUpload, safeFileName } from "../../../lib/file-routing";

export const runtime = "edge";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "dwg",
  "jpeg",
  "jpg",
  "mpp",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "zip",
]);

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
  get: (key: string) => Promise<StoredObject | null>;
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

  const downloadId = new URL(request.url).searchParams.get("download");
  const db = getDb();
  if (downloadId) {
    const [row] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, downloadId)).limit(1);
    if (!row) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
    if (row.area === "finanzas" && !auth.user.financeAccess) {
      return Response.json({ error: "No tienes acceso a documentos financieros." }, { status: 403 });
    }

    const object = await getFileBucket().get(row.storageKey);
    if (!object) return Response.json({ error: "El original no está disponible en el almacenamiento." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || row.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const rows = await db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt)).limit(60);
  return Response.json({
    files: rows.filter((row) => auth.user.financeAccess || row.area !== "finanzas").map(publicFileRow),
    refreshedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const auth = await authenticatedUser();
  if (!auth.user) return auth.response;

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
      { error: "Formato no admitido. Usa Excel, CSV, PowerPoint, PDF, Word, MPP, DWG, imagen o ZIP." },
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
  const classification = classifyUpload({
    fileName: candidate.name,
    description,
    declaredArea: String(formData.get("area") ?? "auto"),
  });
  if (classification.area === "finanzas" && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes permiso para cargar documentos financieros." }, { status: 403 });
  }
  const safeName = safeFileName(candidate.name);
  const bytes = await candidate.arrayBuffer();
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

  await bucket.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      originalName: candidate.name,
      area: classification.area,
      uploader: auth.user.email,
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
        uploaderEmail: auth.user.email,
        uploaderName: auth.user.displayName,
        version,
        declaredCutoff,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
      })
      .returning();
    await db.insert(fileActivity).values({
      fileId: id,
      eventType: "archivo_recibido",
      message: `Archivo dirigido a ${areaLabels[classification.area]}. En cola de normalización; todo dato publicado conservará fuente, corte, moneda y versión.`,
      actorEmail: auth.user.email,
      actorName: auth.user.displayName,
    });
    return Response.json(
      {
        file: publicFileRow(row),
        message: `Archivo registrado en ${areaLabels[classification.area]}. El original aparece de inmediato; sus datos normalizados actualizarán todas las pantallas automáticamente y las contradicciones quedarán observadas.`,
      },
      { status: 201 },
    );
  } catch {
    await bucket.delete(storageKey);
    return Response.json({ error: "No se pudo completar el registro del archivo." }, { status: 500 });
  }
}
