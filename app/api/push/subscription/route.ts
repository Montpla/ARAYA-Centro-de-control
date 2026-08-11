import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { pushSubscriptions } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function limitedText(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

function privateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19));
}

function safePushEndpoint(value: unknown) {
  const candidate = limitedText(value, 4_096);
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const isIpv6 = hostname.includes(":");
    const privateIpv6 = isIpv6 && (
      hostname === "::1" ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd")
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      privateIpv4(hostname) ||
      privateIpv6
    ) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function base64UrlByteLength(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return -1;
  const unpadded = value.replace(/=+$/, "");
  const base64 = unpadded.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (unpadded.length % 4)) % 4);
  try {
    return atob(base64).length;
  } catch {
    return -1;
  }
}

function normalizedExpirationTime(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.trunc(parsed)) : null;
}

function noStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: JsonRecord;
  try {
    payload = record(await request.json());
  } catch {
    return noStore({ error: "La suscripción push no es válida." }, { status: 400 });
  }

  const subscription = Object.keys(record(payload.subscription)).length
    ? record(payload.subscription)
    : payload;
  const keys = record(subscription.keys);
  const endpoint = safePushEndpoint(subscription.endpoint);
  const p256dh = limitedText(keys.p256dh, 256);
  const authKey = limitedText(keys.auth, 128);
  const expirationTime = normalizedExpirationTime(subscription.expirationTime);
  if (!endpoint) {
    return noStore({ error: "El endpoint push debe ser una dirección HTTPS pública." }, { status: 400 });
  }
  if (base64UrlByteLength(p256dh) !== 65 || base64UrlByteLength(authKey) !== 16) {
    return noStore({ error: "Las claves de la suscripción push no son válidas." }, { status: 400 });
  }
  if (expirationTime === null) {
    return noStore({ error: "La caducidad de la suscripción push no es válida." }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const platform = limitedText(payload.platform, 80);
  const userAgent = limitedText(request.headers.get("user-agent"), 500);
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);
  const id = existing?.id ?? crypto.randomUUID();
  await db
    .insert(pushSubscriptions)
    .values({
      id,
      userEmail: auth.user.email.toLowerCase(),
      endpoint,
      p256dh,
      auth: authKey,
      expirationTime,
      platform,
      userAgent,
      active: true,
      failureCount: 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userEmail: auth.user.email.toLowerCase(),
        p256dh,
        auth: authKey,
        expirationTime,
        platform,
        userAgent,
        active: true,
        failureCount: 0,
        updatedAt: now,
      },
    });

  return noStore({
    subscription: { id, endpoint, active: true },
    updatedAt: now,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: JsonRecord;
  try {
    payload = record(await request.json());
  } catch {
    return noStore({ error: "La solicitud para desactivar el push no es válida." }, { status: 400 });
  }

  const endpoint = safePushEndpoint(payload.endpoint);
  if (!endpoint) {
    return noStore({ error: "Indica un endpoint push HTTPS válido." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const disabled = await getDb()
    .update(pushSubscriptions)
    .set({ active: false, updatedAt: now })
    .where(and(
      eq(pushSubscriptions.endpoint, endpoint),
      eq(pushSubscriptions.userEmail, auth.user.email.toLowerCase()),
    ))
    .returning({ id: pushSubscriptions.id });

  return noStore({
    disabled: disabled.length > 0,
    updatedAt: now,
  });
}
