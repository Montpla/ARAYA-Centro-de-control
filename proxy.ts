import { NextRequest, NextResponse } from "next/server";
import type { ChatGPTUser } from "./app/chatgpt-auth";
import { resolveAuthorizedUser } from "./lib/access-control";

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

const financeOnlyDocuments = new Set([
  "/data-center/junio-2026/informe-junio-2026-araya.xlsx",
  "/data-center/junio-2026/datos-para-informe-jun-26.xlsx",
  "/data-center/junio-2026/lamina-flujo-mayo-2026.pptx",
  "/data-center/julio-2026/comparativo-presupuesto-edificio-tipo-a.xls",
  "/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf",
  "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30.xlsx",
  "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30-copia.xlsx",
  "/data-center/julio-2026/desviacion-mensual-junio-2026.xlsx",
  "/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx",
]);
const financeDocumentPathPattern =
  /(?:^|[-/])(finanzas?|financiero|fideicomiso|balance|resultados?|flujo|cxp|presupuesto|desviacion|prestamo|ifc|antonely)(?:[-./]|$)/i;

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function chatGPTIdentity(request: NextRequest): ChatGPTUser | null {
  const email = request.headers.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = request.headers.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    request.headers.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

function requiresFinanceAccess(pathname: string) {
  const normalizedPath = pathname.toLowerCase();
  return (
    financeDocumentPathPattern.test(normalizedPath) ||
    financeOnlyDocuments.has(normalizedPath)
  );
}

function protectedResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, noarchive, nosnippet",
    },
  });
}

export async function proxy(request: NextRequest) {
  const identity = chatGPTIdentity(request);
  if (!identity) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/signin-with-chatgpt";
    signInUrl.search = "";
    signInUrl.searchParams.set(
      "return_to",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const response = NextResponse.redirect(signInUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
    return response;
  }

  let user;
  try {
    user = await resolveAuthorizedUser(identity);
  } catch {
    return protectedResponse(
      "No se ha podido comprobar tu acceso al Centro de Control.",
      503,
    );
  }

  if (!user) {
    return protectedResponse(
      "Tu usuario no está autorizado o se encuentra desactivado.",
      403,
    );
  }

  if (requiresFinanceAccess(request.nextUrl.pathname) && !user.financeAccess) {
    return protectedResponse("No tienes acceso a este documento financiero.", 403);
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  // `Vary: *` also prevents the app's Cache Storage layer from retaining a private original.
  response.headers.set("Vary", "*");
  response.headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
  return response;
}

export const config = {
  matcher: ["/data-center/:path*"],
};
