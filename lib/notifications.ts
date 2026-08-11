import { getDb } from "../db";
import { and, asc, eq, sql } from "drizzle-orm";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import {
  appUsers,
  notificationDeliveries,
  notificationEvents,
  pushSubscriptions,
} from "../db/schema";
import {
  financeProtectedAreaValues,
  requiresFinanceAccessForArea,
} from "./live-data";

export type NotificationAudience =
  | "all"
  | "admin"
  | "finance"
  | "area"
  | `area:${string}`
  | `user:${string}`;

export type NotificationRecipient = {
  email: string;
  role: "admin" | "member";
  area: string;
  financeAccess: boolean;
};

export type NotificationVisibilityRecord = {
  audience: string;
  area: string;
};

export type NotificationInput = {
  kind: string;
  projectId?: string;
  area?: string;
  audience?: NotificationAudience;
  actorEmail?: string;
  actorName?: string;
  subjectType?: string;
  subjectId?: string | number;
  title: string;
  body?: string;
  view?: string;
  payload?: unknown;
  createdAt?: string;
};

export type PreparedNotificationRecord = {
  kind: string;
  projectId: string;
  area: string;
  audience: string;
  actorEmail: string;
  actorName: string;
  subjectType: string;
  subjectId: string;
  title: string;
  body: string;
  view: string;
  payloadJson: string;
  createdAt: string;
};

const FANOUT_LEASE_MS = 2 * 60 * 1_000;
const DELIVERY_LEASE_MS = 2 * 60 * 1_000;
// One successful push consumes at most six D1 queries. Five deliveries plus
// relay/fanout bookkeeping remain below the D1 Free 50-query invocation cap.
const MAX_DISPATCH_BATCH = 5;
const MAX_FANOUTS_PER_DISPATCH = 2;

function limitedText(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizedAudience(value: NotificationAudience | undefined): NotificationAudience {
  const audience = limitedText(value || "all", 320).toLowerCase();
  if (["all", "admin", "finance", "area"].includes(audience)) {
    return audience as NotificationAudience;
  }
  if (audience.startsWith("area:") && audience.length > 5) {
    return audience as `area:${string}`;
  }
  if (audience.startsWith("user:") && audience.length > 5) {
    return `user:${normalizedEmail(audience.slice(5))}`;
  }
  throw new Error("La audiencia de la notificación no es válida.");
}

function serializedPayload(value: unknown) {
  if (value === undefined) return "{}";
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > 8_000) return JSON.stringify({ truncated: true });
    return serialized;
  } catch {
    return "{}";
  }
}

export function notificationVisibleToUser(
  event: NotificationVisibilityRecord,
  user: NotificationRecipient,
) {
  const audience = event.audience.trim().toLowerCase();
  const eventArea = event.area.trim().toLowerCase();
  const userArea = user.area.trim().toLowerCase();
  const userEmail = normalizedEmail(user.email);

  // Finance and commercial data are always fail-closed, even if a producer
  // accidentally selects "all" or the user's normal area matches the event.
  const audienceArea = audience.startsWith("area:") ? audience.slice(5) : "";
  if (!user.financeAccess && (
    requiresFinanceAccessForArea(eventArea) ||
    audience === "finance" ||
    requiresFinanceAccessForArea(audienceArea)
  )) return false;

  if (audience === "all") return true;
  if (audience === "admin") return user.role === "admin";
  if (audience === "finance") return user.financeAccess;
  if (audience === "area") return user.role === "admin" || eventArea === userArea;
  if (audience.startsWith("area:")) {
    return user.role === "admin" || audience.slice(5) === userArea;
  }
  if (audience.startsWith("user:")) return audience.slice(5) === userEmail;
  return false;
}

/**
 * SQL equivalent of notificationVisibleToUser(). Keeping the audience filter
 * in the query prevents a large protected history from crowding visible rows
 * out of a bounded page.
 */
export function notificationVisibilityWhere(user: NotificationRecipient) {
  const audience = sql`lower(trim(${notificationEvents.audience}))`;
  const area = sql`lower(trim(${notificationEvents.area}))`;
  const userArea = user.area.trim().toLowerCase();
  const userEmail = normalizedEmail(user.email);
  const audienceClauses = [sql`${audience} = 'all'`];

  if (user.role === "admin") {
    audienceClauses.push(
      sql`${audience} = 'admin'`,
      sql`${audience} = 'area'`,
      sql`${audience} LIKE 'area:%'`,
    );
  } else {
    audienceClauses.push(
      sql`(${audience} = 'area' AND ${area} = ${userArea})`,
      sql`${audience} = ${`area:${userArea}`}`,
    );
  }
  if (user.financeAccess) audienceClauses.push(sql`${audience} = 'finance'`);
  audienceClauses.push(sql`${audience} = ${`user:${userEmail}`}`);

  const protectedAreas = financeProtectedAreaValues();
  const financeGuard = user.financeAccess
    ? sql`1 = 1`
    : sql`(
      ${area} NOT IN (${sql.join(protectedAreas.map((value) => sql`${value}`), sql`, `)})
      AND ${audience} != 'finance'
      AND ${audience} NOT IN (${sql.join(protectedAreas.map((value) => sql`${`area:${value}`}`), sql`, `)})
    )`;
  return and(
    financeGuard,
    sql`(${sql.join(audienceClauses, sql` OR `)})`,
  );
}

