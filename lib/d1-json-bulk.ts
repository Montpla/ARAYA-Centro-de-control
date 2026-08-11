export const MAX_D1_JSON_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_DOCUMENT_PROPOSALS = 250;
export const MAX_NOTIFICATION_RECEIPTS = 500;

type D1RunResult = {
  meta?: { changes?: number };
};

type D1RunStatement = {
  bind: (...values: Array<string | number | null>) => D1RunStatement;
  run: () => Promise<D1RunResult> | D1RunResult;
  all: () => Promise<{ results?: unknown[] }> | { results?: unknown[] };
};

export type D1JsonDatabase = {
  prepare: (sql: string) => D1RunStatement;
};

export type DocumentProposalJsonRow = {
  id: string;
  fileId: string;
  generation: string;
  key: string;
  label: string;
  valueJson: string;
  previousValueJson: string | null;
  valueType: string;
  area: string;
  sourceCurrency: string;
  cutoff: string;
  confidence: number;
  discrepancy: boolean;
  status: string;
  notes: string;
  createdByEmail: string;
  createdByName: string;
  updatedAt: string;
};

export type NotificationReceiptJsonRow = {
  notificationId: number;
  userEmail: string;
  readAt: string;
  openedAt: string;
};

export type LivePointValueRow = {
  key: string;
  valueJson: string;
};

type BoundedJsonOptions = {
  label: string;
  maxItems: number;
  maxBytes?: number;
};

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Serializes a bounded list for SQLite json_each(). Keeping every bulk request
 * below one D1 bind payload avoids both variable-count growth and accidental
 * oversized Worker-to-D1 requests.
 */
export function encodeBoundedJsonArray<T>(
  rows: readonly T[],
  options: BoundedJsonOptions,
) {
  if (!Array.isArray(rows) || rows.length > options.maxItems) {
    throw new Error(`${options.label} admite como máximo ${options.maxItems} elementos.`);
  }
  const payload = JSON.stringify(rows);
  const maxBytes = options.maxBytes ?? MAX_D1_JSON_PAYLOAD_BYTES;
  if (utf8ByteLength(payload) >= maxBytes) {
    throw new Error(`${options.label} debe ocupar menos de 2 MB.`);
  }
  return payload;
}

export function encodeDocumentProposalRows(rows: readonly DocumentProposalJsonRow[]) {
  return encodeBoundedJsonArray(rows, {
    label: "La preparación de propuestas",
    maxItems: MAX_DOCUMENT_PROPOSALS,
  });
}

export function encodeNotificationReceiptRows(rows: readonly NotificationReceiptJsonRow[]) {
  return encodeBoundedJsonArray(rows, {
    label: "La confirmación de notificaciones",
    maxItems: MAX_NOTIFICATION_RECEIPTS,
  });
}

export const UPSERT_DOCUMENT_PROPOSALS_SQL = `
INSERT INTO document_data_proposals (
  id, file_id, generation, key, label, value_json, previous_value_json,
  value_type, area, source_currency, cutoff, confidence, discrepancy, status,
  notes, created_by_email, created_by_name, updated_at
)
SELECT
  json_extract(item.value, '$.id'),
  json_extract(item.value, '$.fileId'),
  json_extract(item.value, '$.generation'),
  json_extract(item.value, '$.key'),
  json_extract(item.value, '$.label'),
  json_extract(item.value, '$.valueJson'),
  json_extract(item.value, '$.previousValueJson'),
  json_extract(item.value, '$.valueType'),
  json_extract(item.value, '$.area'),
  json_extract(item.value, '$.sourceCurrency'),
  json_extract(item.value, '$.cutoff'),
  CAST(json_extract(item.value, '$.confidence') AS REAL),
  CAST(json_extract(item.value, '$.discrepancy') AS INTEGER),
  json_extract(item.value, '$.status'),
  json_extract(item.value, '$.notes'),
  json_extract(item.value, '$.createdByEmail'),
  json_extract(item.value, '$.createdByName'),
  json_extract(item.value, '$.updatedAt')
FROM json_each(?) AS item
WHERE true
ON CONFLICT(file_id, generation, key) DO UPDATE SET
  label = excluded.label,
  value_json = excluded.value_json,
  previous_value_json = excluded.previous_value_json,
  value_type = excluded.value_type,
  area = excluded.area,
  source_currency = excluded.source_currency,
  cutoff = excluded.cutoff,
  confidence = excluded.confidence,
  discrepancy = excluded.discrepancy,
  status = excluded.status,
  notes = excluded.notes,
  created_by_email = excluded.created_by_email,
  created_by_name = excluded.created_by_name,
  updated_at = excluded.updated_at
`;

