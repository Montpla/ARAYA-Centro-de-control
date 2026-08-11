import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationPath = new URL("../drizzle/0015_purple_stark_industries.sql", import.meta.url);
const migrationSql = readFileSync(migrationPath, "utf8");

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE notification_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT 'araya',
      area TEXT NOT NULL DEFAULT 'direccion',
      audience TEXT NOT NULL DEFAULT 'all',
      actor_email TEXT NOT NULL DEFAULT '',
      actor_name TEXT NOT NULL DEFAULT '',
      subject_type TEXT NOT NULL DEFAULT '',
      subject_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      view TEXT NOT NULL DEFAULT 'resumen',
      payload_json TEXT NOT NULL DEFAULT '{}',
      fanout_status TEXT NOT NULL DEFAULT 'pending',
      fanout_claimed_at TEXT NOT NULL DEFAULT '',
      fanout_at TEXT NOT NULL DEFAULT '',
      fanout_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE uploaded_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'araya',
      original_name TEXT NOT NULL,
      area TEXT NOT NULL,
      extension TEXT NOT NULL DEFAULT '',
      uploader_email TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente_revision',
      processing_stage TEXT NOT NULL DEFAULT 'recibido',
      processing_summary TEXT NOT NULL DEFAULT '',
      document_type TEXT NOT NULL DEFAULT 'clasificacion_pendiente',
      proposal_generation TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE document_data_proposals (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      generation TEXT NOT NULL
    );
    CREATE TABLE file_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      proposal_count INTEGER NOT NULL DEFAULT 0,
      publication_revision INTEGER,
      actor_email TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      area TEXT NOT NULL DEFAULT 'direccion',
      finance_access INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      avatar_storage_key TEXT NOT NULL DEFAULT '',
      avatar_mime_type TEXT NOT NULL DEFAULT '',
      avatar_updated_at TEXT NOT NULL DEFAULT '',
      created_by_email TEXT NOT NULL DEFAULT '',
      last_login_at TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      deleted_by_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_presence (
      session_id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      device_id TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE control_actions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT 'direccion',
      related_view TEXT NOT NULL DEFAULT 'resumen',
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_email TEXT NOT NULL DEFAULT '',
      assignee_name TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      source_file_id TEXT NOT NULL DEFAULT '',
      request_key TEXT NOT NULL,
      created_by_email TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE control_action_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      request_key TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE report_snapshots (
      id TEXT PRIMARY KEY,
      frequency TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      label TEXT NOT NULL,
      includes_finance INTEGER NOT NULL DEFAULT 0,
      created_by_email TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE custom_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL DEFAULT '',
      trend TEXT NOT NULL DEFAULT 'flat',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'revision',
      score REAL NOT NULL DEFAULT 0,
      next_delivery TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  for (const statement of migrationSql.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
  return db;
}

function notifications(db) {
  return db.prepare(`
    SELECT kind, area, audience, actor_email, subject_type, subject_id,
           title, body, view, payload_json, fanout_status
    FROM notification_events ORDER BY id
  `).all();
}

function clearNotifications(db) {
  db.exec("DELETE FROM notification_events");
}

test("0015 enqueues provisional receipt and privacy-scoped resolved classification", () => {
  const db = createDatabase();
  db.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, area, extension, uploader_email, uploader_name,
      processing_stage, document_type, proposal_generation, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'extraccion_en_curso', 'clasificacion_pendiente', ?, ?, ?)
  `).run("public-file", "implantacion.xlsx", "obra", "xlsx", "worker@example.com", "Obra", "g-public", "2026-08-11T10:00:00Z", "2026-08-11T10:00:00Z");
  let rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "file_received");
  assert.equal(rows[0].audience, "admin");
  assert.equal(rows[0].area, "direccion");
  assert.doesNotMatch(rows[0].title + rows[0].body, /implantacion\.xlsx/);

  db.prepare("INSERT INTO document_data_proposals (id, file_id, generation) VALUES (?, ?, ?)")
    .run("proposal-1", "public-file", "g-public");
  db.prepare("UPDATE uploaded_files SET document_type = 'informe_obra', updated_at = ? WHERE id = ?")
    .run("2026-08-11T10:01:00Z", "public-file");
  rows = notifications(db);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].kind, "file_uploaded");
  assert.equal(rows[1].audience, "all");
  assert.equal(JSON.parse(rows[1].payload_json).updateCount, 1);

  db.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, area, extension, uploader_email, uploader_name,
      processing_stage, document_type, proposal_generation, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'extraccion_en_curso', 'clasificacion_pendiente', '', ?, ?)
  `).run("finance-file", "balance.pdf", "obra", "pdf", "finance@example.com", "Finanzas", "2026-08-11T10:02:00Z", "2026-08-11T10:02:00Z");
  db.prepare("UPDATE uploaded_files SET area = 'finanzas', document_type = 'estado_financiero', updated_at = ? WHERE id = ?")
    .run("2026-08-11T10:03:00Z", "finance-file");
  rows = notifications(db);
  assert.equal(rows.at(-1).audience, "finance");
  assert.equal(rows.at(-1).area, "finanzas");
  assert.equal(rows.at(-1).fanout_status, "pending");

  db.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, area, extension, uploader_email, uploader_name,
      processing_stage, document_type, proposal_generation, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'extraccion_en_curso', 'clasificacion_pendiente', '', ?, ?)
  `).run("observed-file", "confidencial.pdf", "obra", "pdf", "worker@example.com", "Obra", "2026-08-11T10:04:00Z", "2026-08-11T10:04:00Z");
  clearNotifications(db);
  db.prepare("UPDATE uploaded_files SET status = 'observado', processing_stage = 'observado', updated_at = ? WHERE id = ?")
    .run("2026-08-11T10:05:00Z", "observed-file");
  rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "file_processing_observed");
  assert.equal(rows[0].audience, "admin");
  assert.equal(rows[0].area, "direccion");
  assert.doesNotMatch(rows[0].title + rows[0].body, /confidencial\.pdf/);
  db.close();
});

test("0015 notifies only non-publication review decisions", () => {
  const db = createDatabase();
  db.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, area, extension, uploader_email, uploader_name,
      processing_stage, document_type, proposal_generation
    ) VALUES ('review-file', 'balance.pdf', 'finanzas', 'pdf', 'owner@example.com', 'Owner',
              'contraste', 'estado_financiero', 'g-review')
  `).run();
  clearNotifications(db);
  db.prepare(`
    INSERT INTO file_reviews (file_id, action, note, proposal_count, actor_email, actor_name)
    VALUES ('review-file', 'procesando_prepare', '', 2, 'reviewer@example.com', 'Reviewer')
  `).run();
  assert.equal(notifications(db).length, 0);
  db.exec("UPDATE file_reviews SET action = 'preparado' WHERE id = 1");
  let rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "file_review_prepared");
  assert.equal(rows[0].audience, "finance");

  clearNotifications(db);
  db.prepare(`
    INSERT INTO file_reviews (file_id, action, note, proposal_count, actor_email, actor_name)
    VALUES ('review-file', 'procesando_approve', '', 2, 'reviewer@example.com', 'Reviewer')
  `).run();
  db.exec("UPDATE file_reviews SET action = 'aprobado', publication_revision = 17 WHERE id = 2");
  assert.equal(notifications(db).length, 0, "live publication owns its notification");

  db.prepare(`
    INSERT INTO file_reviews (file_id, action, note, proposal_count, actor_email, actor_name)
    VALUES ('review-file', 'procesando_reject', 'No conforme', 2, 'reviewer@example.com', 'Reviewer')
  `).run();
  db.exec("UPDATE file_reviews SET action = 'rechazado' WHERE id = 3");
  rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "file_rechazado");
  assert.equal(rows[0].body, "No conforme");
  db.close();
});

