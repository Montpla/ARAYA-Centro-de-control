import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, timezoneMigration, center, route, workspace, onboarding, dashboard, manifest, worker, auditWorkflow, backupWorkflow, guide] = await Promise.all([
  readFile("db/schema.ts", "utf8"),
  readFile("drizzle/0029_happy_nova.sql", "utf8"),
  readFile("drizzle/0030_eminent_stature.sql", "utf8"),
  readFile("lib/automation-center.ts", "utf8"),
  readFile("app/api/automation-center/route.ts", "utf8"),
  readFile("app/automation-workspace.tsx", "utf8"),
  readFile("app/onboarding-assistant.tsx", "utf8"),
  readFile("app/dashboard-client.tsx", "utf8"),
  readFile("public/manifest.webmanifest", "utf8"),
  readFile("public/sw.js", "utf8"),
  readFile(".github/workflows/auditoria-nocturna.yml", "utf8"),
  readFile(".github/workflows/backup-produccion.yml", "utf8"),
  readFile("historical/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf"),
]);

test("la migración incorpora auditorías, incidencias, cierres y preferencias", () => {
  for (const table of ["automation_runs", "automation_incidents", "reporting_periods", "reporting_requirements", "user_automation_preferences"]) {
    assert.match(schema, new RegExp(`sqliteTable\\(\\s*"${table}"`));
    assert.ok(migration.includes("CREATE TABLE `" + table + "`"));
  }
  assert.match(migration, /UNIQUE INDEX `automation_runs_idempotency_idx`/);
  assert.match(migration, /UNIQUE INDEX `automation_incidents_fingerprint_idx`/);
  assert.match(timezoneMigration, /timezone_offset_minutes/);
});

test("el auditor es idempotente, repara cargas seguras y no salta controles financieros", () => {
  assert.match(center, /runOperationalAudit/);
  assert.match(center, /validateLiveDataContract/);
  assert.match(center, /validateFinancialPublication/);
  assert.match(center, /financialGroups/);
  assert.match(center, /baselineValues:\s*\{\}/);
  assert.match(center, /sourceFileId \|\| point\.sourceName/);
  assert.match(center, /ingestionVersion:\s*""/);
  assert.match(center, /onConflictDoUpdate/);
  assert.match(route, /auth\.user\.role !== "admin"/);
  assert.match(auditWorkflow, /schedule:/);
  assert.match(auditWorkflow, /auditar-produccion\.mjs/);
});

test("un requisito del checklist se satisface por documentType, no también por area", () => {
  // Un derivado automático (el XML que sale de convertir un .mpp) se archiva
  // deliberadamente en Obra para que su publicación no se frene por "sin
  // clasificar" (lib/mpp-conversion-trigger.ts), aunque su documentType siga
  // siendo "cronograma". Exigir también area="planificacion" dejaba
  // "Cronograma actualizado" en pendiente para siempre, avanzara el
  // cronograma o no (visto en producción el 10/09/2026).
  const match = center.match(/const winner = files\s*\.filter\(\(file\) =>([\s\S]*?)\)\s*\n\s*\.sort/);
  assert.ok(match, "no se encontró el filtro de reconcileReportingPeriods");
  assert.match(match[1], /file\.documentType === requirement\.documentType/);
  assert.doesNotMatch(match[1], /file\.area === requirement\.area/);
});

test("los cierres tienen requisitos, responsables, recordatorios y bloqueo por faltantes", () => {
  assert.match(center, /DEFAULT_REPORTING_REQUIREMENTS/);
  assert.match(center, /closeReportingPeriod/);
  assert.match(center, /obligatorio\(s\) para cerrar el periodo/);
  assert.match(center, /sendReportingReminders/);
  assert.match(workspace, /Cierre semanal y mensual/);
  assert.match(workspace, /Recordar pendientes/);
});

test("la carga múltiple y compartir desde móvil conservan un recibo por archivo", () => {
  assert.match(dashboard, /slice\(0, 20\)/);
  assert.match(dashboard, /source: "dashboard_batch"/);
  assert.match(dashboard, /setCompletedBatch\(entries\)/);
  assert.match(manifest, /"share_target"/);
  assert.match(worker, /storeSharedFiles/);
  assert.match(worker, /bricket-share-inbox/);
});

test("las preferencias conservan privacidad, frecuencia y horario silencioso", () => {
  assert.match(center, /digestFrequency/);
  assert.match(center, /notificationVisibleToUser/);
  assert.match(workspace, /Silencio desde/);
  assert.match(workspace, /Resumen semanal/);
  assert.match(route, /body\.criticalOnly === undefined/);
});

test("las copias se restauran y verifican antes de registrarse", () => {
  assert.match(backupWorkflow, /wrangler d1 export/);
  assert.match(backupWorkflow, /sqlite3 restore-test\.sqlite/);
  assert.match(backupWorkflow, /PRAGMA integrity_check/);
  assert.match(backupWorkflow, /sha256sum/);
  assert.match(backupWorkflow, /retention-days: 30/);
});

test("el onboarding queda persistido y la guía corporativa está actualizada", () => {
  assert.match(onboarding, /onboardingCompleted/);
  assert.match(onboarding, /steps\.length/);
  assert.match(dashboard, /<OnboardingAssistant/);
  assert.ok(guide.byteLength > 100_000);
});
