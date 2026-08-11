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
  const head = await bucket.head(storageKey);
  if (!head) return errorResponse("Archivo no encontrado.", 404);

  const requestedRange = parseByteRange(request.headers.get("range"), head.size);
  if (requestedRange === "invalid") {
    return new Response(null, {
      status: 416,
      headers: privateHeaders(new Headers({ "Content-Range": `bytes */${head.size}` })),
    });
  }

  const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = head.httpMetadata?.contentType || canonicalMimeByExtension[extension] || "application/octet-stream";
  const fileName = safeFileName(pathname);
  const headers = privateHeaders(new Headers({
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Content-Length": String(requestedRange ? requestedRange.length : head.size),
    "Content-Type": contentType,
  }));
  if (requestedRange) {
    headers.set("Content-Range", `bytes ${requestedRange.start}-${requestedRange.end}/${head.size}`);
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  const object = await bucket.get(
    storageKey,
    requestedRange ? { range: { offset: requestedRange.offset, length: requestedRange.length } } : undefined,
  );
  if (!object) return errorResponse("Archivo no encontrado.", 404);
  return new Response(object.body, {
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
