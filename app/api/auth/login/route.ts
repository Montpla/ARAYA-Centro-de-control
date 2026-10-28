import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";
import { safeRelativeReturnPath } from "../../../chatgpt-auth";
import { hashPin, timingSafeStringsEqual, validPinFormat, verifyPin } from "../../../../lib/pin";
import {
  clearFailedPinAttempts,
  createSession,
  isLockedOut,
  registerFailedPinAttempt,
  sessionCookieHeader,
} from "../../../../lib/session";

export const runtime = "edge";

// Marca el expediente que absorbe los intentos fallidos del PIN de arranque
// antes de que exista el administrador real: no es una cuenta usable (queda
// inactiva, sin pinHash), solo el mismo mecanismo de bloqueo por intentos que
// ya protege a cualquier otro usuario, aplicado también a esa ventana sin
// cuenta todavía.
const BOOTSTRAP_PENDING_MARKER = "bootstrap-pending";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function redirectToSignIn(request: Request, returnTo: string, error: string) {
  const url = new URL(request.url);
  url.pathname = "/signin-with-chatgpt";
  url.search = "";
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const email = normalizeEmail(formData?.get("email"));
  const pin = String(formData?.get("pin") ?? "");
  const returnTo = safeRelativeReturnPath(String(formData?.get("return_to") ?? "/"));

  if (!email || !email.includes("@") || !validPinFormat(pin)) {
    return redirectToSignIn(request, returnTo, "missing");
  }

  const db = getDb();
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);

  // Arranque: la primera vez que entra la cuenta declarada en
  // BOOTSTRAP_ADMIN_EMAIL con el PIN de BOOTSTRAP_ADMIN_PIN, se crea (o se
  // completa, si ya existía sin PIN -p. ej. la creó el otro camino de
  // arranque vía ChatGPT en lib/access-control.ts-) como administrador. A
  // partir de que tiene pinHash, entra por el camino normal como cualquier
  // otro usuario: el PIN de arranque deja de compararse.
  //
  // Antes de que exista una cuenta real, no hay ninguna fila donde registrar
  // intentos fallidos -por eso se trata aparte y con su propio bloqueo-: un
  // marcador inactivo (BOOTSTRAP_PENDING_MARKER) absorbe los fallos con el
  // mismo mecanismo de lockout que ya protege a cualquier otra cuenta, en vez
  // de dejar la comparación del PIN sin límite de intentos.
  const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const bootstrapPin = String(process.env.BOOTSTRAP_ADMIN_PIN ?? "");
  const isBootstrapCandidate = Boolean(bootstrapEmail) && Boolean(bootstrapPin) && email === bootstrapEmail;
  const canAttemptBootstrap =
    isBootstrapCandidate && (!existing || (!existing.pinHash && !existing.deletedAt));

  if (canAttemptBootstrap) {
    if (existing && isLockedOut(existing.pinLockedUntil)) {
      return redirectToSignIn(request, returnTo, "locked");
    }
    if (!timingSafeStringsEqual(pin, bootstrapPin)) {
      if (existing) {
        await registerFailedPinAttempt(existing.id, existing.failedPinAttempts);
      } else {
        await db
          .insert(appUsers)
          .values({
            email,
            displayName: "Administrador",
            role: "member",
            area: "direccion",
            financeAccess: false,
            active: false,
            pinHash: "",
            failedPinAttempts: 1,
            createdByEmail: BOOTSTRAP_PENDING_MARKER,
          })
          .onConflictDoNothing({ target: appUsers.email });
      }
      return redirectToSignIn(request, returnTo, "invalid");
    }
    const [confirmed] = existing
      ? await db
          .update(appUsers)
          .set({
            displayName: "Administrador",
            role: "admin",
            area: "direccion",
            financeAccess: true,
            active: true,
            pinHash: hashPin(pin),
            failedPinAttempts: 0,
            pinLockedUntil: "",
            createdByEmail: "bootstrap",
            lastLoginAt: new Date().toISOString(),
          })
          .where(eq(appUsers.id, existing.id))
          .returning()
      : await db
          .insert(appUsers)
          .values({
            email,
            displayName: "Administrador",
            role: "admin",
            area: "direccion",
            financeAccess: true,
            active: true,
            pinHash: hashPin(pin),
            createdByEmail: "bootstrap",
            lastLoginAt: new Date().toISOString(),
          })
          .returning();
    if (!confirmed) return redirectToSignIn(request, returnTo, "invalid");
    return finishLogin(request, confirmed.id, returnTo);
  }

  if (!existing) {
    return redirectToSignIn(request, returnTo, "invalid");
  }
  if (existing.deletedAt || !existing.active) {
    return redirectToSignIn(request, returnTo, "invalid");
  }
  if (isLockedOut(existing.pinLockedUntil)) {
    return redirectToSignIn(request, returnTo, "locked");
  }

  if (!existing.pinHash || !verifyPin(pin, existing.pinHash)) {
    await registerFailedPinAttempt(existing.id, existing.failedPinAttempts);
    return redirectToSignIn(request, returnTo, "invalid");
  }

  await clearFailedPinAttempts(existing.id);
  await db.update(appUsers).set({ lastLoginAt: new Date().toISOString() }).where(eq(appUsers.id, existing.id));
  return finishLogin(request, existing.id, returnTo);
}

async function finishLogin(request: Request, userId: number, returnTo: string) {
  const { token, expiresAt } = await createSession(userId);
  const url = new URL(request.url);
  url.pathname = returnTo;
  url.search = "";
  const secure = url.protocol === "https:";
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: `${returnTo}`,
      "Set-Cookie": sessionCookieHeader(token, expiresAt, secure),
    },
  });
  return response;
}
