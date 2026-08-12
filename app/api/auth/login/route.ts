import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";
import { safeRelativeReturnPath } from "../../../chatgpt-auth";
import { hashPin, validPinFormat, verifyPin } from "../../../../lib/pin";
import {
  clearFailedPinAttempts,
  createSession,
  isLockedOut,
  registerFailedPinAttempt,
  sessionCookieHeader,
} from "../../../../lib/session";

export const runtime = "edge";

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
  // completa, si ya existía sin PIN) como administrador. A partir de ahí
  // entra por el camino normal como cualquier otro usuario.
  const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const bootstrapPin = String(process.env.BOOTSTRAP_ADMIN_PIN ?? "");
  const isBootstrapAttempt =
    Boolean(bootstrapEmail) && Boolean(bootstrapPin) && email === bootstrapEmail && pin === bootstrapPin;

  if (!existing) {
    if (!isBootstrapAttempt) {
      return redirectToSignIn(request, returnTo, "invalid");
    }
    const [created] = await db
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
    if (!created) return redirectToSignIn(request, returnTo, "invalid");
    return finishLogin(request, created.id, returnTo);
  }

  if (existing.deletedAt || !existing.active) {
    return redirectToSignIn(request, returnTo, "invalid");
  }
  if (isLockedOut(existing.pinLockedUntil)) {
    return redirectToSignIn(request, returnTo, "locked");
  }

  // Autoreparación de arranque: el admin de bootstrap ya existe (p. ej. lo
  // creó otra vía) pero todavía no tiene PIN asignado.
  if (!existing.pinHash && isBootstrapAttempt) {
    await db.update(appUsers).set({ pinHash: hashPin(pin) }).where(eq(appUsers.id, existing.id));
    return finishLogin(request, existing.id, returnTo);
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
