import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { notificationEvents, notificationReads } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import {
  D1JsonDatabase,
  MAX_NOTIFICATION_RECEIPTS,
  encodeBoundedJsonArray,
  upsertNotificationReceiptRows,
} from "../../../lib/d1-json-bulk";
import {
  dispatchPendingNotifications,
  notificationVisibilityWhere,
  notificationVisibleToUser,
} from "../../../lib/notifications";

export const runtime = "edge";

const DEFAULT_LIMIT = 30;
// D1 rechaza consultas con demasiados parámetros ligados. La consulta de
// notification_reads liga userEmail + un id por cada notificación visible;
// con MAX_LIMIT=100 eso son 101 parámetros y la consulta fallaba con 500 en
// cada poll de 5s. Se deja margen (no el límite exacto) por si D1 cambia el
// tope o se añade otro parámetro a la consulta más adelante.
const MAX_LIMIT = 90;
const MAX_SCAN = 500;

function getD1JsonDatabase() {
  const database = (env as unknown as { DB?: D1JsonDatabase }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  return database;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function responseWithNoStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function publicPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  // The UI poll doubles as a bounded outbox relay. Per-subscription rows and
  // leases make concurrent mobile/desktop polls idempotent.
  await dispatchPendingNotifications(5).catch(() => undefined);

  const url = new URL(request.url);
  const afterId = positiveInteger(url.searchParams.get("afterId"));
  const requestedLimit = positiveInteger(url.searchParams.get("limit"));
  const limit = Math.min(requestedLimit || DEFAULT_LIMIT, MAX_LIMIT);
  const db = getDb();
  const visibilityWhere = notificationVisibilityWhere(auth.user);
  const rows = afterId
    ? await db
        .select()
        .from(notificationEvents)
        .where(and(gt(notificationEvents.id, afterId), visibilityWhere))
        .orderBy(asc(notificationEvents.id))
        .limit(limit)
    : await db
        .select()
        .from(notificationEvents)
        .where(visibilityWhere)
        .orderBy(desc(notificationEvents.id))
        .limit(limit);
  const visibleRows = rows
    .filter((row) => notificationVisibleToUser(row, auth.user))
    .slice(0, limit);
  const cursor = afterId && visibleRows.length === limit
    ? visibleRows[visibleRows.length - 1].id
    : rows.reduce((latest, row) => Math.max(latest, row.id), afterId);
  const eventIds = visibleRows.map((row) => row.id);
  const readRows = eventIds.length
    ? await db
        .select()
        .from(notificationReads)
        .where(and(
          eq(notificationReads.userEmail, auth.user.email.toLowerCase()),
          inArray(notificationReads.notificationId, eventIds),
        ))
    : [];
  const readByEvent = new Map(readRows.map((row) => [row.notificationId, row]));

  return responseWithNoStore({
    notifications: visibleRows.map((row) => {
      const receipt = readByEvent.get(row.id);
      return {
        id: row.id,
        kind: row.kind,
        projectId: row.projectId,
        area: row.area,
        actorName: row.actorName,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        title: row.title,
        body: row.body,
        view: row.view,
        payload: publicPayload(row.payloadJson),
        createdAt: row.createdAt,
        readAt: receipt?.readAt ?? "",
        openedAt: receipt?.openedAt ?? "",
        read: Boolean(receipt),
      };
    }),
    cursor,
    refreshIntervalMs: 5_000,
    refreshedAt: new Date().toISOString(),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: { ids?: unknown; readThroughId?: unknown; openedId?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return responseWithNoStore({ error: "La solicitud de lectura no es válida." }, { status: 400 });
  }

  const requestedIds = Array.isArray(payload.ids)
    ? payload.ids.map(positiveInteger).filter(Boolean).slice(0, MAX_LIMIT)
    : [];
  const readThroughId = positiveInteger(payload.readThroughId);
  const openedId = positiveInteger(payload.openedId);
  if (openedId) requestedIds.push(openedId);
  const db = getDb();
  const throughRows = readThroughId
    ? await db
        .select()
        .from(notificationEvents)
        .where(and(
          lte(notificationEvents.id, readThroughId),
          notificationVisibilityWhere(auth.user),
        ))
        .orderBy(desc(notificationEvents.id))
        .limit(MAX_SCAN)
    : [];
  const uniqueIds = [...new Set(requestedIds)];
  const uniqueIdsJson = encodeBoundedJsonArray(uniqueIds, {
    label: "La selección de notificaciones",
    maxItems: MAX_NOTIFICATION_RECEIPTS,
  });
  const selectedRows = uniqueIds.length
    ? await db
        .select()
        .from(notificationEvents)
        .where(and(
          sql`${notificationEvents.id} IN (
            SELECT CAST(value AS INTEGER) FROM json_each(${uniqueIdsJson})
          )`,
          notificationVisibilityWhere(auth.user),
        ))
    : [];
  const visibleRows = [...new Map(
    [...selectedRows, ...throughRows]
      .filter((row) => notificationVisibleToUser(row, auth.user))
      .map((row) => [row.id, row]),
  ).values()].slice(0, MAX_NOTIFICATION_RECEIPTS);
  if (!visibleRows.length) {
    return responseWithNoStore({ error: "No hay notificaciones visibles para marcar." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const userEmail = auth.user.email.toLowerCase();
  await upsertNotificationReceiptRows(
    getD1JsonDatabase(),
    visibleRows.map((row) => ({
      notificationId: row.id,
      userEmail,
      readAt: now,
      openedAt: row.id === openedId ? now : "",
    })),
  );

  return responseWithNoStore({
    updated: visibleRows.length,
    readAt: now,
  });
}