export const UPSERT_NOTIFICATION_RECEIPTS_SQL = `
INSERT INTO notification_reads (
  notification_id, user_email, read_at, opened_at
)
SELECT
  CAST(json_extract(item.value, '$.notificationId') AS INTEGER),
  lower(json_extract(item.value, '$.userEmail')),
  json_extract(item.value, '$.readAt'),
  json_extract(item.value, '$.openedAt')
FROM json_each(?) AS item
WHERE true
ON CONFLICT(notification_id, user_email) DO UPDATE SET
  read_at = excluded.read_at,
  opened_at = CASE
    WHEN excluded.opened_at <> '' THEN excluded.opened_at
    ELSE notification_reads.opened_at
  END
`;

export const SELECT_LIVE_POINT_VALUES_SQL = `
SELECT key, value_json AS valueJson
FROM live_data_points
WHERE key IN (
  SELECT CAST(value AS TEXT) FROM json_each(?)
)
`;

export const DELETE_EXPIRED_REVIEW_RESERVATIONS_SQL = `
DELETE FROM file_reviews
WHERE file_id = ?
  AND action IN (SELECT CAST(value AS TEXT) FROM json_each(?))
  AND lease_expires_at <> ''
  AND julianday(lease_expires_at) IS NOT NULL
  AND julianday(lease_expires_at) <= julianday(?)
  AND previous_review_status = ?
  AND previous_updated_at = ?
`;

export async function upsertDocumentProposalRows(
  database: D1JsonDatabase,
  rows: readonly DocumentProposalJsonRow[],
) {
  if (!rows.length) return { meta: { changes: 0 } } satisfies D1RunResult;
  const payload = encodeDocumentProposalRows(rows);
  return await database.prepare(UPSERT_DOCUMENT_PROPOSALS_SQL).bind(payload).run();
}

export async function upsertNotificationReceiptRows(
  database: D1JsonDatabase,
  rows: readonly NotificationReceiptJsonRow[],
) {
  if (!rows.length) return { meta: { changes: 0 } } satisfies D1RunResult;
  const payload = encodeNotificationReceiptRows(rows);
  return await database.prepare(UPSERT_NOTIFICATION_RECEIPTS_SQL).bind(payload).run();
}

export async function selectLivePointValues(
  database: D1JsonDatabase,
  keys: readonly string[],
) {
  if (!keys.length) return [] as LivePointValueRow[];
  const payload = encodeBoundedJsonArray(keys, {
    label: "La consulta de datos publicados",
    maxItems: MAX_DOCUMENT_PROPOSALS,
  });
  const result = await database.prepare(SELECT_LIVE_POINT_VALUES_SQL).bind(payload).all();
  return (result.results ?? []) as LivePointValueRow[];
}

export async function deleteExpiredReviewReservations(
  database: D1JsonDatabase,
  input: {
    fileId: string;
    processingActions: readonly string[];
    expiredAt: string;
    previousReviewStatus: string;
    previousUpdatedAt: string;
  },
) {
  const actionsJson = encodeBoundedJsonArray(input.processingActions, {
    label: "La limpieza de reservas de revisión",
    maxItems: 16,
  });
  return await database.prepare(DELETE_EXPIRED_REVIEW_RESERVATIONS_SQL).bind(
    input.fileId,
    actionsJson,
    input.expiredAt,
    input.previousReviewStatus,
    input.previousUpdatedAt,
  ).run();
}
