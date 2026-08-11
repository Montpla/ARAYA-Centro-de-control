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
  const file = formData.get("file");
  if (!validHistoricalPath(path) || !(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Ruta o archivo no válido." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "El archivo supera el límite permitido." }, { status: 413 });
  }

  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = mimeByExtension[extension] || file.type || "application/octet-stream";
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
