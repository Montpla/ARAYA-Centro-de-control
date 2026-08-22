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
    console, JSON, Map, Set, Number, Object, Array, String, Promise,
    TextDecoder, TextEncoder, Blob, Response, DecompressionStream, Uint8Array,
  });
  return compiled.exports;
}

async function cargarIngestion() {
  const ooxml = await compilar("../lib/ooxml-tables.ts", (especificador) => {
    if (especificador === "./xlsx-reader") return xlsxReader;
    throw new Error(`Import inesperado: ${especificador}`);
  });
  return compilar("../lib/ingestion.ts", (especificador) => {
    if (especificador === "./live-data") return liveData;
    if (especificador === "./project-xml") return projectXml;
    if (especificador === "./xlsx-reader") return xlsxReader;
    if (especificador === "./ooxml-tables") return ooxml;
    if (especificador === "./pdf-text") return pdfText;
    if (especificador === "./progress-model") return progressModel;
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
  sourceName: "corte.zip",
  knownBuildingTokens: new Set(["14", "7", "3"]),
};

// --- Comprimidos -------------------------------------------------------------

test("un comprimido se abre y se procesa lo que lleva dentro", async () => {
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("corte-mensual.zip"),
    "zip",
    defaults,
  );
  assert.equal(resultado.updates.length, 2);
  assert.match(resultado.summary, /dentro del comprimido/);
  // El nombre del archivo interno se conserva en la procedencia, para que en la
  // auditoría se sepa de cuál de los archivos del ZIP salió cada cifra.
  assert.match(resultado.updates[0].sourceName, /avance-julio\.csv/);
});

test("los restos que mete el sistema al comprimir se ignoran", async () => {
  // Un ZIP hecho en macOS lleva una carpeta __MACOSX con copias ocultas; leerlas
  // duplicaría datos o produciría avisos sin sentido.
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("corte-mensual.zip"),
    "zip",
    defaults,
  );
  assert.ok(resultado.updates.every((update) => !update.sourceName.includes("MACOSX")));
});

test("un ZIP que supera el volumen permitido se rechaza antes de descomprimirlo", async () => {
  const bytes = await leerFixture("corte-mensual.zip");
  await assert.rejects(
    xlsxReader.readZipEntries(bytes, () => true, { maxTotalUncompressedBytes: 1 }),
    /tamaño descomprimido|límite/i,
  );
});

test("un ZIP con una relación de compresión desproporcionada se rechaza", async () => {
  const bytes = await leerFixture("corte-mensual.zip");
  await assert.rejects(
    xlsxReader.readZipEntries(bytes, () => true, { maxCompressionRatio: 0.01 }),
    /compresión (?:no segura|desproporcionada)|relación de compresión/i,
  );
});

test("un ZIP con contraseña explica cómo corregirlo", async () => {
  const original = new Uint8Array(await leerFixture("corte-mensual.zip"));
  const encrypted = original.slice();
  let centralOffset = -1;
  for (let index = 0; index <= encrypted.length - 4; index += 1) {
    if (
      encrypted[index] === 0x50 &&
      encrypted[index + 1] === 0x4b &&
      encrypted[index + 2] === 0x01 &&
      encrypted[index + 3] === 0x02
    ) {
      centralOffset = index;
      break;
    }
  }
  assert.ok(centralOffset >= 0, "el fixture no contiene directorio central");
  encrypted[centralOffset + 8] |= 0x01;

  await assert.rejects(
    xlsxReader.readZipEntries(encrypted.buffer, () => true),
    /contraseña.*sin contraseña/is,
  );
});

// --- PDF ---------------------------------------------------------------------

test("se recupera el texto de un PDF con texto digital", async () => {
  const lectura = await pdfText.readPdfText(await leerFixture("informe-avance.pdf"));
  assert.match(lectura.text, /Informe de avance/);
  assert.match(lectura.text, /TH-14/);
  assert.equal(lectura.scanned, false);
});

test("un PDF escaneado se reconoce como tal en vez de devolver vacío sin más", async () => {
  const lectura = await pdfText.readPdfText(await leerFixture("escaneado.pdf"));
  assert.equal(lectura.text, "");
  assert.equal(lectura.scanned, true, "un escaneo es una imagen, no texto");
});