export function prepareNotificationRecord(input: NotificationInput): PreparedNotificationRecord {
  const kind = limitedText(input.kind, 80);
  const title = limitedText(input.title, 240);
  if (!kind) throw new Error("La notificación necesita un tipo.");
  if (!title) throw new Error("La notificación necesita un título.");

  return {
    kind,
    projectId: limitedText(input.projectId || "araya", 80) || "araya",
    area: limitedText(input.area || "direccion", 80) || "direccion",
    audience: normalizedAudience(input.audience),
    actorEmail: normalizedEmail(limitedText(input.actorEmail, 320)),
    actorName: limitedText(input.actorName, 160),
    subjectType: limitedText(input.subjectType, 80),
    subjectId: limitedText(input.subjectId, 160),
    title,
    body: limitedText(input.body, 800),
    view: limitedText(input.view || "resumen", 80) || "resumen",
    payloadJson: serializedPayload(input.payload),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export async function emitNotification(input: NotificationInput) {
  const record = prepareNotificationRecord(input);

  const [event] = await getDb()
    .insert(notificationEvents)
    .values(record)
    .returning();

  // Delivery is best-effort. The D1 event and per-subscription delivery rows
  // remain durable and are retried by dispatchPendingNotifications().
  await deliverPushNotification(event).catch(() => undefined);

  return event;
}

async function ensureNotificationFanout(eventId: number) {
  const db = getDb();
  const [event] = await db
    .select()
    .from(notificationEvents)
    .where(eq(notificationEvents.id, eventId))
    .limit(1);
  if (!event || event.fanoutStatus === "ready") return event;

  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - FANOUT_LEASE_MS).toISOString();
  const [claimed] = await db
    .update(notificationEvents)
    .set({
      fanoutStatus: "processing",
      fanoutClaimedAt: now,
      fanoutError: "",
    })
    .where(and(
      eq(notificationEvents.id, eventId),
      sql`(
        ${notificationEvents.fanoutStatus} = 'pending'
        OR (
          ${notificationEvents.fanoutStatus} = 'processing'
          AND ${notificationEvents.fanoutClaimedAt} <= ${staleBefore}
        )
      )`,
    ))
    .returning();
  if (!claimed) return event;

  try {
    await db
      .insert(notificationDeliveries)
      .select(db
        .select({
          notificationId: sql<number>`${claimed.id}`.as("notification_id"),
          subscriptionId: pushSubscriptions.id,
          status: sql<string>`'pending'`.as("status"),
          attemptCount: sql<number>`0`.as("attempt_count"),
          nextAttemptAt: sql<string>`''`.as("next_attempt_at"),
          claimedAt: sql<string>`''`.as("claimed_at"),
          deliveredAt: sql<string>`''`.as("delivered_at"),
          lastError: sql<string>`''`.as("last_error"),
          createdAt: sql<string>`${now}`.as("created_at"),
          updatedAt: sql<string>`${now}`.as("updated_at"),
        })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.active, true)))
      .onConflictDoNothing({
        target: [
          notificationDeliveries.notificationId,
          notificationDeliveries.subscriptionId,
        ],
      });
    const [ready] = await db
      .update(notificationEvents)
      .set({
        fanoutStatus: "ready",
        fanoutAt: now,
        fanoutError: "",
      })
      .where(and(
        eq(notificationEvents.id, claimed.id),
        eq(notificationEvents.fanoutStatus, "processing"),
        eq(notificationEvents.fanoutClaimedAt, now),
      ))
      .returning();
    return ready ?? claimed;
  } catch (error) {
    await db
      .update(notificationEvents)
      .set({
        fanoutStatus: "pending",
        fanoutClaimedAt: "",
        fanoutError: limitedText(error instanceof Error ? error.message : error, 500),
      })
      .where(and(
        eq(notificationEvents.id, claimed.id),
        eq(notificationEvents.fanoutStatus, "processing"),
        eq(notificationEvents.fanoutClaimedAt, now),
      ));
    throw error;
  }
}

