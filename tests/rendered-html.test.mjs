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
    "Viviendas",
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
  assert.match(source, /156 viviendas/);
  assert.match(source, /araya-site-plan-clean\.png/);
  assert.match(source, /planCoordinates/);
  assert.match(source, /Descargar archivo/);
  assert.match(source, /araya-visual-masterplan-v3\.png/);
  assert.match(source, /Plano visual interactivo/);
  assert.match(source, /Plano técnico/);
  assert.match(source, /progress-line planned/);
  assert.match(source, /progress-point actual/);
  assert.match(source, /FICHA INDIVIDUAL DE VIVIENDA/);
  assert.match(source, /CAPAS OPERATIVAS DEL PLANO/);
  assert.match(source, /INFORME COMERCIAL · JUNIO 2026/);
  assert.match(source, /CONTROL TRANSVERSAL · JUNIO 2026/);
  assert.match(source, /INFORME FINANCIERO · JUNIO 2026/);
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
  assert.match(source, /currency: "No indicada en la fuente"/);
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
  assert.match(source, /14 edificios · 84 viviendas/);
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

test("agent is source-grounded, read-only and evaluated", async () => {
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
  assert.match(prompt, /No inventes cifras/);
  assert.match(prompt, /No modifiques datos/);
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
  assert.match(juneData, /#REF!/);
  assert.match(dashboard, /juneDataQualityIssues/);
});

test("database migration covers extensible metrics, suppliers and agent logs", async () => {
  const migration = await readFile("drizzle/0000_broken_vin_gonzales.sql", "utf8");
  assert.match(migration, /CREATE TABLE `custom_metrics`/);
  assert.match(migration, /CREATE TABLE `suppliers`/);
  assert.match(migration, /CREATE TABLE `agent_logs`/);
});
