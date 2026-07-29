import { eq } from "drizzle-orm";
import { ChatGPTUser, getChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { appUsers } from "../db/schema";
import { UserArea, isUserArea } from "./file-routing";

export type AuthorizedUser = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "member";
  area: UserArea;
  financeAccess: boolean;
  active: boolean;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function publicUser(row: typeof appUsers.$inferSelect): AuthorizedUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName || row.email,
    role: row.role === "admin" ? "admin" : "member",
    area: isUserArea(row.area) ? row.area : "direccion",
    financeAccess: row.role === "admin" || row.financeAccess,
    active: row.active,
  };
}

export async function resolveAuthorizedUser(identity: ChatGPTUser) {
  const email = normalizeEmail(identity.email);
  const db = getDb();
  let [row] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);

  const bootstrapAdmin = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "");
  if (!row && bootstrapAdmin && email === bootstrapAdmin) {
    await db
      .insert(appUsers)
      .values({
        email,
        displayName: identity.displayName,
        role: "admin",
        area: "direccion",
        financeAccess: true,
        active: true,
        createdByEmail: "bootstrap",
        lastLoginAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: appUsers.email });
    [row] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  }

  if (!row || !row.active) return null;
  const now = new Date();
  const previousLoginAt = row.lastLoginAt ? Date.parse(row.lastLoginAt) : Number.NaN;
  const shouldRefreshLogin =
    !Number.isFinite(previousLoginAt) || now.getTime() - previousLoginAt >= 5 * 60 * 1000;

  if (shouldRefreshLogin) {
    const lastLoginAt = now.toISOString();
    await db
      .update(appUsers)
      .set({
        displayName: row.displayName || identity.displayName,
        lastLoginAt,
      })
      .where(eq(appUsers.id, row.id));
  }
  return publicUser(row);
}

export async function getAuthorizedUser() {
  const identity = await getChatGPTUser();
  if (!identity) return { identity: null, user: null };
  try {
    return { identity, user: await resolveAuthorizedUser(identity) };
  } catch {
    return { identity, user: null };
  }
}

export async function requireApiUser(options: { admin?: boolean; finance?: boolean } = {}) {
  const auth = await getAuthorizedUser();
  if (!auth.identity) {
    return {
      response: Response.json({ error: "Debes iniciar sesión para acceder al Centro de Control." }, { status: 401 }),
      identity: null,
      user: null,
    };
  }
  if (!auth.user) {
    return {
      response: Response.json({ error: "Tu usuario no está autorizado o se encuentra desactivado." }, { status: 403 }),
      identity: auth.identity,
      user: null,
    };
  }
  if (options.admin && auth.user.role !== "admin") {
    return {
      response: Response.json({ error: "Esta acción requiere permisos de administrador." }, { status: 403 }),
      identity: auth.identity,
      user: null,
    };
  }
  if (options.finance && !auth.user.financeAccess) {
    return {
      response: Response.json({ error: "No tienes acceso al área financiera." }, { status: 403 }),
      identity: auth.identity,
      user: null,
    };
  }
  return { response: null, identity: auth.identity, user: auth.user };
}
