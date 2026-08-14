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

// --- Listas económicas -------------------------------------------------------
// Sólo 5 de las 26 colecciones del modelo traen id. Las económicas se
// distinguen por su nombre de negocio, su mes o su entidad emisora, así que
// hasta ahora un importe sólo podía dirigirse por su posición en la lista.

test("una partida de CxP se actualiza por su nombre", async () => {
  const { cxpCategories } = await import("../app/june-report-data.ts");
  const objetivo = cxpCategories[0].name;
  const resultado = materializeLiveRoot("cxpCategories", cxpCategories, {
    [`cxpCategories.${objetivo}.amount`]: 12345.67,
  });
  const partida = resultado.find((item) => item.name === objetivo);
  assert.equal(partida.amount, 12345.67);
  // Ninguna otra partida puede haberse movido.
  for (const item of resultado) {
    if (item.name !== objetivo) {
      const original = cxpCategories.find((base) => base.name === item.name);
      assert.equal(item.amount, original.amount);
    }
  }
});

test("un mes con año se actualiza por su nombre", async () => {
  const { monthlyPlan } = await import("../app/demo-data.ts");
  const indice = monthlyPlan.findIndex((entry) => entry.month === "ene 26");
  assert.ok(indice > 0, "el plan debe contener ene 26");
  const resultado = materializeLiveRoot("monthlyPlan", monthlyPlan, {
    "monthlyPlan.ene 26.actual": 33.3,
  });
  assert.equal(resultado[indice].actual, 33.3);
});

test("un mes repetido en la serie no se resuelve por su etiqueta", async () => {
  // La Curva S abarca 27 meses y sólo lleva año en el primero de cada uno, así
  // que "jul" designa a la vez a julio de 2025, 2026 y 2027. Como de la última
  // fila con ejecutado sale el avance físico global, escribir en el año
  // equivocado desplazaría el KPI principal del proyecto. Se descarta.
  const { monthlyPlan } = await import("../app/demo-data.ts");
  const repetidos = monthlyPlan.filter((entry) => entry.month === "jul");
  assert.ok(repetidos.length > 1, "jul debe seguir apareciendo más de una vez");
  const resultado = materializeLiveRoot("monthlyPlan", monthlyPlan, {
    "monthlyPlan.jul.actual": 99,
  });
  assert.ok(resultado.every((entry, indice) => entry.actual === monthlyPlan[indice].actual));
});

test("un nombre que señala a dos partidas no escribe en ninguna", () => {
  // Escribir en la primera repartiría el importe a cara o cruz entre dos
  // líneas distintas, que sobre cifras económicas es peor que no escribir.
  const lista = [
    { name: "Obra", amount: 10 },
    { name: "obra", amount: 20 },
  ];
  const resultado = materializeLiveRoot("cxpCategories", lista, {
    "cxpCategories.Obra.amount": 999,
  });
  assert.equal(resultado[0].amount, 10);
  assert.equal(resultado[1].amount, 20);
});

test("los nombres de negocio no se recortan por empezar como un tipo", () => {
  // "Torres del Este" llegó a normalizarse como "sdeleste" al descartar el
  // prefijo sin comprobar que detrás viniera un número.
  const lista = [
    { name: "Torres del Este", amount: 10 },
    { name: "Torre Norte", amount: 20 },
  ];
  const resultado = materializeLiveRoot("cxpCategories", lista, {
    "cxpCategories.Torre Norte.amount": 55,
  });
  assert.equal(resultado[0].amount, 10, "Torres del Este no debe verse afectada");
  assert.equal(resultado[1].amount, 55);
});
