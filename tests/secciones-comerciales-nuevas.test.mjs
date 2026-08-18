import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as juneReport from "../app/june-report-data.ts";
import * as liveData from "../lib/live-data.ts";

// Metas de recaudación y aliados captados.
//
// Venían en el informe de ventas y el programa no tenía dónde ponerlas, así que
// las apartó como "propuesta de sección nueva" y allí se quedaron sin que nadie
// las viera. Crear el campo es lo que hace que se muestren y, sobre todo, que
// la lectura del mes siguiente sepa dónde colocarlas.

test("las dos secciones son datos vivos", () => {
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("collectionTargets"));
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("commercialPartners"));
});

test("son datos comerciales y quedan protegidos como tales", () => {
  // Metas de venta y cartera de aliados son información comercial: si no
  // estuvieran protegidas, se verían desde una cuenta sin ese permiso mientras
  // el resto de ventas sí se oculta.
  for (const clave of ["collectionTargets", "commercialPartners"]) {
    assert.equal(liveData.isCommercialLiveKey(clave), true, clave);
    assert.equal(liveData.isFinancialLiveKey(clave), true, clave);
  }
});

test("las metas conservan la precisión que da el informe", () => {
  const fases = juneReport.collectionTargets.map((meta) => meta.label);
  assert.deepEqual(fases, ["Fase I", "Fase II"]);
  // La lámina las declara en millones con un decimal ("US$22.1M"): 22.100.000
  // es exactamente eso, ni más preciso ni redondeado de más.
  assert.equal(juneReport.collectionTargets[0].targetUsd, 22_100_000);
  assert.equal(juneReport.collectionTargets[1].targetUsd, 25_200_000);
});

test("los aliados guardan lo que consta y no inventan los nombres", () => {
  const [julio] = juneReport.commercialPartners;
  assert.equal(julio.period, "2026-07");
  assert.equal(julio.captured, 10);
  // El listado venía en el informe pero no llegó en la extracción. El campo
  // queda preparado y vacío: rellenarlo con nombres supuestos sería peor que
  // no tenerlo.
  assert.equal(julio.names, "");
});

test("el campo de fase no impone un catálogo cerrado", () => {
  // "phase" entra en la lista de campos de enumeración del contrato, que sólo
  // admite los valores del dato base: usarlo dejaría fuera una Fase III el día
  // que exista. Por eso la fase se llama "label".
  for (const meta of juneReport.collectionTargets) {
    assert.ok(!Object.hasOwn(meta, "phase"), "usar 'phase' cerraría el catálogo de fases");
  }
});

// Bloques descubiertos: lo que antes esperaba aprobación y ahora entra solo.

test("el contenedor de bloques descubiertos es un dato vivo protegido", () => {
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("discoveredSections"));
  // Un bloque descubierto puede contener cualquier cosa, incluidas cifras de
  // ventas, y no se sabe qué es hasta mirarlo: se protege como financiero para
  // que no aparezca ante una cuenta sin ese permiso.
  assert.equal(liveData.isFinancialLiveKey("discoveredSections"), true);
});

test("empieza vacío y admite crecer", () => {
  // Vacío porque no hay ningún bloque descubierto sin sitio propio: los dos del
  // informe de julio ya tienen el suyo. Si alguien lo rellenara, el panel
  // mostraría datos duplicados.
  assert.deepEqual(juneReport.discoveredSections, []);
  // Y una clave con índice tiene que seguir siendo válida, o el primer bloque
  // que descubriera la lectura se rechazaría.
  assert.equal(liveData.isLiveDataKey("discoveredSections.0"), true);
});

test("el primer bloque descubierto se acepta sobre la lista vacía", async () => {
  // Guarda del fallo real: la plantilla de forma se consulta por la ruta de la
  // lista ("discoveredSections") y no la del elemento, así que escribirla como
  // "discoveredSections.*" hacía que el primer bloque se rechazara por "la ruta
  // no existe en el modelo autorizado" — y sólo se veía al publicar de verdad.
  const contrato = await readFile("lib/live-data-contract.ts", "utf8");
  assert.match(contrato, /if \(path === "discoveredSections"\) \{/);
  assert.doesNotMatch(contrato, /path === "discoveredSections\.\*"/);
});
