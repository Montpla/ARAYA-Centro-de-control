import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as liveData from "../lib/live-data.ts";
import * as projectXml from "../lib/project-xml.ts";
import * as xlsxReader from "../lib/xlsx-reader.ts";

async function compilar(ruta, requerir) {
  const source = await readFile(new URL(ruta, import.meta.url), "utf8");
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
    require: requerir,
    console,
    JSON,
    Map,
    Set,
    Number,
    Object,
    Array,
    String,
    Promise,
    TextDecoder,
  });
  return compiled.exports;
}

const cargarTablas = () => compilar("../lib/ooxml-tables.ts", (especificador) => {
  if (especificador === "./xlsx-reader") return xlsxReader;
  throw new Error(`Import inesperado: ${especificador}`);
});

async function cargarIngestion() {
  const ooxml = await cargarTablas();
  return compilar("../lib/ingestion.ts", (especificador) => {
    if (especificador === "./live-data") return liveData;
    if (especificador === "./project-xml") return projectXml;
    if (especificador === "./xlsx-reader") return xlsxReader;
    if (especificador === "./ooxml-tables") return ooxml;
    throw new Error(`Import inesperado: ${especificador}`);
  });
}

async function leerFixture(nombre) {
  const buffer = await readFile(new URL(`./fixtures/${nombre}`, import.meta.url));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const defaults = {
  area: "obra",
  cutoff: "2026-07-31",
  sourceCurrency: "DOP",
  sourceName: "informe.docx",
  knownBuildingTokens: new Set(["14", "3", "7"]),
};

test("lee la tabla de un informe en Word", async () => {
  const ooxml = await cargarTablas();
  const tablas = await ooxml.readOfficeTables(await leerFixture("informe-obra.docx"), "docx");
  assert.equal(tablas.length, 1);
  assert.equal(tablas[0][0].A, "Edificio");
  // Word trocea el texto de una celda en varios fragmentos cuando cambia el
  // formato o pasa el corrector: "TH-" y "14" van en trozos distintos y tienen
  // que volver a unirse.
  assert.equal(tablas[0][1].A, "TH- 14");
});

test("lee las tablas de una presentación, en el orden de las diapositivas", async () => {
  const ooxml = await cargarTablas();
  const tablas = await ooxml.readOfficeTables(await leerFixture("comite-obra.pptx"), "pptx");
  assert.equal(tablas.length, 2, "la portada también es una tabla en esta presentación");
  const avance = tablas[1];
  assert.equal(avance[0].A, "Edificio");
  assert.equal(avance[1].A, "TH-14");
});

test("un informe de Word actualiza los edificios de su tabla", async () => {
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("informe-obra.docx"),
    "docx",
    defaults,
  );
  const claves = resultado.updates.map((update) => update.key).sort().join(" | ");
  assert.equal(claves, "buildings.TH-03.progress | buildings.TH-14.progress");
  assert.equal(resultado.updates.find((u) => u.key === "buildings.TH-14.progress").value, 62.5);
});

test("una presentación de comité también entra por su tabla", async () => {
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("comite-obra.pptx"),
    "pptx",
    defaults,
  );
  assert.equal(resultado.updates.length, 2);
  assert.match(resultado.summary, /2 edificios actualizados/);
});

test("un documento sin tablas lo dice en vez de callarse", async () => {
  const ingestion = await cargarIngestion();
  // Un .docx válido pero sin ninguna tabla: sólo texto corrido, que es lo que
  // sigue necesitando interpretación.
  const vacio = await leerFixture("sin-tablas.docx");
  const resultado = await ingestion.extractStructuredUpdates(vacio, "docx", defaults);
  assert.equal(resultado.updates.length, 0);
  assert.match(resultado.summary, /no contiene ninguna tabla/);
  assert.ok(resultado.warnings.some((aviso) => /texto corrido/.test(aviso)));
});
