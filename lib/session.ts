import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { appUsers, userSessions } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";

export const SESSION_COOKIE = "araya_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await getDb().insert(userSessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await getDb().delete(userSessions).where(eq(userSessions.tokenHash, hashToken(token))).catch(() => undefined);
}

// Se llama de forma oportunista (no bloqueante) cada vez que se valida un
// token: no hay cron en Cloudflare Workers para este proyecto, así que la
// purga de sesiones caducadas ocurre como efecto secundario del tráfico real
// en vez de un job aparte.
async function purgeExpiredSessions() {
  await getDb().delete(userSessions).where(lt(userSessions.expiresAt, new Date().toISOString())).catch(() => undefined);
}

export async function sessionUserFromToken(token: string | undefined | null): Promise<ChatGPTUser | null> {
  if (!token) return null;
  const db = getDb();
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      userId: userSessions.userId,
      expiresAt: userSessions.expiresAt,
      email: appUsers.email,
      displayName: appUsers.displayName,
      active: appUsers.active,
      deletedAt: appUsers.deletedAt,
    })
    .from(userSessions)
    .innerJoin(appUsers, eq(appUsers.id, userSessions.userId))
    .where(eq(userSessions.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await getDb().delete(userSessions).where(eq(userSessions.tokenHash, tokenHash)).catch(() => undefined);
    return null;
  }
  if (!row.active || row.deletedAt) return null;
  void purgeExpiredSessions();
  return {
    displayName: row.displayName || row.email,
    email: row.email,
    fullName: row.displayName || null,
  };
}

export function sessionCookieHeader(token: string, expiresAt: string, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const secureAttr = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secureAttr}`;
}

export function clearSessionCookieHeader(secure: boolean): string {
  const secureAttr = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureAttr}`;
}

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

export function isLockedOut(pinLockedUntil: string): boolean {
  return Boolean(pinLockedUntil) && new Date(pinLockedUntil).getTime() > Date.now();
}

export async function registerFailedPinAttempt(userId: number, currentFailedAttempts: number): Promise<void> {
  const attempts = currentFailedAttempts + 1;
  const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : "";
  await getDb()
    .update(appUsers)
    .set({ failedPinAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts, pinLockedUntil: lockedUntil })
    .where(eq(appUsers.id, userId))
    .catch(() => undefined);
}

export async function clearFailedPinAttempts(userId: number): Promise<void> {
  await getDb()
    .update(appUsers)
    .set({ failedPinAttempts: 0, pinLockedUntil: "" })
    .where(eq(appUsers.id, userId))
    .catch(() => undefined);
}
