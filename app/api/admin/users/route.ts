import { env } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accessAudit, appUsers } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { isUserArea } from "../../../../lib/file-routing";
import { scheduleNotificationDispatch } from "../../../../lib/notification-dispatch";
import { hashPin, validPinFormat } from "../../../../lib/pin";

export const runtime = "edge";

type UserPayload = {
  id?: number;
  email?: string;
  displayName?: string;
  role?: string;
  area?: string;
  financeAccess?: boolean;
  financeUploadAccess?: boolean;
  financeApproveAccess?: boolean;
  active?: boolean;
  expectedUpdatedAt?: string;
  restore?: boolean;
  pin?: string;
};

type AvatarBucket = {
  delete: (key: string) => Promise<void>;
};

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseUserId(value: unknown) {
  const id = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizedDisplayName(value: unknown, email: string) {
  return String(value ?? "").trim().slice(0, 120) || email;
}

function validEmail(email: string) {
  return Boolean(email && email.includes("@") && email.length <= 254);
}

function publicRow(row: typeof appUsers.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName || row.email,
    role: row.role === "admin" ? "admin" : "member",
    area: isUserArea(row.area) ? row.area : "direccion",
    financeAccess: row.role === "admin" || row.financeAccess || row.financeApproveAccess,
    financeUploadAccess: row.role === "admin" || row.financeUploadAccess,
    financeApproveAccess: row.role === "admin" || row.financeApproveAccess,
    active: row.active,
    avatarUrl: row.avatarStorageKey
      ? `/api/profile/avatar?user=${row.id}&v=${encodeURIComponent(row.avatarUpdatedAt)}`
      : "",
    lastLoginAt: row.lastLoginAt,
    deletedAt: row.deletedAt,
    deletedByEmail: row.deletedByEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditSnapshot(row: typeof appUsers.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName || row.email,
    role: row.role,
    area: row.area,
    financeAccess: row.role === "admin" || row.financeAccess || row.financeApproveAccess,
    financeUploadAccess: row.role === "admin" || row.financeUploadAccess,
    financeApproveAccess: row.role === "admin" || row.financeApproveAccess,
    active: row.active,
    deletedAt: row.deletedAt,
  };
}

async function writeAudit(input: {
  targetEmail: string;
  action: string;
  before?: ReturnType<typeof auditSnapshot>;
  after?: ReturnType<typeof auditSnapshot>;
  actorEmail: string;
  actorName: string;
}) {
  try {
    await getDb().insert(accessAudit).values({
      targetEmail: input.targetEmail,
      action: input.action,
      detail: JSON.stringify({ before: input.before ?? null, after: input.after ?? null }),
      actorEmail: input.actorEmail,
      actorName: input.actorName,
    });
    return true;
  } catch {
    return false;
  }
}

function auditedMessage(message: string, auditRecorded: boolean) {
  return auditRecorded
    ? message
    : `${message} Aviso: el cambio se aplicó, pero el registro de auditoría requiere revisión técnica.`;
}

function activeAdminSafetyCondition() {
  return sql`(
    SELECT COUNT(*)
    FROM ${appUsers}
    WHERE ${appUsers.role} = 'admin'
      AND ${appUsers.active} = 1
      AND ${appUsers.deletedAt} = ''
  ) > 1`;
}

async function removeAvatar(storageKey: string) {
  if (!storageKey) return;
  const bucket = (env as unknown as { FILES?: AvatarBucket }).FILES;
  if (!bucket) return;
  await bucket.delete(storageKey).catch(() => undefined);
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

  let payload: UserPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Los datos del usuario no son válidos." }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  if (!validEmail(email)) {
    return Response.json({ error: "Introduce un correo electrónico válido." }, { status: 400 });
  }
  const pin = String(payload.pin ?? "");
  if (!validPinFormat(pin)) {
    return Response.json({ error: "El PIN debe tener entre 4 y 10 dígitos." }, { status: 400 });
  }
  const role = payload.role === "admin" ? "admin" : "member";
  const area = isUserArea(String(payload.area ?? "")) ? String(payload.area) : "direccion";
  const financeAccess = role === "admin" || Boolean(payload.financeAccess) || Boolean(payload.financeApproveAccess);
  const financeUploadAccess = role === "admin" || payload.financeUploadAccess !== false;
  const financeApproveAccess = role === "admin" || Boolean(payload.financeApproveAccess);
  const now = new Date().toISOString();
  const db = getDb();
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  if (existing) {
    return Response.json(
      {
        error: existing.deletedAt
          ? "Ese correo pertenece a un usuario eliminado. Restáuralo desde el archivo de usuarios."
          : "Ese correo ya está autorizado. Usa Editar para modificar sus datos.",
      },
      { status: 409 },
    );
  }

  let row: typeof appUsers.$inferSelect | undefined;
  try {
    [row] = await db
      .insert(appUsers)
      .values({
        email,
        displayName: normalizedDisplayName(payload.displayName, email),
        role,
        area,
        financeAccess,
        financeUploadAccess,
        financeApproveAccess,
        active: true,
        pinHash: hashPin(pin),
        createdByEmail: auth.user.email,
        updatedAt: now,
      })
      .returning();
  } catch {
    return Response.json({ error: "Ese correo ya está registrado." }, { status: 409 });
  }
  if (!row) {
    return Response.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }

  const auditRecorded = await writeAudit({
    targetEmail: row.email,
    action: "usuario_creado",
    after: auditSnapshot(row),
    actorEmail: auth.user.email,
    actorName: auth.identity.displayName,
  });
  scheduleNotificationDispatch();
  return Response.json(
    {
      user: publicRow(row),
      message: auditedMessage(
        `${row.displayName || row.email} ya puede acceder al Centro de Control.`,
        auditRecorded,
      ),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user || !auth.identity) return auth.response;

  let payload: UserPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Los datos del usuario no son válidos." }, { status: 400 });
  }

  const id = parseUserId(payload.id);
  if (!id) return Response.json({ error: "Usuario no válido." }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!existing) return Response.json({ error: "El usuario ya no existe." }, { status: 404 });

  const expectedUpdatedAt = String(payload.expectedUpdatedAt ?? existing.updatedAt);
  const now = new Date().toISOString();
  if (payload.restore) {
    if (!existing.deletedAt) {
      return Response.json({ user: publicRow(existing), message: "El usuario ya estaba activo en el directorio." });
    }
    const [restored] = await db
      .update(appUsers)
      .set({
        active: true,
        financeAccess: existing.role === "admin" || existing.financeAccess || existing.financeApproveAccess,
        financeUploadAccess: existing.role === "admin" || existing.financeUploadAccess,
        financeApproveAccess: existing.role === "admin" || existing.financeApproveAccess,
        deletedAt: "",
        deletedByEmail: "",
        notificationKind: "user_restored",
        notificationNonce: crypto.randomUUID(),
        notificationActorEmail: auth.user.email,
        notificationActorName: auth.identity.displayName,
        updatedAt: now,
      })
      .where(and(eq(appUsers.id, id), eq(appUsers.updatedAt, expectedUpdatedAt)))
      .returning();
    if (!restored) {
      return Response.json({ error: "El usuario cambió mientras lo editabas. Actualiza el directorio e inténtalo de nuevo." }, { status: 409 });
    }
    const auditRecorded = await writeAudit({
      targetEmail: restored.email,
      action: "usuario_restaurado",
      before: auditSnapshot(existing),
      after: auditSnapshot(restored),
      actorEmail: auth.user.email,
      actorName: auth.identity.displayName,
    });
    scheduleNotificationDispatch();
    return Response.json({
      user: publicRow(restored),
      message: auditedMessage(`${restored.displayName || restored.email} ha sido restaurado.`, auditRecorded),
    });
  }

  if (existing.deletedAt) {
    return Response.json({ error: "Restaura el usuario antes de editarlo." }, { status: 409 });
  }

  const email = normalizeEmail(payload.email);
  if (!validEmail(email)) {
    return Response.json({ error: "Introduce un correo electrónico válido." }, { status: 400 });
  }
  const resetPin = payload.pin !== undefined && String(payload.pin).trim() !== "";
  if (resetPin && !validPinFormat(String(payload.pin))) {
    return Response.json({ error: "El PIN debe tener entre 4 y 10 dígitos." }, { status: 400 });
  }
  const role = payload.role === "admin" ? "admin" : "member";
  const area = isUserArea(String(payload.area ?? "")) ? String(payload.area) : "direccion";
  const active = payload.active !== false;
  const financeAccess = role === "admin" || Boolean(payload.financeAccess) || Boolean(payload.financeApproveAccess);
  const financeUploadAccess = role === "admin" || payload.financeUploadAccess !== false;
  const financeApproveAccess = role === "admin" || Boolean(payload.financeApproveAccess);
  const isSelf = existing.id === auth.user.id;
  if (isSelf && (email !== auth.user.email || !active || role !== "admin")) {
    return Response.json(
      { error: "Tu propia cuenta debe conservar el correo, el acceso activo y el rol de administrador." },
      { status: 400 },
    );
  }

  const removesActiveAdmin =
    existing.role === "admin" && existing.active && (role !== "admin" || !active);
  try {
    const [updated] = await db
      .update(appUsers)
      .set({
        email,
        displayName: normalizedDisplayName(payload.displayName, email),
        role,
        area,
        financeAccess,
        financeUploadAccess,
        financeApproveAccess,
        active,
        ...(resetPin ? { pinHash: hashPin(String(payload.pin)), failedPinAttempts: 0, pinLockedUntil: "" } : {}),
        notificationKind: "user_updated",
        notificationNonce: crypto.randomUUID(),
        notificationActorEmail: auth.user.email,
        notificationActorName: auth.identity.displayName,
        updatedAt: now,
      })
      .where(and(
        eq(appUsers.id, id),
        eq(appUsers.updatedAt, expectedUpdatedAt),
        removesActiveAdmin ? activeAdminSafetyCondition() : undefined,
      ))
      .returning();

    if (!updated) {
      const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
      if (!current || current.updatedAt !== expectedUpdatedAt) {
        return Response.json({ error: "El usuario cambió mientras lo editabas. Actualiza el directorio e inténtalo de nuevo." }, { status: 409 });
      }
      return Response.json({ error: "Debe permanecer al menos un administrador activo." }, { status: 400 });
    }

    const auditRecorded = await writeAudit({
      targetEmail: updated.email,
      action: "usuario_editado",
      before: auditSnapshot(existing),
      after: auditSnapshot(updated),
      actorEmail: auth.user.email,
      actorName: auth.identity.displayName,
    });
    scheduleNotificationDispatch();
    return Response.json({
      user: publicRow(updated),
      message: auditedMessage(
        `Los datos de ${updated.displayName || updated.email} se han actualizado.`,
        auditRecorded,
      ),
    });
  } catch {
    return Response.json({ error: "Ese correo ya está asignado a otro usuario." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user || !auth.identity) return auth.response;

  const url = new URL(request.url);
  const id = parseUserId(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "Usuario no válido." }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!existing) return Response.json({ error: "El usuario ya no existe." }, { status: 404 });
  if (existing.deletedAt) {
    return Response.json({ message: "El acceso ya estaba eliminado." });
  }
  if (existing.id === auth.user.id) {
    return Response.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  }

  const expectedUpdatedAt = url.searchParams.get("expectedUpdatedAt") ?? existing.updatedAt;
  const removesActiveAdmin = existing.role === "admin" && existing.active;
  const now = new Date().toISOString();
  const [deleted] = await db
    .update(appUsers)
    .set({
      active: false,
      avatarStorageKey: "",
      avatarMimeType: "",
      avatarUpdatedAt: "",
      deletedAt: now,
      deletedByEmail: auth.user.email,
      notificationKind: "user_removed",
      notificationNonce: crypto.randomUUID(),
      notificationActorEmail: auth.user.email,
      notificationActorName: auth.identity.displayName,
      updatedAt: now,
    })
    .where(and(
      eq(appUsers.id, id),
      eq(appUsers.updatedAt, expectedUpdatedAt),
      removesActiveAdmin ? activeAdminSafetyCondition() : undefined,
    ))
    .returning();

  if (!deleted) {
    const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
    if (!current || current.updatedAt !== expectedUpdatedAt) {
      return Response.json({ error: "El usuario cambió mientras confirmabas la eliminación. Actualiza el directorio e inténtalo de nuevo." }, { status: 409 });
    }
    return Response.json({ error: "No puedes eliminar el último administrador activo." }, { status: 400 });
  }

  const auditRecorded = await writeAudit({
    targetEmail: existing.email,
    action: "usuario_eliminado",
    before: auditSnapshot(existing),
    after: auditSnapshot(deleted),
    actorEmail: auth.user.email,
    actorName: auth.identity.displayName,
  });
  await removeAvatar(existing.avatarStorageKey);
  scheduleNotificationDispatch();
  return Response.json({
    message: auditedMessage(
      `${existing.displayName || existing.email} ya no puede acceder. Su historial de actividad se conserva.`,
      auditRecorded,
    ),
  });
}
