import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appUsers, uploadAgentTokens } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

// Tokens de carga automática: permiten que un equipo de la oficina envíe
// archivos sin que nadie inicie sesión, para que el corte mensual de obra
// llegue solo desde Microsoft Project.
//
// A diferencia de los de TV, éstos ESCRIBEN, así que se emiten con más
// cautela: sólo un administrador, siempre a nombre de una persona concreta
// —que es de quien heredan los permisos y a quien se atribuyen las cargas en la
// auditoría—, con caducidad más corta por defecto y revocables al instante.

const MAX_ACTIVE_TOKENS = 10;
const DEFAULT_VALIDITY_DAYS = 180;
const MAX_VALIDITY_DAYS = 365;
const TOKEN_PREFIX = "araya_up_";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function noStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function publicToken(row: typeof uploadAgentTokens.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    ownerEmail: row.ownerEmail,
    createdByName: row.createdByName,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    useCount: row.useCount,
    createdAt: row.createdAt,
    active: !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now(),
  };
}

const AVISO_MIGRACION =
  "El registro de cargas automáticas no está disponible. Si el despliegue es nuevo, falta aplicar la migración 0022_upload_agent_tokens.sql en D1.";

export async function GET() {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;
  try {
    const rows = await getDb()
      .select()
      .from(uploadAgentTokens)
      .orderBy(desc(uploadAgentTokens.id))
      .limit(50);
    return noStore({ tokens: rows.map(publicToken) });
  } catch {
    return noStore({ error: AVISO_MIGRACION }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  let payload: { label?: unknown; ownerEmail?: unknown; validityDays?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    payload = {};
  }
  const label = String(payload.label ?? "").trim().slice(0, 120) || "Equipo sin nombre";
  const ownerEmail = String(payload.ownerEmail ?? "").trim().toLowerCase();
  if (!ownerEmail) {
    return noStore({
      error: "Indica a nombre de quién se emite: las cargas se atribuyen a esa persona y heredan sus permisos.",
    }, { status: 400 });
  }
  const requestedDays = Number(payload.validityDays);
  const validityDays = Number.isFinite(requestedDays) && requestedDays >= 1
    ? Math.min(Math.trunc(requestedDays), MAX_VALIDITY_DAYS)
    : DEFAULT_VALIDITY_DAYS;

  try {
    const db = getDb();

    // El titular tiene que existir y estar operativo ahora: emitir un token a
    // nombre de alguien desactivado crearía un acceso que no funciona y que
    // parecería válido en la lista.
    const [owner] = await db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.email, ownerEmail), eq(appUsers.active, true), eq(appUsers.deletedAt, "")))
      .limit(1);
    if (!owner) {
      return noStore({
        error: "Esa persona no existe o no está activa en el Centro de Control.",
      }, { status: 400 });
    }

    const existing = await db
      .select({ revokedAt: uploadAgentTokens.revokedAt, expiresAt: uploadAgentTokens.expiresAt })
      .from(uploadAgentTokens);
    const activeCount = existing.filter((row) => !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now()).length;
    if (activeCount >= MAX_ACTIVE_TOKENS) {
      return noStore({
        error: `Ya hay ${MAX_ACTIVE_TOKENS} cargas automáticas activas. Revoca alguna antes de crear otra.`,
      }, { status: 400 });
    }

    const token = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
    const [row] = await db.insert(uploadAgentTokens).values({
      tokenHash: hashToken(token),
      label,
      ownerEmail: owner.email,
      createdByEmail: auth.user.email,
      createdByName: auth.user.displayName,
      expiresAt,
    }).returning();

    return noStore({
      token: publicToken(row),
      // El token en claro sólo viaja en esta respuesta y no vuelve a poder
      // consultarse: en la base únicamente queda su hash.
      secret: token,
      message: "Carga automática creada. Copia el token ahora: no volverá a mostrarse.",
    }, { status: 201 });
  } catch {
    return noStore({ error: AVISO_MIGRACION }, { status: 503 });
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
    return noStore({ error: "Identificador de carga automática no válido." }, { status: 400 });
  }
  try {
    const [row] = await getDb()
      .update(uploadAgentTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(uploadAgentTokens.id, id))
      .returning();
    if (!row) return noStore({ error: "Esa carga automática no existe." }, { status: 404 });
    return noStore({
      token: publicToken(row),
      message: "Carga automática revocada. El token deja de funcionar de inmediato.",
    });
  } catch {
    return noStore({ error: "No se pudo revocar la carga automática." }, { status: 500 });
  }
}
