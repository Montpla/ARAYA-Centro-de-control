import { env } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  liveDataEvents,
  liveDataPoints,
  uploadedFiles,
} from "../db/schema";
import {
  dispatchNotificationBySubject,
  prepareNotificationRecord,
} from "./notifications";
import { readEffectiveLiveData } from "./effective-live-data";
import {
  CanonicalPublicationPoint,
  planStalePublicationRecovery,
  publicationKeyConflict,
} from "./live-data-publication-recovery";
import {
  LiveDataUpdate,
  isCommercialLiveKey,
  isFinancialLiveKey,
  isLiveDataKey,
  liveValueType,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "./live-data";
import { assertLiveDataContracts } from "./live-data-contract";

const MAX_UPDATES = 250;
const MAX_VALUE_SIZE = 250_000;
const MAX_ATOMIC_PUBLICATION_STATEMENTS = 20;
const MAX_ATOMIC_JSON_BYTES = 1_800_000;

function expectedAtomicPublicationStatementCount(hasReviewClosure: boolean) {
  // Ten set-based statements publish any batch from 1 to MAX_UPDATES rows.
  // Review closure adds five more statements, independently of row count.
  return hasReviewClosure ? 15 : 10;
}

export type LiveDataActor = {
  email: string;
  displayName: string;
  financeAccess?: boolean;
};

export type NormalizedLiveDataUpdate = {
  area: string;
  cutoff: string;
  key: string;
  sourceCurrency: "DOP" | "USD";
  sourceFileId: string;
  sourceName: string;
  valueJson: string;
  valueType: string;
};

export type LiveDataReviewClosure = {
  fileId: string;
  proposalGeneration: string;
  completedAction: string;
  note: string;
  proposalCount: number;
} & (
  | {
      mode: "reservation";
      reservationId: number;
      processingAction: string;
    }
  | {
      mode: "insert";
      requestKey: string;
    }
);

type UploadedFileSnapshot = typeof uploadedFiles.$inferSelect;

type D1Bindable = string | number | null;

type AtomicD1Statement = {
  bind: (...values: D1Bindable[]) => AtomicD1Statement;
};

type AtomicD1Database = {
  prepare: (sql: string) => AtomicD1Statement;
  batch: (statements: AtomicD1Statement[]) => Promise<unknown[]>;
};

function getAtomicD1() {
  const database = (env as unknown as { DB?: AtomicD1Database }).DB;
  if (!database) throw new Error("La base de datos transaccional no está disponible.");
  return database;
}

function statement(
  database: AtomicD1Database,
  sql: string,
  ...values: D1Bindable[]
) {
  return database.prepare(sql).bind(...values);
}

function assertBoundedAtomicJson(label: string, payload: string) {
  if (new TextEncoder().encode(payload).byteLength > MAX_ATOMIC_JSON_BYTES) {
    throw new Error(`${label} supera el tamaÃ±o transaccional seguro.`);
  }
}

function failedInvariantStatement(
  database: AtomicD1Database,
  eventId: number,
  conditionSql: string,
  ...values: D1Bindable[]
) {
  // The event already owns this primary key. If the expected CAS result is
  // absent, this conditional insert raises a constraint error and D1 rolls the
  // complete batch back.
  return statement(
    database,
    `INSERT INTO live_data_events (id, actor_email, actor_name)
     SELECT ?, '', ''
     WHERE NOT (${conditionSql})`,
    eventId,
    ...values,
  );
}

function assertUniqueUpdateKeys(updates: Array<Pick<NormalizedLiveDataUpdate, "key">>) {
  const conflict = publicationKeyConflict(updates.map((update) => update.key));
  if (!conflict) return;
  if (conflict.duplicate) {
    throw new Error(`La clave ${conflict.duplicate} aparece más de una vez en la misma publicación.`);
  }
  throw new Error(
    `La publicación no puede mezclar ${conflict.ancestor} con su ruta hija ${conflict.descendant}; envía una sola representación.`,
  );
}

export function normalizeLiveDataUpdates(input: {
  updates: LiveDataUpdate[];
  area?: string;
  cutoff?: string;
  sourceFileId?: string;
  sourceName?: string;
}) {
  if (!Array.isArray(input.updates) || input.updates.length === 0) {
    throw new Error("Incluye al menos un dato para actualizar.");
  }
  if (input.updates.length > MAX_UPDATES) {
    throw new Error(`Una actualización admite como máximo ${MAX_UPDATES} datos.`);
  }
  const normalized = input.updates.map((update) => {
    const key = String(update?.key ?? "").trim();
    if (!isLiveDataKey(key)) throw new Error(`La clave ${key || "(vacía)"} no pertenece al modelo vivo de ARAYA.`);
    const valueJson = JSON.stringify(update.value);
    if (valueJson === undefined || valueJson.length > MAX_VALUE_SIZE) {
      throw new Error(`El valor de ${key} no es válido o supera el tamaño permitido.`);
    }
    return {
      area: String(update.area ?? input.area ?? "direccion").slice(0, 80),
      cutoff: String(update.cutoff ?? input.cutoff ?? "").slice(0, 40),
      key,
      sourceCurrency: update.sourceCurrency === "USD" ? "USD" as const : "DOP" as const,
      sourceFileId: String(update.sourceFileId ?? input.sourceFileId ?? "").slice(0, 80),
      sourceName: String(update.sourceName ?? input.sourceName ?? "Actualización manual").slice(0, 255),
      valueJson,
      valueType: liveValueType(update.value),
    } satisfies NormalizedLiveDataUpdate;
  });
  assertUniqueUpdateKeys(normalized);
  return normalized;
}

async function loadPointPublicationState(keys: string[]) {
  const db = getDb();
  const points = await db
    .select()
    .from(liveDataPoints)
    .where(sql`${liveDataPoints.key} IN (
      SELECT value FROM json_each(${JSON.stringify(keys)})
    )`);
  const revisionIds = [...new Set(points.map((point) => point.revision))];
  const events = revisionIds.length
    ? await db
        .select({
          id: liveDataEvents.id,
          status: liveDataEvents.status,
          createdAt: liveDataEvents.createdAt,
        })
        .from(liveDataEvents)
        .where(sql`${liveDataEvents.id} IN (
          SELECT value FROM json_each(${JSON.stringify(revisionIds)})
        )`)
    : [];
  return { events, points };
}

async function recoverInterruptedPointPublications(keys: string[]) {
  let state = await loadPointPublicationState(keys);
  const statusByRevision = new Map(state.events.map((event) => [event.id, event.status]));
  if (state.points.every((point) => statusByRevision.get(point.revision) === "published")) {
    return state.points;
  }

  const canonical = await readEffectiveLiveData(true);
  const plan = planStalePublicationRecovery({
    points: state.points,
    events: state.events,
    canonicalPoints: canonical.points as CanonicalPublicationPoint[],
  });
  if (plan.repairs.length) {
    const database = getAtomicD1();
    const repairPayload = JSON.stringify(plan.repairs);
    const staleEventPayload = JSON.stringify([...plan.staleEventIds]);
    const recoveryGuardEventId = [...plan.staleEventIds][0];
    if (!recoveryGuardEventId) {
      throw new Error("La recuperaciÃ³n no tiene una revisiÃ³n de guarda vÃ¡lida.");
    }
    assertBoundedAtomicJson("La recuperaciÃ³n de revisiones", repairPayload);
    const repairs: AtomicD1Statement[] = [
      statement(
        database,
        `WITH repairs AS (
           SELECT
             json_extract(item.value, '$.key') AS key,
             CAST(json_extract(item.value, '$.staleRevision') AS INTEGER) AS staleRevision,
             json_extract(item.value, '$.replacement.valueJson') AS valueJson,
             json_extract(item.value, '$.replacement.valueType') AS valueType,
             json_extract(item.value, '$.replacement.area') AS area,
             json_extract(item.value, '$.replacement.sourceFileId') AS sourceFileId,
             json_extract(item.value, '$.replacement.sourceName') AS sourceName,
             json_extract(item.value, '$.replacement.sourceCurrency') AS sourceCurrency,
             json_extract(item.value, '$.replacement.cutoff') AS cutoff,
             CAST(json_extract(item.value, '$.replacement.revision') AS INTEGER) AS revision,
             json_extract(item.value, '$.replacement.updatedByEmail') AS updatedByEmail,
             json_extract(item.value, '$.replacement.updatedByName') AS updatedByName,
             json_extract(item.value, '$.replacement.updatedAt') AS updatedAt
           FROM json_each(?) AS item
           WHERE json_extract(item.value, '$.replacement') IS NOT NULL
         )
         UPDATE live_data_points AS point
         SET value_json = repairs.valueJson, value_type = repairs.valueType,
             area = repairs.area, source_file_id = repairs.sourceFileId,
             source_name = repairs.sourceName, source_currency = repairs.sourceCurrency,
             cutoff = repairs.cutoff, revision = repairs.revision,
             updated_by_email = repairs.updatedByEmail,
             updated_by_name = repairs.updatedByName, updated_at = repairs.updatedAt
         FROM repairs
         WHERE point.key = repairs.key AND point.revision = repairs.staleRevision`,
        repairPayload,
      ),
      statement(
        database,
        `DELETE FROM live_data_points AS point
         WHERE EXISTS (
           SELECT 1 FROM json_each(?) AS item
           WHERE json_extract(item.value, '$.replacement') IS NULL
             AND point.key = json_extract(item.value, '$.key')
             AND point.revision = CAST(json_extract(item.value, '$.staleRevision') AS INTEGER)
         )`,
        repairPayload,
      ),
      failedInvariantStatement(
        database,
        recoveryGuardEventId,
        `NOT EXISTS (
           SELECT 1 FROM json_each(?) AS item
           WHERE (
             json_extract(item.value, '$.replacement') IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM live_data_points AS point
               WHERE point.key = json_extract(item.value, '$.key')
                 AND point.revision = CAST(json_extract(item.value, '$.replacement.revision') AS INTEGER)
             )
           ) OR (
             json_extract(item.value, '$.replacement') IS NULL
             AND EXISTS (
               SELECT 1 FROM live_data_points AS point
               WHERE point.key = json_extract(item.value, '$.key')
             )
           )
         )`,
        repairPayload,
      ),
      statement(
        database,
        `UPDATE live_data_events AS event
         SET status = 'compensated'
         WHERE event.status = 'preparing'
           AND event.id IN (SELECT value FROM json_each(?))
           AND NOT EXISTS (SELECT 1 FROM live_data_points WHERE revision = event.id)`,
        staleEventPayload,
      ),
    ];
    await database.batch(repairs);
    state = await loadPointPublicationState(keys);
  }

  const refreshedStatus = new Map(state.events.map((event) => [event.id, event.status]));
  const unstablePoint = state.points.find((point) =>
    refreshedStatus.get(point.revision) !== "published");
  if (unstablePoint) {
    throw new Error(
      `La clave ${unstablePoint.key} pertenece a una revisión en curso; vuelve a intentarlo en unos instantes.`,
    );
  }
  return state.points;
}

async function settleFailedPreparingEvent(eventId: number) {
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

export async function publishLiveDataUpdates(input: {
  normalized: NormalizedLiveDataUpdate[];
  actor: LiveDataActor;
  area?: string;
  cutoff?: string;
  sourceFileId?: string;
  sourceName?: string;
  message?: string;
  reviewClosure?: LiveDataReviewClosure;
}) {
  if (!input.normalized.length) throw new Error("No hay cambios preparados para publicar.");
  assertUniqueUpdateKeys(input.normalized);
  const db = getDb();
  const linkedFileIds = [...new Set([
    ...input.normalized.map((update) => update.sourceFileId),
    String(input.sourceFileId ?? "").trim(),
  ].filter(Boolean))];
  const keys = input.normalized.map((update) => update.key);
  const [currentLiveData, pointRows, fileRows] = await Promise.all([
    readEffectiveLiveData(true),
    recoverInterruptedPointPublications(keys),
    linkedFileIds.length
      ? db.select().from(uploadedFiles).where(sql`${uploadedFiles.id} IN (
          SELECT value FROM json_each(${JSON.stringify(linkedFileIds)})
        )`)
      : Promise.resolve([] as UploadedFileSnapshot[]),
  ]);
  assertLiveDataContracts(input.normalized, currentLiveData.values);
  if (fileRows.length !== linkedFileIds.length) {
    throw new Error("Uno de los archivos de origen ya no existe; no se publicara ningun dato.");
  }
  const unavailableFile = fileRows.find((file) => file.deletedAt !== "");
  if (unavailableFile) {
    throw new Error(`El archivo ${unavailableFile.id} esta eliminado; restauralo antes de publicar sus datos.`);
  }
  const protectedUpdate = input.normalized.find((update) =>
    requiresFinanceAccessForArea(update.area) || isFinancialLiveKey(update.key));
  const protectedFile = fileRows.find((file) =>
    requiresFinanceAccessForDocument(file.area, file.documentType));
  if ((protectedUpdate || protectedFile) && input.actor.financeAccess !== true) {
    throw new Error("La publicación contiene datos financieros o comerciales y requiere autorización expresa.");
  }
  const requestedEventArea = String(input.area ?? input.normalized[0].area).slice(0, 80);
  const hasCommercialContent = input.normalized.some((update) => isCommercialLiveKey(update.key)) ||
    fileRows.some((file) => file.area === "comercial" || file.documentType === "ventas_cobranza");
  const publicationProtected = Boolean(protectedUpdate || protectedFile);
  const eventArea = publicationProtected && !requiresFinanceAccessForArea(requestedEventArea)
    ? hasCommercialContent ? "comercial" : "finanzas"
    : requestedEventArea;
  const pointSnapshots = new Map(pointRows.map((row) => [row.key, row]));
  const fileSnapshots = new Map(fileRows.map((row) => [row.id, row]));
  if (input.reviewClosure) {
    const closureFile = fileSnapshots.get(input.reviewClosure.fileId);
    if (!closureFile || closureFile.proposalGeneration !== input.reviewClosure.proposalGeneration) {
      throw new Error("La generación documental cambió antes de publicar; vuelve a revisar el archivo.");
    }
    if (!Number.isSafeInteger(input.reviewClosure.proposalCount) || input.reviewClosure.proposalCount < 1) {
      throw new Error("El cierre de revisión no contiene un número de propuestas válido.");
    }
  }
  const updatePayloadJson = JSON.stringify(input.normalized.map((update) => ({
    ...update,
    expectedRevision: pointSnapshots.get(update.key)?.revision ?? null,
  })));
  const filePayloadJson = JSON.stringify(linkedFileIds.map((fileId) => {
    const file = fileSnapshots.get(fileId);
    return {
      id: fileId,
      expectedPublicationRevision: file?.publicationRevision ?? null,
      expectedUpdatedAt: file?.updatedAt ?? "",
    };
  }));
  assertBoundedAtomicJson("La publicaciÃ³n", updatePayloadJson);
  assertBoundedAtomicJson("El conjunto de archivos", filePayloadJson);
  const updatedAt = new Date().toISOString();
  const [createdEvent] = await db
    .insert(liveDataEvents)
    .values({
      sourceFileId: String(input.sourceFileId ?? input.normalized[0].sourceFileId).slice(0, 80),
      sourceName: String(input.sourceName ?? input.normalized[0].sourceName).slice(0, 255),
      area: eventArea,
      cutoff: String(input.cutoff ?? input.normalized[0].cutoff).slice(0, 40),
      changeCount: input.normalized.length,
      message: String(input.message ?? `${input.normalized.length} datos actualizados en el Centro de Control.`).slice(0, 500),
      status: "preparing",
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
      createdAt: updatedAt,
    })
    .returning();
  if (!createdEvent) throw new Error("No se pudo crear la revisión de datos.");

  let event = createdEvent;
  const isAutomaticPublication = input.reviewClosure?.completedAction === "aprobado_automatico";
  const notificationRecord = prepareNotificationRecord({
    kind: "data_published",
    projectId: "araya",
    area: event.area,
    audience: publicationProtected ? "finance" : "all",
    actorEmail: input.actor.email,
    actorName: input.actor.displayName,
    subjectType: "live_revision",
    subjectId: event.id,
    title: isAutomaticPublication
      ? `Publicación automática sin revisión · revisión ${event.id}`
      : `Centro de Control actualizado · revisión ${event.id}`,
    body: isAutomaticPublication
      ? `${event.changeCount} datos de ${event.area} se publicaron solos desde ${event.sourceName}, sin que nadie los revisara. Échales un vistazo; si algo no cuadra, retira el archivo de origen para deshacerlo.`
      : `${event.changeCount} datos de ${event.area} se han recalculado y ya están disponibles.`,
    view: event.area === "comercial"
      ? "comercial"
      : event.area === "finanzas"
        ? "metricas"
        : event.area === "obra"
          ? "planificacion"
          : "resumen",
    payload: {
      revision: event.id,
      changeCount: event.changeCount,
      sourceFileIds: linkedFileIds,
      cutoff: event.cutoff,
      automatic: isAutomaticPublication,
    },
    createdAt: updatedAt,
  });
  try {
    const database = getAtomicD1();
    const atomicStatements: AtomicD1Statement[] = [];
    atomicStatements.push(statement(
      database,
      `INSERT INTO live_data_history (
         event_id, key, value_json, value_type, area, source_file_id,
         source_name, source_currency, cutoff, actor_email, actor_name, created_at
       )
       SELECT ?,
         json_extract(item.value, '$.key'),
         json_extract(item.value, '$.valueJson'),
         json_extract(item.value, '$.valueType'),
         json_extract(item.value, '$.area'),
         json_extract(item.value, '$.sourceFileId'),
         json_extract(item.value, '$.sourceName'),
         json_extract(item.value, '$.sourceCurrency'),
         json_extract(item.value, '$.cutoff'),
         ?, ?, ?
       FROM json_each(?) AS item`,
      event.id,
      input.actor.email,
      input.actor.displayName,
      updatedAt,
      updatePayloadJson,
    ));
    atomicStatements.push(statement(
      database,
      `WITH updates AS (
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
       )
       UPDATE live_data_points AS point
       SET value_json = updates.valueJson,
           value_type = updates.valueType,
           area = updates.area,
           source_file_id = updates.sourceFileId,
           source_name = updates.sourceName,
           source_currency = updates.sourceCurrency,
           cutoff = updates.cutoff,
           revision = ?, updated_by_email = ?, updated_by_name = ?, updated_at = ?
       FROM updates
       WHERE point.key = updates.key
         AND updates.expectedRevision IS NOT NULL
         AND point.revision = updates.expectedRevision`,
      updatePayloadJson,
      event.id,
      input.actor.email,
      input.actor.displayName,
      updatedAt,
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
       WHERE json_extract(item.value, '$.expectedRevision') IS NULL`,
      event.id,
      input.actor.email,
      input.actor.displayName,
      updatedAt,
      updatePayloadJson,
    ));
    atomicStatements.push(failedInvariantStatement(
      database,
      event.id,
      `NOT EXISTS (
         SELECT 1 FROM json_each(?) AS item
         WHERE NOT EXISTS (
           SELECT 1 FROM live_data_points AS point
           WHERE point.key = json_extract(item.value, '$.key')
             AND point.revision = ?
         )
       )`,
      updatePayloadJson,
      event.id,
    ));
    atomicStatements.push(statement(
      database,
      `WITH files AS (
         SELECT
           json_extract(item.value, '$.id') AS id,
           CAST(json_extract(item.value, '$.expectedPublicationRevision') AS INTEGER) AS expectedRevision,
           json_extract(item.value, '$.expectedUpdatedAt') AS expectedUpdatedAt
         FROM json_each(?) AS item
       )
       UPDATE uploaded_files AS file
       SET status = 'integrado', processing_stage = 'sincronizado',
           processing_progress = 100, processing_summary = ?, requires_review = 0,
           review_status = 'aprobado', reviewed_by_email = ?, reviewed_by_name = ?,
           reviewed_at = ?, publication_revision = ?, published_at = ?, updated_at = ?
       FROM files
       WHERE file.id = files.id AND file.deleted_at = ''
         AND file.publication_revision IS files.expectedRevision
         AND file.updated_at = files.expectedUpdatedAt`,
      filePayloadJson,
      `${input.normalized.length} datos normalizados y publicados en la revisión ${event.id}.`,
      input.actor.email,
      input.actor.displayName,
      updatedAt,
      event.id,
      updatedAt,
      updatedAt,
    ));
    atomicStatements.push(failedInvariantStatement(
      database,
      event.id,
      `NOT EXISTS (
         SELECT 1 FROM json_each(?) AS item
         WHERE NOT EXISTS (
           SELECT 1 FROM uploaded_files AS file
           WHERE file.id = json_extract(item.value, '$.id')
             AND file.deleted_at = ''
             AND file.publication_revision = ?
             AND file.updated_at = ?
         )
       )`,
      filePayloadJson,
      event.id,
      updatedAt,
    ));
    atomicStatements.push(statement(
      database,
      `INSERT INTO file_activity (
         file_id, event_type, message, actor_email, actor_name, created_at
       )
       SELECT json_extract(item.value, '$.id'), 'datos_publicados', ?, ?, ?, ?
       FROM json_each(?) AS item`,
      `${input.normalized.length} datos publicados en la revisión ${event.id}; las pantallas han quedado sincronizadas.`,
      input.actor.email,
      input.actor.displayName,
      updatedAt,
      filePayloadJson,
    ));
    if (input.reviewClosure) {
      const closure = input.reviewClosure;
      atomicStatements.push(statement(
        database,
        `UPDATE document_data_proposals
         SET status = 'publicado', updated_at = ?
         WHERE file_id = ? AND generation = ? AND status = 'pendiente'`,
        updatedAt,
        closure.fileId,
        closure.proposalGeneration,
      ));
      atomicStatements.push(failedInvariantStatement(
        database,
        event.id,
        `NOT EXISTS (
           SELECT 1 FROM document_data_proposals
           WHERE file_id = ? AND generation = ? AND status = 'pendiente'
         )`,
        closure.fileId,
        closure.proposalGeneration,
      ));
      atomicStatements.push(failedInvariantStatement(
        database,
        event.id,
        `(
           SELECT COUNT(*) FROM document_data_proposals
           WHERE file_id = ? AND generation = ? AND status = 'publicado'
         ) = ?`,
        closure.fileId,
        closure.proposalGeneration,
        closure.proposalCount,
      ));
      if (closure.mode === "reservation") {
        atomicStatements.push(statement(
          database,
          `UPDATE file_reviews
           SET action = ?, note = ?, proposal_count = ?, publication_revision = ?,
               claimed_at = '', lease_expires_at = ''
           WHERE id = ? AND file_id = ? AND action = ?`,
          closure.completedAction,
          closure.note,
          closure.proposalCount,
          event.id,
          closure.reservationId,
          closure.fileId,
          closure.processingAction,
        ));
        atomicStatements.push(failedInvariantStatement(
          database,
          event.id,
          `EXISTS (
             SELECT 1 FROM file_reviews
             WHERE id = ? AND file_id = ? AND action = ? AND publication_revision = ?
           )`,
          closure.reservationId,
          closure.fileId,
          closure.completedAction,
          event.id,
        ));
      } else {
        atomicStatements.push(statement(
          database,
          `INSERT OR IGNORE INTO file_reviews (
             file_id, action, note, proposal_count, publication_revision,
             request_key, actor_email, actor_name, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          closure.fileId,
          closure.completedAction,
          closure.note,
          closure.proposalCount,
          event.id,
          closure.requestKey,
          input.actor.email,
          input.actor.displayName,
          updatedAt,
        ));
        atomicStatements.push(failedInvariantStatement(
          database,
          event.id,
          `EXISTS (
             SELECT 1 FROM file_reviews
             WHERE file_id = ? AND request_key = ? AND action = ? AND publication_revision = ?
           )`,
          closure.fileId,
          closure.requestKey,
          closure.completedAction,
          event.id,
        ));
      }
    }
    atomicStatements.push(statement(
      database,
      `INSERT INTO notification_events (
         kind, project_id, area, audience, actor_email, actor_name,
         subject_type, subject_id, title, body, view, payload_json,
         fanout_status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      notificationRecord.kind,
      notificationRecord.projectId,
      notificationRecord.area,
      notificationRecord.audience,
      notificationRecord.actorEmail,
      notificationRecord.actorName,
      notificationRecord.subjectType,
      notificationRecord.subjectId,
      notificationRecord.title,
      notificationRecord.body,
      notificationRecord.view,
      notificationRecord.payloadJson,
      notificationRecord.createdAt,
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
    if (atomicStatements.length !== expectedAtomicPublicationStatementCount(Boolean(input.reviewClosure))) {
      throw new Error("La publicación no coincide con el contrato transaccional esperado.");
    }
    if (atomicStatements.length > MAX_ATOMIC_PUBLICATION_STATEMENTS) {
      throw new Error("La publicaciÃ³n supera el presupuesto transaccional seguro.");
    }
    await database.batch(atomicStatements);
    event = { ...event, status: "published" };
  } catch (error) {
    try {
      const committedEvent = await settleFailedPreparingEvent(event.id);
      if (committedEvent) {
        // A lost Worker response can make an already committed D1 batch reject
        // locally. The durable event is authoritative and must not be undone.
        event = committedEvent;
      } else {
        throw error;
      }
    } catch (settlementError) {
      if (settlementError === error) throw error;
      throw new AggregateError(
        [error, settlementError],
        `No se pudo confirmar el resultado de la revisión ${event.id}.`,
      );
    }
  }

  await dispatchNotificationBySubject({
    kind: notificationRecord.kind,
    subjectType: notificationRecord.subjectType,
    subjectId: notificationRecord.subjectId,
  }).catch(() => undefined);
  return event;
}
