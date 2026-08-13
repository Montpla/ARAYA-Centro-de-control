import { env } from "cloudflare:workers";
import { requireApiUser } from "../../../lib/access-control";
import { requiresFinanceDocumentAccess } from "../../../lib/document-access";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type StoredDocument = {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
};

type StoredDocumentHead = {
  size: number;
  httpMetadata?: { contentType?: string };
};

type DocumentBucket = {
  head(key: string): Promise<StoredDocumentHead | null>;
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<StoredDocument | null>;
};

type DocumentManifest = {
  version: 1;
  size: number;
  contentType: string;
  fileName: string;
  sha256: string;
  chunks: Array<{ key: string; size: number; sha256: string }>;
};

type StoredSegment = {
  key: string;
  offset: number;
  length: number;
};

const canonicalMimeByExtension: Record<string, string> = {
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

function privateHeaders(source: Headers) {
  const headers = new Headers(source);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
  headers.set("Vary", "*");
  return headers;
}

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: privateHeaders(
      new Headers({ "Content-Type": "text/plain; charset=utf-8" }),
    ),
  });
}

function parseByteRange(value: string | null, size: number) {
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) return "invalid" as const;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid" as const;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return "invalid" as const;
  }
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, start, end };
}

function safeFileName(pathname: string) {
  const encoded = pathname.split("/").at(-1) || "documento";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function asciiFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180) || "documento";
}

async function readDocumentManifest(bucket: DocumentBucket, pathname: string) {
  const object = await bucket.get(`historical-manifest${pathname}`);
  if (!object) return null;
  try {
    const candidate = JSON.parse(await new Response(object.body).text()) as Partial<DocumentManifest>;
    if (
      candidate.version !== 1 ||
      !Number.isInteger(candidate.size) ||
      Number(candidate.size) <= 0 ||
      typeof candidate.contentType !== "string" ||
      typeof candidate.fileName !== "string" ||
      typeof candidate.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.sha256) ||
      !Array.isArray(candidate.chunks) ||
      candidate.chunks.length === 0 ||
      candidate.chunks.length > 10_000
    ) return null;

    let totalSize = 0;
    const chunks = candidate.chunks.map((chunk, index) => {
      const expectedPrefix = `historical-chunks/${candidate.sha256}/`;
      if (
        typeof chunk?.key !== "string" ||
        !chunk.key.startsWith(expectedPrefix) ||
        !Number.isInteger(chunk.size) ||
        chunk.size <= 0 ||
        typeof chunk.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(chunk.sha256)
      ) throw new Error(`Invalid chunk ${index}`);
      totalSize += chunk.size;
      return { key: chunk.key, size: chunk.size, sha256: chunk.sha256 };
    });
    if (totalSize !== candidate.size) return null;
    return {
      version: 1,
      size: candidate.size,
      contentType: candidate.contentType,
      fileName: candidate.fileName,
      sha256: candidate.sha256,
      chunks,
    } satisfies DocumentManifest;
  } catch {
    return null;
  }
}

function manifestSegments(
  manifest: DocumentManifest,
  range: { start: number; end: number } | null,
) {
  const segments: StoredSegment[] = [];
  let cursor = 0;
  for (const chunk of manifest.chunks) {
    const chunkStart = cursor;
    const chunkEnd = cursor + chunk.size - 1;
    const requestedStart = range ? Math.max(range.start, chunkStart) : chunkStart;
    const requestedEnd = range ? Math.min(range.end, chunkEnd) : chunkEnd;
    if (requestedStart <= requestedEnd) {
      segments.push({
        key: chunk.key,
        offset: requestedStart - chunkStart,
        length: requestedEnd - requestedStart + 1,
      });
    }
    cursor += chunk.size;
  }
  return segments;
}

function streamStoredSegments(bucket: DocumentBucket, segments: StoredSegment[]) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const segment of segments) {
          const object = await bucket.get(segment.key, {
            range: { offset: segment.offset, length: segment.length },
          });
          if (!object) throw new Error("Missing document chunk");
          const reader = object.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value as Uint8Array);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function serveProtectedDocument(request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (!auth.user) {
    const response = auth.response ?? errorResponse("Acceso no autorizado.", 401);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: privateHeaders(response.headers),
    });
  }

  const { path } = await context.params;
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    return errorResponse("Ruta de documento no válida.", 400);
  }

  const pathname = new URL(request.url).pathname;
  if (requiresFinanceDocumentAccess(pathname) && !auth.user.financeAccess) {
    return errorResponse("No tienes acceso a este documento financiero.", 403);
  }

  const bucket = (env as unknown as { FILES?: DocumentBucket }).FILES;
  if (!bucket) {
    return errorResponse("El archivo no está disponible temporalmente.", 503);
  }

  const storageKey = `historical${pathname}`;
  let head: StoredDocumentHead | null = null;
  let headError = "";
  try {
    head = await bucket.head(storageKey);
  } catch (error) {
    headError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const manifest = head ? null : await readDocumentManifest(bucket, pathname);
  if (!head && !manifest) {
    return errorResponse(
      `Archivo no encontrado. DEBUG pathname=${pathname} storageKey=${storageKey} bucketType=${typeof bucket} headErr=${headError || "none"}`,
      404,
    );
  }
  const totalSize = head?.size ?? manifest?.size ?? 0;

  const requestedRange = parseByteRange(request.headers.get("range"), totalSize);
  if (requestedRange === "invalid") {
    return new Response(null, {
      status: 416,
      headers: privateHeaders(new Headers({ "Content-Range": `bytes */${totalSize}` })),
    });
  }

  const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = head?.httpMetadata?.contentType || manifest?.contentType || canonicalMimeByExtension[extension] || "application/octet-stream";
  const fileName = manifest?.fileName || safeFileName(pathname);
  const headers = privateHeaders(new Headers({
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Content-Length": String(requestedRange ? requestedRange.length : totalSize),
    "Content-Type": contentType,
  }));
  if (requestedRange) {
    headers.set("Content-Range", `bytes ${requestedRange.start}-${requestedRange.end}/${totalSize}`);
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  let body: ReadableStream;
  if (manifest) {
    body = streamStoredSegments(
      bucket,
      manifestSegments(
        manifest,
        requestedRange ? { start: requestedRange.start, end: requestedRange.end } : null,
      ),
    );
  } else {
    const object = await bucket.get(
      storageKey,
      requestedRange ? { range: { offset: requestedRange.offset, length: requestedRange.length } } : undefined,
    );
    if (!object) return errorResponse("Archivo no encontrado.", 404);
    body = object.body;
  }
  return new Response(body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return serveProtectedDocument(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serveProtectedDocument(request, context);
}
