import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard includes the complete project-control navigation and site plan", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  for (const label of [
    "Resumen ejecutivo",
    "Planificación",
    "Implantación general",
    "Edificios",
    "Apartamentos",
    "Ventas y cobranza",
    "Urbanismo",
    "Seguridad y permisos",
    "Cronología",
    "Proveedores",
    "Finanzas",
    "Centro de datos",
    "Agente IA",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Nuevo proveedor/);
  assert.match(source, /Añadir métrica/);
  assert.match(source, /IMPLANTACIÓN GENERAL · DWG 002/);
  assert.match(source, /156 apartamentos/);
  assert.match(source, /araya-site-plan-clean\.png/);
  assert.match(source, /planCoordinates/);
  assert.match(source, /Descargar archivo/);
  assert.match(source, /araya-visual-masterplan-v3\.png/);
  assert.match(source, /Plano visual interactivo/);
  assert.match(source, /Plano técnico/);
  assert.match(source, /progress-line planned/);
  assert.match(source, /progress-point actual/);
  assert.match(source, /FICHA INDIVIDUAL DE APARTAMENTO/);
  assert.match(source, /CAPAS OPERATIVAS DEL PLANO/);
  assert.match(source, /INFORME COMERCIAL · JUNIO 2026/);
  assert.match(source, /CONTROL TRANSVERSAL · JUNIO 2026/);
  assert.match(source, /INFORME FINANCIERO · JUNIO 2026/);
});

test("desktop, tablet and mobile share the requested navigation order", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const navBlock = source.match(/const navItems:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const orderedItems = [
    ['"resumen"', '"Resumen ejecutivo"', '"01"'],
    ['"planificacion"', '"Planificación"', '"02"'],
    ['"implantacion"', '"Implantación general"', '"03"'],
    ['"edificios"', '"Edificios"', '"04"'],
    ['"viviendas"', '"Apartamentos"', '"05"'],
    ['"urbanismo"', '"Urbanismo"', '"06"'],
    ['"comercial"', '"Ventas y cobranza"', '"07"'],
    ['"metricas"', '"Finanzas"', '"08"'],
    ['"cronologia"', '"Cronología"', '"09"'],
    ['"proveedores"', '"Proveedores"', '"10"'],
    ['"control"', '"Seguridad y permisos"', '"11"'],
    ['"fuentes"', '"Centro de datos"', '"12"'],
    ['"agente"', '"Agente IA"', '"AI"'],
    ['"usuarios"', '"Usuarios y accesos"', '"AD"'],
  ];
  let previousIndex = -1;
  for (const [id, label, mark] of orderedItems) {
    const entry = `{ id: ${id}, label: ${label}, mark: ${mark} }`;
    const index = navBlock.indexOf(entry);
    assert.ok(index > previousIndex, `${entry} debe conservar el orden solicitado`);
    previousIndex = index;
  }
  assert.match(source, /availableNavItems\.map/);
});

test("normalized source data contains 26 buildings and 156 apartments", async () => {
  const source = await readFile("app/demo-data.ts", "utf8");
  assert.match(source, /buildingCount: 26/);
  assert.match(source, /unitCount: 156/);
  assert.match(source, /masterPlanBuildingCount: 77/);
  assert.match(source, /buildingsPendingIntegration: 51/);
  assert.match(source, /urbanismProgress: 18\.28/);
  assert.match(source, /overallProgress: 18\.23/);
  assert.match(source, /plannedProgress: 21\.24/);
  assert.match(source, /currency: "DOP"/);
  assert.match(source, /002 - IMPLANTACIÓN GENERAL\.dwg/);
  assert.match(source, /\/data-center\/002-implantacion-general\.dwg/);
  assert.match(source, /urbanismAreas/);
});

test("project selector keeps ARAYA separate from the fictional demo project", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  assert.match(source, /type ProjectId = "araya" \| "mirador"/);
  assert.match(source, /MIRADOR DEL PARQUE/);
  assert.match(source, /Proyecto ficticio de demostración/);
  assert.match(source, /Todos los nombres, cifras y documentos de Mirador del Parque son simulados/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /setActiveProjectId/);
  assert.match(source, /14 edificios · 84 apartamentos/);
  assert.match(source, /DemoProjectContent/);
});

test("sidebar uses the official Bricket brand mark", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const logo = await readFile("public/bricket-mark.png");
  assert.match(source, /src="\/bricket-mark\.png"/);
  assert.ok(logo.length > 1000);
});

test("ARAYA project selector uses the supplied Punta Cana wordmark", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const logo = await readFile("public/araya-wordmark.jpg");
  assert.match(source, /src="\/araya-wordmark\.jpg" alt="ARAYA Punta Cana"/);
  assert.match(source, /className="project-wordmark"/);
  assert.ok(logo.length > 1000);
});

