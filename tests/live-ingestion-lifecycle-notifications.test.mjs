import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as liveDataModule from "../lib/live-data.ts";

const read = (path) => readFile(path, "utf8");

async function loadNotificationVisibility() {
  const source = await read("lib/notifications.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const schemaStub = new Proxy({}, { get: () => ({}) });
  const require = (specifier) => {
    if (specifier === "../db") return { getDb: () => { throw new Error("DB not used"); } };
    if (specifier === "drizzle-orm") return { and: () => ({}), eq: () => ({}) };
    if (specifier === "@block65/webcrypto-web-push") return { buildPushPayload: () => ({}) };
    if (specifier === "../db/schema") return schemaStub;
    if (specifier === "./live-data") return liveDataModule;
    if (specifier === "./notification-preferences") return { preferenceAllowsPush: async () => true };
    throw new Error(`Unexpected import: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    JSON,
    Map,
    Promise,
  });
  return compiledModule.exports.notificationVisibleToUser;
}

const [
  filesRoute,
  fileReviewRoute,
  aiExtraction,
  liveDataContract,
  publishLiveData,
  lifecycleRoute,
  lifecycle,
  schema,
  migration,
  migrationJournal,
  uploadConstraintMigration,
  reviewLeaseMigration,
  generationAndOutboxMigration,
  mutationNotificationMigration,
  uploadCommitRecovery,
  notifications,
  notificationsRoute,
  presenceRoute,
  pushConfigRoute,
  pushSubscriptionRoute,
  serviceWorker,
  dashboardClient,
  liveData,
  documentAccess,
  controlRoomRoute,
  historyRoute,
  agentRoute,
] = await Promise.all([
  read("app/api/files/route.ts"),
  read("app/api/files/review/route.ts"),
  read("lib/ai-document-extraction.ts"),
  read("lib/live-data-contract.ts"),
  read("lib/publish-live-data.ts"),
  read("app/api/files/lifecycle/route.ts"),
  read("lib/file-lifecycle.ts"),
  read("db/schema.ts"),
  read("drizzle/0009_complex_stick.sql"),
  read("drizzle/meta/_journal.json"),
  read("drizzle/0012_natural_madelyne_pryor.sql"),
  read("drizzle/0013_nebulous_pete_wisdom.sql"),
  read("drizzle/0014_round_shape.sql"),
  read("drizzle/0015_purple_stark_industries.sql"),
  read("lib/upload-commit-recovery.ts"),
  read("lib/notifications.ts"),
  read("app/api/notifications/route.ts"),
  read("app/api/presence/route.ts"),
  read("app/api/push/config/route.ts"),
  read("app/api/push/subscription/route.ts"),
  read("public/sw.js"),
  read("app/dashboard-client.tsx"),
  read("lib/live-data.ts"),
  read("lib/document-access.ts"),
  read("app/api/control-room/route.ts"),
  read("app/api/history/route.ts"),
  read("app/api/agent/route.ts"),
]);

function expectPatterns(source, patterns, label) {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${label}: falta ${pattern}`);
  }
}

test("multiformat ingestion publishes valid facts and closes isolated diagnostics", () => {
  expectPatterns(filesRoute, [
    /import \{[\s\S]*?canAutomaticallyPublishExtraction,[\s\S]*?extractDocumentWithAI,[\s\S]*?\} from ["']\.\.\/\.\.\/\.\.\/lib\/ai-document-extraction["'];/,
    /const allowedExtensions = new Set\(\[[\s\S]*?["']pdf["'][\s\S]*?["']pptx["'][\s\S]*?["']xlsx["'][\s\S]*?["']png["'][\s\S]*?\]\);/,
    /extractStructuredUpdates\(bytes, extension,/,
    // El lector determinista manda; la IA se ejecuta también cuando la lectura
    // de un documento narrativo fue sólo parcial, y complementa los huecos.
    /const lecturaParcial = deterministicExtraction\.updates\.length > 0 && documentoNarrativo;/,
    /if \(documentoNarrativo && \(!deterministicExtraction\.updates\.length \|\| lecturaParcial\) && !aiBudget\.blocked\) \{[\s\S]*?for \(const document of documentosNarrativos\)[\s\S]*?extractDocumentWithAI\(/,
    /const clavesDeterministas = deterministicExtraction\.updates\.map\(\(update\) => update\.key\);/,
    // La IA no puede aportar una lista entera cuando el lector ya emite una hija
    // suya (collectionTargets vs collectionTargets\.0\.targetUsd): choca en la
    // publicación, así que se descarta por antepasada/descendiente, no sólo por
    // clave idéntica.
    /clave\.startsWith\(`\$\{aiKey\}\.`\) \|\|\s*aiKey\.startsWith\(`\$\{clave\}\.`\)/,
    /\.filter\(\(\{ update, confianza \}\) =>\s*!complementoChocaConLector\(update\.key\) && Number\.isFinite\(confianza\) && confianza > 0\)/,
    /apiKey: process\.env\.OPENAI_API_KEY \?\? ["']["']/,
    /extractionMode: extraction\.model === ["']deterministic["'][\s\S]*?["']openai_responses["']/,
    /automaticPublicationRequested &&/,
    /canAutomaticallyPublishExtraction\(/,
    /updateConfidences: normalizedUpdateConfidences/,
    /normalizedUpdates\.length > 0/,
    /resolvedArea !== ["']sin_clasificar["']/,
    /publicationActor\.financeAccess \|\| !isFinancialLiveKey\(update\.key\)/,
    /isSafeAutomaticStructuredUpdate\(update\)/,
    // La confianza se vuelve a enlazar por clave+valor después de normalizar;
    // un dato descartado o reordenado no desplaza la confianza de los demás.
    /resolveNormalizedUpdateConfidences\(/,
    /updateCount: normalizedUpdateConfidences\.length/,
    /partitionChangedLiveUpdates\(/,
    /const batchPreconditions =/,
    /const updateIsAutoPublishable = /,
    /normalizedUpdates\.filter\(updateIsAutoPublishable\)/,
    /status: ["']descartado_automatico["']/,
    /publishLiveDataUpdates\(/,
    /reviewClosure: \{[\s\S]*?mode: ["']insert["'][\s\S]*?completedAction: ["']aprobado_automatico["']/,
  ], "files route");

  expectPatterns(aiExtraction, [
    /const IMAGE_EXTENSIONS = new Set\(\[["']jpg["'], ["']jpeg["'], ["']png["']\]\)/,
    /const FILE_EXTENSIONS = new Set\(\[[\s\S]*?["']pdf["'][\s\S]*?["']xls["'][\s\S]*?["']xlsx["'][\s\S]*?["']pptx["'][\s\S]*?["']docx["'][\s\S]*?["']csv["'][\s\S]*?["']json["']/,
    /type: ["']input_image["']/,
    /type: ["']input_file["']/,
    /formData\.append\(["']purpose["'], ["']user_data["']\)/,
    /method: ["']DELETE["']/,
    /finally \{/,
    /isLiveDataKey\(key\)/,
    /JSON\.parse\(candidate\.value_json\)/,
    /text: \{[\s\S]*?format: \{[\s\S]*?type: ["']json_schema["'][\s\S]*?strict: true/,
    /safety_identifier: SAFETY_IDENTIFIER/,
    /input\.updateConfidences\.every\(\(confidence\) =>[\s\S]*?confidence > 0/,
  ], "AI extraction");
});

test("upload quarantine, idempotent resume and automatic runtime contracts fail closed", () => {
  expectPatterns(filesRoute, [
    /const PROVISIONAL_DOCUMENT_TYPE = ["']clasificacion_pendiente["']/,
    /const EXTRACTION_LEASE_MS = 5 \* 60 \* 1_000/,
    /processingStage: ["']extraccion_en_curso["']/,
    /eq\(uploadedFiles\.updatedAt, duplicate\.updatedAt\)/,
    /resumedRow = claimedRow/,
    /extractionGeneration = `ingest:\$\{crypto\.randomUUID\(\)\}`/,
    /generation: extractionGeneration/,
    /proposalGeneration: extractionGeneration/,
    /uploadInsertWasCommitted\(/,
    /proposalPointerWasCommitted\(/,
    /scheduleNotificationDispatch\(\)/,
    /const affirmativeContentClassification = extractedUpdates\.length > 0/,
    /resolvedDocumentType = PROVISIONAL_DOCUMENT_TYPE;[\s\S]*?financeProtectedUpload = true;[\s\S]*?protectionResolved = false/,
    /financeProtectedUpload && !user\.financeAccess/,
    // Se le pasan además las colecciones de partida para poder traducir a
    // posición el nombre de una entidad en cualquier lista, no sólo en las
    // espaciales: las económicas no tienen id y sólo se distinguen por nombre.
    /resolveSpatialIdentityUpdates\(\s*extraction\.updates,\s*currentLiveData\.values,\s*getContractRootsSnapshot\(\),?\s*\)/,
    /const liveValues = currentLiveData\?\.values \?\? \{\}/,
    /automaticContractIsSafe\(normalizedUpdates, liveValues\)/,
    /individualUpdateContractIsSafe\(update, liveValues\)/,
    /!\[["']__proto__["'], ["']constructor["'], ["']prototype["']\]\.includes\(key\)/,
    // Reproceso pedido a propósito: un expediente ya publicado vuelve a pasar
    // por la ingesta actual (misma fila, revisión nueva) con una clave
    // idempotente propia para no chocar con el cierre `auto:${id}` anterior.
    /const reprocessRequested = formData\.get\(["']reprocess["']\) === ["']true["']/,
    /const canReprocess = reprocessRequested &&[\s\S]*?duplicate\.status !== ["']rechazado["']/,
    /reprocessing = !canResume && duplicate\.publicationRevision !== null/,
    /requestKey: reprocessing \? `auto:\$\{id\}:\$\{extractionGeneration\}` : `auto:\$\{id\}`/,
    // Una clave que no encaja en el modelo no tumba toda la ingesta automática:
    // se normaliza dato a dato y se descartan sólo los que fallan.
    /function normalizeIngestedUpdatesResilient\(/,
    /return \{ normalized: normalizeLiveDataUpdates\(\{ updates, \.\.\.context \}\), descartadas: 0 \}/,
    /normalized\.push\(\.\.\.normalizeLiveDataUpdates\(\{ updates: \[update\], \.\.\.context \}\)\)/,
    /const extractedUpdates = sinChoques\.resueltas/,
    // Norma estructural: el choque lista/fila y los duplicados se resuelven con
    // el mismo detector que usa la publicación, antes de publicar, quedándose
    // con la representación más específica. Así nunca llegan a la publicación.
    /const sinChoques = resolvePublicationKeyConflicts\(normalizacion\.normalized\)/,
    /const conflict = publicationKeyConflict\(vigentes\.map\(\(update\) => update\.key\)\)/,
    /vigentes = vigentes\.filter\(\(update\) => update\.key !== conflict\.ancestor\)/,
  ], "files route quarantine");

  expectPatterns(mutationNotificationMigration, [
    /CREATE TRIGGER `notify_uploaded_file_received`[\s\S]*?'direccion', 'admin'/,
    /CREATE TRIGGER `notify_uploaded_file_observed`[\s\S]*?'direccion', 'admin'/,
    /CREATE TRIGGER `notify_uploaded_file_classified`/,
  ], "trigger-owned upload notifications");

  expectPatterns(liveDataContract, [
    /buildDashboardBootstrap\(true\)/,
    /Object\.hasOwn\(current, segment\)/,
    /index > currentArray\.length/,
    /const earlierGap = [\s\S]*?\.some\(\(item\) => item == null\)/,
    /typeof expected === ["']number["'][\s\S]*?typeof actual === ["']number["']/,
    /const optionalFields = OPTIONAL_OBJECT_FIELDS\[path\.join\(["']\.\s*["']\)\] \?\? \{\}/,
    /!expectedKeys\.every\(\(key\) => Object\.hasOwn\(actual, key\)\)/,
    /PERCENT_FIELD[\s\S]*?actual < 0 \|\| actual > 100/,
    /DATE_FIELD[\s\S]*?validIsoDate/,
    /export function assertLiveDataContract/,
    /FORBIDDEN_SEGMENTS/,
    /export function matchesAutomaticLiveDataContract/,
  ], "automatic contract");

  expectPatterns(uploadConstraintMigration, [
    /CREATE UNIQUE INDEX `uploaded_files_active_sha256_idx`[\s\S]*?WHERE [^;]+["'`]deleted_at["'`][^;]+''/,
    /CREATE UNIQUE INDEX `uploaded_files_area_name_version_idx`/,
  ], "upload constraint migration");
  expectPatterns(generationAndOutboxMigration, [
    /ALTER TABLE `document_data_proposals` ADD `generation`/,
    /CREATE UNIQUE INDEX `document_data_proposals_file_generation_key_idx`/,
    /ALTER TABLE `uploaded_files` ADD `proposal_generation`/,
  ], "proposal generation migration");
  expectPatterns(uploadCommitRecovery, [
    /export function uploadInsertWasCommitted/,
    /input\.row\.storageKey === input\.storageKey/,
    /export function proposalPointerWasCommitted/,
    /export function stagedGenerationMayBeDeleted/,
  ], "ambiguous commit recovery");
  assert.match(migrationJournal, /"idx": 12[\s\S]*?"tag": "0012_natural_madelyne_pryor"/);
  assert.match(migrationJournal, /"idx": 14[\s\S]*?"tag": "0014_round_shape"/);
});

test("review decisions reserve, CAS, recover stale leases and reuse client request keys", () => {
  expectPatterns(fileReviewRoute, [
    /const REVIEW_ACTIONS = \[[\s\S]*?["']prepare["'][\s\S]*?["']approve["'][\s\S]*?["']reopen["']/,
    /onConflictDoNothing\(\{ target: fileReviews\.requestKey \}\)/,
    /reviewStatus: processingAction[\s\S]*?eq\(uploadedFiles\.reviewStatus, file\.reviewStatus\)[\s\S]*?eq\(uploadedFiles\.updatedAt, file\.updatedAt\)/,
    /leaseExpiresAt = new Date\(Date\.now\(\) \+ 5 \* 60 \* 1_000\)/,
    /file\.reviewStatus\.startsWith\(["']procesando_["']\)/,
    /previousReviewStatus: file\.reviewStatus/,
    /previousUpdatedAt: file\.updatedAt/,
    /Date\.parse\(claim!\.leaseExpiresAt\) <= Date\.now\(\)/,
    /async function commitReviewDecision/,
    /await database\.batch\(statements\)/,
    /generation: requestKey/,
    /proposal_generation = \?/,
    /expectedProposalGeneration: requestKey/,
    /invisible staged generation is intentionally retained/,
    /reviewClosure: \{[\s\S]*?mode: ["']reservation["'][\s\S]*?proposalGeneration: file\.proposalGeneration/,
    /if \(committedState\)[\s\S]*?Reintenta con la misma clave idempotente/,
  ], "review concurrency");
  expectPatterns(dashboardClient, [
    /const reviewRequestKeys = useRef/,
    /reviewRequestKeys\.current\[action\] \?\? crypto\.randomUUID\(\)/,
    /requestKey,/,
    /delete reviewRequestKeys\.current\[action\]/,
  ], "client review idempotency");
  expectPatterns(reviewLeaseMigration, [
    /ALTER TABLE `file_reviews` ADD `previous_review_status`/,
    /ALTER TABLE `file_reviews` ADD `previous_updated_at`/,
    /ALTER TABLE `file_reviews` ADD `claimed_at`/,
    /ALTER TABLE `file_reviews` ADD `lease_expires_at`/,
  ], "review lease migration");
  assert.match(migrationJournal, /"idx": 13[\s\S]*?"tag": "0013_nebulous_pete_wisdom"/);
});

test("deleted source files cannot be reviewed or rematerialized, including a delete race", () => {
  expectPatterns(fileReviewRoute, [
    /if \(file\.deletedAt\) \{[\s\S]*?status: 410/,
    /UPDATE uploaded_files SET \$\{input\.fileSetSql\}[\s\S]*?deleted_at = '' AND review_status = \? AND updated_at = \?/,
    /failedReviewInvariant\([\s\S]*?uploaded_files[\s\S]*?deleted_at = ''[\s\S]*?review_status = \?[\s\S]*?updated_at = \?/,
  ], "file review route");

  expectPatterns(publishLiveData, [
    /fileRows\.length !== linkedFileIds\.length/,
    /fileRows\.find\(\(file\) => file\.deletedAt !== ["']{2}\)/,
    /WITH files AS \([\s\S]*?FROM json_each\(\?\)[\s\S]*?UPDATE uploaded_files AS file[\s\S]*?file\.deleted_at = ''[\s\S]*?file\.publication_revision IS files\.expectedRevision[\s\S]*?file\.updated_at = files\.expectedUpdatedAt/,
    /failedInvariantStatement\([\s\S]*?uploaded_files[\s\S]*?publication_revision = \?/,
    /await database\.batch\(atomicStatements\)/,
    /settleFailedPreparingEvent\(event\.id\)/,
  ], "live data publication");
});

test("a 250-value publication stays inside the bounded D1 transaction contract", () => {
  expectPatterns(publishLiveData, [
    /const MAX_UPDATES = 250/,
    /const MAX_ATOMIC_PUBLICATION_STATEMENTS = 20/,
    /return hasReviewClosure \? 15 : 10/,
    /INSERT INTO live_data_history[\s\S]*?FROM json_each\(\?\) AS item/,
    /WITH updates AS \([\s\S]*?FROM json_each\(\?\) AS item[\s\S]*?UPDATE live_data_points AS point/,
    /atomicStatements\.length !== expectedAtomicPublicationStatementCount\(Boolean\(input\.reviewClosure\)\)/,
  ], "bounded publication");
  assert.doesNotMatch(
    publishLiveData,
    /for \(const update of input\.normalized\)/,
    "250 updates must not create one D1 statement per value",
  );
  assert.ok(
    publishLiveData.indexOf('assertBoundedAtomicJson("La publicaci') <
      publishLiveData.indexOf(".insert(liveDataEvents)"),
    "oversized payloads must fail before reserving a preparing event",
  );
});

test("soft delete and restore recompute live points while preserving R2 and history", () => {
  expectPatterns(lifecycleRoute, [
    /type LifecyclePayload = \{[\s\S]*?action\?: FileLifecycleAction/,
    /action !== ["']delete["'] && action !== ["']restore["']/,
    /auth\.user\.role !== ["']admin["'] && !isUploader/,
    /const protectedFile = requiresFinanceAccessForDocument\(file\.area, file\.documentType\)/,
    /if \(protectedFile && !auth\.user\.financeAccess\)/,
    /applyFileLifecycle\(/,
  ], "lifecycle route");
  assert.doesNotMatch(lifecycleRoute, /emitNotification\(/, "la notificaciÃ³n debe estar en el batch atÃ³mico");

  expectPatterns(lifecycle, [
    /export type FileLifecycleAction = ["']delete["'] \| ["']restore["']/,
    /selectDistinct\(\{ key: liveDataHistory\.key \}\)/,
    /linkedFileDeletedAt: uploadedFiles\.deletedAt/,
    /action === ["']restore["']/,
    /decideFileLifecycleRetry\(/,
    /UPDATE uploaded_files[\s\S]*?deleted_at = \?[\s\S]*?updated_at = \?/,
    /failedInvariantStatement\([\s\S]*?uploaded_files/,
    /DELETE FROM live_data_points AS point[\s\S]*?FROM json_each\(\?\) AS item/,
    /WITH changes AS \([\s\S]*?FROM json_each\(\?\) AS item[\s\S]*?UPDATE live_data_points AS point/,
    /INSERT OR IGNORE INTO live_data_points[\s\S]*?FROM json_each\(\?\) AS item/,
    /EXPECTED_ATOMIC_LIFECYCLE_STATEMENTS = 11/,
    /atomicStatements\.length !== EXPECTED_ATOMIC_LIFECYCLE_STATEMENTS/,
    /db\s*\.insert\(liveDataEvents\)/,
    /INSERT INTO file_activity/,
    /INSERT INTO notification_events/,
    /await database\.batch\(atomicStatements\)/,
    /settleFailedLifecycleEvent\(event\.id\)/,
  ], "file lifecycle");

  assert.doesNotMatch(lifecycle, /db\.delete\(liveDataHistory\)/, "el historial no debe borrarse");
  assert.doesNotMatch(lifecycle, /db\.delete\(liveDataEvents\)/, "los eventos no deben borrarse");
  assert.doesNotMatch(lifecycle, /db\.delete\(uploadedFiles\)/, "el registro debe ser soft-delete");
  assert.doesNotMatch(lifecycle, /getFileBucket|storageKey|bucket\.delete|\.FILES\b/, "el ciclo no debe borrar R2");
  assert.doesNotMatch(lifecycle, /for \(const key of affectedKeys\)/, "la recomputación debe ser set-based y acotada");
});

test("migration 0009 and Drizzle schema contain lifecycle, notifications, presence and push", () => {
  expectPatterns(migration, [
    /CREATE TABLE `notification_events`/,
    /CREATE TABLE `notification_reads`/,
    /CREATE TABLE `push_subscriptions`/,
    /CREATE TABLE `user_presence`/,
    /ALTER TABLE `uploaded_files` ADD `deleted_at`/,
    /ALTER TABLE `uploaded_files` ADD `deleted_by_email`/,
    /ALTER TABLE `uploaded_files` ADD `delete_reason`/,
    /ALTER TABLE `uploaded_files` ADD `restored_at`/,
    /ALTER TABLE `uploaded_files` ADD `restored_by_email`/,
    /CREATE INDEX `uploaded_files_deleted_at_idx`/,
  ], "migration 0009");
  expectPatterns(schema, [
    /export const notificationEvents = sqliteTable\(/,
    /export const notificationReads = sqliteTable\(/,
    /export const notificationDeliveries = sqliteTable\(/,
    /export const userPresence = sqliteTable\(/,
    /export const pushSubscriptions = sqliteTable\(/,
    /deletedAt: text\(["']deleted_at["']\)/,
    /restoredAt: text\(["']restored_at["']\)/,
    /uniqueIndex\(["']notification_reads_event_user_idx["']\)/,
    /uniqueIndex\(["']notification_deliveries_event_subscription_idx["']\)/,
    /uniqueIndex\(["']push_subscriptions_endpoint_idx["']\)/,
  ], "Drizzle schema");
  assert.match(migrationJournal, /"idx": 9[\s\S]*?"tag": "0009_complex_stick"/);
});

test("notification, presence and push routes are authenticated and durable", () => {
  expectPatterns(notifications, [
    /export async function emitNotification/,
    /insert\(notificationEvents\)/,
    /deliverPushNotification\(event\)\.catch/,
    /notificationVisibleToUser/,
    /!user\.financeAccess && \([\s\S]*?requiresFinanceAccessForArea\(eventArea\)[\s\S]*?audience === ["']finance["'][\s\S]*?requiresFinanceAccessForArea\(audienceArea\)/,
    /buildPushPayload\(/,
    /insert\(notificationDeliveries\)/,
    /export async function dispatchPendingNotifications/,
    /deliverPushDelivery\(delivery\.id\)/,
    /notificationVisibleToUser\(event/,
    /response\.status === 404 \|\| response\.status === 410/,
  ], "notifications service");

  expectPatterns(notificationsRoute, [
    /export async function GET\(request: Request\)/,
    /export async function PATCH\(request: Request\)/,
    /requireApiUser\(\)/,
    /dispatchPendingNotifications\(5\)/,
    /notificationVisibleToUser\(row, auth\.user\)/,
    /upsertNotificationReceiptRows\(/,
    /encodeBoundedJsonArray\(uniqueIds/,
    /Cache-Control["'], ["']private, no-store/,
  ], "notifications route");

  expectPatterns(presenceRoute, [
    /export async function POST\(request: Request\)/,
    /requireApiUser\(\)/,
    /const ACTIVE_WINDOW_MS = 90_000/,
    /insert\(userPresence\)/,
    /onConflictDoUpdate/,
    /if \(becameActive\) scheduleNotificationDispatch\(\)/,
  ], "presence route");
  expectPatterns(mutationNotificationMigration, [
    /CREATE TRIGGER `notify_user_presence_connected`[\s\S]*?'user_connected'[\s\S]*?'direccion', 'all'/,
    /CREATE TRIGGER `notify_user_presence_reconnected`[\s\S]*?NEW\.`connected_at` <> OLD\.`connected_at`/,
  ], "presence notification triggers");

  expectPatterns(pushConfigRoute, [
    /export async function GET\(\)/,
    /requireApiUser\(\)/,
    /VAPID_PUBLIC_KEY/,
    /enabled/,
  ], "push config route");

  expectPatterns(pushSubscriptionRoute, [
    /export async function POST\(request: Request\)/,
    /export async function DELETE\(request: Request\)/,
    /requireApiUser\(\)/,
    /safePushEndpoint\(/,
    /url\.protocol !== ["']https:["']/,
    /base64UrlByteLength\(p256dh\) !== 65/,
    /base64UrlByteLength\(authKey\) !== 16/,
    /insert\(pushSubscriptions\)/,
    /target: pushSubscriptions\.endpoint/,
    /active: false/,
  ], "push subscription route");
});

test("notification dispatch cannot be starved by future retries or protected history", () => {
  const now = "2026-08-11T10:00:00.000Z";
  const staleBefore = "2026-08-11T09:58:00.000Z";
  const futureRetries = Array.from({ length: 250 }, (_, index) => ({
    id: index + 1,
    status: "retry",
    nextAttemptAt: "2026-08-12T10:00:00.000Z",
    claimedAt: "",
  }));
  const pending = {
    id: 251,
    status: "pending",
    nextAttemptAt: "",
    claimedAt: "",
  };
  const eligible = [...futureRetries, pending]
    .filter((delivery) => delivery.status === "pending" ||
      (delivery.status === "retry" && (!delivery.nextAttemptAt || delivery.nextAttemptAt <= now)) ||
      (delivery.status === "processing" && delivery.claimedAt <= staleBefore))
    .slice(0, 20);
  assert.deepEqual(eligible.map((delivery) => delivery.id), [pending.id]);

  expectPatterns(notifications, [
    /function dispatchableDeliveryCondition\(now: string, staleBefore: string\)/,
    /nextAttemptAt\} <= \$\{now\}/,
    /claimedAt\} <= \$\{staleBefore\}/,
    /\.where\(dispatchableDeliveryCondition\(now, staleBefore\)\)[\s\S]*?\.orderBy\(dispatchableDeliveryOrder\(\), asc\(notificationDeliveries\.id\)\)[\s\S]*?\.limit\(boundedLimit\)/,
  ], "due-first notification dispatcher");
  assert.doesNotMatch(
    notifications,
    /const candidates = await getDb\(\)[\s\S]*?\.limit\([\s\S]*?const eligible = candidates\.filter/,
    "future retries must be excluded before the bounded SQL window",
  );
  expectPatterns(notificationsRoute, [
    /const visibilityWhere = notificationVisibilityWhere\(auth\.user\)/,
    /\.where\(and\(gt\(notificationEvents\.id, afterId\), visibilityWhere\)\)/,
    /\.where\(visibilityWhere\)[\s\S]*?\.limit\(limit\)/,
  ], "visibility-aware notification history query");
});

test("connection notices remain visible to every authorized area", async () => {
  const notificationVisibleToUser = await loadNotificationVisibility();
  const connectionEvent = { audience: "all", area: "direccion" };
  const obraUser = {
    email: "obra@example.com",
    role: "member",
    area: "obra",
    financeAccess: false,
  };
  assert.equal(notificationVisibleToUser(connectionEvent, obraUser), true);
  assert.equal(notificationVisibleToUser({
    audience: "area:finanzas",
    area: "direccion",
  }, { ...obraUser, area: "finanzas" }), false);
  assert.equal(notificationVisibleToUser({
    audience: "all",
    area: "ventas",
  }, obraUser), false);
});

test("Ventas y cobranza shares the fail-closed finance permission on every server boundary", () => {
  expectPatterns(liveData, [
    /const financeProtectedAreas = new Set\(\[[\s\S]*?["']finanzas["'][\s\S]*?["']comercial["']/,
    /const commercialRootSet = new Set\(\[[\s\S]*?["']arrearsBreakdown["'][\s\S]*?["']salesLocations["'][\s\S]*?["']salesModels["']/,
    /export function isCommercialLiveKey/,
    /juneReport\\\.\(\?:sales\|contracts\|collections\)/,
    /delete record\.sales/,
    /delete record\.contracts/,
    /delete record\.collections/,
    /export function requiresFinanceAccessForArea/,
  ], "live data privacy");

  expectPatterns(documentAccess, [
    /informe-ventas-araya-junio-2026\.pptx/,
    /araya-informe-junio-2026\.pptx/,
    /presentacion-informe-araya-junio-2026\.pdf/,
    /comercial\|ventas\?\|cobranza\|morosidad\|reservas\?/,
  ], "document access");

  expectPatterns(filesRoute, [
    /function fileRequiresFinanceAccess/,
    /requiresFinanceAccessForDocument\(row\.area, row\.documentType\)/,
    /initiallyProtectedUpload = requiresFinanceAccessForDocument/,
    /scheduleNotificationDispatch\(\)/,
  ], "files privacy");
  expectPatterns(mutationNotificationMigration, [
    /CREATE TRIGGER `notify_uploaded_file_classified`[\s\S]*?THEN 'finance' ELSE 'all'/,
  ], "classified file notification privacy");

  expectPatterns(fileReviewRoute, [
    /function fileRequiresFinanceAccess/,
    /const nextFileProtected = requiresFinanceAccessForDocument\(nextArea, nextDocumentType\)/,
    /scheduleNotificationDispatch\(\)/,
  ], "review privacy");
  expectPatterns(mutationNotificationMigration, [
    /CREATE TRIGGER `notify_file_review_decision_updated`[\s\S]*?NEW\.`publication_revision` IS NULL/,
    /THEN 'finance' ELSE 'area'/,
  ], "review notification privacy");

  expectPatterns(publishLiveData, [
    /const protectedUpdate = input\.normalized\.find/,
    /input\.actor\.financeAccess !== true/,
    /audience: publicationProtected \? ["']finance["'] : ["']all["']/,
  ], "publication privacy");

  expectPatterns(controlRoomRoute, [
    /function visibleFile/,
    /readEffectiveLiveData\(auth\.financeAccess\)/,
    /requiresFinanceAccessForArea\(area\)/,
    /\["metricas", "comercial"\]\.includes\(relatedView\)/,
  ], "control room privacy");

  expectPatterns(historyRoute, [
    /requiresFinanceAccessForDocument\(row\.area, row\.documentType\)/,
    /readPublishedLiveDataHistory\(auth\.user\.financeAccess\)/,
  ], "history privacy");

  expectPatterns(agentRoute, [
    /if \(!canAccessFinance\) return \{ error: ["']Acceso financiero y comercial no autorizado\./,
    /comercial\|ventas\?\|reservas\?\|cobranza\|morosidad/,
  ], "agent privacy");

  expectPatterns(dashboardClient, [
    /view === ["']comercial["'][\s\S]*?currentUser\.financeAccess[\s\S]*?<FinanceLockedView/,
    /\["metricas", "comercial"\]\.includes\(item\.id\)/,
  ], "client navigation privacy");
});

// Un servidor sin claves VAPID configuradas se comportaba igual que uno
// correcto: /api/push/config devolvía enabled:false, el cliente se rendía en
// silencio y el panel seguía anunciando "Activadas · ACTIVO" porque solo
// miraba el permiso del navegador. El usuario veía todo en verde y no le
// llegaba nada al teléfono. La capacidad del servidor y el permiso del
// dispositivo son cosas distintas y deben mostrarse por separado.
test("push readiness distinguishes device permission from server capability", async () => {
  const [dashboard, deviceCenter] = await Promise.all([
    read("app/dashboard-client.tsx"),
    read("app/device-center.tsx"),
  ]);

  // El cliente registra si el servidor puede enviar, no solo si hay suscripción.
  expectPatterns(dashboard, [
    /const \[pushServerConfigured, setPushServerConfigured\] = useState<boolean \| null>\(null\)/,
    /setPushServerConfigured\(serverReady\)/,
    /pushServerConfigured=\{pushServerConfigured\}/,
  ], "client push server capability");

  // Y el panel lo muestra en vez de anunciar ACTIVO sin matices.
  expectPatterns(deviceCenter, [
    /pushServerConfigured: boolean \| null/,
    /const pushBlockedOnServer = notificationPermission === "granted" && pushServerConfigured === false/,
    /pushBlockedOnServer \? "LIMITADO"/,
    /faltan las claves de notificación \(VAPID\)/,
  ], "device center push diagnosis");

  // El distintivo verde solo puede encenderse con el servidor listo.
  assert.doesNotMatch(
    deviceCenter,
    /className=\{notificationPermission === "granted" \? "ready" : ""\}/,
    "el distintivo ACTIVO no debe depender solo del permiso del navegador",
  );
});

// Una suscripción push queda atada a la clave VAPID con la que se creó. Al
// generar claves nuevas —o migrarlas de plataforma— la suscripción que el
// navegador conserva deja de valer: el servicio push rechaza los envíos y no
// llega nada, sin error visible. Reutilizarla con getSubscription() sin
// comprobar la clave dejaba el dispositivo mudo hasta borrar los datos del
// sitio a mano, en cada dispositivo y persona.
test("stale push subscriptions from an older VAPID key are replaced automatically", async () => {
  const dashboard = await read("app/dashboard-client.tsx");

  expectPatterns(dashboard, [
    /function subscriptionMatchesServerKey\(/,
    /subscription\.options\?\.applicationServerKey/,
    /currentBytes\.every\(\(byte, index\) => byte === expectedBytes\[index\]\)/,
    /if \(subscription && !subscriptionMatchesServerKey\(subscription, expectedKey\)\)/,
    /await subscription\.unsubscribe\(\)/,
  ], "stale push subscription recovery");

  // La suscripción existente no puede volver a aceptarse sin comprobarla.
  assert.doesNotMatch(
    dashboard,
    /let subscription = await registration\.pushManager\.getSubscription\(\);\s*\n\s*if \(!subscription\) \{/,
    "getSubscription() no debe reutilizarse sin validar la clave del servidor",
  );
});

test("service worker receives push and opens only a same-origin destination", () => {
  expectPatterns(serviceWorker, [
    /self\.addEventListener\(["']push["']/,
    /event\.data \? event\.data\.json\(\)/,
    /safeNotificationDestination\(payload\.url\)/,
    /url\.origin !== self\.location\.origin/,
    /self\.registration\.showNotification\(/,
    /self\.addEventListener\(["']notificationclick["']/,
    /event\.notification\.close\(\)/,
    /self\.clients\.matchAll\(/,
    /client\.navigate\(destination\)/,
    /self\.clients\.openWindow/,
  ], "service worker");

  expectPatterns(dashboardClient, [
    /navigator\.serviceWorker[\s\S]*?\.register\(["']\/sw\.js["']/,
    /fetch\(["']\/api\/push\/config["']/,
    /registration\.pushManager\.subscribe\(/,
    /fetch\(["']\/api\/push\/subscription["']/,
    /fetchWithEtag\(["']\/api\/notifications\?limit=100["']/,
    /fetch\(["']\/api\/presence["']/,
  ], "dashboard client");
});

// El modo TV es la única superficie de la aplicación que sirve datos sin una
// sesión de usuario: la autoriza un token de dispositivo. Una pantalla en la
// oficina de obra es semi-pública, así que el recorte financiero no puede ser
// opcional ni depender de que alguien recuerde aplicarlo.
test("TV mode serves a token-scoped, non-financial snapshot and never stores the raw token", async () => {
  const [tvRoute, tvTokensRoute, tvPage, tvClient, journal, migration, schemaSource] = await Promise.all([
    read("app/api/tv/route.ts"),
    read("app/api/admin/tv-tokens/route.ts"),
    read("app/tv/page.tsx"),
    read("app/tv/tv-client.tsx"),
    read("drizzle/meta/_journal.json"),
    read("drizzle/0021_tv_device_tokens.sql"),
    read("db/schema.ts"),
  ]);

  // La vía de datos es la del usuario sin permiso financiero, no una copia
  // paralela que pueda divergir con el tiempo.
  expectPatterns(tvRoute, [
    /readEffectiveLiveData\(false\)/,
    /buildControlRoomBaseline\(false,/,
    /notInArray\(controlActions\.area, financeProtectedAreaValues\(\)\)/,
  ], "tv route financial scope");
  // Y no debe filtrarse ninguna raíz financiera por otra vía.
  assert.doesNotMatch(tvRoute, /readEffectiveLiveData\(true\)/);
  assert.doesNotMatch(tvRoute, /payables|antonelyPayableInvoiceLines|fiduciary|cxpAging/i);

  // El token viaja por Authorization o query, pero solo su hash llega a D1.
  expectPatterns(tvRoute, [
    /createHash\("sha256"\)/,
    /eq\(tvDeviceTokens\.tokenHash, hashToken\(token\)\)/,
    /tokenRow\.revokedAt/,
    /new Date\(tokenRow\.expiresAt\)\.getTime\(\) < Date\.now\(\)/,
  ], "tv token validation");
  assert.doesNotMatch(tvRoute, /eq\(tvDeviceTokens\.tokenHash, token\)/);

  // Crear y revocar pantallas es exclusivo de administradores.
  const adminGuards = tvTokensRoute.match(/requireApiUser\(\{ admin: true \}\)/g) ?? [];
  assert.equal(adminGuards.length, 3, "GET, POST y PATCH de tv-tokens deben exigir administrador");
  expectPatterns(tvTokensRoute, [
    /tokenHash: hashToken\(token\)/,
    /randomBytes\(32\)/,
  ], "tv token creation");
  // publicToken() nunca puede devolver el hash ni el token en claro.
  const publicTokenBlock = tvTokensRoute.match(/function publicToken[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(publicTokenBlock, "no se encontró publicToken()");
  assert.doesNotMatch(publicTokenBlock, /tokenHash/);

  // La pantalla retira el token de la barra de direcciones tras guardarlo.
  expectPatterns(tvClient, [
    /sessionStorage\.setItem\(TOKEN_STORAGE_KEY/,
    /history\.replaceState\(null, "", "\/tv"\)/,
    /Authorization`?: `Bearer \$\{token\}`/,
  ], "tv client token handling");
  assert.match(tvPage, /export const dynamic = "force-dynamic"/);

  // La migración debe existir y estar encadenada en el journal, o el
  // despliegue quedaría con la tabla ausente.
  assert.match(migration, /CREATE TABLE `tv_device_tokens`/);
  assert.match(migration, /CREATE UNIQUE INDEX `tv_device_tokens_token_hash_idx`/);
  assert.match(journal, /"idx": 21[\s\S]*?"tag": "0021_tv_device_tokens"/);
  assert.match(schemaSource, /export const tvDeviceTokens = sqliteTable\(/);
});

async function loadBusinessAlertCandidates() {
  const source = await read("lib/business-alerts.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "./notifications") return { emitMissingNotifications: async () => ({ created: 0 }) };
    if (specifier === "./live-data") return liveDataModule;
    if (specifier === "vinext/shims/request-context") return { getRequestExecutionContext: () => null };
    throw new Error(`Unexpected import: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    JSON,
    Date,
    Number,
    Math,
  });
  return compiledModule.exports;
}

test("business alerts derive idempotent, audience-safe candidates from polled state", async () => {
  const alerts = await loadBusinessAlertCandidates();

  // Desviación física bajo el umbral: un aviso por mes de corte, audiencia global.
  const deviation = alerts.controlRoomAlertCandidates({
    planning: { kpiDeviationPoints: -3.9, curveCutoffLabel: "2026-07" },
    actions: [],
  });
  assert.equal(deviation.length, 1);
  assert.equal(deviation[0].kind, "deviation_alert");
  assert.equal(deviation[0].audience, "all");
  assert.equal(deviation[0].subjectId, "2026-07:3");
  assert.match(deviation[0].title, /3,9 puntos/);

  // Dentro del umbral o sin corte: sin candidatos.
  assert.equal(alerts.controlRoomAlertCandidates({
    planning: { kpiDeviationPoints: -2.9, curveCutoffLabel: "2026-07" },
  }).length, 0);
  assert.equal(alerts.controlRoomAlertCandidates({
    planning: { kpiDeviationPoints: -9, curveCutoffLabel: "" },
  }).length, 0);

  // Acciones vencidas: solo abiertas y con fecha pasada; el área financiera
  // degrada la audiencia a "finance" (fail-closed), el resto a su área.
  const actions = alerts.controlRoomAlertCandidates({
    actions: [
      { id: "a1", title: "Cerrar pendiente", area: "obra", status: "open", dueDate: "2026-01-01" },
      { id: "a2", title: "Completada", area: "obra", status: "completed", dueDate: "2026-01-01" },
      { id: "a3", title: "Futura", area: "obra", status: "open", dueDate: "2999-01-01" },
      { id: "a4", title: "CxP", area: "finanzas", status: "open", dueDate: "2026-01-01" },
    ],
  });
  assert.equal(actions.length, 2);
  assert.equal(actions[0].audience, "area:obra");
  assert.equal(actions[0].subjectId, "a1:2026-01-01");
  assert.equal(actions[1].audience, "finance");

  const aiBudget = alerts.controlRoomAlertCandidates({
    aiUsage: {
      month: "2026-08",
      budgetPercent: 82,
      estimatedCostUsdMicros: 41_000_000,
      monthlyBudgetUsdMicros: 50_000_000,
      blocked: false,
    },
  });
  assert.equal(aiBudget.length, 1);
  assert.equal(aiBudget[0].kind, "ai_budget_alert");
  assert.equal(aiBudget[0].audience, "admin");
  assert.equal(aiBudget[0].subjectId, "2026-08:80");

  // Facturas envejecidas: agregado financiero, nunca por debajo del índice 3.
  const payables = alerts.payablesAlertCandidates({
    cutoff: "2026-06-30",
    invoices: [
      { amountDop: 1000, agingIndex: 5 },
      { amountDop: 2000, agingIndex: 3 },
      { amountDop: 9999, agingIndex: 2 },
      { amountDop: -500, agingIndex: 5 },
    ],
  });
  assert.equal(payables.length, 1);
  assert.equal(payables[0].audience, "finance");
  assert.equal(payables[0].subjectId, "2026-06-30:2");
  assert.match(payables[0].title, /2 facturas/);
  assert.equal(alerts.payablesAlertCandidates({ invoices: [] }).length, 0);

  // Y los endpoints sondeados deben seguir programando la emisión.
  expectPatterns(controlRoomRoute, [
    /scheduleBusinessAlerts\(controlRoomAlertCandidates\(payload\)\)/,
  ], "control room business alerts");
});
