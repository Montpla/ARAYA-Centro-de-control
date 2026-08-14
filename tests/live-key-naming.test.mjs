import assert from "node:assert/strict";
import test from "node:test";
import { buildings as baselineBuildings } from "../app/demo-data.ts";
import { materializeLiveRoot } from "../lib/live-data.ts";

// Los 26 edificios no están ordenados por su código: la posición 0 es el
// edificio "3" (rotulado TH-03 en pantalla) y el edificio "14" (TH-14) vive en
// la posición 13. Esa distancia entre "número de edificio" y "posición en la
// lista" es justo la que hacía que los datos entraran en el edificio
// equivocado, así que las pruebas la usan a propósito.
const indexOfCode = (code) => baselineBuildings.findIndex((building) => building.shortName === code);

test("una clave con el nombre de obra actualiza el edificio correcto", () => {
  const index = indexOfCode("14");
  assert.equal(index, 13, "TH-14 debe seguir estando en la posición 13");
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.TH-14.progress": 62.5,
  });
  assert.equal(result[index].shortName, "14");
  assert.equal(result[index].progress, 62.5);
});

test("el nombre de obra con cero de relleno también encuentra su edificio", () => {
  const index = indexOfCode("3");
  assert.equal(index, 0);
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.TH-03.progress": 44,
  });
  assert.equal(result[0].shortName, "3");
  assert.equal(result[0].progress, 44);
});

test("el identificador interno sigue sirviendo para nombrar la entidad", () => {
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.edificio-71.progress": 8,
  });
  const index = indexOfCode("71");
  assert.equal(result[index].progress, 8);
});

test("un apartamento se nombra por su código dentro del edificio", () => {
  const buildingIndex = indexOfCode("14");
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.TH-14.units.14-101.progress": 35,
  });
  const unit = result[buildingIndex].units.find((candidate) => candidate.code === "14-101");
  assert.ok(unit, "el apartamento 14-101 debe existir");
  assert.equal(unit.progress, 35);
});

test("la posición numérica mantiene el significado que siempre tuvo", () => {
  // Retrocompatibilidad estricta: "buildings.13" es la posición 13, no el
  // edificio 13. Las claves que ya publicó el sistema traen posiciones, y
  // reinterpretarlas como códigos habría movido datos ya asentados.
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.13.progress": 77,
  });
  assert.equal(result[13].progress, 77);
  assert.equal(result[13].shortName, "14");
  assert.equal(result[indexOfCode("13")].progress, baselineBuildings[indexOfCode("13")].progress);
});

test("un edificio inexistente se descarta sin ensuciar la lista", () => {
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.TH-99.progress": 100,
  });
  assert.equal(result.length, baselineBuildings.length);
  assert.ok(result.every((building) => building.shortName !== "99"));
  // El fallo original: Number("TH-99") daba NaN y la escritura acababa en una
  // propiedad "NaN" del array, invisible en pantalla y sin error.
  assert.ok(!Object.prototype.hasOwnProperty.call(result, "NaN"));
});

test("las claves que no nombran ninguna entidad no alteran el resto", () => {
  const result = materializeLiveRoot("buildings", baselineBuildings, {
    "buildings.TH-99.progress": 100,
    "buildings.TH-14.progress": 51,
  });
  assert.equal(result[indexOfCode("14")].progress, 51);
});