function retryAt(attemptCount: number) {
  const delayMs = Math.min(60 * 60 * 1_000, 30_000 * (2 ** Math.min(attemptCount, 7)));
  return new Date(Date.now() + delayMs).toISOString();
}

function dispatchableDeliveryCondition(now: string, staleBefore: string) {
  return sql`(
    ${notificationDeliveries.status} = 'pending'
    OR (
      ${notificationDeliveries.status} = 'retry'
      AND (
        ${notificationDeliveries.nextAttemptAt} = ''
        OR ${notificationDeliveries.nextAttemptAt} <= ${now}
      )
    )
    OR (
      ${notificationDeliveries.status} = 'processing'
      AND ${notificationDeliveries.claimedAt} <= ${staleBefore}
    )
  )`;
}

function dispatchableDeliveryOrder() {
  return sql`CASE
    WHEN ${notificationDeliveries.status} = 'pending' THEN ${notificationDeliveries.createdAt}
    WHEN ${notificationDeliveries.status} = 'retry' THEN
      CASE
        WHEN ${notificationDeliveries.nextAttemptAt} = '' THEN ${notificationDeliveries.createdAt}
        ELSE ${notificationDeliveries.nextAttemptAt}
      END
    ELSE ${notificationDeliveries.claimedAt}
  END`;
}

async function finishDelivery(input: {
  id: number;
  claimedAt: string;
  status: "delivered" | "retry" | "cancelled";
  attemptCount: number;
  error?: string;
}) {
  const now = new Date().toISOString();
  await getDb()
    .update(notificationDeliveries)
    .set({
      status: input.status,
      nextAttemptAt: input.status === "retry" ? retryAt(input.attemptCount) : "",
      claimedAt: "",
      deliveredAt: input.status === "delivered" ? now : "",
      lastError: limitedText(input.error, 500),
      updatedAt: now,
    })
    .where(and(
      eq(notificationDeliveries.id, input.id),
      eq(notificationDeliveries.status, "processing"),
      eq(notificationDeliveries.claimedAt, input.claimedAt),
    ));
}

