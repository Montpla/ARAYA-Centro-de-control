import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    processingStage: text("processing_stage").notNull().default("recibido"),
    processingProgress: integer("processing_progress").notNull().default(10),
    processingSummary: text("processing_summary").notNull().default(""),
    requiresReview: integer("requires_review", { mode: "boolean" }).notNull().default(true),
    projectId: text("project_id").notNull().default("araya"),
    documentType: text("document_type").notNull().default("documento_general"),
    detectedPeriod: text("detected_period").notNull().default(""),
    extractionMode: text("extraction_mode").notNull().default("asistida"),
    extractionConfidence: real("extraction_confidence").notNull().default(0),
    extractionSummary: text("extraction_summary").notNull().default(""),
    discrepancyCount: integer("discrepancy_count").notNull().default(0),
    reviewStatus: text("review_status").notNull().default("pendiente_extraccion"),
    reviewedByEmail: text("reviewed_by_email").notNull().default(""),
    reviewedByName: text("reviewed_by_name").notNull().default(""),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewNote: text("review_note").notNull().default(""),
    publicationRevision: integer("publication_revision"),
    publishedAt: text("published_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("uploaded_files_created_at_idx").on(table.createdAt),
    index("uploaded_files_area_idx").on(table.area),
    index("uploaded_files_sha256_idx").on(table.sha256),
  ],
);

export const documentDataProposals = sqliteTable(
  "document_data_proposals",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull().default(""),
    valueJson: text("value_json").notNull(),
    previousValueJson: text("previous_value_json"),
    valueType: text("value_type").notNull(),
    area: text("area").notNull().default("direccion"),
    sourceCurrency: text("source_currency").notNull().default("DOP"),
    cutoff: text("cutoff").notNull().default(""),
    confidence: real("confidence").notNull().default(1),
    discrepancy: integer("discrepancy", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("pendiente"),
    notes: text("notes").notNull().default(""),
    createdByEmail: text("created_by_email").notNull().default(""),
    createdByName: text("created_by_name").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("document_data_proposals_file_key_idx").on(table.fileId, table.key),
    index("document_data_proposals_file_id_idx").on(table.fileId),
    index("document_data_proposals_status_idx").on(table.status),
  ],
);

export const fileReviews = sqliteTable(
  "file_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileId: text("file_id").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull().default(""),
    proposalCount: integer("proposal_count").notNull().default(0),
    publicationRevision: integer("publication_revision"),
    requestKey: text("request_key").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("file_reviews_request_key_idx").on(table.requestKey),
    index("file_reviews_file_id_idx").on(table.fileId),
    index("file_reviews_created_at_idx").on(table.createdAt),
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

export const liveDataEvents = sqliteTable(
  "live_data_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceFileId: text("source_file_id").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    area: text("area").notNull().default("direccion"),
    cutoff: text("cutoff").notNull().default(""),
    changeCount: integer("change_count").notNull().default(0),
    message: text("message").notNull().default(""),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("live_data_events_created_at_idx").on(table.createdAt),
    index("live_data_events_source_file_id_idx").on(table.sourceFileId),
  ],
);

export const liveDataPoints = sqliteTable(
  "live_data_points",
  {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    valueType: text("value_type").notNull(),
    area: text("area").notNull().default("direccion"),
    sourceFileId: text("source_file_id").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    sourceCurrency: text("source_currency").notNull().default("DOP"),
    cutoff: text("cutoff").notNull().default(""),
    revision: integer("revision").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    updatedByName: text("updated_by_name").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("live_data_points_revision_idx").on(table.revision),
    index("live_data_points_area_idx").on(table.area),
    index("live_data_points_source_file_id_idx").on(table.sourceFileId),
  ],
);

export const liveDataHistory = sqliteTable(
  "live_data_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id").notNull(),
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    valueType: text("value_type").notNull(),
    area: text("area").notNull().default("direccion"),
    sourceFileId: text("source_file_id").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    sourceCurrency: text("source_currency").notNull().default("DOP"),
    cutoff: text("cutoff").notNull().default(""),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("live_data_history_event_idx").on(table.eventId),
    index("live_data_history_key_idx").on(table.key),
    index("live_data_history_created_at_idx").on(table.createdAt),
    index("live_data_history_source_file_id_idx").on(table.sourceFileId),
  ],
);

export const appUsers = sqliteTable(
  "app_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: text("role").notNull().default("member"),
    area: text("area").notNull().default("direccion"),
    financeAccess: integer("finance_access", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    avatarStorageKey: text("avatar_storage_key").notNull().default(""),
    avatarMimeType: text("avatar_mime_type").notNull().default(""),
    avatarUpdatedAt: text("avatar_updated_at").notNull().default(""),
    createdByEmail: text("created_by_email").notNull().default(""),
    lastLoginAt: text("last_login_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("app_users_email_idx").on(table.email),
    index("app_users_active_idx").on(table.active),
    index("app_users_role_idx").on(table.role),
  ],
);

export const accessAudit = sqliteTable(
  "access_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetEmail: text("target_email").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("access_audit_target_email_idx").on(table.targetEmail),
    index("access_audit_created_at_idx").on(table.createdAt),
  ],
);

