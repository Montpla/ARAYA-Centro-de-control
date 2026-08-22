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
  createdByEmail: text("created_by_email").notNull().default(""),
  createdByName: text("created_by_name").notNull().default(""),
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
  createdByEmail: text("created_by_email").notNull().default(""),
  createdByName: text("created_by_name").notNull().default(""),
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

// Memoria operativa del agente de ingesta. La firma identifica una familia de
// documentos (por ejemplo, la carátula mensual de cubicaciones) sin depender
// del número de cubicación o del mes concreto. El mapeo no contiene el
// documento: únicamente las claves del contrato vivo que una ejecución
// publicada consiguió alimentar, para que el siguiente archivo parta de una
// interpretación ya probada.
export const documentTemplates = sqliteTable(
  "document_templates",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    namePattern: text("name_pattern").notNull(),
    extension: text("extension").notNull(),
    area: text("area").notNull(),
    documentType: text("document_type").notNull(),
    mappingJson: text("mapping_json").notNull().default("[]"),
    visualizationJson: text("visualization_json").notNull().default("[]"),
    promptVersion: text("prompt_version").notNull().default(""),
    schemaVersion: text("schema_version").notNull().default("live-v1"),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
    lastSourceFileId: text("last_source_file_id").notNull().default(""),
    lastRunAt: text("last_run_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("document_templates_fingerprint_idx").on(table.fingerprint),
    index("document_templates_lookup_idx").on(
      table.extension,
      table.area,
      table.documentType,
    ),
    index("document_templates_last_run_idx").on(table.lastRunAt),
  ],
);

// Una fila por recorrido completo del agente. Permite saber qué herramientas
// usó, cuántas vueltas necesitó y si terminó publicando, sin guardar el
// razonamiento privado del modelo ni replicar el contenido confidencial del
// archivo.
export const ingestionAgentRuns = sqliteTable(
  "ingestion_agent_runs",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull(),
    templateId: text("template_id").notNull().default(""),
    fingerprint: text("fingerprint").notNull().default(""),
    status: text("status").notNull().default("running"),
    model: text("model").notNull().default(""),
    promptVersion: text("prompt_version").notNull().default(""),
    iterations: integer("iterations").notNull().default(0),
    toolCallsJson: text("tool_calls_json").notNull().default("[]"),
    validationJson: text("validation_json").notNull().default("{}"),
    proposedCount: integer("proposed_count").notNull().default(0),
    publishedCount: integer("published_count").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    cacheWriteInputTokens: integer("cache_write_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsdMicros: integer("estimated_cost_usd_micros").notNull().default(0),
    error: text("error").notNull().default(""),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at").notNull().default(""),
  },
  (table) => [
    index("ingestion_agent_runs_file_idx").on(table.fileId),
    index("ingestion_agent_runs_status_idx").on(table.status),
    index("ingestion_agent_runs_started_idx").on(table.startedAt),
  ],
);

// TelemetrÃ­a econÃ³mica del asistente. No conserva la pregunta ni la respuesta:
// solamente identidad operativa, modelo, tokens y coste estimado.
export const assistantAiRuns = sqliteTable(
  "assistant_ai_runs",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull().default(""),
    userName: text("user_name").notNull().default(""),
    mode: text("mode").notNull().default("normal"),
    status: text("status").notNull().default("running"),
    model: text("model").notNull().default(""),
    turns: integer("turns").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    cacheWriteInputTokens: integer("cache_write_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsdMicros: integer("estimated_cost_usd_micros").notNull().default(0),
    error: text("error").notNull().default(""),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at").notNull().default(""),
  },
  (table) => [
    index("assistant_ai_runs_started_idx").on(table.startedAt),
    index("assistant_ai_runs_model_idx").on(table.model),
    index("assistant_ai_runs_user_idx").on(table.userEmail),
  ],
);

