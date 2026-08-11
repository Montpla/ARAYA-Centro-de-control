import { env } from "cloudflare:workers";

export const runtime = "edge";

const MAX_FILE_SIZE = 60 * 1024 * 1024;

type SeedBucket = {
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  createMultipartUpload(
    key: string,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<{ uploadId: string }>;
  resumeMultipartUpload(key: string, uploadId: string): {
    uploadPart(partNumber: number, value: ArrayBuffer): Promise<{ partNumber: number; etag: string }>;
    complete(parts: Array<{ partNumber: number; etag: string }>): Promise<unknown>;
    abort(): Promise<void>;
  };
};

const mimeByExtension: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dwg: "image/vnd.dwg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json; charset=utf-8",
  mpp: "application/vnd.ms-project",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

function unauthorized() {
  return Response.json(
    { error: "No autorizado." },
    { status: 401, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function tokensMatch(candidate: string, expected: string) {
  if (candidate.length < 32 || candidate.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [candidateDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function validHistoricalPath(value: string) {
  return (
    value.startsWith("/data-center/") &&
    value.length <= 500 &&
    !value.includes("..") &&
    !value.includes("\\") &&
    !/[\0\r\n?#]/.test(value)
  );
}

function contentTypeFor(path: string, fallback = "") {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return mimeByExtension[extension] || fallback || "application/octet-stream";
}

function validUploadId(value: string) {
  return value.length >= 16 && value.length <= 512 && /^[a-zA-Z0-9._-]+$/.test(value);
}

export async function POST(request: Request) {
  const runtime = env as unknown as {
    DOCUMENT_SEED_TOKEN?: string;
    FILES?: SeedBucket;
  };
  const expectedToken = runtime.DOCUMENT_SEED_TOKEN ?? "";
  const suppliedToken = request.headers.get("x-document-seed-token") ?? "";
  if (!expectedToken || !(await tokensMatch(suppliedToken, expectedToken))) return unauthorized();
  if (!runtime.FILES) {
    return Response.json({ error: "Almacenamiento no disponible." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Carga no válida." }, { status: 400 });
  }
  const path = String(formData.get("path") ?? "");
  const action = String(formData.get("action") ?? "put");
  if (!validHistoricalPath(path)) {
    return Response.json({ error: "Ruta no válida." }, { status: 400 });
  }

  if (action === "multipart-init") {
    const sha256 = String(formData.get("sha256") ?? "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      return Response.json({ error: "Hash no válido." }, { status: 400 });
    }
    const upload = await runtime.FILES.createMultipartUpload(`historical${path}`, {
      httpMetadata: { contentType: contentTypeFor(path) },
      customMetadata: { originalName: path.split("/").at(-1) || "documento", sha256 },
    });
    return Response.json(
      { initialized: true, path, uploadId: upload.uploadId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const uploadId = String(formData.get("uploadId") ?? "");
  if (action === "multipart-abort") {
    if (!validUploadId(uploadId)) return Response.json({ error: "Carga no válida." }, { status: 400 });
    await runtime.FILES.resumeMultipartUpload(`historical${path}`, uploadId).abort();
    return Response.json({ aborted: true, path }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (action === "multipart-complete") {
    if (!validUploadId(uploadId)) return Response.json({ error: "Carga no válida." }, { status: 400 });
    let parts: Array<{ partNumber: number; etag: string }>;
    try {
      const candidate = JSON.parse(String(formData.get("parts") ?? "[]")) as unknown;
      if (!Array.isArray(candidate) || candidate.length === 0 || candidate.length > 10_000) throw new Error();
      parts = candidate.map((part) => {
        if (
          typeof part !== "object" ||
          part === null ||
          !Number.isInteger((part as { partNumber?: number }).partNumber) ||
          Number((part as { partNumber?: number }).partNumber) < 1 ||
          typeof (part as { etag?: string }).etag !== "string" ||
          !(part as { etag: string }).etag
        ) throw new Error();
        return {
          partNumber: Number((part as { partNumber: number }).partNumber),
          etag: (part as { etag: string }).etag,
        };
      });
    } catch {
      return Response.json({ error: "Partes no válidas." }, { status: 400 });
    }
    await runtime.FILES.resumeMultipartUpload(`historical${path}`, uploadId).complete(parts);
    return Response.json(
      { stored: true, path, multipart: true, partCount: parts.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (action === "chunk-complete") {
    const sha256 = String(formData.get("sha256") ?? "").toLowerCase();
    const declaredSize = Number(formData.get("size"));
    if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isInteger(declaredSize) || declaredSize <= 0) {
      return Response.json({ error: "Manifiesto no válido." }, { status: 400 });
    }
    let parts: Array<{ partNumber: number; key: string; size: number; sha256: string }>;
    try {
      const candidate = JSON.parse(String(formData.get("parts") ?? "[]")) as unknown;
      if (!Array.isArray(candidate) || candidate.length === 0 || candidate.length > 10_000) throw new Error();
      parts = candidate.map((part, index) => {
        const expectedPartNumber = index + 1;
        const expectedKey = `historical-chunks/${sha256}/${String(expectedPartNumber).padStart(5, "0")}`;
        if (
          typeof part !== "object" ||
          part === null ||
          (part as { partNumber?: number }).partNumber !== expectedPartNumber ||
          (part as { key?: string }).key !== expectedKey ||
          !Number.isInteger((part as { size?: number }).size) ||
          Number((part as { size?: number }).size) <= 0 ||
          typeof (part as { sha256?: string }).sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test((part as { sha256: string }).sha256)
        ) throw new Error();
        return {
          partNumber: expectedPartNumber,
          key: expectedKey,
          size: Number((part as { size: number }).size),
          sha256: (part as { sha256: string }).sha256,
        };
      });
      if (parts.reduce((sum, part) => sum + part.size, 0) !== declaredSize) throw new Error();
    } catch {
      return Response.json({ error: "Partes no válidas." }, { status: 400 });
    }

    const manifest = {
      version: 1,
      size: declaredSize,
      contentType: contentTypeFor(path),
      fileName: path.split("/").at(-1) || "documento",
      sha256,
      chunks: parts.map(({ key, size, sha256: partSha256 }) => ({ key, size, sha256: partSha256 })),
    };
    await runtime.FILES.put(
      `historical-manifest${path}`,
      new TextEncoder().encode(JSON.stringify(manifest)).buffer,
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );
    return Response.json(
      { stored: true, path, chunked: true, partCount: parts.length, size: declaredSize, sha256 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Ruta o archivo no válido." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "El archivo supera el límite permitido." }, { status: 413 });
  }

  if (action === "chunk-part") {
    const sha256 = String(formData.get("sha256") ?? "").toLowerCase();
    const partNumber = Number(formData.get("partNumber"));
    if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      return Response.json({ error: "Parte no válida." }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const partSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const key = `historical-chunks/${sha256}/${String(partNumber).padStart(5, "0")}`;
    await runtime.FILES.put(key, bytes, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { sha256: partSha256 },
    });
    return Response.json(
      { uploaded: true, path, partNumber, key, size: file.size, sha256: partSha256 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (action === "multipart-part") {
    const partNumber = Number(formData.get("partNumber"));
    if (!validUploadId(uploadId) || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      return Response.json({ error: "Parte no válida." }, { status: 400 });
    }
    const part = await runtime.FILES
      .resumeMultipartUpload(`historical${path}`, uploadId)
      .uploadPart(partNumber, await file.arrayBuffer());
    return Response.json(
      { uploaded: true, path, partNumber: part.partNumber, etag: part.etag, size: file.size },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const contentType = contentTypeFor(path, file.type);
  const bytes = await file.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await runtime.FILES.put(`historical${path}`, bytes, {
    httpMetadata: { contentType },
    customMetadata: { originalName: file.name, sha256: digest },
  });

  return Response.json(
    { stored: true, path, size: file.size, sha256: digest },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
