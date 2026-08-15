import assert from "node:assert/strict";
import test from "node:test";
import * as pm from "../lib/progress-model.ts";
import { buildings } from "../app/demo-data.ts";
import { unitOverallProgress } from "../lib/unit-progress.ts";

// La regla de negocio que este módulo fija: el porcentaje del edificio es el
// dato bueno (viene de la cubicación) y todo lo demás se deriva de él en
// cascada, sin poder contradecirlo. Antes de esto un edificio al 40,6% mostraba
// sus seis apartamentos al 100%.

test("los pesos de las fases suman 100", () => {
  const total = pm.PHASE_WEIGHTS.reduce((s, f) => s + f.weight, 0);
  assert.equal(total, 100);
});

test("repartir las fases y recomponerlas devuelve el porcentaje del edificio", () => {
  // Si esto falla, el avance del edificio deja de coincidir con la suma de sus
  // fases y vuelve la contradicción que el módulo existe para quitar.
  for (const overall of [0, 5.9, 12.2, 25, 40.6, 73.4, 100]) {
    const recompuesto = pm
      .phasesFromBuildingProgress(overall)
      .reduce((s, fase) => {
        const peso = pm.PHASE_WEIGHTS.find((p) => p.id === fase.id).weight;
        return s + (fase.progress / 100) * peso;
      }, 0);
    assert.ok(Math.abs(recompuesto - overall) < 0.11, `${recompuesto} ≠ ${overall}`);
  }
});

test("las fases se llenan en orden de ejecución", () => {
  // No hay acabados antes de estructura: a mitad de obra, las fases tempranas
  // están completas y las tardías a cero, no todas a medias.
  const fases = pm.phasesFromBuildingProgress(40.6);
  const comun = fases.find((f) => f.id === "comun");
  const acabados = fases.find((f) => f.id === "acabados");
  assert.equal(comun.progress, 100, "la obra común ya está hecha a ese nivel");
  assert.equal(acabados.progress, 0, "los acabados no han empezado");
});

test("el apartamento nunca va por delante de su edificio", () => {
  // El apartamento no recibe crédito por la obra común del edificio, así que su
  // avance es siempre menor o igual. Lo contrario —lo que pasaba antes— es el
  // síntoma de que las cifras no salen de la misma fuente.
  for (const b of buildings) {
    const apto = b.units[0].progress;
    assert.ok(apto <= b.progress + 0.05, `TH-${b.shortName}: apto ${apto} > edif ${b.progress}`);
  }
});

test("la media ponderada de las disciplinas de un apartamento es su avance", () => {
  // La cascada tiene que cerrar: el número que se muestra del apartamento y el
  // que sale de sumar sus cuatro disciplinas ponderadas son el mismo.
  for (const b of buildings.slice(0, 8)) {
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
  // los acabados hechos no es lo mismo que tener sólo la albañilería, y la
  // media simple —que es lo que había antes— los trataba igual.
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
  assert.notEqual(soloAcabados, soloAlbanileria);
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