export const aiUsageSettings = sqliteTable("ai_usage_settings", {
  id: text("id").primaryKey().default("global"),
  // 0 significa sin lÃ­mite. Guardamos microdÃ³lares para evitar redondeos.
  monthlyBudgetUsdMicros: integer("monthly_budget_usd_micros").notNull().default(0),
  updatedByEmail: text("updated_by_email").notNull().default(""),
  updatedByName: text("updated_by_name").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
    processingReceiptJson: text("processing_receipt_json").notNull().default(""),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    nextRetryAt: text("next_retry_at").notNull().default(""),
    lastProcessingError: text("last_processing_error").notNull().default(""),
    requiresReview: integer("requires_review", { mode: "boolean" }).notNull().default(true),
    projectId: text("project_id").notNull().default("araya"),
    documentType: text("document_type").notNull().default("documento_general"),
    detectedPeriod: text("detected_period").notNull().default(""),
    extractionMode: text("extraction_mode").notNull().default("asistida"),
    extractionConfidence: real("extraction_confidence").notNull().default(0),
    extractionSummary: text("extraction_summary").notNull().default(""),
    discrepancyCount: integer("discrepancy_count").notNull().default(0),
    ingestionVersion: text("ingestion_version").notNull().default(""),
    processedAt: text("processed_at").notNull().default(""),
    derivedFromFileId: text("derived_from_file_id").notNull().default(""),
    automationKind: text("automation_kind").notNull().default(""),
    proposalGeneration: text("proposal_generation").notNull().default(""),
    reviewStatus: text("review_status").notNull().default("pendiente_extraccion"),
    reviewedByEmail: text("reviewed_by_email").notNull().default(""),
    reviewedByName: text("reviewed_by_name").notNull().default(""),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewNote: text("review_note").notNull().default(""),
    publicationRevision: integer("publication_revision"),
    publishedAt: text("published_at").notNull().default(""),
    deletedAt: text("deleted_at").notNull().default(""),
    deletedByEmail: text("deleted_by_email").notNull().default(""),
    deletedByName: text("deleted_by_name").notNull().default(""),
    deleteReason: text("delete_reason").notNull().default(""),
    restoredAt: text("restored_at").notNull().default(""),
    restoredByEmail: text("restored_by_email").notNull().default(""),
    supersededByFileId: text("superseded_by_file_id").notNull().default(""),
    supersededAt: text("superseded_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
      index("uploaded_files_created_at_idx").on(table.createdAt),
      index("uploaded_files_created_at_id_idx").on(table.createdAt, table.id),
      index("uploaded_files_updated_at_id_idx").on(table.updatedAt, table.id),
    index("uploaded_files_area_idx").on(table.area),
    index("uploaded_files_sha256_idx").on(table.sha256),
    uniqueIndex("uploaded_files_active_sha256_idx")
      .on(table.sha256)
      .where(sql`${table.deletedAt} = ''`),
    uniqueIndex("uploaded_files_area_name_version_idx")
      .on(table.area, table.safeName, table.version),
    index("uploaded_files_deleted_at_idx").on(table.deletedAt),
    index("uploaded_files_ingestion_version_idx").on(table.ingestionVersion),
    index("uploaded_files_derived_from_idx").on(table.derivedFromFileId),
    index("uploaded_files_superseded_by_idx").on(table.supersededByFileId),
  ],
);

export const documentDataProposals = sqliteTable(
  "document_data_proposals",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull(),
    generation: text("generation").notNull().default(""),
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
    uniqueIndex("document_data_proposals_file_generation_key_idx")
      .on(table.fileId, table.generation, table.key),
    index("document_data_proposals_file_id_idx").on(table.fileId),
    index("document_data_proposals_status_idx").on(table.status),
  ],
);

