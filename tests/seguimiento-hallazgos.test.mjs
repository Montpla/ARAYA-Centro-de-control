import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as juneReport from "../app/june-report-data.ts";
import * as procurement from "../app/procurement-data.ts";
import * as liveData from "../lib/live-data.ts";

// Seguimiento de hallazgos: el único dato del área que no sale de un documento.
//
// Los hallazgos se leen solos del informe de obra, pero quién se hace cargo,
// para cuándo y con qué prueba queda cerrado lo pone la obra desde el panel.

test("el seguimiento es un dato vivo y no financiero", () => {
  assert.ok(
    liveData.LIVE_DATA_ROOTS.includes("safetyFindingTracking"),
    "sin estar en el modelo vivo, lo que se escriba no se guarda",
  );
  // Un hallazgo de seguridad no es información financiera: exigir ese permiso
  // dejaría fuera justo a quien tiene que cerrarlo.
  assert.equal(liveData.isFinancialLiveKey("safetyFindingTracking"), false);
  assert.equal(liveData.isCommercialLiveKey("safetyFindingTracking"), false);
});

test("el catálogo de estados permite cerrar un hallazgo", () => {
  // El contrato de datos sólo admite en un campo "status" los valores que
  // aparecen en el dato base. Si alguien recorta esta lista, guardar "Cerrado"
  // empieza a fallar y el seguimiento deja de poder completarse.
  const estados = new Set(juneReport.safetyFindingTracking.map((fila) => fila.status));
  for (const estado of ["Abierto", "En proceso", "Cerrado"]) {
    assert.ok(estados.has(estado), `falta "${estado}" en el catálogo autorizado`);
  }
});

test("cada fila trae los campos que la pantalla escribe", () => {
  for (const fila of juneReport.safetyFindingTracking) {
    for (const campo of ["finding", "responsible", "status", "dueDate", "evidence"]) {
      assert.equal(typeof fila[campo], "string", `${campo} en "${fila.finding}"`);
    }
    // La fecha objetivo va en ISO o vacía: el contrato rechaza cualquier otra
    // forma, y el fallo aparecería al guardar, no al escribir.
    if (fila.dueDate) assert.match(fila.dueDate, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("la pantalla y el servidor comparten el mismo catálogo de estados", async () => {
  const cliente = await readFile("app/dashboard-client.tsx", "utf8");
  const servidor = await readFile("app/api/safety-findings/route.ts", "utf8");
  const catalogo = /\["Abierto", "En proceso", "Cerrado"\]/;
  assert.match(cliente, catalogo, "el desplegable de la pantalla cambió");
  assert.match(servidor, catalogo, "el catálogo del servidor cambió");
});

test("el seguimiento no se puede escribir desde el endpoint general de datos", async () => {
  const ruta = await readFile("app/api/safety-findings/route.ts", "utf8");
  // La ruta acepta a cualquier persona autorizada, así que su única defensa es
  // que no pueda escribir nada más que el seguimiento.
  assert.match(ruta, /requireApiUser\(\)/);
  const claves = [...ruta.matchAll(/key: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
  assert.deepEqual(claves, ["safetyFindingTracking"]);
});

// Seguimiento de las obligaciones del préstamo con IFC.

test("el seguimiento de obligaciones es un dato vivo y financiero", () => {
  assert.ok(liveData.LIVE_DATA_ROOTS.includes("ifcComplianceTracking"));
  // El bloque IFC sólo se sirve con acceso a finanzas: su seguimiento tiene
  // que estar protegido igual, o sería una puerta lateral a ese contenido.
  assert.equal(liveData.isFinancialLiveKey("ifcComplianceTracking"), true);
});

test("las obligaciones no imponen catálogo de estados en el dato base", () => {
  // Al revés que los hallazgos: aquí el dato base va sin estado a propósito,
  // porque dar por abierta o incumplida una obligación del contrato sería
  // afirmar algo que no consta. Con el campo vacío el contrato no fija
  // catálogo y la lista válida la impone el servidor; si alguien rellenara
  // estos estados, el desplegable dejaría de poder usar los demás.
  const estados = new Set(procurement.ifcComplianceTracking.map((fila) => fila.status));
  assert.deepEqual([...estados], [""]);
});

test("cada obligación trae los campos que la pantalla escribe", () => {
  assert.ok(procurement.ifcComplianceTracking.length > 0, "el contrato necesita al menos una fila de referencia");
  for (const fila of procurement.ifcComplianceTracking) {
    for (const campo of ["commitment", "responsible", "status", "dueDate", "evidence"]) {
      assert.equal(typeof fila[campo], "string", campo);
    }
  }
});

test("el endpoint de obligaciones exige finanzas y sólo escribe su clave", async () => {
  const ruta = await readFile("app/api/ifc-compliance/route.ts", "utf8");
  assert.match(ruta, /requireApiUser\(\{ finance: true \}\)/);
  const claves = [...ruta.matchAll(/key: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
  assert.deepEqual(claves, ["ifcComplianceTracking"]);
});
