import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customMetrics = sqliteTable("custom_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  value: text("value").notNull(),
  target: text("target").notNull().default(""),
  unit: text("unit").notNull().default(""),
  owner: text("owner").notNull().default(""),
  trend: text("trend").notNull().default("flat"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contact: text("contact").notNull().default(""),
  status: text("status").notNull().default("revision"),
  score: real("score").notNull().default(0),
  nextDelivery: text("next_delivery").notNull().default(""),
  amount: text("amount").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agentLogs = sqliteTable("agent_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  mode: text("mode").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const uploadedFiles = sqliteTable(
  "uploaded_files",
  {
    id: text("id").primaryKey(),
    originalName: text("original_name").notNull(),
    safeName: text("safe_name").notNull(),
    area: text("area").notNull(),
    section: text("section").notNull().default(""),
    description: text("description").notNull().default(""),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    extension: text("extension").notNull().default(""),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    source: text("source").notNull().default("dashboard"),
    sourceCurrency: text("source_currency").notNull().default("DOP"),
    status: text("status").notNull().default("pendiente_revision"),
    uploaderEmail: text("uploader_email").notNull(),
    uploaderName: text("uploader_name").notNull(),
    version: integer("version").notNull().default(1),
    declaredCutoff: text("declared_cutoff").notNull().default(""),
    classificationConfidence: real("classification_confidence").notNull().default(0),
    classificationReason: text("classification_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("uploaded_files_created_at_idx").on(table.createdAt),
    index("uploaded_files_area_idx").on(table.area),
    index("uploaded_files_sha256_idx").on(table.sha256),
  ],
);

export const fileActivity = sqliteTable(
  "file_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileId: text("file_id").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull().default(""),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("file_activity_file_id_idx").on(table.fileId)],
);

