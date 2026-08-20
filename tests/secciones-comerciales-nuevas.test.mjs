import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as juneReport from "../app/june-report-data.ts";
import * as demoData from "../app/demo-data.ts";
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

test("las reservas mensuales por modelo conservan las cifras del informe de julio", () => {
  assert.deepEqual(juneReport.juneReport.sales.reservationsByModel, {
    Balcony: 6.3,
    Garden: 4.9,
    Sunset: 6.8,
    Flex: 3.8,
  });
  for (const model of Object.keys(juneReport.juneReport.sales.reservationsByModel)) {
    assert.equal(
      liveData.isCommercialLiveKey(`juneReport.sales.reservationsByModel.${model}`),
      true,
      model,
    );
  }
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

test("el contenedor de bloques descubiertos aplica privacidad por área", () => {
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("discoveredSections"));
  // La raíz no se bloquea entera: cada punto publicado conserva un área y el
  // lector efectivo filtra Finanzas/Comercial antes de materializarlo.
  assert.equal(liveData.isFinancialLiveKey("discoveredSections"), false);
  assert.equal(liveData.requiresFinanceAccessForArea("comercial"), true);
  assert.equal(liveData.requiresFinanceAccessForArea("obra"), false);
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

// Certificaciones del proyecto y carátula de cubicación: las propuestas que se
// modelaron en su sitio propio en vez de dejarlas como bloque genérico.

test("las dos secciones modeladas son datos vivos", () => {
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("projectCertifications"));
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("cubicacionCaratula"));
});

test("la carátula es financiera; las certificaciones no", () => {
  // El monto de una cubicación es información financiera y se protege como tal.
  assert.equal(liveData.isFinancialLiveKey("cubicacionCaratula"), true);
  // Una certificación LEED es información de proyecto: la ve todo el equipo,
  // como los permisos, no sólo quien tiene acceso financiero.
  assert.equal(liveData.isFinancialLiveKey("projectCertifications"), false);
  assert.equal(liveData.isCommercialLiveKey("projectCertifications"), false);
});

test("guardan el dato real y no inventan lo que no llegó", () => {
  const [cert] = demoData.projectCertifications;
  assert.equal(cert.name, "LEED Gold");
  assert.equal(cert.quantity, 3);

  const [caratula] = demoData.cubicacionCaratula;
  assert.equal(caratula.label, "Cubicación Nº8");
  assert.equal(caratula.montoDop, 33639335.5863896);
  // La relación de obra ejecutada (presupuesto, ejecutado, acumulados) no llegó
  // estructurada: no se le añaden campos con cifras que el documento no dio.
  assert.ok(!Object.hasOwn(caratula, "presupuestoDop"));
});

// El lector de ventas emite las metas y el mix por nombre; el contrato exige
// que esos nombres se traduzcan a una posición real de la lista.
test("las claves por nombre del informe de ventas apuntan a entidades reales", () => {
  const modelos = new Set(juneReport.salesModels.map((m) => m.name.toLowerCase()));
  assert.ok(modelos.has("sunset") && modelos.has("garden"), "faltan modelos que el lector nombra");
  const fases = new Set(juneReport.collectionTargets.map((t) => t.label.toLowerCase()));
  assert.ok(fases.has("fase i") && fases.has("fase ii"), "faltan las fases que el lector nombra");
});
