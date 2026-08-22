import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [filesRoute, reviewRoute, dashboard, accessControl, adminUsersRoute, templateRoute, schema, migration, reprocessor, workflow] = await Promise.all([
  readFile("app/api/files/route.ts", "utf8"),
  readFile("app/api/files/review/route.ts", "utf8"),
  readFile("app/dashboard-client.tsx", "utf8"),
  readFile("lib/access-control.ts", "utf8"),
  readFile("app/api/admin/users/route.ts", "utf8"),
  readFile("app/api/templates/route.ts", "utf8"),
  readFile("db/schema.ts", "utf8"),
  readFile("drizzle/0026_uneven_wallow.sql", "utf8"),
  readFile("scripts/reprocesar-obsoletos.mjs", "utf8"),
  readFile(".github/workflows/reprocesar-obsoletos.yml", "utf8"),
]);

test("entregar, consultar y aprobar finanzas son permisos independientes", () => {
  assert.match(accessControl, /financeUploadAccess: boolean/);
  assert.match(accessControl, /financeApproveAccess: boolean/);
  assert.match(adminUsersRoute, /const financeApproveAccess = role === "admin" \|\| Boolean\(payload\.financeApproveAccess\)/);
  assert.match(adminUsersRoute, /financeAccess = role === "admin" \|\| Boolean\(payload\.financeAccess\) \|\| Boolean\(payload\.financeApproveAccess\)/);
  assert.match(filesRoute, /initiallyProtectedUpload && !user\.financeUploadAccess/);
  assert.match(reviewRoute, /protectedReview && !auth\.user\.financeApproveAccess/);
  assert.match(dashboard, /Entregar documentos financieros/);
  assert.match(dashboard, /Validar documentos financieros/);
});

test("la migracion conserva los validadores financieros actuales", () => {
  assert.match(schema, /financeUploadAccess: integer\("finance_upload_access"/);
  assert.match(schema, /financeApproveAccess: integer\("finance_approve_access"/);
  assert.match(migration, /SET `finance_approve_access` = `finance_access`/);
  assert.match(migration, /processing_attempts/);
  assert.match(migration, /next_retry_at/);
  assert.match(migration, /last_processing_error/);
});

test("la carga web devuelve aceptacion inmediata y procesa con reintentos", () => {
  assert.match(filesRoute, /deferProcessingRequested/);
  assert.match(filesRoute, /scheduleBackgroundUploadProcessing/);
  assert.match(filesRoute, /BACKGROUND_PROCESSING_ATTEMPTS = 3/);
  assert.match(filesRoute, /outcome: "accepted"/);
  assert.match(filesRoute, /status: 202/);
  assert.match(dashboard, /Mis cargas/);
  assert.match(dashboard, /Reintento autom/);
});

test("un duplicado financiero confirma recepcion sin revelar sus cifras", () => {
  assert.match(filesRoute, /duplicate: true,[\s\S]{0,100}restricted: true/);
  assert.match(filesRoute, /outcome: "already_registered"/);
  assert.match(filesRoute, /statusOnly/);
  assert.match(filesRoute, /No tienes que volver a subirlo/);
});

test("el reproceso programado cura cargas tecnicas sin crear bucles", () => {
  assert.match(reprocessor, /technicalRetryCandidate/);
  assert.match(reprocessor, /attempts >= 3/);
  assert.match(reprocessor, /oldEnough/);
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
});

test("finanzas dispone de plantillas deterministas opcionales", () => {
  for (const kind of ["cxp_categorias", "cxp_vencimientos", "costes", "anticipos", "proyeccion_financiera", "financiacion", "balance_fideicomiso", "resultados_fideicomiso", "flujo_mensual_finanzas"]) {
    assert.match(templateRoute, new RegExp(`${kind}:`));
    assert.match(dashboard, new RegExp(`kind=${kind}`));
  }
});