test("0015 covers user access, avatar and reconnection without heartbeat spam", () => {
  const db = createDatabase();
  db.prepare(`
    INSERT INTO app_users (email, display_name, role, area, finance_access, created_by_email)
    VALUES ('admin@example.com', 'Admin', 'admin', 'direccion', 1, '')
  `).run();
  clearNotifications(db);
  db.prepare(`
    INSERT INTO app_users (email, display_name, area, created_by_email)
    VALUES ('user@example.com', 'Usuario', 'obra', 'admin@example.com')
  `).run();
  let rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "user_created");
  assert.equal(rows[0].audience, "admin");

  clearNotifications(db);
  db.exec("UPDATE app_users SET last_login_at = '2026-08-11T10:00:00Z' WHERE email = 'user@example.com'");
  assert.equal(notifications(db).length, 0);
  db.prepare(`
    UPDATE app_users
    SET avatar_updated_at = ?, notification_kind = 'user_avatar_updated',
        notification_nonce = ?, notification_actor_email = ?, notification_actor_name = ?, updated_at = ?
    WHERE email = 'user@example.com'
  `).run("2026-08-11T10:01:00Z", "avatar-1", "admin@example.com", "Admin", "2026-08-11T10:01:00Z");
  rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "user_avatar_updated");

  clearNotifications(db);
  db.prepare(`
    INSERT INTO user_presence (
      session_id, user_email, user_name, platform, connected_at, last_seen_at
    ) VALUES ('session-1234', 'user@example.com', 'Usuario', 'iOS', ?, ?)
  `).run("2026-08-11T10:02:00Z", "2026-08-11T10:02:00Z");
  rows = notifications(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "user_connected");
  assert.equal(rows[0].audience, "all");
  assert.equal(rows[0].area, "direccion");
  db.exec("UPDATE user_presence SET last_seen_at = '2026-08-11T10:02:30Z' WHERE session_id = 'session-1234'");
  assert.equal(notifications(db).length, 1, "heartbeat must not enqueue another event");
  db.exec("UPDATE user_presence SET connected_at = '2026-08-11T10:05:00Z', last_seen_at = '2026-08-11T10:05:00Z' WHERE session_id = 'session-1234'");
  assert.equal(notifications(db).length, 2, "a real reconnection is visible");
  db.close();
});

