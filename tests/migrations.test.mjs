import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function journal() {
  return JSON.parse(await readFile(new URL("drizzle/meta/_journal.json", root), "utf8"));
}

async function migrationSql(tag) {
  return readFile(new URL(`drizzle/${tag}.sql`, root), "utf8");
}

function applySql(database, sql) {
  for (const statement of sql.split("--> statement-breakpoint")) {
    const normalized = statement.trim();
    if (normalized) database.exec(normalized);
  }
}

async function migrate(database, throughTag = "") {
  const state = await journal();
  for (const entry of state.entries) {
    applySql(database, await migrationSql(entry.tag));
    if (entry.tag === throughTag) break;
  }
}

function tableColumns(database, table) {
  return database.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

test("the exact journal migrates an empty database with ingestion and control-room schema", async () => {
  const database = new DatabaseSync(":memory:");
  await migrate(database);

  const tables = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all().map((row) => row.name);
  assert.ok(tables.includes("document_data_proposals"));
  assert.ok(tables.includes("file_reviews"));
  assert.ok(tables.includes("control_actions"));
  assert.ok(tables.includes("report_snapshots"));
  assert.ok(tables.includes("document_templates"));
  assert.ok(tables.includes("ingestion_agent_runs"));

  const uploadedColumns = tableColumns(database, "uploaded_files");
  for (const column of [
    "project_id",
    "document_type",
    "review_status",
    "publication_revision",
    "deleted_at",
    "ingestion_version",
    "processed_at",
    "derived_from_file_id",
    "automation_kind",
    "superseded_by_file_id",
    "superseded_at",
  ]) {
    assert.ok(uploadedColumns.includes(column), `missing uploaded_files.${column}`);
  }
  database.close();
});

test("migration 0012 reconciles legacy duplicates before unique indexes", async () => {
  const database = new DatabaseSync(":memory:");
  await migrate(database, "0011_motionless_aqueduct");
  const insert = database.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, safe_name, area, size_bytes, sha256, storage_key,
      uploader_email, uploader_name, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const base = ["Informe.xlsx", "informe.xlsx", "obra", 100, "same-sha", "araya/obra/2026/08/informe.xlsx", "obra@example.com", "Obra", 1];
  insert.run("file-a", ...base, "2026-08-11T10:00:00.000Z", "2026-08-11T10:00:00.000Z");
  insert.run("file-b", ...base, "2026-08-11T10:01:00.000Z", "2026-08-11T10:01:00.000Z");

  applySql(database, await migrationSql("0012_natural_madelyne_pryor"));

  const rows = database.prepare(
    "SELECT id, version, deleted_at FROM uploaded_files ORDER BY id",
  ).all();
  assert.deepEqual(rows.map((row) => Number(row.version)), [1, 2]);
  assert.equal(rows.filter((row) => row.deleted_at === "").length, 1);
  const indexes = database.prepare("PRAGMA index_list(uploaded_files)").all();
  assert.ok(indexes.some((index) => index.name === "uploaded_files_active_sha256_idx" && index.unique === 1));
  assert.ok(indexes.some((index) => index.name === "uploaded_files_area_name_version_idx" && index.unique === 1));
  database.close();
});

test("migration 0012 keeps the protected authoritative duplicate and its published history effective", async () => {
  const database = new DatabaseSync(":memory:");
  await migrate(database, "0011_motionless_aqueduct");
  const insert = database.prepare(`
    INSERT INTO uploaded_files (
      id, original_name, safe_name, area, size_bytes, sha256, storage_key,
      uploader_email, uploader_name, version, document_type, review_status,
      publication_revision, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    "file-generic",
    "Estado.xlsx",
    "estado.xlsx",
    "obra",
    200,
    "protected-sha",
    "araya/obra/2026/07/estado.xlsx",
    "obra@example.com",
    "Obra",
    1,
    "documento_general",
    "pendiente_extraccion",
    null,
    "",
    "2026-07-01T10:00:00.000Z",
    "2026-07-01T10:00:00.000Z",
  );
  insert.run(
    "file-finance",
    "Estado.xlsx",
    "estado.xlsx",
    "finanzas",
    200,
    "protected-sha",
    "araya/finanzas/2026/08/estado.xlsx",
    "finanzas@example.com",
    "Finanzas",
    1,
    "estado_financiero",
    "aprobado",
    12,
    "2026-08-11T10:10:00.000Z",
    "2026-08-11T10:00:00.000Z",
    "2026-08-11T10:10:00.000Z",
  );
  database.exec(`
    INSERT INTO live_data_events (
      id, source_file_id, source_name, area, cutoff, change_count, message,
      status, actor_email, actor_name, created_at
    ) VALUES (
      12, 'file-finance', 'Estado.xlsx', 'finanzas', '2026-06-30', 1,
      'Dato financiero publicado', 'published', 'finanzas@example.com',
      'Finanzas', '2026-08-11T10:10:00.000Z'
    );
    INSERT INTO live_data_history (
      event_id, key, value_json, value_type, area, source_file_id, source_name,
      source_currency, cutoff, actor_email, actor_name, created_at
    ) VALUES (
      12, 'financialProjection', '{}', 'object', 'finanzas', 'file-finance',
      'Estado.xlsx', 'DOP', '2026-06-30', 'finanzas@example.com', 'Finanzas',
      '2026-08-11T10:10:00.000Z'
    );
    INSERT INTO document_data_proposals (
      id, file_id, key, value_json, value_type, area, status, created_at, updated_at
    ) VALUES (
      'proposal-generic', 'file-generic', 'financialProjection', '{"total":1}',
      'object', 'obra', 'pendiente', '2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z'
    );
    INSERT INTO document_data_proposals (
      id, file_id, key, value_json, value_type, area, status, created_at, updated_at
    ) VALUES (
      'proposal-finance', 'file-finance', 'financialProjection', '{"total":2}',
      'object', 'finanzas', 'publicado', '2026-08-11T10:00:00.000Z', '2026-08-11T10:10:00.000Z'
    );
  `);

  applySql(database, await migrationSql("0012_natural_madelyne_pryor"));

  const [active] = database.prepare(`
    SELECT id, area, document_type, publication_revision, status,
      processing_stage, processing_progress, review_status, requires_review
    FROM uploaded_files
    WHERE sha256 = 'protected-sha' AND deleted_at = ''
  `).all();
  assert.deepEqual({ ...active }, {
    id: "file-finance",
    area: "finanzas",
    document_type: "estado_financiero",
    publication_revision: 12,
    status: "integrado",
    processing_stage: "sincronizado",
    processing_progress: 100,
    review_status: "aprobado",
    requires_review: 0,
  });
  const [effective] = database.prepare(`
    SELECT history.source_file_id, source.deleted_at
    FROM live_data_history AS history
    JOIN uploaded_files AS source ON source.id = history.source_file_id
    WHERE history.key = 'financialProjection'
  `).all();
  assert.deepEqual({ ...effective }, { source_file_id: "file-finance", deleted_at: "" });
  const [proposal] = database.prepare(`
    SELECT id, file_id, status, value_json
    FROM document_data_proposals
    WHERE key = 'financialProjection'
  `).all();
  assert.deepEqual({ ...proposal }, {
    id: "proposal-finance",
    file_id: "file-finance",
    status: "publicado",
    value_json: '{"total":2}',
  });
  database.close();
});
