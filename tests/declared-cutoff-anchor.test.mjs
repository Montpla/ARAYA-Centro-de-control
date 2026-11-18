import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { monthlyPlan as baselinePlan } from "../app/demo-data.ts";
import {
  anchorDeclaredCutoff,
  clearTrailingMonthlyActualPlaceholders,
  curveMonthIndex,
} from "../lib/monthly-plan.ts";
import { reconcileGeneralUrbanism } from "../lib/urbanism-map-progress.ts";

// Estado real de producción el 18/11/2026: el Excel maestro llegó hasta
// agosto y el Informe Ejecutivo de octubre declaró 32,06% frente a 39,8%.
function planDeProduccion() {
  const plan = baselinePlan.map((point) => ({ ...point }));
  plan[14] = { ...plan[14], actual: 27.9, planned: 35.29 };
  plan[15] = { ...plan[15], actual: 0, planned: 45.58 };
  plan[16] = { ...plan[16], actual: 0, planned: 57.48 };
  for (let index = 17; index < plan.length; index += 1) plan[index] = { ...plan[index], actual: 0 };
  clearTrailingMonthlyActualPlaceholders(plan);
  return plan;
}

function ultimoCorte(plan) {
  let index = -1;
  plan.forEach((point, i) => { if (point.actual !== null) index = i; });
  return plan[index];
}

test("curveMonthIndex usa el calendario de la Curva S (junio 2025 = 0)", () => {
  assert.equal(curveMonthIndex("2025-06-30"), 0);
  assert.equal(curveMonthIndex("2026-08-31"), 14);
  assert.equal(curveMonthIndex("2026-10-31"), 16);
  assert.equal(curveMonthIndex("2025-05-31"), null);
  assert.equal(curveMonthIndex("sin fecha"), null);
});

test("un informe con corte posterior a la Curva S manda en el resumen", () => {
  const plan = planDeProduccion();
  assert.equal(ultimoCorte(plan).actual, 27.9);

  const anclado = anchorDeclaredCutoff(plan, {
    declaredCutoff: "2026-10-31",
    overallProgress: 32.06,
    plannedProgress: 39.8,
  });

  assert.equal(anclado, true);
  assert.deepEqual(
    { actual: ultimoCorte(plan).actual, planned: ultimoCorte(plan).planned },
    { actual: 32.06, planned: 39.8 },
  );
  assert.equal(plan[15].actual, null, "septiembre no se inventa");
  assert.equal(plan[14].actual, 27.9, "agosto medido se conserva");
});

test("es idempotente y no pisa un Excel del mismo mes o posterior", () => {
  const plan = planDeProduccion();
  const informe = { declaredCutoff: "2026-10-31", overallProgress: 32.06, plannedProgress: 39.8 };
  anchorDeclaredCutoff(plan, informe);
  assert.equal(anchorDeclaredCutoff(plan, informe), false);

  const conExcelDeOctubre = planDeProduccion();
  conExcelDeOctubre[16] = { ...conExcelDeOctubre[16], actual: 31.5, planned: 57.48 };
  assert.equal(anchorDeclaredCutoff(conExcelDeOctubre, informe), false);
  assert.equal(conExcelDeOctubre[16].actual, 31.5);
});

test("no ancla cortes antiguos, valores vacíos ni retrocesos del acumulado", () => {
  const plan = planDeProduccion();
  assert.equal(anchorDeclaredCutoff(plan, { declaredCutoff: "2026-07-31", overallProgress: 22.71 }), false);
  assert.equal(anchorDeclaredCutoff(plan, { declaredCutoff: "2026-10-31", overallProgress: null }), false);
  assert.equal(anchorDeclaredCutoff(plan, { declaredCutoff: "2026-10-31", overallProgress: 20 }), false);
  assert.equal(anchorDeclaredCutoff(plan, { declaredCutoff: null, overallProgress: 32.06 }), false);
  assert.equal(ultimoCorte(plan).actual, 27.9);
});

test("sin plan declarado conserva el plan de la curva para ese mes", () => {
  const plan = planDeProduccion();
  anchorDeclaredCutoff(plan, { declaredCutoff: "2026-10-31", overallProgress: 32.06 });
  assert.equal(plan[16].planned, 57.48);
});

test("urbanismo general toma el mayor avance conocido entre plano e informe", () => {
  const areas = [
    { id: "urban-general", progress: 25.9, status: "integrado", source: "Avance urbanismo.xlsx" },
    { id: "urban-roads", progress: 7, status: "integrado", source: "x" },
  ];
  const conciliadas = reconcileGeneralUrbanism(areas, 28.9);
  assert.equal(conciliadas[0].progress, 28.9);
  assert.match(conciliadas[0].source, /Informe Ejecutivo/);
  assert.equal(conciliadas[1].progress, 7);
  assert.equal(reconcileGeneralUrbanism(areas, 20)[0].progress, 25.9);
  assert.equal(reconcileGeneralUrbanism(areas, null)[0].progress, 25.9);
});

test("servidor y cliente anclan el corte declarado tras limpiar los ceros futuros", async () => {
  const [servidor, cliente] = await Promise.all([
    readFile("lib/spatial-live-data.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
  ]);
  assert.match(servidor, /clearTrailingMonthlyActualPlaceholders\(monthlyPlan\);\s*\n\s*anchorDeclaredCutoff\(monthlyPlan, snapshot\);/);
  assert.match(cliente, /clearTrailingMonthlyActualPlaceholders\(monthlyPlan\);\s*\n\s*anchorDeclaredCutoff\(monthlyPlan, projectSnapshot\);/);
  assert.match(servidor, /reconcileGeneralUrbanism\(/);
  assert.match(cliente, /reconcileGeneralUrbanism\(/);
});