test("agent is source-grounded, guarded and evaluated", async () => {
  const [route, prompt, evalCases] = await Promise.all([
    readFile("app/api/agent/route.ts", "utf8"),
    readFile("lib/agent-prompt.ts", "utf8"),
    readFile("tests/agent-cases.json", "utf8"),
  ]);
  assert.match(route, /get_project_summary/);
  assert.match(route, /get_schedule_deviations/);
  assert.match(route, /get_building_units/);
  assert.match(route, /get_work_packages/);
  assert.match(route, /get_financial_measurements/);
  assert.match(route, /get_commercial_status/);
  assert.match(route, /get_financial_status/);
  assert.match(route, /get_safety_permits/);
  assert.match(route, /get_data_quality/);
  assert.match(route, /get_uploaded_files/);
  assert.match(route, /get_live_data_status/);
  assert.match(route, /materializeLiveRoot/);
  assert.match(prompt, /No inventes cifras/);
  assert.match(prompt, /Consulta siempre las herramientas/);
  assert.equal(JSON.parse(evalCases).length, 20);
});

test("June 2026 reports are integrated with traceable downloads and reconciliations", async () => {
  const [dashboard, data, juneData] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("app/june-report-data.ts", "utf8"),
  ]);
  for (const filename of [
    "araya-informe-junio-2026.pptx",
    "informe-obra-araya-junio-2026.pptx",
    "informe-ventas-araya-junio-2026.pptx",
    "informe-junio-2026-araya.xlsx",
    "datos-para-informe-jun-26.xlsx",
    "lamina-flujo-mayo-2026.pptx",
    "presentacion-informe-araya-junio-2026.pdf",
  ]) {
    const file = await readFile(`public/data-center/junio-2026/${filename}`);
    assert.ok(file.length > 1000);
    assert.match(data, new RegExp(filename.replaceAll(".", "\\.")));
  }
  assert.match(juneData, /overdueUsd: 136840\.39/);
  assert.match(juneData, /budgetDop: 3591280577\.17/);
  assert.match(juneData, /projectedCashDecemberDop: -125196511\.23/);
  assert.match(juneData, /payablesDetailDop: 18627534\.91/);
  assert.match(juneData, /juneCostsDop: 48988755\.86/);
  assert.match(juneData, /#REF!/);
  assert.match(dashboard, /juneDataQualityIssues/);
});

test("database migrations cover records, file registry, source currency and live versions", async () => {
  const [baseMigration, fileMigration, currencyMigration, liveMigration] = await Promise.all([
    readFile("drizzle/0000_broken_vin_gonzales.sql", "utf8"),
    readFile("drizzle/0001_milky_jamie_braddock.sql", "utf8"),
    readFile("drizzle/0002_dry_black_knight.sql", "utf8"),
    readFile("drizzle/0003_luxuriant_thaddeus_ross.sql", "utf8"),
  ]);
  assert.match(baseMigration, /CREATE TABLE `custom_metrics`/);
  assert.match(baseMigration, /CREATE TABLE `suppliers`/);
  assert.match(baseMigration, /CREATE TABLE `agent_logs`/);
  assert.match(fileMigration, /CREATE TABLE `uploaded_files`/);
  assert.match(fileMigration, /CREATE TABLE `file_activity`/);
  assert.match(fileMigration, /uploaded_files_sha256_idx/);
  assert.match(currencyMigration, /source_currency/);
  assert.match(currencyMigration, /DEFAULT 'DOP'/);
  assert.match(liveMigration, /CREATE TABLE `live_data_events`/);
  assert.match(liveMigration, /CREATE TABLE `live_data_points`/);
  assert.match(liveMigration, /live_data_points_revision_idx/);
});

test("collaborative uploads use authenticated identity, R2 storage and duplicate detection", async () => {
  const [route, dashboard, routing, hosting] = await Promise.all([
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("lib/file-routing.ts", "utf8"),
    readFile(".openai/hosting.json", "utf8"),
  ]);
  assert.match(route, /requireApiUser/);
  assert.match(route, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(route, /getFileBucket\(\)\.get/);
  assert.match(route, /pendiente_revision/);
  assert.match(route, /resolveSourceCurrency/);
  assert.match(dashboard, /CARGA COLABORATIVA/);
  assert.match(dashboard, /uploadProjectFile/);
  assert.match(dashboard, /ACTUALIZACIÓN CADA 5 S/);
  assert.match(routing, /Clasificación automática/);
  assert.equal(JSON.parse(hosting).r2, "FILES");
});

test("dashboard requires verified membership and provides administrator-managed access", async () => {
  const [page, access, adminRoute, dashboard, schema, migration] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("lib/access-control.ts", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0004_organic_krista_starr.sql", "utf8"),
  ]);
  assert.match(page, /requireChatGPTUser/);
  assert.match(page, /resolveAuthorizedUser/);
  assert.match(access, /BOOTSTRAP_ADMIN_EMAIL/);
  assert.match(access, /requireApiUser/);
  assert.match(adminRoute, /requireApiUser\(\{ admin: true \}\)/);
  assert.match(adminRoute, /financeAccess/);
  assert.match(adminRoute, /accessAudit/);
  assert.match(dashboard, /Usuarios y accesos/);
  assert.match(dashboard, /Bricket no almacena/);
  assert.match(dashboard, /FinanceLockedView/);
  assert.match(schema, /appUsers/);
  assert.match(schema, /accessAudit/);
  assert.match(migration, /CREATE TABLE `app_users`/);
  assert.match(migration, /CREATE TABLE `access_audit`/);
});