export const unmappedFieldCandidates = sqliteTable(
  "unmapped_field_candidates",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    valueJson: text("value_json").notNull(),
    suggestedArea: text("suggested_area").notNull().default(""),
    evidence: text("evidence").notNull().default(""),
    confidence: real("confidence").notNull().default(0),
    status: text("status").notNull().default("pendiente"),
    reviewedByEmail: text("reviewed_by_email").notNull().default(""),
    reviewedByName: text("reviewed_by_name").notNull().default(""),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewNote: text("review_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("unmapped_field_candidates_file_id_idx").on(table.fileId),
    index("unmapped_field_candidates_status_idx").on(table.status),
    index("unmapped_field_candidates_created_at_idx").on(table.createdAt),
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
    previousReviewStatus: text("previous_review_status").notNull().default(""),
    previousUpdatedAt: text("previous_updated_at").notNull().default(""),
    claimedAt: text("claimed_at").notNull().default(""),
    leaseExpiresAt: text("lease_expires_at").notNull().default(""),
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
    financialValidationJson: text("financial_validation_json").notNull().default(""),
    monetaryAuditJson: text("monetary_audit_json").notNull().default(""),
    sourceAuthorityJson: text("source_authority_json").notNull().default(""),
    affectedViewsJson: text("affected_views_json").notNull().default(""),
    verificationJson: text("verification_json").notNull().default(""),
    status: text("status").notNull().default("published"),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("live_data_events_created_at_idx").on(table.createdAt),
    index("live_data_events_source_file_id_idx").on(table.sourceFileId),
    index("live_data_events_status_idx").on(table.status),
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
      index("live_data_history_key_id_idx").on(table.key, table.id),
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
    // Entregar un documento no concede acceso a sus cifras. Se separan las
    // tres capacidades para que el personal pueda alimentar el buzón sin
    // ampliar innecesariamente sus permisos de lectura o aprobación.
    financeUploadAccess: integer("finance_upload_access", { mode: "boolean" }).notNull().default(true),
    financeApproveAccess: integer("finance_approve_access", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    avatarStorageKey: text("avatar_storage_key").notNull().default(""),
    avatarMimeType: text("avatar_mime_type").notNull().default(""),
    avatarUpdatedAt: text("avatar_updated_at").notNull().default(""),
    pinHash: text("pin_hash").notNull().default(""),
    failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
    pinLockedUntil: text("pin_locked_until").notNull().default(""),
    createdByEmail: text("created_by_email").notNull().default(""),
    lastLoginAt: text("last_login_at").notNull().default(""),
    deletedAt: text("deleted_at").notNull().default(""),
    deletedByEmail: text("deleted_by_email").notNull().default(""),
    notificationKind: text("notification_kind").notNull().default(""),
    notificationNonce: text("notification_nonce").notNull().default(""),
    notificationActorEmail: text("notification_actor_email").notNull().default(""),
    notificationActorName: text("notification_actor_name").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("app_users_email_idx").on(table.email),
    index("app_users_active_idx").on(table.active),
    index("app_users_role_idx").on(table.role),
    index("app_users_deleted_at_idx").on(table.deletedAt),
  ],
);

export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_idx").on(table.tokenHash),
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_expires_at_idx").on(table.expiresAt),
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

export const notificationEvents = sqliteTable(
  "notification_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    projectId: text("project_id").notNull().default("araya"),
    area: text("area").notNull().default("direccion"),
    audience: text("audience").notNull().default("all"),
    actorEmail: text("actor_email").notNull().default(""),
    actorName: text("actor_name").notNull().default(""),
    subjectType: text("subject_type").notNull().default(""),
    subjectId: text("subject_id").notNull().default(""),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    view: text("view").notNull().default("resumen"),
    payloadJson: text("payload_json").notNull().default("{}"),
    fanoutStatus: text("fanout_status").notNull().default("pending"),
    fanoutClaimedAt: text("fanout_claimed_at").notNull().default(""),
    fanoutAt: text("fanout_at").notNull().default(""),
    fanoutError: text("fanout_error").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("notification_events_created_at_idx").on(table.createdAt),
    index("notification_events_audience_idx").on(table.audience),
    index("notification_events_area_idx").on(table.area),
    index("notification_events_fanout_idx").on(table.fanoutStatus, table.fanoutClaimedAt),
  ],
);

export const notificationReads = sqliteTable(
  "notification_reads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notificationId: integer("notification_id").notNull(),
    userEmail: text("user_email").notNull(),
    readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    openedAt: text("opened_at").notNull().default(""),
  },
  (table) => [
    uniqueIndex("notification_reads_event_user_idx").on(table.notificationId, table.userEmail),
    index("notification_reads_user_idx").on(table.userEmail),
  ],
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notificationId: integer("notification_id").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: text("next_attempt_at").notNull().default(""),
    claimedAt: text("claimed_at").notNull().default(""),
    deliveredAt: text("delivered_at").notNull().default(""),
    lastError: text("last_error").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("notification_deliveries_event_subscription_idx").on(
      table.notificationId,
      table.subscriptionId,
    ),
    index("notification_deliveries_status_next_idx").on(table.status, table.nextAttemptAt),
    index("notification_deliveries_event_idx").on(table.notificationId),
  ],
);

