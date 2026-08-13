import { NextRequest, NextResponse } from "next/server";
import { resolveAuthorizedUser } from "./lib/access-control";
import { requiresFinanceDocumentAccess } from "./lib/document-access";
import { SESSION_COOKIE, sessionUserFromToken } from "./lib/session";

async function chatGPTIdentity(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return sessionUserFromToken(token);
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
  if (process.env.LOCAL_DEMO_MODE === "true") {
    return NextResponse.next();
  }
  const identity = await chatGPTIdentity(request);
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

  if (requiresFinanceDocumentAccess(request.nextUrl.pathname) && !user.financeAccess) {
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
  // /data-center/* ya no pasa por este middleware: app/data-center/[...path]/
  // route.ts hace exactamente la misma comprobación de identidad y acceso
  // financiero por su cuenta (requireApiUser + requiresFinanceDocumentAccess,
  // mismo SESSION_COOKIE), así que no pierde protección. El traspaso de
  // NextResponse.next() de este middleware hacia esa ruta catch-all no estaba
  // llegando a ejecutar route.ts en este despliegue (404 vacío pese a que el
  // archivo sí existía en R2); con la ruta fuera del matcher, deja de pasar
  // por ese punto de fallo.
  matcher: [],
};
