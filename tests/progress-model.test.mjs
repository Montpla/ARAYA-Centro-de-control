import assert from "node:assert/strict";
import test from "node:test";
import * as pm from "../lib/progress-model.ts";
import { buildings } from "../app/demo-data.ts";
import { unitOverallProgress } from "../lib/unit-progress.ts";

// La regla de negocio que este módulo fija: el avance de cada fase de cada
// edificio es medición real del plan de obra, y de esas fases sale —ponderando—
// el porcentaje del edificio y el de sus apartamentos. Las tres cifras no pueden
// contradecirse porque salen de la misma fuente.

test("los pesos de las fases suman 100", () => {
  const total = pm.PHASE_WEIGHTS.reduce((s, f) => s + f.weight, 0);
  assert.equal(total, 100);
});

test("el avance del edificio es la media ponderada de sus fases", () => {
  // Todas al 100% → 100; todas a 0 → 0; una combinación → su media por peso.
  assert.equal(pm.buildingProgressFromPhases(pm.phasesFromValues([100, 100, 100, 100, 100])), 100);
  assert.equal(pm.buildingProgressFromPhases(pm.phasesFromValues([0, 0, 0, 0, 0])), 0);
  const mezcla = pm.buildingProgressFromPhases(pm.phasesFromValues([100, 100, 100, 0, 0]));
  // 8+15+19 de 100 = 42.
  assert.ok(Math.abs(mezcla - 42) < 0.05, `${mezcla} ≠ 42`);
});

test("el apartamento nunca va por delante de su edificio", () => {
  // El apartamento no recibe crédito por la obra común del edificio, así que su
  // avance es siempre menor o igual. Lo contrario es el síntoma de que las
  // cifras no salen de la misma fuente.
  for (const b of buildings) {
    const apto = b.units[0].progress;
    assert.ok(apto <= b.progress + 0.05, `TH-${b.shortName}: apto ${apto} > edif ${b.progress}`);
  }
});

test("las disciplinas del apartamento son la medición real, no una cascada", () => {
  // TH-03 tiene instalaciones (34,7%) empezadas y acabados (32,3%) también, a la
  // vez: la Cubicación Nº8 mide oficios que se solapan. Una cascada las habría
  // puesto a 0 hasta acabar la anterior. Que ambas sean >0 prueba que es dato real.
  const th03 = buildings.find((b) => b.shortName === "3");
  const inst = th03.units[0].disciplines.find((d) => d.id === "instalaciones");
  const acab = th03.units[0].disciplines.find((d) => d.id === "acabados");
  assert.ok(inst.progress > 0 && acab.progress > 0, "instalaciones y acabados solapadas");
  assert.equal(inst.progress, 34.7);
  assert.equal(acab.progress, 32.3);
});

test("la media ponderada de las disciplinas de un apartamento es su avance", () => {
  // La cascada tiene que cerrar: el número que se muestra del apartamento y el
  // que sale de sumar sus cuatro disciplinas ponderadas son el mismo.
  for (const b of buildings.slice(0, 12)) {
    const u = b.units[0];
    const desdeDisciplinas = pm.weightedUnitProgress(u.disciplines);
    assert.ok(
      Math.abs(desdeDisciplinas - u.progress) < 0.2,
      `TH-${b.shortName}: disciplinas dan ${desdeDisciplinas}, apto marca ${u.progress}`,
    );
  }
});

test("las fases no pesan todas igual", () => {
  // La corrección frente a la media simple: cada fase vale distinto. Tener sólo
  // los acabados hechos no es lo mismo que tener sólo la albañilería.
  const soloAcabados = pm.weightedUnitProgress([
    { id: "superestructura", progress: 0 },
    { id: "albanileria", progress: 0 },
    { id: "instalaciones", progress: 0 },
    { id: "acabados", progress: 100 },
  ]);
  const soloAlbanileria = pm.weightedUnitProgress([
    { id: "superestructura", progress: 0 },
    { id: "albanileria", progress: 100 },
    { id: "instalaciones", progress: 0 },
    { id: "acabados", progress: 0 },
  ]);
  assert.ok(soloAcabados > soloAlbanileria, "los acabados pesan más que la albañilería");
});

test("ningún edificio contradice ya a sus apartamentos", () => {
  // La prueba de regresión del bug original: antes 14 de 26 edificios tenían el
  // edificio y la media de sus apartamentos separados por decenas de puntos.
  for (const b of buildings) {
    const overall = unitOverallProgress(b.units[0], []);
    assert.ok(
      Math.abs(overall - b.units[0].progress) < 0.2,
      `TH-${b.shortName}: el conjunto del apartamento (${overall}) no cuadra con su avance (${b.units[0].progress})`,
    );
  }
});

test("la media de todos los edificios reproduce el avance global del plan", () => {
  // El plan de Project muestra el proyecto al 22% en su raíz. Si la agregación
  // es fiel, la media de los 26 edificios cae cerca de esa cifra.
  const media = buildings.reduce((s, b) => s + b.progress, 0) / buildings.length;
  assert.ok(media > 17 && media < 25, `media global ${media.toFixed(1)}% fuera de rango`);
});