export const userPresence = sqliteTable(
  "user_presence",
  {
    sessionId: text("session_id").primaryKey(),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull().default(""),
    deviceId: text("device_id").notNull().default(""),
    platform: text("platform").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    connectedAt: text("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("user_presence_email_idx").on(table.userEmail),
    index("user_presence_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: text("expiration_time").notNull().default(""),
    platform: text("platform").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    failureCount: integer("failure_count").notNull().default(0),
    lastSuccessAt: text("last_success_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userEmail),
    index("push_subscriptions_active_idx").on(table.active),
  ],
);

export const controlActions = sqliteTable(
  "control_actions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    area: text("area").notNull().default("direccion"),
    relatedView: text("related_view").notNull().default("resumen"),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    assigneeEmail: text("assignee_email").notNull().default(""),
    assigneeName: text("assignee_name").notNull().default(""),
    dueDate: text("due_date").notNull().default(""),
    sourceFileId: text("source_file_id").notNull().default(""),
    requestKey: text("request_key").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    notificationNonce: text("notification_nonce").notNull().default(""),
    notificationActorEmail: text("notification_actor_email").notNull().default(""),
    notificationActorName: text("notification_actor_name").notNull().default(""),
    completedAt: text("completed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("control_actions_request_key_idx").on(table.requestKey),
    index("control_actions_area_idx").on(table.area),
    index("control_actions_status_idx").on(table.status),
    index("control_actions_assignee_email_idx").on(table.assigneeEmail),
    index("control_actions_due_date_idx").on(table.dueDate),
  ],
);

export const controlActionActivity = sqliteTable(
  "control_action_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actionId: text("action_id").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull().default(""),
    requestKey: text("request_key").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("control_action_activity_request_key_idx").on(table.requestKey),
    index("control_action_activity_action_id_idx").on(table.actionId),
    index("control_action_activity_created_at_idx").on(table.createdAt),
  ],
);

export const reportSnapshots = sqliteTable(
  "report_snapshots",
  {
    id: text("id").primaryKey(),
    frequency: text("frequency").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    label: text("label").notNull(),
    currency: text("currency").notNull().default("USD"),
    liveRevision: integer("live_revision").notNull().default(0),
    cutoff: text("cutoff").notNull().default(""),
    snapshotJson: text("snapshot_json").notNull(),
    includesFinance: integer("includes_finance", { mode: "boolean" }).notNull().default(false),
    reportType: text("report_type").notNull().default("global"),
    requestKey: text("request_key").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("report_snapshots_request_key_idx").on(table.requestKey),
    index("report_snapshots_created_at_idx").on(table.createdAt),
    index("report_snapshots_frequency_idx").on(table.frequency),
  ],
);


/**
 * Tokens de carga automática.
 *
 * Permiten que un equipo de la oficina envíe un archivo sin que nadie inicie
 * sesión —el caso que los motiva es el corte mensual saliendo solo desde
 * Microsoft Project—, y a diferencia de los de TV, éstos escriben.
 *
 * Por eso llevan `ownerEmail`: la carga se atribuye a esa persona y el
 * expediente tiene un responsable con nombre y apellidos en la auditoría, igual
 * que si lo hubiera subido a mano. El token no es un usuario ni tiene permisos
 * propios; hereda los de quien lo emitió, incluido el acceso financiero, así
 * que revocar o desactivar a esa persona lo inutiliza.
 */
export const uploadAgentTokens = sqliteTable(
  "upload_agent_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    label: text("label").notNull().default(""),
    ownerEmail: text("owner_email").notNull(),
    createdByEmail: text("created_by_email").notNull().default(""),
    createdByName: text("created_by_name").notNull().default(""),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at").notNull().default(""),
    lastUsedAt: text("last_used_at").notNull().default(""),
    useCount: integer("use_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("upload_agent_tokens_token_hash_idx").on(table.tokenHash),
    index("upload_agent_tokens_owner_idx").on(table.ownerEmail),
  ],
);

export const tvDeviceTokens = sqliteTable(
  "tv_device_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    label: text("label").notNull().default(""),
    createdByEmail: text("created_by_email").notNull().default(""),
    createdByName: text("created_by_name").notNull().default(""),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at").notNull().default(""),
    lastUsedAt: text("last_used_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("tv_device_tokens_token_hash_idx").on(table.tokenHash),
  ],
);

/**
 * Instantánea semanal del avance para el resumen automático.
 *
 * Cada envío del resumen guarda aquí una foto —avance global, avance por
 * edificio y documentos subidos—, y el envío siguiente compara contra la última
 * para contar la variación de la semana ("TH-07 subió 4 puntos"). Sin esta foto
 * no habría con qué comparar: el modelo vivo sólo sabe cómo están las cosas
 * ahora, no cómo estaban el lunes pasado.
 */
export const weeklySummarySnapshots = sqliteTable(
  "weekly_summary_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    overallProgress: real("overall_progress").notNull().default(0),
    // JSON { "TH-14": 30.6, ... } con el avance de cada edificio en la foto.
    buildingsJson: text("buildings_json").notNull().default("{}"),
    documentsCount: integer("documents_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("weekly_summary_snapshots_created_at_idx").on(table.createdAt),
  ],
);
