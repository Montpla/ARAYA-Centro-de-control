import { env } from "cloudflare:workers";
import { requireApiUser } from "../../../lib/access-control";
import { requiresFinanceDocumentAccess } from "../../../lib/document-access";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ path: string[] }>;
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

  const assets = (env as unknown as { ASSETS?: Fetcher }).ASSETS;
  if (!assets) {
    return errorResponse("El archivo no está disponible temporalmente.", 503);
  }

  const assetResponse = await assets.fetch(request);
  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers: privateHeaders(assetResponse.headers),
  });
}

export async function GET(request: Request, context: RouteContext) {
  return serveProtectedDocument(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serveProtectedDocument(request, context);
}
