import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  MAX_D1_JSON_PAYLOAD_BYTES,
  deleteExpiredReviewReservations,
  encodeBoundedJsonArray,
  selectLivePointValues,
  upsertDocumentProposalRows,
  upsertNotificationReceiptRows,
} from "../lib/d1-json-bulk.ts";

function countedD1(database) {
  const counts = { all: 0, prepare: 0, run: 0 };
  return {
    counts,
    binding: {
      prepare(sql) {
        counts.prepare += 1;
        const statement = database.prepare(sql);
        let values = [];
        const bound = {
          bind(...nextValues) {
            values = nextValues;
            return bound;
          },
          all() {
            counts.all += 1;
            return { results: statement.all(...values) };
          },
          run() {
            counts.run += 1;
            const result = statement.run(...values);
            return { meta: { changes: Number(result.changes) } };
          },
        };
        return bound;
      },
    },
  };
}

function createProposalDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE live_data_points (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    CREATE TABLE document_data_proposals (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL, generation TEXT NOT NULL,
      key TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', value_json TEXT NOT NULL,
      previous_value_json TEXT, value_type TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT 'direccion', source_currency TEXT NOT NULL DEFAULT 'DOP',
      cutoff TEXT NOT NULL DEFAULT '', confidence REAL NOT NULL DEFAULT 1,
      discrepancy INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pendiente',
      notes TEXT NOT NULL DEFAULT '', created_by_email TEXT NOT NULL DEFAULT '',
      created_by_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(file_id, generation, key)
    );
  `);
  return database;
}

test("250 proposals use one point query and one set-based upsert, then replay idempotently", async () => {
  const database = createProposalDatabase();
  const seed = database.prepare("INSERT INTO live_data_points (key, value_json) VALUES (?, ?)");
  for (let index = 0; index < 250; index += 1) {
    seed.run(`project.metric.${index}`, JSON.stringify(index));
  }
  const proposals = Array.from({ length: 250 }, (_, index) => ({
    id: `proposal-${index}`,
    fileId: "file-1",
    generation: "generation-1",
    key: `project.metric.${index}`,
    label: `Metric ${index}`,
    valueJson: JSON.stringify(index + 1),
    previousValueJson: JSON.stringify(index),
    valueType: "number",
    area: "obra",
    sourceCurrency: "DOP",
    cutoff: "2026-08-11",
    confidence: 0.99,
    discrepancy: true,
    status: "pendiente",
    notes: "Carga controlada",
    createdByEmail: "obra@example.com",
    createdByName: "Obra",
    updatedAt: "2026-08-11T10:00:00.000Z",
  }));
  const d1 = countedD1(database);

  const points = await selectLivePointValues(d1.binding, proposals.map((row) => row.key));
  await upsertDocumentProposalRows(d1.binding, proposals);
  assert.equal(points.length, 250);
  assert.deepEqual(d1.counts, { all: 1, prepare: 2, run: 1 });
  assert.equal(database.prepare("SELECT count(*) AS count FROM document_data_proposals").get().count, 250);

  const replayed = proposals.map((row) => ({
    ...row,
    id: `replacement-${row.id}`,
    valueJson: JSON.stringify(999),
    updatedAt: "2026-08-11T10:05:00.000Z",
  }));
  await upsertDocumentProposalRows(d1.binding, replayed);
  assert.deepEqual(d1.counts, { all: 1, prepare: 3, run: 2 });
  assert.equal(database.prepare("SELECT count(*) AS count FROM document_data_proposals").get().count, 250);
  const first = database.prepare("SELECT id, value_json AS valueJson FROM document_data_proposals WHERE key = ?")
    .get("project.metric.0");
  assert.equal(first.id, "proposal-0");
  assert.equal(first.valueJson, "999");
  database.close();
});

test("expired review claims are removed with one D1 statement and active claims survive", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE file_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT, file_id TEXT NOT NULL, action TEXT NOT NULL,
      lease_expires_at TEXT NOT NULL, previous_review_status TEXT NOT NULL,
      previous_updated_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO file_reviews (
      file_id, action, lease_expires_at, previous_review_status, previous_updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  for (let index = 0; index < 250; index += 1) {
    insert.run(
      "file-1",
      index % 2 ? "procesando_prepare" : "procesando_approve",
      "2026-08-11T09:00:00.000Z",
      "pendiente_extraccion",
      "2026-08-11T08:00:00.000Z",
    );
  }
  insert.run(
    "file-1",
    "procesando_prepare",
    "2026-08-11T12:00:00.000Z",
    "pendiente_extraccion",
    "2026-08-11T08:00:00.000Z",
  );
  const d1 = countedD1(database);
  await deleteExpiredReviewReservations(d1.binding, {
    fileId: "file-1",
    processingActions: ["procesando_prepare", "procesando_approve"],
    expiredAt: "2026-08-11T10:00:00.000Z",
    previousReviewStatus: "pendiente_extraccion",
    previousUpdatedAt: "2026-08-11T08:00:00.000Z",
  });
  assert.deepEqual(d1.counts, { all: 0, prepare: 1, run: 1 });
  assert.equal(database.prepare("SELECT count(*) AS count FROM file_reviews").get().count, 1);
  database.close();
});

test("500 visible notification receipts use one upsert, preserve privacy and replay safely", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE notification_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, notification_id INTEGER NOT NULL,
      user_email TEXT NOT NULL, read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      opened_at TEXT NOT NULL DEFAULT '', UNIQUE(notification_id, user_email)
    );
    INSERT INTO notification_reads (notification_id, user_email, read_at, opened_at)
    VALUES (9999, 'finance@example.com', '2026-08-11T08:00:00.000Z', 'finance-only');
  `);
  const receipts = Array.from({ length: 500 }, (_, index) => ({
    notificationId: index + 1,
    userEmail: "WORKER@EXAMPLE.COM",
    readAt: "2026-08-11T10:00:00.000Z",
    openedAt: index === 16 ? "2026-08-11T10:00:00.000Z" : "",
  }));
  const d1 = countedD1(database);
  await upsertNotificationReceiptRows(d1.binding, receipts);
  assert.deepEqual(d1.counts, { all: 0, prepare: 1, run: 1 });
  assert.equal(database.prepare("SELECT count(*) AS count FROM notification_reads WHERE user_email = 'worker@example.com'").get().count, 500);
  assert.equal(database.prepare("SELECT count(*) AS count FROM notification_reads WHERE user_email = 'outsider@example.com'").get().count, 0);
  const financeReceipt = database.prepare(
    "SELECT read_at AS readAt, opened_at AS openedAt FROM notification_reads WHERE notification_id = 9999",
  ).get();
  assert.equal(financeReceipt.readAt, "2026-08-11T08:00:00.000Z");
  assert.equal(financeReceipt.openedAt, "finance-only");

  await upsertNotificationReceiptRows(
    d1.binding,
    receipts.map((row) => ({ ...row, readAt: "2026-08-11T10:05:00.000Z", openedAt: "" })),
  );
  assert.deepEqual(d1.counts, { all: 0, prepare: 2, run: 2 });
  const openedReceipt = database.prepare(
    "SELECT read_at AS readAt, opened_at AS openedAt FROM notification_reads WHERE notification_id = 17 AND user_email = 'worker@example.com'",
  ).get();
  assert.equal(openedReceipt.readAt, "2026-08-11T10:05:00.000Z");
  assert.equal(openedReceipt.openedAt, "2026-08-11T10:00:00.000Z");

  const route = await readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8");
  const visibilityGate = route.indexOf(".filter((row) => notificationVisibleToUser(row, auth.user))");
  const bulkWrite = route.indexOf("upsertNotificationReceiptRows(");
  assert.match(route, /notificationVisibilityWhere\(auth\.user\)/);
  assert.ok(visibilityGate >= 0 && bulkWrite > visibilityGate, "privacy filtering must precede the bulk receipt write");
  database.close();
});

test("bulk payload limits reject item overflow and payloads of 2 MB or more before D1", () => {
  assert.throws(
    () => encodeBoundedJsonArray(Array.from({ length: 251 }, (_, index) => index), {
      label: "Propuestas",
      maxItems: 250,
    }),
    /máximo 250/,
  );
  assert.throws(
    () => encodeBoundedJsonArray(["x".repeat(MAX_D1_JSON_PAYLOAD_BYTES)], {
      label: "Carga",
      maxItems: 1,
    }),
    /menos de 2 MB/,
  );
});
