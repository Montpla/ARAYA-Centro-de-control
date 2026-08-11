import { env } from "cloudflare:workers";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  liveDataEvents,
  liveDataHistory,
  liveDataPoints,
  uploadedFiles,
} from "../db/schema";
import {
  isCommercialLiveKey,
  isFinancialLiveKey,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "./live-data";
import {
  dispatchNotificationBySubject,
  prepareNotificationRecord,
} from "./notifications";
import {
  FILE_LIFECYCLE_LEASE_MS,
  decideFileLifecycleRetry,
} from "./file-lifecycle-recovery";

export type FileLifecycleAction = "delete" | "restore";

export type FileLifecycleActor = {
  email: string;
  displayName: string;
  financeAccess?: boolean;
};

export type FileLifecycleResult = {
  affectedKeys: string[];
  deletedAt: string;
  idempotent: boolean;
  revision: number | null;
};

type UploadedFile = typeof uploadedFiles.$inferSelect;
type LiveDataPoint = typeof liveDataPoints.$inferSelect;
type D1Bindable = string | number | null;
type AtomicD1Statement = { bind: (...values: D1Bindable[]) => AtomicD1Statement };
type AtomicD1Database = {
  prepare: (sql: string) => AtomicD1Statement;
  batch: (statements: AtomicD1Statement[]) => Promise<unknown[]>;
};
const MAX_ATOMIC_LIFECYCLE_STATEMENTS = 16;
const MAX_ATOMIC_JSON_BYTES = 1_800_000;
const EXPECTED_ATOMIC_LIFECYCLE_STATEMENTS = 11;

function getAtomicD1() {
  const database = (env as unknown as { DB?: AtomicD1Database }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  return database;
}

function statement(database: AtomicD1Database, sql: string, ...values: D1Bindable[]) {
  return database.prepare(sql).bind(...values);
}

function assertBoundedAtomicJson(payload: string) {
  if (new TextEncoder().encode(payload).byteLength > MAX_ATOMIC_JSON_BYTES) {
    throw new Error("La recomputaciÃ³n supera el tamaÃ±o transaccional seguro.");
  }
}

function failedInvariantStatement(
  database: AtomicD1Database,
  eventId: number,
  conditionSql: string,
  ...values: D1Bindable[]
) {
  // The event already owns this primary key. A false invariant intentionally
  // violates it, which makes D1 roll the entire batch back.
  return statement(
    database,
    `INSERT INTO live_data_events (id, actor_email, actor_name)
     SELECT ?, '', '' WHERE NOT (${conditionSql})`,
    eventId,
    ...values,
  );
}

async function affectedKeysForFile(fileId: string) {
  const rows = await getDb()
    .selectDistinct({ key: liveDataHistory.key })
    .from(liveDataHistory)
    .where(eq(liveDataHistory.sourceFileId, fileId))
    .orderBy(asc(liveDataHistory.key));
  return rows.map((row) => row.key);
}

async function currentFile(fileId: string) {
  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);
  return file;
}

async function latestFileEvent(fileId: string, status: "published" | "preparing") {
  const events = await getDb()
    .select({
      id: liveDataEvents.id,
      createdAt: liveDataEvents.createdAt,
      message: liveDataEvents.message,
      status: liveDataEvents.status,
    })
    .from(liveDataEvents)
    .where(and(
      eq(liveDataEvents.sourceFileId, fileId),
      eq(liveDataEvents.status, status),
    ))
    .orderBy(desc(liveDataEvents.id))
    .limit(20);
  return events.find((event) =>
    event.message.startsWith("Archivo retirado;") ||
    event.message.startsWith("Archivo restaurado;")) ?? null;
}

function desiredStateAlreadyApplied(file: UploadedFile, action: FileLifecycleAction) {
  return action === "delete" ? Boolean(file.deletedAt) : !file.deletedAt;
}

function lifecycleStateMarker(file: UploadedFile, action: FileLifecycleAction) {
  return action === "delete" ? file.deletedAt : file.restoredAt;
}

async function lifecycleStateIsDurable(file: UploadedFile, action: FileLifecycleAction) {
  const marker = lifecycleStateMarker(file, action);
  if (!marker) return false;
  const event = await latestFileEvent(file.id, "published");
  return Boolean(event && event.createdAt >= marker);
}

async function livePointSnapshot(keys: string[]) {
  if (!keys.length) return new Map<string, LiveDataPoint>();
  const rows = await getDb()
    .select()
    .from(liveDataPoints)
    .where(sql`${liveDataPoints.key} IN (
      SELECT value FROM json_each(${JSON.stringify(keys)})
    )`);
  return new Map(rows.map((row) => [row.key, row]));
}

async function lifecycleWinners(
  fileId: string,
  action: FileLifecycleAction,
  affectedKeys: string[],
) {
  if (!affectedKeys.length) return new Map<string, typeof liveDataHistory.$inferSelect>();
  const rows = await getDb()
    .select({
      history: liveDataHistory,
      linkedFileId: uploadedFiles.id,
      linkedFileDeletedAt: uploadedFiles.deletedAt,
    })
    .from(liveDataHistory)
    .innerJoin(liveDataEvents, eq(liveDataHistory.eventId, liveDataEvents.id))
    .leftJoin(uploadedFiles, eq(liveDataHistory.sourceFileId, uploadedFiles.id))
    .where(and(
      sql`${liveDataHistory.key} IN (
        SELECT value FROM json_each(${JSON.stringify(affectedKeys)})
      )`,
      eq(liveDataEvents.status, "published"),
    ))
    .orderBy(desc(liveDataHistory.id));

  const winners = new Map<string, typeof liveDataHistory.$inferSelect>();
  for (const row of rows) {
    if (winners.has(row.history.key)) continue;
    const sourceFileId = row.history.sourceFileId.trim();
    const unmanaged = sourceFileId === "" || !row.linkedFileId;
    const target = sourceFileId === fileId;
    const activeManaged = Boolean(row.linkedFileId) && row.linkedFileDeletedAt === "";
    if (unmanaged || (target ? action === "restore" : activeManaged)) {
      winners.set(row.history.key, row.history);
    }
  }
  return winners;
}

async function settleFailedLifecycleEvent(eventId: number) {
  const db = getDb();
  const [current] = await db
    .select()
    .from(liveDataEvents)
    .where(eq(liveDataEvents.id, eventId))
    .limit(1);
  if (current?.status === "published") return current;
  if (current?.status === "preparing") {
    await db
      .update(liveDataEvents)
      .set({ status: "compensated" })
      .where(and(eq(liveDataEvents.id, eventId), eq(liveDataEvents.status, "preparing")));
  }
  return null;
}

/**
 * Applies delete/restore, cache rematerialization, activity, revision and its
 * durable notification in one D1 transaction. The R2 object and immutable
 * history are retained, so restore is deterministic.
 */
export async function applyFileLifecycle(input: {
  action: FileLifecycleAction;
  actor: FileLifecycleActor;
  file: UploadedFile;
  reason?: string;
}): Promise<FileLifecycleResult> {
  const reason = String(input.reason ?? "").trim().slice(0, 1_000);
  const affectedKeys = await affectedKeysForFile(input.file.id);
  const [fileSnapshot, winners, pointSnapshot] = await Promise.all([
    currentFile(input.file.id),
    lifecycleWinners(input.file.id, input.action, affectedKeys),
    livePointSnapshot(affectedKeys),
  ]);
  if (!fileSnapshot) throw new Error("El archivo ya no existe en el registro documental.");

  const protectedFile = requiresFinanceAccessForDocument(fileSnapshot.area, fileSnapshot.documentType) ||
    affectedKeys.some((key) => isFinancialLiveKey(key));
  if (protectedFile && input.actor.financeAccess !== true) {
    throw new Error("El ciclo de este archivo requiere autorización financiera y comercial.");
  }
  const commercial = fileSnapshot.area === "comercial" ||
    fileSnapshot.documentType === "ventas_cobranza" ||
    affectedKeys.some((key) => isCommercialLiveKey(key));
  const eventArea = protectedFile && !requiresFinanceAccessForArea(fileSnapshot.area)
    ? commercial ? "comercial" : "finanzas"
    : fileSnapshot.area;

  const alreadyApplied = desiredStateAlreadyApplied(fileSnapshot, input.action);
  const [latestPublished, latestPreparing] = alreadyApplied
    ? await Promise.all([
        latestFileEvent(fileSnapshot.id, "published"),
        latestFileEvent(fileSnapshot.id, "preparing"),
      ])
    : [null, null];
  const retryDecision = decideFileLifecycleRetry({
    desiredStateApplied: alreadyApplied,
    stateMarker: lifecycleStateMarker(fileSnapshot, input.action),
    latestPublishedAt: latestPublished?.createdAt,
    latestPreparingAt: latestPreparing?.createdAt,
  });
  if (retryDecision === "idempotent") {
    return {
      affectedKeys,
      deletedAt: fileSnapshot.deletedAt,
      idempotent: true,
      revision: latestPublished?.id ?? null,
    };
  }
  if (retryDecision === "wait") {
    throw new Error("El ciclo del archivo todavía se está consolidando; vuelve a intentarlo en unos instantes.");
  }

  const now = new Date().toISOString();
  const actionLabel = input.action === "delete" ? "retirado" : "restaurado";
  const activityEventType = input.action === "delete" ? "archivo_eliminado" : "archivo_restaurado";
  const target = alreadyApplied
    ? {
        deletedAt: fileSnapshot.deletedAt,
        deletedByEmail: fileSnapshot.deletedByEmail,
        deletedByName: fileSnapshot.deletedByName,
        deleteReason: fileSnapshot.deleteReason,
        restoredAt: fileSnapshot.restoredAt,
        restoredByEmail: fileSnapshot.restoredByEmail,
      }
    : input.action === "delete"
      ? {
          deletedAt: now,
          deletedByEmail: input.actor.email,
          deletedByName: input.actor.displayName,
          deleteReason: reason,
          restoredAt: "",
          restoredByEmail: "",
        }
      : {
          deletedAt: "",
          deletedByEmail: "",
          deletedByName: "",
          deleteReason: "",
          restoredAt: now,
          restoredByEmail: input.actor.email,
        };

  const pointChangesJson = JSON.stringify(affectedKeys.map((key) => {
    const winner = winners.get(key);
    const previous = pointSnapshot.get(key);
    return {
      key,
      winner: Boolean(winner),
      expectedRevision: previous?.revision ?? null,
      valueJson: winner?.valueJson ?? "",
      valueType: winner?.valueType ?? "",
      area: winner?.area ?? "",
      sourceFileId: winner?.sourceFileId ?? "",
      sourceName: winner?.sourceName ?? "",
      sourceCurrency: winner?.sourceCurrency ?? "DOP",
      cutoff: winner?.cutoff ?? "",
    };
  }));
  assertBoundedAtomicJson(pointChangesJson);
  const db = getDb();
  const [createdEvent] = await db
    .insert(liveDataEvents)
    .values({
      sourceFileId: fileSnapshot.id,
      sourceName: fileSnapshot.originalName,
      area: eventArea,
      cutoff: fileSnapshot.detectedPeriod || fileSnapshot.declaredCutoff,
      changeCount: affectedKeys.length,
      message: `Archivo ${actionLabel}; ${affectedKeys.length} claves vivas recomputadas desde el historial.`,
      status: "preparing",
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
      createdAt: now,
    })
    .returning();
  if (!createdEvent) throw new Error("No se pudo reservar la revisión del ciclo documental.");
  let event = createdEvent;

  const notification = prepareNotificationRecord({
    kind: input.action === "delete" ? "file_deleted" : "file_restored",
    projectId: "araya",
    area: eventArea,
    audience: protectedFile ? "finance" : "all",
    actorEmail: input.actor.email,
    actorName: input.actor.displayName,
    subjectType: "live_revision",
    subjectId: event.id,
    title: `${input.action === "delete" ? "Archivo retirado" : "Archivo restaurado"} · ${fileSnapshot.originalName}`,
    body: `${affectedKeys.length} claves del Centro de Control se han recalculado.`,
    view: "fuentes",
    payload: { fileId: fileSnapshot.id, revision: event.id, affectedKeys },
    createdAt: now,
  });
  try {
    const database = getAtomicD1();
    const atomicStatements: AtomicD1Statement[] = [];
    atomicStatements.push(statement(
      database,
      `UPDATE uploaded_files
       SET deleted_at = ?, deleted_by_email = ?, deleted_by_name = ?,
           delete_reason = ?, restored_at = ?, restored_by_email = ?, updated_at = ?
       WHERE id = ? AND deleted_at = ? AND deleted_by_email = ?
         AND deleted_by_name = ? AND delete_reason = ? AND restored_at = ?
         AND restored_by_email = ? AND updated_at = ?`,
      target.deletedAt,
      target.deletedByEmail,
      target.deletedByName,
      target.deleteReason,
      target.restoredAt,
      target.restoredByEmail,
      now,
      fileSnapshot.id,
      fileSnapshot.deletedAt,
      fileSnapshot.deletedByEmail,
      fileSnapshot.deletedByName,
      fileSnapshot.deleteReason,
      fileSnapshot.restoredAt,
      fileSnapshot.restoredByEmail,
      fileSnapshot.updatedAt,
    ));
    atomicStatements.push(failedInvariantStatement(
      database,
      event.id,
      `EXISTS (
         SELECT 1 FROM uploaded_files
         WHERE id = ? AND deleted_at = ? AND deleted_by_email = ?
           AND deleted_by_name = ? AND delete_reason = ? AND restored_at = ?
           AND restored_by_email = ? AND updated_at = ?
       )`,
      fileSnapshot.id,
      target.deletedAt,
      target.deletedByEmail,
      target.deletedByName,
      target.deleteReason,
      target.restoredAt,
      target.restoredByEmail,
      now,
    ));

    atomicStatements.push(statement(
      database,
      `DELETE FROM live_data_points AS point
       WHERE EXISTS (
         SELECT 1 FROM json_each(?) AS item
         WHERE json_extract(item.value, '$.winner') = 0
           AND json_extract(item.value, '$.expectedRevision') IS NOT NULL
           AND point.key = json_extract(item.value, '$.key')
           AND point.revision = CAST(json_extract(item.value, '$.expectedRevision') AS INTEGER)
       )`,
      pointChangesJson,
    ));
    atomicStatements.push(statement(
      database,
      `WITH changes AS (
         SELECT
           json_extract(item.value, '$.key') AS key,
           json_extract(item.value, '$.valueJson') AS valueJson,
           json_extract(item.value, '$.valueType') AS valueType,
           json_extract(item.value, '$.area') AS area,
           json_extract(item.value, '$.sourceFileId') AS sourceFileId,
           json_extract(item.value, '$.sourceName') AS sourceName,
           json_extract(item.value, '$.sourceCurrency') AS sourceCurrency,
           json_extract(item.value, '$.cutoff') AS cutoff,
           CAST(json_extract(item.value, '$.expectedRevision') AS INTEGER) AS expectedRevision
         FROM json_each(?) AS item
         WHERE json_extract(item.value, '$.winner') = 1
           AND json_extract(item.value, '$.expectedRevision') IS NOT NULL
       )
       UPDATE live_data_points AS point
       SET value_json = changes.valueJson, value_type = changes.valueType,
           area = changes.area, source_file_id = changes.sourceFileId,
           source_name = changes.sourceName, source_currency = changes.sourceCurrency,
           cutoff = changes.cutoff, revision = ?, updated_by_email = ?,
           updated_by_name = ?, updated_at = ?
       FROM changes
       WHERE point.key = changes.key AND point.revision = changes.expectedRevision`,
      pointChangesJson,
      event.id,
      input.actor.email,
      input.actor.displayName,
      now,
    ));
    atomicStatements.push(statement(
      database,
      `INSERT OR IGNORE INTO live_data_points (
         key, value_json, value_type, area, source_file_id, source_name,
         source_currency, cutoff, revision, updated_by_email, updated_by_name, updated_at
       )
       SELECT
         json_extract(item.value, '$.key'),
         json_extract(item.value, '$.valueJson'),
         json_extract(item.value, '$.valueType'),
         json_extract(item.value, '$.area'),
         json_extract(item.value, '$.sourceFileId'),
         json_extract(item.value, '$.sourceName'),
         json_extract(item.value, '$.sourceCurrency'),
         json_extract(item.value, '$.cutoff'),
         ?, ?, ?, ?
       FROM json_each(?) AS item
       WHERE json_extract(item.value, '$.winner') = 1
         AND json_extract(item.value, '$.expectedRevision') IS NULL`,
      event.id,
      input.actor.email,
      input.actor.displayName,
      now,
      pointChangesJson,
    ));
    atomicStatements.push(failedInvariantStatement(
      database,
      event.id,
      `NOT EXISTS (
         SELECT 1 FROM json_each(?) AS item
         WHERE (
           json_extract(item.value, '$.winner') = 1
           AND NOT EXISTS (
             SELECT 1 FROM live_data_points AS point
             WHERE point.key = json_extract(item.value, '$.key') AND point.revision = ?
           )
         ) OR (
           json_extract(item.value, '$.winner') = 0
           AND EXISTS (
             SELECT 1 FROM live_data_points AS point
             WHERE point.key = json_extract(item.value, '$.key')
           )
         )
       )`,
      pointChangesJson,
      event.id,
    ));

    const activityMessage = input.action === "delete"
      ? `Archivo retirado sin borrar su original ni su historial. ${affectedKeys.length} claves recomputadas.${reason ? ` Motivo: ${reason}` : ""}`
      : `Archivo restaurado y reincorporado al modelo vivo. ${affectedKeys.length} claves recomputadas.`;
    atomicStatements.push(statement(
      database,
      `INSERT INTO file_activity (
         file_id, event_type, message, actor_email, actor_name, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      fileSnapshot.id,
      activityEventType,
      activityMessage.slice(0, 1_000),
      input.actor.email,
      input.actor.displayName,
      now,
    ));
    atomicStatements.push(statement(
      database,
      `UPDATE live_data_events
       SET status = 'compensated'
       WHERE source_file_id = ? AND status = 'preparing' AND id <> ? AND created_at <= ?`,
      fileSnapshot.id,
      event.id,
      new Date(Date.now() - FILE_LIFECYCLE_LEASE_MS).toISOString(),
    ));
    atomicStatements.push(statement(
      database,
      `INSERT INTO notification_events (
         kind, project_id, area, audience, actor_email, actor_name,
         subject_type, subject_id, title, body, view, payload_json,
         fanout_status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      notification.kind,
      notification.projectId,
      notification.area,
      notification.audience,
      notification.actorEmail,
      notification.actorName,
      notification.subjectType,
      notification.subjectId,
      notification.title,
      notification.body,
      notification.view,
      notification.payloadJson,
      notification.createdAt,
    ));
    atomicStatements.push(statement(
      database,
      "UPDATE live_data_events SET status = 'published' WHERE id = ? AND status = 'preparing'",
      event.id,
    ));
    atomicStatements.push(failedInvariantStatement(
      database,
      event.id,
      "EXISTS (SELECT 1 FROM live_data_events WHERE id = ? AND status = 'published')",
      event.id,
    ));
    if (atomicStatements.length !== EXPECTED_ATOMIC_LIFECYCLE_STATEMENTS) {
      throw new Error("El ciclo documental no coincide con el contrato transaccional esperado.");
    }
    if (atomicStatements.length > MAX_ATOMIC_LIFECYCLE_STATEMENTS) {
      throw new Error("El ciclo documental supera el presupuesto transaccional seguro.");
    }
    await database.batch(atomicStatements);
    event = { ...event, status: "published" };
  } catch (error) {
    try {
      const committed = await settleFailedLifecycleEvent(event.id);
      if (committed) {
        event = committed;
      } else {
        const fresh = await currentFile(fileSnapshot.id);
        if (fresh && desiredStateAlreadyApplied(fresh, input.action) &&
          await lifecycleStateIsDurable(fresh, input.action)) {
          const latest = await latestFileEvent(fresh.id, "published");
          return {
            affectedKeys,
            deletedAt: fresh.deletedAt,
            idempotent: true,
            revision: latest?.id ?? null,
          };
        }
        throw error;
      }
    } catch (settlementError) {
      if (settlementError === error) throw error;
      throw new AggregateError(
        [error, settlementError],
        `No se pudo confirmar el ciclo documental de ${fileSnapshot.originalName}.`,
      );
    }
  }

  await dispatchNotificationBySubject({
    kind: notification.kind,
    subjectType: notification.subjectType,
    subjectId: notification.subjectId,
  }).catch(() => undefined);

  return {
    affectedKeys,
    deletedAt: target.deletedAt,
    idempotent: alreadyApplied,
    revision: event.id,
  };
}
