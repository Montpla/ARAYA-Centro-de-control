import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { tvDeviceTokens } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

// Pantallas del modo TV/obra. Solo un administrador crea o revoca tokens de
// dispositivo; el token en claro se muestra una única vez al crearlo (en la
// base solo queda su hash SHA-256, igual que las sesiones). El token da
// acceso exclusivamente al resumen no financiero de /api/tv.

const MAX_ACTIVE_TOKENS = 20;
const DEFAULT_VALIDITY_DAYS = 90;
const MAX_VALIDITY_DAYS = 365;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function noStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function publicToken(row: typeof tvDeviceTokens.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    createdByName: row.createdByName,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    active: !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now(),
  };
}

export async function GET() {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;
  try {
    const rows = await getDb()
      .select()
      .from(tvDeviceTokens)
      .orderBy(desc(tvDeviceTokens.id))
      .limit(50);
    return noStore({ tokens: rows.map(publicToken) });
  } catch {
    return noStore({
      error: "El registro de pantallas no está disponible. Si el despliegue es nuevo, falta aplicar la migración 0021_tv_device_tokens.sql en D1.",
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  let payload: { label?: unknown; validityDays?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    payload = {};
  }
  const label = String(payload.label ?? "").trim().slice(0, 120) || "Pantalla sin nombre";
  const requestedDays = Number(payload.validityDays);
  const validityDays = Number.isFinite(requestedDays) && requestedDays >= 1
    ? Math.min(Math.trunc(requestedDays), MAX_VALIDITY_DAYS)
    : DEFAULT_VALIDITY_DAYS;

  try {
    const db = getDb();
    const existing = await db.select({ revokedAt: tvDeviceTokens.revokedAt, expiresAt: tvDeviceTokens.expiresAt }).from(tvDeviceTokens);
    const activeCount = existing.filter((row) => !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now()).length;
    if (activeCount >= MAX_ACTIVE_TOKENS) {
      return noStore({ error: `Ya hay ${MAX_ACTIVE_TOKENS} pantallas activas. Revoca alguna antes de crear otra.` }, { status: 400 });
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
    const [row] = await db.insert(tvDeviceTokens).values({
      tokenHash: hashToken(token),
      label,
      createdByEmail: auth.user.email,
      createdByName: auth.user.displayName,
      expiresAt,
    }).returning();
    return noStore({
      token: publicToken(row),
      // El token en claro solo viaja en esta respuesta; no vuelve a poder
      // consultarse. La URL completa se construye aquí para copiarla directa.
      url: `/tv?token=${token}`,
      message: `Pantalla creada. Copia el enlace ahora: no volverá a mostrarse.`,
    }, { status: 201 });
  } catch {
    return noStore({
      error: "No se pudo crear la pantalla. Si el despliegue es nuevo, falta aplicar la migración 0021_tv_device_tokens.sql en D1.",
    }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  let payload: { id?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return noStore({ error: "La petición no contiene un JSON válido." }, { status: 400 });
  }
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return noStore({ error: "Identificador de pantalla no válido." }, { status: 400 });
  }
  try {
    const [row] = await getDb()
      .update(tvDeviceTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(tvDeviceTokens.id, id))
      .returning();
    if (!row) return noStore({ error: "La pantalla no existe." }, { status: 404 });
    return noStore({ token: publicToken(row), message: "Pantalla revocada. El enlace deja de funcionar de inmediato." });
  } catch {
    return noStore({ error: "No se pudo revocar la pantalla." }, { status: 500 });
  }
}
