import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accessAudit, appUsers } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function publicRow(row: typeof appUsers.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName || row.email,
    role: row.role === "admin" ? "admin" : "member",
    financeAccess: row.role === "admin" || row.financeAccess,
    active: row.active,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;
  const db = getDb();
  const rows = await db.select().from(appUsers).orderBy(desc(appUsers.createdAt));
  return Response.json({ users: rows.map(publicRow), currentUserEmail: auth.user.email });
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user || !auth.identity) return auth.response;

  let payload: {
    email?: string;
    displayName?: string;
    role?: string;
    financeAccess?: boolean;
    active?: boolean;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Los datos del usuario no son válidos." }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  if (!email || !email.includes("@") || email.length > 254) {
    return Response.json({ error: "Introduce un correo electrónico válido." }, { status: 400 });
  }
  const role = payload.role === "admin" ? "admin" : "member";
  const active = payload.active !== false;
  const financeAccess = role === "admin" || Boolean(payload.financeAccess);
  if (email === auth.user.email && (!active || role !== "admin")) {
    return Response.json({ error: "El administrador actual no puede desactivar ni retirar su propio rol." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getDb();
  await db
    .insert(appUsers)
    .values({
      email,
      displayName: String(payload.displayName ?? "").trim().slice(0, 120) || email,
      role,
      financeAccess,
      active,
      createdByEmail: auth.user.email,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appUsers.email,
      set: {
        displayName: String(payload.displayName ?? "").trim().slice(0, 120) || email,
        role,
        financeAccess,
        active,
        updatedAt: now,
      },
    });
  const [row] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  await db.insert(accessAudit).values({
    targetEmail: email,
    action: "usuario_actualizado",
    detail: JSON.stringify({ role, financeAccess, active }),
    actorEmail: auth.user.email,
    actorName: auth.identity.displayName,
  });
  return Response.json({
    user: publicRow(row),
    message: active
      ? `${row.displayName || row.email} ya puede acceder al Centro de Control.`
      : `El acceso de ${row.displayName || row.email} ha sido desactivado.`,
  });
}
