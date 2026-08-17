import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as liveData from "../lib/live-data.ts";
import * as projectXml from "../lib/project-xml.ts";
import * as xlsxReader from "../lib/xlsx-reader.ts";
import * as pdfText from "../lib/pdf-text.ts";
import * as progressModel from "../lib/progress-model.ts";

// Las hojas de prueba se generan con scripts/generar-fixtures-xlsx.py y tienen
// la forma de las reales: un título de la oficina encima, la cabecera más
// abajo, celdas vacías y una fila que no nombra ningún edificio.
async function leerFixture(nombre) {
  const buffer = await readFile(new URL(`./fixtures/${nombre}`, import.meta.url));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadIngestion() {
  const ooxml = await cargarOoxmlTables();
  const source = await readFile(new URL("../lib/ingestion.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "./live-data") return liveData;
    if (specifier === "./project-xml") return projectXml;
    if (specifier === "./xlsx-reader") return xlsxReader;
    if (specifier === "./ooxml-tables") return ooxml;
    if (specifier === "./pdf-text") return pdfText;
    if (specifier === "./progress-model") return progressModel;
    throw new Error(`Import inesperado: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    JSON,
    Map,
    Set,
    Number,
    Object,
    Array,
    TextDecoder,
    Promise,
  });
  return compiledModule.exports;
}

// ooxml-tables importa a xlsx-reader por ruta relativa sin extensión, que Node
// no resuelve al cargar el .ts directamente, así que se compila igual que el
// resto de módulos del proyecto.
async function cargarOoxmlTables() {
  const source = await readFile(new URL("../lib/ooxml-tables.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(output, {
    module: compiled,
    exports: compiled.exports,
    require: (specifier) => {
      if (specifier === "./xlsx-reader") return xlsxReader;
      throw new Error(`Import inesperado: ${specifier}`);
    },
    console, JSON, Map, Set, Number, Object, Array, String, Promise, TextDecoder,
  });
  return compiled.exports;
}

const defaults = {
  area: "obra",
  cutoff: "2026-07-31",
  sourceCurrency: "DOP",
  sourceName: "avance.xlsx",
  knownBuildingTokens: new Set(["14", "3", "7"]),
};

test("abre un .xlsx y devuelve sus celdas", async () => {
  const filas = await xlsxReader.readXlsxRows(await leerFixture("plantilla-avance.xlsx"));
  assert.ok(filas.length >= 4, "debe leer todas las filas con contenido");
  // Las cadenas van en una tabla compartida aparte dentro del archivo: si no se
  // resolviera, aquí aparecerían números en vez de texto.
  assert.equal(filas[2].A, "clave");
  assert.equal(filas[3].A, "buildings.TH-14.progress");
  assert.equal(filas[3].B, "62.5");
});

test("encuentra la cabecera aunque haya un título encima", async () => {
  const filas = await xlsxReader.readXlsxRows(await leerFixture("plantilla-avance.xlsx"));
  const { headerRow, records } = xlsxReader.rowsToRecords(filas, ["clave"]);
  assert.equal(headerRow, 2, "la cabecera está en la tercera fila, tras el membrete");
  assert.equal(records.length, 3);
  assert.equal(records[0].clave, "buildings.TH-14.progress");
});

test("una plantilla en Excel publica lo mismo que en CSV", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("plantilla-avance.xlsx"),
    "xlsx",
    defaults,
  );
  assert.equal(resultado.warnings.length, 0, resultado.warnings.join(" · "));
  // Tres filas, pero la de TH-03 tiene el valor vacío: no se toca.
  assert.equal(resultado.updates.length, 2);
  const claves = resultado.updates.map((update) => update.key);
  assert.deepEqual([...claves].sort(), ["buildings.TH-07.progress", "buildings.TH-14.progress"]);
  assert.equal(resultado.updates.find((u) => u.key === "buildings.TH-14.progress").value, 62.5);
});

test("lee una tabla de obra corriente, sin claves técnicas", async () => {
  // El caso que ahorra el trabajo de convertir: la hoja que ya mantiene la
  // oficina, con una columna de edificio y otra de porcentaje.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("tabla-obra.xlsx"),
    "xlsx",
    defaults,
  );
  assert.equal(resultado.updates.length, 2, "TH-14 y TH-03; la zona común queda fuera");
  const th14 = resultado.updates.find((update) => update.key === "buildings.TH-14.progress");
  assert.equal(th14.value, 62.5);
  assert.match(resultado.summary, /2 edificios actualizados/);
  assert.ok(resultado.warnings.some((aviso) => /no nombran un edificio/.test(aviso)));
});

test("readXlsxSheets devuelve todas las hojas del libro, no solo la primera", async () => {
  const hojas = await xlsxReader.readXlsxSheets(await leerFixture("flujo-con-cubicacion.xlsx"));
  assert.equal(hojas.length, 2, "el libro tiene dos hojas");
  assert.equal(hojas[0][0].A, "Categoría", "la primera es el detalle por categoría");
  assert.equal(hojas[1][0].A, "Edificio", "la segunda es la matriz de cubicación");
});

test("la matriz de cubicación se lee aunque esté en la segunda hoja", async () => {
  // El flujo de finanzas trae el detalle delante y el dato que importa detrás.
  // Antes se leía sólo la primera hoja y ese dato se perdía.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("flujo-con-cubicacion.xlsx"),
    "xlsx",
    { ...defaults, knownBuildingTokens: new Set(["3", "11"]) },
  );
  const porClave = new Map(resultado.updates.map((u) => [u.key, u.value]));
  assert.equal(porClave.get("buildings.TH-03.progress"), 60.3);
  assert.equal(porClave.get("buildings.TH-11.progress"), 28.1);
  assert.match(resultado.summary, /por disciplina/);
});

test("el Excel de finanzas actualiza el flujo reprogramado mes a mes", async () => {
  // El flujo mensual (hoja Comparación Mensual) es la parte que cambia cada mes.
  // Se lee y se traduce cada mes a su posición en la línea temporal del flujo.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("flujo-finanzas.xlsx"),
    "xlsx",
    { ...defaults, area: "finanzas", knownBuildingTokens: new Set([]) },
  );
  const porClave = new Map(resultado.updates.map((u) => [u.key, u.value]));
  // jul-26 es el índice 7 de la línea temporal.
  assert.equal(porClave.get("reprogrammedFlowMonths.7.currentDop"), 31735296.71);
  assert.equal(porClave.get("reprogrammedFlowMonths.7.urbanismDop"), 8125258.55);
  assert.equal(porClave.get("reprogrammedFlowMonths.7.buildingsDop"), 23610038.16);
  // dic-25 es el índice 0.
  assert.equal(porClave.get("reprogrammedFlowMonths.0.currentDop"), 16398543.68);
  assert.match(resultado.summary, /flujo reprogramado/);
  // La fila TOTAL no es un mes: no genera clave.
  assert.ok(![...porClave.keys()].some((k) => k.includes("NaN")));
});

test("un archivo que no es una hoja de cálculo se rechaza con una indicación", async () => {
  const ingestion = await loadIngestion();
  const basura = new TextEncoder().encode("esto no es un xlsx").buffer;
  const resultado = await ingestion.extractStructuredUpdates(basura, "xlsx", defaults);
  assert.equal(resultado.updates.length, 0);
  assert.ok(resultado.warnings.length > 0);
  assert.match(resultado.warnings[0], /\.xlsx/);
});

test("un edificio que no existe no entra desde una tabla", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("tabla-obra.xlsx"),
    "xlsx",
    { ...defaults, knownBuildingTokens: new Set(["14"]) },
  );
  assert.equal(resultado.updates.length, 1, "sólo TH-14, porque TH-03 no está en la lista");
});