test("0015 covers actions, reports, metrics and amount-free supplier notices", () => {
  const db = createDatabase();
  db.prepare(`
    INSERT INTO control_actions (
      id, title, area, related_view, status, request_key, created_by_email, created_by_name
    ) VALUES ('action-1', 'Conciliar balance', 'finanzas', 'metricas', 'open', 'req-1',
              'admin@example.com', 'Admin')
  `).run();
  let rows = notifications(db);
  assert.equal(rows.at(-1).audience, "finance");
  clearNotifications(db);
  db.prepare(`
    UPDATE control_actions
    SET status = 'completed', notification_nonce = 'status-1',
        notification_actor_email = 'admin@example.com', notification_actor_name = 'Admin'
    WHERE id = 'action-1'
  `).run();
  db.prepare(`
    INSERT INTO control_action_activity (
      action_id, event_type, message, request_key, actor_email, actor_name
    ) VALUES ('action-1', 'comment', 'Revisado', 'comment-1', 'admin@example.com', 'Admin')
  `).run();
  rows = notifications(db);
  assert.deepEqual(rows.map((row) => row.kind), ["action_status_changed", "action_commented"]);
  assert.ok(rows.every((row) => row.audience === "finance"));

  clearNotifications(db);
  db.prepare(`
    INSERT INTO report_snapshots (
      id, frequency, start_date, end_date, label, includes_finance, created_by_email, created_by_name
    ) VALUES ('report-public', 'weekly', '2026-08-01', '2026-08-07', 'Obra semanal', 0,
              'worker@example.com', 'Obra')
  `).run();
  db.prepare(`
    INSERT INTO report_snapshots (
      id, frequency, start_date, end_date, label, includes_finance, created_by_email, created_by_name
    ) VALUES ('report-finance', 'monthly', '2026-07-01', '2026-07-31', 'Cierre', 1,
              'finance@example.com', 'Finanzas')
  `).run();
  rows = notifications(db);
  assert.equal(rows[0].audience, "all");
  assert.equal(rows[1].audience, "finance");

  clearNotifications(db);
  db.prepare(`
    INSERT INTO custom_metrics (name, value, created_by_email, created_by_name)
    VALUES ('Caja', '100', 'finance@example.com', 'Finanzas')
  `).run();
  db.prepare(`
    INSERT INTO suppliers (name, category, status, amount, created_by_email, created_by_name)
    VALUES ('Hormigones RD', 'Estructura', 'activo', 'DOP 999999', 'worker@example.com', 'Obra')
  `).run();
  rows = notifications(db);
  assert.equal(rows[0].audience, "finance");
  assert.equal(rows[1].audience, "all");
  assert.doesNotMatch(`${rows[1].title} ${rows[1].body} ${rows[1].payload_json}`, /999999|amount|importe/i);
  db.close();
});

test("trigger-owned routes do not reinsert events and schedule immediate push relay", () => {
  const routePaths = [
    "../app/api/admin/users/route.ts",
    "../app/api/profile/avatar/route.ts",
    "../app/api/presence/route.ts",
    "../app/api/dashboard/route.ts",
    "../app/api/control-room/route.ts",
    "../app/api/files/route.ts",
    "../app/api/files/review/route.ts",
  ];
  for (const path of routePaths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /emitNotification/);
    assert.match(source, /scheduleNotificationDispatch/);
  }
  const helper = readFileSync(new URL("../lib/notification-dispatch.ts", import.meta.url), "utf8");
  assert.match(helper, /getRequestExecutionContext/);
  assert.match(helper, /waitUntil\(task\)/);
  assert.match(helper, /dispatchPendingNotifications/);
  assert.doesNotMatch(migrationSql, /AFTER (?:INSERT|UPDATE).*`live_data_events`/i);
  assert.doesNotMatch(migrationSql, /file_(?:deleted|restored)/);
});
