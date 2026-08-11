import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accessAudit, appUsers } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { scheduleNotificationDispatch } from "../../../../lib/notification-dispatch";

export const runtime = "edge";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const avatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

type StoredAvatar = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type AvatarBucket = {
  put: (
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
  get: (key: string) => Promise<StoredAvatar | null>;
  delete: (key: string) => Promise<void>;
};

function getAvatarBucket() {
  const bucket = (env as unknown as { FILES?: AvatarBucket }).FILES;
  if (!bucket) throw new Error("La vinculación R2 `FILES` no está disponible.");
  return bucket;
}

function avatarUrl(userId: number, updatedAt: string) {
  return `/api/profile/avatar?user=${userId}&v=${encodeURIComponent(updatedAt)}`;
}

function parseUserId(value: unknown) {
  const id = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const requestedId = parseUserId(new URL(request.url).searchParams.get("user")) ?? auth.user.id;
  const db = getDb();
  const [row] = await db.select().from(appUsers).where(eq(appUsers.id, requestedId)).limit(1);
  if (!row?.avatarStorageKey) {
    return Response.json({ error: "Este usuario todavía no tiene fotografía." }, { status: 404 });
  }

  const object = await getAvatarBucket().get(row.avatarStorageKey);
  if (!object) {
    return Response.json({ error: "La fotografía no está disponible." }, { status: 404 });
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || row.avatarMimeType || "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user || !auth.identity) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "La solicitud de fotografía no es válida." }, { status: 400 });
  }

  const targetUserId = parseUserId(formData.get("targetUserId")) ?? auth.user.id;
  if (targetUserId !== auth.user.id && auth.user.role !== "admin") {
    return Response.json(
      { error: "Sólo un administrador puede cambiar la fotografía de otra persona." },
      { status: 403 },
    );
  }

  const candidate = formData.get("file");
  if (!(candidate instanceof File) || candidate.size === 0) {
    return Response.json({ error: "Selecciona una fotografía." }, { status: 400 });
  }
  if (candidate.size > MAX_AVATAR_SIZE) {
    return Response.json({ error: "La fotografía supera el límite de 5 MB." }, { status: 413 });
  }
  const extension = avatarTypes.get(candidate.type);
  if (!extension) {
    return Response.json(
      { error: "Formato no admitido. Usa JPG, PNG, WebP o AVIF." },
      { status: 415 },
    );
  }

  const db = getDb();
  const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, targetUserId)).limit(1);
  if (!targetUser) {
    return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const bucket = getAvatarBucket();
  const previousStorageKey = targetUser.avatarStorageKey;
  const storageKey = `araya/user-avatars/${targetUserId}/${crypto.randomUUID()}.${extension}`;
  const bytes = await candidate.arrayBuffer();
  const updatedAt = new Date().toISOString();

  await bucket.put(storageKey, bytes, {
    httpMetadata: { contentType: candidate.type },
    customMetadata: {
      userId: String(targetUserId),
      uploadedBy: auth.user.email,
      originalName: candidate.name.slice(0, 180),
    },
  });

  try {
    await db
      .update(appUsers)
      .set({
        avatarStorageKey: storageKey,
        avatarMimeType: candidate.type,
        avatarUpdatedAt: updatedAt,
        notificationKind: "user_avatar_updated",
        notificationNonce: crypto.randomUUID(),
        notificationActorEmail: auth.user.email,
        notificationActorName: auth.identity.displayName,
        updatedAt,
      })
      .where(eq(appUsers.id, targetUserId));
    await db.insert(accessAudit).values({
      targetEmail: targetUser.email,
      action: "foto_perfil_actualizada",
      detail: JSON.stringify({ mimeType: candidate.type, sizeBytes: candidate.size }),
      actorEmail: auth.user.email,
      actorName: auth.identity.displayName,
    });
  } catch {
    await bucket.delete(storageKey);
    return Response.json({ error: "No se pudo guardar la fotografía." }, { status: 500 });
  }

  if (previousStorageKey && previousStorageKey !== storageKey) {
    await bucket.delete(previousStorageKey).catch(() => undefined);
  }
  scheduleNotificationDispatch();
  return Response.json(
    {
      avatarUrl: avatarUrl(targetUserId, updatedAt),
      message: `Fotografía de ${targetUser.displayName || targetUser.email} actualizada.`,
    },
    { status: 201 },
  );
}
