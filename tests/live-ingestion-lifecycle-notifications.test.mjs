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

test("multiformat ingestion falls back to AI and gates automatic publication", () => {
  expectPatterns(filesRoute, [
    /import \{[\s\S]*?canAutomaticallyPublishExtraction,[\s\S]*?extractDocumentWithAI,[\s\S]*?\} from ["']\.\.\/\.\.\/\.\.\/lib\/ai-document-extraction["'];/,
    /const allowedExtensions = new Set\(\[[\s\S]*?["']pdf["'][\s\S]*?["']pptx["'][\s\S]*?["']xlsx["'][\s\S]*?["']png["'][\s\S]*?\]\);/,
    /extractStructuredUpdates\(bytes, extension,/,
    /if \(!deterministicExtraction\.updates\.length\) \{[\s\S]*?extractDocumentWithAI\(/,
    /apiKey: process\.env\.OPENAI_API_KEY \?\? ["']["']/,
    /extractionMode: extraction\.model === ["']deterministic["'][\s\S]*?["']openai_responses["']/,
    /automaticPublicationRequested &&/,
    /canAutomaticallyPublishExtraction\(/,
    /updateConfidences: extraction\.updateConfidences/,
    /normalizedUpdates\.length > 0/,
    /resolvedArea !== ["']sin_clasificar["']/,
    /user\.financeAccess \|\| !isFinancialLiveKey\(update\.key\)/,
    /isSafeAutomaticStructuredUpdate\(update\)/,
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
    /input\.updateConfidences\.every\(\(confidence\) =>[\s\S]*?confidence >= 0\.5/,
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
    /resolveSpatialIdentityUpdates\(extraction\.updates, currentLiveData\.values\)/,
    /const liveValues = currentLiveData\?\.values \?\? \{\}/,
    /automaticContractIsSafe\(normalizedUpdates, liveValues\)/,
    /individualUpdateContractIsSafe\(update, liveValues\)/,
    /!\[["']__proto__["'], ["']constructor["'], ["']prototype["']\]\.includes\(key\)/,
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
    /fetch\(["']\/api\/notifications\?limit=100["']/,
    /fetch\(["']\/api\/presence["']/,
  ], "dashboard client");
});
