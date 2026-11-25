import assert from "node:assert/strict";
import test from "node:test";

import { applyLiveValuesToTargets } from "../lib/live-data.ts";

// El panel enlaza raíces entre sí (projectSnapshot.buildings = buildings). Con
// cada sondeo de 5 s, restaurar el resumen desde su copia base pisaba los
// edificios con los valores de Project: el edificio 75 volvía al 0 % aunque la
// cubicación de octubre dijera 33,60 %.
test("una raíz enlazada dentro de otra conserva sus datos vivos en cada ciclo", () => {
  const buildings = [{ id: "edificio-3", progress: 60.3 }, { id: "edificio-75", progress: 0 }];
  const urbanismAreas = [{ id: "urban-general", progress: 10 }];
  const projectSnapshot = { overallProgress: 22.71, buildings: structuredClone(buildings), urbanismAreas: structuredClone(urbanismAreas) };
  const synchronize = () => {
    projectSnapshot.buildings = buildings;
    projectSnapshot.urbanismAreas = urbanismAreas;
  };
  const values = { "buildings.1.progress": 33.6, "urbanismAreas.0.progress": 31.89, "projectSnapshot.overallProgress": 32.06 };
  for (let ciclo = 1; ciclo <= 3; ciclo += 1) {
    applyLiveValuesToTargets(values, { buildings, urbanismAreas, projectSnapshot }, synchronize);
    assert.equal(buildings[1].progress, 33.6, `ciclo ${ciclo}: el edificio 75 vuelve al valor base`);
    assert.equal(urbanismAreas[0].progress, 31.89, `ciclo ${ciclo}: urbanismo vuelve al valor base`);
    assert.equal(projectSnapshot.overallProgress, 32.06);
    assert.equal(projectSnapshot.buildings, buildings, "el resumen sigue enlazado a la misma lista");
  }
});