test("spatial views derive live colors and accept new mapped buildings and urbanism areas", async () => {
  const [dashboard, data] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
  ]);
  assert.match(dashboard, /function visualUnitStatus/);
  assert.match(dashboard, /unit\.progress >= 100/);
  assert.match(dashboard, /unit\.progress > 0/);
  assert.match(dashboard, /building\.mapCoordinates\?\.\[planMode\]/);
  assert.match(dashboard, /area\.mapCoordinates\?\.\[planMode\]/);
  assert.match(dashboard, /synchronizeSpatialSummary/);
  assert.match(dashboard, /Los porcentajes, estados y colores cambian/);
  assert.match(data, /mapCoordinates\?:/);
});

test("premium visual refinement uses an editorial hierarchy and readable controls", async () => {
  const styles = await readFile("app/globals.css", "utf8");
  assert.doesNotMatch(styles, /font-family:\s*Inter/);
  assert.match(styles, /--font-editorial/);
  assert.match(styles, /Premium editorial refinement/);
  assert.match(styles, /\.report-tabs button::before/);
  assert.match(styles, /\.account-control/);
  assert.match(styles, /\.access-user-list/);
  assert.match(styles, /\.finance-locked/);
});

test("financial files, live values and agent answers enforce per-user authorization", async () => {
  const [files, liveRoute, liveModel, agent, dashboardRoute] = await Promise.all([
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("lib/live-data.ts", "utf8"),
    readFile("app/api/agent/route.ts", "utf8"),
    readFile("app/api/dashboard/route.ts", "utf8"),
  ]);
  assert.match(files, /No tienes acceso a documentos financieros/);
  assert.match(files, /row\.area !== "finanzas"/);
  assert.match(liveRoute, /redactFinancialFields/);
  assert.match(liveRoute, /No tienes permiso para publicar datos financieros/);
  assert.match(liveModel, /isFinancialLiveKey/);
  assert.match(agent, /Acceso financiero no autorizado/);
  assert.match(agent, /auth\.user\.financeAccess/);
  assert.match(agent, /rows\.filter\(\(row\) => row\.area !== "finanzas"\)/);
  assert.match(dashboardRoute, /No tienes acceso para modificar indicadores financieros/);
});

test("all variable dashboard values use a versioned live-data layer with five-second refresh", async () => {
  const [dashboard, route, liveData, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("lib/live-data.ts", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  assert.match(dashboard, /fetch\("\/api\/live-data"/);
  assert.match(dashboard, /applyLiveValuesToTargets/);
  assert.match(dashboard, /setInterval\(\(\) => void refreshLiveData\(\), 5_000\)/);
  assert.match(dashboard, /Gráficas, cifras, porcentajes, cronograma y avance/);
  assert.match(dashboard, /Tiempo real/);
  assert.match(route, /onConflictDoUpdate/);
  assert.match(route, /provenance/);
  assert.match(route, /refreshIntervalMs: 5_000/);
  assert.match(liveData, /LIVE_DATA_ROOTS/);
  assert.match(liveData, /projectSnapshot/);
  assert.match(liveData, /monthlyPlan/);
  assert.match(liveData, /financialProjection/);
  assert.match(styles, /\.live-data-ribbon/);
});

test("financial presentation defaults to USD and preserves DOP source values", async () => {
  const [dashboard, currency, financeDetail] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("lib/currency.ts", "utf8"),
    readFile("app/antonely-finance-data.ts", "utf8"),
  ]);
  assert.match(currency, /DEFAULT_DISPLAY_CURRENCY: CurrencyCode = "USD"/);
  assert.match(currency, /DOP_TO_USD = 0\.016788/);
  assert.match(currency, /return "DOP"/);
  assert.match(dashboard, /Moneda de visualización/);
  assert.match(dashboard, /Detalle completo/);
  assert.match(dashboard, /29 CUENTAS DE COSTE/);
  assert.match(dashboard, /15 CATEGORÍAS · 96 FACTURAS/);
  assert.match(dashboard, /26 ANTICIPOS/);
  assert.match(dashboard, /41 LÍNEAS DE BALANCE/);
  assert.match(financeDetail, /antonelyPayableVendorsAll/);
  assert.match(financeDetail, /advancePendingDop: 9210448\.86/);
});

test("direction can generate grounded weekly or monthly reports and export them to PDF", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  assert.match(dashboard, /Crear informe/);
  assert.match(dashboard, /Informe semanal/);
  assert.match(dashboard, /Informe mensual/);
  assert.match(dashboard, /Generar vista previa/);
  assert.match(dashboard, /Imprimir \/ Guardar PDF/);
  assert.match(dashboard, /El sistema no interpola ni inventa avances entre cortes/);
  assert.match(dashboard, /direction-report-document/);
  assert.match(styles, /\.direction-report-overlay/);
  assert.match(styles, /@media print/);
});