async function deliverPushDelivery(deliveryId: number) {
  const db = getDb();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const [claimed] = await db
    .update(notificationDeliveries)
    .set({
      status: "processing",
      claimedAt: now,
      attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(and(
      eq(notificationDeliveries.id, deliveryId),
      sql`(
        (
          ${notificationDeliveries.status} IN ('pending', 'retry')
          AND (
            ${notificationDeliveries.nextAttemptAt} = ''
            OR ${notificationDeliveries.nextAttemptAt} <= ${now}
          )
        )
        OR (
          ${notificationDeliveries.status} = 'processing'
          AND ${notificationDeliveries.claimedAt} <= ${staleBefore}
        )
      )`,
    ))
    .returning();
  if (!claimed) return false;

  const [event, subscription] = await Promise.all([
    db
      .select()
      .from(notificationEvents)
      .where(eq(notificationEvents.id, claimed.notificationId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, claimed.subscriptionId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  if (!event || !subscription || !subscription.active) {
    await finishDelivery({
      id: claimed.id,
      claimedAt: now,
      status: "cancelled",
      attemptCount: claimed.attemptCount,
      error: "Destino no disponible.",
    });
    return true;
  }

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, subscription.userEmail.toLowerCase()))
    .limit(1);
  if (!user || !user.active || user.deletedAt || !notificationVisibleToUser(event, {
    email: user.email,
    role: user.role === "admin" ? "admin" : "member",
    area: user.area,
    financeAccess: user.financeAccess,
  })) {
    await finishDelivery({
      id: claimed.id,
      claimedAt: now,
      status: "cancelled",
      attemptCount: claimed.attemptCount,
      error: "El destinatario ya no está autorizado para este aviso.",
    });
    return true;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    await finishDelivery({
      id: claimed.id,
      claimedAt: now,
      status: "retry",
      attemptCount: claimed.attemptCount,
      error: "La entrega push todavía no está configurada.",
    });
    return true;
  }

  const message = JSON.stringify({
    title: event.title,
    body: event.body,
    url: `/?view=${encodeURIComponent(event.view)}&notification=${event.id}`,
    tag: `bricket-${event.kind}-${event.id}`,
    kind: event.kind,
  });
  try {
    const payload = await buildPushPayload(
      { data: message, options: { ttl: 86_400, urgency: "normal" } },
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ? Number(subscription.expirationTime) : null,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      { publicKey, privateKey, subject },
    );
    const response = await fetch(subscription.endpoint, {
      ...payload,
      body: new Uint8Array(payload.body).buffer,
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) {
      await db.update(pushSubscriptions).set({
        failureCount: 0,
        lastSuccessAt: now,
        updatedAt: now,
      }).where(eq(pushSubscriptions.id, subscription.id));
      await finishDelivery({
        id: claimed.id,
        claimedAt: now,
        status: "delivered",
        attemptCount: claimed.attemptCount,
      });
      return true;
    }
    const retired = response.status === 404 || response.status === 410;
    await db.update(pushSubscriptions).set({
      active: retired ? false : subscription.active,
      failureCount: subscription.failureCount + 1,
      updatedAt: now,
    }).where(eq(pushSubscriptions.id, subscription.id));
    await finishDelivery({
      id: claimed.id,
      claimedAt: now,
      status: retired ? "cancelled" : "retry",
      attemptCount: claimed.attemptCount,
      error: `El servicio push respondió ${response.status}.`,
    });
    return true;
  } catch (error) {
    await db.update(pushSubscriptions).set({
      failureCount: subscription.failureCount + 1,
      updatedAt: now,
    }).where(eq(pushSubscriptions.id, subscription.id));
    await finishDelivery({
      id: claimed.id,
      claimedAt: now,
      status: "retry",
      attemptCount: claimed.attemptCount,
      error: error instanceof Error ? error.message : "La entrega push ha fallado.",
    });
    return true;
  }
}

export async function dispatchNotificationEvent(eventId: number, limit = MAX_DISPATCH_BATCH) {
  await ensureNotificationFanout(eventId);
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const boundedLimit = Math.max(1, Math.min(limit, MAX_DISPATCH_BATCH));
  const eligible = await getDb()
    .select()
    .from(notificationDeliveries)
    .where(and(
      eq(notificationDeliveries.notificationId, eventId),
      dispatchableDeliveryCondition(now, staleBefore),
    ))
    .orderBy(dispatchableDeliveryOrder(), asc(notificationDeliveries.id))
    .limit(boundedLimit);
  await Promise.allSettled(eligible.map((delivery) => deliverPushDelivery(delivery.id)));
  return { attempted: eligible.length };
}

async function deliverPushNotification(event: typeof notificationEvents.$inferSelect) {
  return dispatchNotificationEvent(event.id);
}

export async function dispatchPendingNotifications(limit = 5) {
  const boundedLimit = Math.max(1, Math.min(limit, MAX_DISPATCH_BATCH));
  const now = new Date().toISOString();
  const staleFanoutBefore = new Date(Date.now() - FANOUT_LEASE_MS).toISOString();
  const pendingFanouts = await getDb()
    .select({ id: notificationEvents.id })
    .from(notificationEvents)
    .where(sql`(
      ${notificationEvents.fanoutStatus} = 'pending'
      OR (
        ${notificationEvents.fanoutStatus} = 'processing'
        AND ${notificationEvents.fanoutClaimedAt} <= ${staleFanoutBefore}
      )
    )`)
    .orderBy(
      sql`CASE
        WHEN ${notificationEvents.fanoutStatus} = 'pending' THEN ${notificationEvents.createdAt}
        ELSE ${notificationEvents.fanoutClaimedAt}
      END`,
      asc(notificationEvents.id),
    )
    .limit(Math.min(boundedLimit, MAX_FANOUTS_PER_DISPATCH));
  await Promise.allSettled(pendingFanouts.map((event) => ensureNotificationFanout(event.id)));

  const staleBefore = new Date(Date.now() - DELIVERY_LEASE_MS).toISOString();
  const eligible = await getDb()
    .select()
    .from(notificationDeliveries)
    .where(dispatchableDeliveryCondition(now, staleBefore))
    .orderBy(dispatchableDeliveryOrder(), asc(notificationDeliveries.id))
    .limit(boundedLimit);
  await Promise.allSettled(eligible.map((delivery) => deliverPushDelivery(delivery.id)));
  return {
    fanouts: pendingFanouts.length,
    deliveries: eligible.length,
  };
}

export async function dispatchNotificationBySubject(input: {
  kind: string;
  subjectType: string;
  subjectId: string | number;
}) {
  const [event] = await getDb()
    .select()
    .from(notificationEvents)
    .where(and(
      eq(notificationEvents.kind, limitedText(input.kind, 80)),
      eq(notificationEvents.subjectType, limitedText(input.subjectType, 80)),
      eq(notificationEvents.subjectId, limitedText(input.subjectId, 160)),
    ))
    .orderBy(asc(notificationEvents.id))
    .limit(1);
  if (!event) return { attempted: 0 };
  return dispatchNotificationEvent(event.id);
}
