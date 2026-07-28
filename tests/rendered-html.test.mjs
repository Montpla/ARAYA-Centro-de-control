import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard includes the complete project-control navigation and site plan", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  for (const label of [
    "Resumen ejecutivo",
    "Planificación",
    "Edificios y viviendas",
    "Cronología",
    "Proveedores",
    "Métricas y finanzas",
    "Fuentes y calidad",
    "Agente IA",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Nuevo proveedor/);
  assert.match(source, /Añadir métrica/);
  assert.match(source, /PLANO OPERATIVO DE OBRA/);
  assert.match(source, /156 viviendas/);
});

test("normalized source data contains 26 buildings and 156 apartments", async () => {
  const source = await readFile("app/demo-data.ts", "utf8");
  assert.match(source, /buildingCount: 26/);
  assert.match(source, /unitCount: 156/);
  assert.match(source, /overallProgress: 18\.23/);
  assert.match(source, /plannedProgress: 21\.24/);
  assert.match(source, /currency: "No indicada en la fuente"/);
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
  assert.match(route, /get_data_quality/);
  assert.match(prompt, /No inventes cifras/);
  assert.match(prompt, /No modifiques datos/);
  assert.equal(JSON.parse(evalCases).length, 20);
});

test("database migration covers extensible metrics, suppliers and agent logs", async () => {
  const migration = await readFile("drizzle/0000_broken_vin_gonzales.sql", "utf8");
  assert.match(migration, /CREATE TABLE `custom_metrics`/);
  assert.match(migration, /CREATE TABLE `suppliers`/);
  assert.match(migration, /CREATE TABLE `agent_logs`/);
});
