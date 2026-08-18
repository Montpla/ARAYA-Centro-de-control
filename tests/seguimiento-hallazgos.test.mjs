import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as juneReport from "../app/june-report-data.ts";
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