test("un informe en PDF actualiza los edificios que nombra", async () => {
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("informe-avance.pdf"),
    "pdf",
    defaults,
  );
  assert.equal(resultado.updates.length, 2, "TH-14 y TH-07; la zona común no es un edificio");
  const th14 = resultado.updates.find((update) => update.key === "buildings.TH-14.progress");
  assert.equal(th14.value, 62.5);
});

test("el escaneo lo dice y deja paso a la lectura asistida", async () => {
  const ingestion = await cargarIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("escaneado.pdf"),
    "pdf",
    defaults,
  );
  assert.equal(resultado.updates.length, 0);
  assert.match(resultado.summary, /escaneo/);
});

// --- Prudencia del emparejado ------------------------------------------------

test("no empareja un porcentaje que pertenece a otro edificio", () => {
  // El texto de un PDF llega sin estructura: si entre el código y el número
  // aparece otro edificio, ese número es del segundo y no del primero.
  const filas = pdfText.findBuildingProgress("TH-14 pendiente TH-07 lleva 21 %");
  assert.equal(filas.length, 1);
  assert.equal(filas[0].code, "TH-07");
});

test("no empareja un porcentaje que queda demasiado lejos", () => {
  const lejano = `TH-14 ${"x".repeat(60)} 62 %`;
  assert.equal(pdfText.findBuildingProgress(lejano).length, 0);
});

test("descarta porcentajes imposibles", () => {
  assert.equal(pdfText.findBuildingProgress("TH-14 avance 140 %").length, 0);
});

test("sólo entran los edificios que existen", () => {
  const filas = pdfText.findBuildingProgress("TH-99 avance 50 %", new Set(["14"]));
  assert.equal(filas.length, 0);
});

// Fuentes en subconjunto con tabla /ToUnicode.
//
// Los informes que la empresa genera cada mes (IFC, proveedores) incrustan la
// fuente renumerando sus glifos: el código que va dentro del PDF no es el del
// carácter. Sin traducir esa tabla, "Informe de análisis" se extraía como
// ",QIRUPHGHDQ£OLVLV" —texto de verdad, pero ilegible— y ni la lectura directa
// ni la IA podían hacer nada con él, sin que ningún aviso lo delatara.
test("traduce las fuentes en subconjunto de los informes mensuales", async () => {
  const bytes = await readFile("historical/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf");
  const resultado = await pdfText.readPdfText(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );

  assert.equal(resultado.scanned, false);
  assert.match(resultado.text, /Informe de [Aa]nálisis/);
  assert.match(resultado.text, /IFC/);
  // Los títulos se dibujan letra a letra ("C o m p r o m i s o s"), que es
  // cómo el PDF coloca cada glifo: se comparan sin espacios.
  const sinEspacios = resultado.text.replace(/\s+/g, "");
  assert.match(sinEspacios, /CompromisosAfirmativos/i);
  assert.match(sinEspacios, /UsodeFondos/i);
  // La firma del fallo anterior: el texto desplazado carácter a carácter.
  assert.doesNotMatch(resultado.text, /QIRUPH/);
});

test("un PDF que ya se leía bien no empeora al traducir", async () => {
  const bytes = await readFile("historical/data-center/junio-2026/presentacion-informe-araya-junio-2026.pdf");
  const resultado = await pdfText.readPdfText(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  // Se elige por flujo la lectura más legible, así que una tabla que no
  // corresponde nunca puede dejar el documento peor de lo que estaba.
  // Antes de traducir las tablas este documento daba 587 palabras reconocibles
  // y ahora da 1570: el umbral protege de una regresión sin fijar la cifra
  // exacta, que depende del documento.
  const reconocibles = resultado.text.match(
    /\b(?:de|la|el|los|las|del|en|y|para|con|por|total|informe|proyecto|obra)\b/gi,
  ) ?? [];
  assert.ok(reconocibles.length > 600, `sólo ${reconocibles.length} palabras reconocibles`);
});
