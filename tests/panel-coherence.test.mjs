import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePanelCoherence } from "../lib/panel-coherence.ts";
import { mergeVerificationChecks } from "../lib/upload-verification.ts";

const edificios = Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`buildings.${index}.progress`, 30 + index]));
// Estado real de producción el 19/11/2026: todo cuadra.
const real = {
  cutoff: "2026-10-31",
  planning: { physicalActual: 38.01, kpiPlan: 39.8, curveActualAtCutoff: 38.01, curvePlanAtCutoff: 39.8, curveCutoffLabel: "2026-10-01" },
  reconciliationCritical: 0,
  liveValues: { ...edificios, "projectSnapshot.overallProgress": 38.01, "urbanismAreas.0.progress": 31.89, "projectSnapshot.urbanismProgress": 31.89 },
  expectedBuildings: 26,
};

test("el panel de producción de hoy es coherente", () => {
  assert.deepEqual(evaluatePanelCoherence(real), []);
});

test("una Curva S que no llega al avance del resumen es una anomalía", () => {
  const checks = evaluatePanelCoherence({ ...real, planning: { ...real.planning, curveActualAtCutoff: 32.1 } });
  assert.equal(checks[0].id, "curva_vs_resumen");
  assert.equal(checks[0].severity, "anomalia");
});

test("una Curva S que se queda en un mes anterior al corte es una anomalía", () => {
  const checks = evaluatePanelCoherence({ ...real, cutoff: "2026-11-30" });
  assert.ok(checks.some((check) => check.id === "curva_atrasada" && check.severity === "anomalia"));
});

test("un edificio sin avance válido no se puede colorear: anomalía", () => {
  const { "buildings.7.progress": _quitado, ...resto } = real.liveValues;
  const checks = evaluatePanelCoherence({ ...real, liveValues: { ...resto, "buildings.9.progress": 140 } });
  const fallo = checks.find((check) => check.id === "edificios_sin_avance");
  assert.equal(fallo.severity, "anomalia");
  assert.match(fallo.detail, /2 edificio/);
});

test("plan y urbanismo que no cuadran son avisos", () => {
  const checks = evaluatePanelCoherence({
    ...real,
    planning: { ...real.planning, kpiPlan: 41 },
    liveValues: { ...real.liveValues, "projectSnapshot.urbanismProgress": 28 },
  });
  assert.deepEqual(checks.map((check) => `${check.id}:${check.severity}`).sort(), ["plan_vs_curva:aviso", "urbanismo_vs_plano:aviso"]);
});

test("la coherencia se suma al veredicto del archivo", () => {
  const ok = { verdict: "ok", checks: [{ id: "integrado", severity: "ok", detail: "Publicado." }], summary: "Publicado." };
  assert.equal(mergeVerificationChecks(ok, []).verdict, "ok");
  const merged = mergeVerificationChecks(ok, [{ id: "curva_vs_resumen", severity: "anomalia", detail: "x" }]);
  assert.equal(merged.verdict, "anomalia");
  assert.deepEqual(merged.checks.map((check) => check.id), ["curva_vs_resumen"]);
  const pendiente = { verdict: "pendiente", checks: [], summary: "" };
  assert.equal(mergeVerificationChecks(pendiente, [{ id: "a", severity: "anomalia", detail: "x" }]).verdict, "pendiente");
});
