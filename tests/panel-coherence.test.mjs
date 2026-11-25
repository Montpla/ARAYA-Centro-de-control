import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePanelCoherence } from "../lib/panel-coherence.ts";
import { mergeVerificationChecks } from "../lib/upload-verification.ts";

// 77 edificios del plano: 26 con avance publicado y el resto con el de partida.
const edificios = Array.from({ length: 77 }, (_, index) => ({ name: `Edificio ${index + 1}`, progress: index < 26 ? 30 + index : 0 }));
// Estado real de producción el 19/11/2026: todo cuadra.
const real = {
  cutoff: "2026-10-31",
  planning: { physicalActual: 38.01, kpiPlan: 39.8, curveActualAtCutoff: 38.01, curvePlanAtCutoff: 39.8, curveCutoffLabel: "2026-10-01" },
  liveValues: { "projectSnapshot.overallProgress": 38.01, "urbanismAreas.0.progress": 31.89, "projectSnapshot.urbanismProgress": 31.89 },
  buildings: edificios,
};

test("el panel de producción de hoy es coherente", () => {
  assert.deepEqual(evaluatePanelCoherence(real), []);
});

test("una Curva S que no llega al avance del resumen es una anomalía", () => {
  const checks = evaluatePanelCoherence({ ...real, planning: { ...real.planning, curveActualAtCutoff: 32.1 } });
  assert.equal(checks[0].id, "curva_vs_resumen");
  assert.equal(checks[0].severity, "anomalia");
});

test("una Curva S que se queda en un mes anterior al corte avisa de que falta el Excel de la curva", () => {
  // Falta un documento, no hay un fallo de código que arreglar solo.
  const checks = evaluatePanelCoherence({ ...real, cutoff: "2026-11-30" });
  const atrasada = checks.find((check) => check.id === "curva_atrasada");
  assert.equal(atrasada.severity, "aviso");
  assert.match(atrasada.detail, /falta subir el Excel de la curva reprogramada/);
});

test("un edificio sin avance válido no se puede colorear: anomalía", () => {
  const rotos = edificios.map((edificio, index) =>
    index === 7 ? { name: edificio.name } : index === 9 ? { ...edificio, progress: 140 } : edificio);
  const checks = evaluatePanelCoherence({ ...real, buildings: rotos });
  const fallo = checks.find((check) => check.id === "edificios_sin_avance");
  assert.equal(fallo.severity, "anomalia");
  assert.match(fallo.detail, /2 edificio\(s\).*Edificio 8, Edificio 10/);
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