test("S-curve matches the supplied executive reference without changing its data series", async () => {
  const [dashboard, styles, data] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
  ]);
  assert.match(dashboard, /Curva S — Plan vs\. Ejecutado/);
  assert.match(dashboard, /jun-2025 a ago-2027/);
  assert.match(dashboard, /Plan Operativo/);
  assert.match(dashboard, /Ejecutado Real/);
  assert.match(dashboard, /Al corte \(jun-2026\):/);
  assert.match(dashboard, /monthLabel/);
  assert.match(styles, /\.progress-line\.planned\s*\{[^}]*stroke: #28d4ed/s);
  assert.match(styles, /\.progress-line\.actual\s*\{[^}]*stroke: #ddb45b/s);
  assert.match(styles, /\.s-curve-plot\s*\{[^}]*background: #142b48/s);
  assert.match(styles, /\.legend\.plan\s*\{[^}]*background: #28d4ed/s);
  assert.match(styles, /\.legend\.actual\s*\{[^}]*background: #ddb45b/s);
  assert.match(data, /\{ month: "jun", planned: 23\.29, actual: 18\.23 \}/);
  assert.match(data, /\{ month: "ago", planned: 100, actual: null \}/);
});

test("operational intelligence adds complete apartment cards, role focus, processing and history", async () => {
  const [dashboard, data, schema, historyRoute, liveRoute, filesRoute, adminRoute, migration] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("app/api/history/route.ts", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("drizzle/0005_dapper_silver_surfer.sql", "utf8"),
  ]);
  assert.match(data, /UnitDiscipline/);
  assert.match(data, /responsible\?: string/);
  assert.match(data, /Albañilería/);
  assert.match(dashboard, /AVANCE POR DISCIPLINA/);
  assert.match(dashboard, /Incidencias abiertas/);
  assert.match(dashboard, /profileFocus/);
  assert.match(dashboard, /ALERTAS AUTOMÁTICAS/);
  assert.match(dashboard, /DataHistoryPanel/);
  assert.match(dashboard, /processingStageLabels/);
  assert.match(schema, /liveDataHistory/);
  assert.match(schema, /processingProgress/);
  assert.match(historyRoute, /requireApiUser/);
  assert.match(historyRoute, /isFinancialLiveKey/);
  assert.match(liveRoute, /datos_publicados/);
  assert.match(filesRoute, /processingStage: "clasificado"/);
  assert.match(adminRoute, /isUserArea/);
  assert.match(migration, /CREATE TABLE `live_data_history`/);
  assert.match(migration, /ALTER TABLE `app_users` ADD `area`/);
  assert.match(migration, /processing_progress/);
});

test("tablet and mobile mode provides app navigation, touch plan, camera upload and safe PWA metadata", async () => {
  const [dashboard, styles, layout, manifest, serviceWorker] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/layout.tsx", "utf8"),
    readFile("public/manifest.webmanifest", "utf8"),
    readFile("public/sw.js", "utf8"),
  ]);
  assert.match(dashboard, /mobile-bottom-nav/);
  assert.match(dashboard, /mobile-menu-sheet/);
  assert.match(dashboard, /Pantalla completa/);
  assert.match(dashboard, /site-plan-canvas-scroll/);
  assert.match(dashboard, /capture="environment"/);
  assert.match(dashboard, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /\.mobile-bottom-nav/);
  assert.match(styles, /\.site-plan-canvas-scroll\.expanded/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(manifest, /"display": "standalone"/);
  assert.doesNotMatch(serviceWorker, /\/api\//);
  assert.doesNotMatch(serviceWorker, /caches\.match\(event\.request\).*fetch\(event\.request\).*navigation/s);
});
