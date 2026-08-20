import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as demoData from "../app/demo-data.ts";
import * as liveData from "../lib/live-data.ts";
import * as projectXml from "../lib/project-xml.ts";
import * as xlsxReader from "../lib/xlsx-reader.ts";
import * as pdfText from "../lib/pdf-text.ts";
import * as progressModel from "../lib/progress-model.ts";

// A diferencia de tests/ingestion-classifier.test.mjs, aquí se carga el
// isLiveDataKey de verdad en vez de sustituirlo por () => true: la validación
// de la clave es justo la que rechazaba los nombres de edificio con guion, así
// que simularla dejaría sin probar lo único que importa de este recorrido.
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
    TextDecoder,
  });
  return compiledModule.exports;
}

async function loadResolver() {
  const source = await readFile(new URL("../lib/spatial-identity-upsert.ts", import.meta.url), "utf8");
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
    if (specifier === "../app/demo-data") return demoData;
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
  });
  return compiledModule.exports.resolveSpatialIdentityUpdates;
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

const defaults = { area: "obra", cutoff: "2026-07-31", sourceCurrency: "DOP", sourceName: "plantilla.csv" };

function comoCsv(texto) {
  return new TextEncoder().encode(texto).buffer;
}

// Recorre la cadena completa tal y como la recorre una subida real: extractor
// determinista, traducción de nombres a posiciones y materialización.
async function publicar(csv) {
  const ingestion = await loadIngestion();
  const resolveSpatialIdentityUpdates = await loadResolver();
  const extraccion = await ingestion.extractStructuredUpdates(comoCsv(csv), "csv", defaults);
  const resueltas = resolveSpatialIdentityUpdates(extraccion.updates, {});
  const values = {};
  for (const update of resueltas) values[update.key] = update.value;
  return { extraccion, values };
}

test("una plantilla rellenada mueve el avance del edificio que nombra", async () => {
  const { extraccion, values } = await publicar(
    "clave,valor,descripcion,valor actual\nbuildings.TH-14.progress,62.5,TH-14 · avance ejecutado (%),3.1\n",
  );
  assert.equal(extraccion.warnings.length, 0, extraccion.warnings.join(" · "));
  assert.equal(extraccion.updates.length, 1);
  const resultado = liveData.materializeLiveRoot("buildings", demoData.buildings, values);
  const indice = demoData.buildings.findIndex((building) => building.shortName === "14");
  assert.equal(resultado[indice].progress, 62.5);
  // El edificio de la posición 14 (TH-13) no puede haberse movido: es el error
  // que cometía el sistema al leer el número como posición.
  assert.equal(resultado[14].progress, demoData.buildings[14].progress);
});

test("las filas sin rellenar no tocan los datos existentes", async () => {
  // El caso real: se rellena una fila de las tres y se sube la plantilla
  // entera. Las vacías tienen que quedarse fuera, no publicar cadenas vacías
  // que borrarían los avances.
  const { extraccion, values } = await publicar([
    "clave,valor,descripcion,valor actual",
    "buildings.TH-14.progress,62.5,TH-14 · avance ejecutado (%),3.1",
    "buildings.TH-03.progress,,TH-03 · avance ejecutado (%),40.6",
    "buildings.TH-07.progress,,TH-07 · avance ejecutado (%),12.2",
  ].join("\n") + "\n");
  assert.equal(extraccion.updates.length, 1, "sólo debe viajar la fila rellenada");
  assert.equal(extraccion.warnings.length, 0, extraccion.warnings.join(" · "));
  const resultado = liveData.materializeLiveRoot("buildings", demoData.buildings, values);
  for (const codigo of ["3", "7"]) {
    const indice = demoData.buildings.findIndex((building) => building.shortName === codigo);
    assert.equal(resultado[indice].progress, demoData.buildings[indice].progress);
  }
});

test("un apartamento nombrado por su código cambia de estado", async () => {
  const { extraccion, values } = await publicar([
    "clave,valor,descripcion,valor actual",
    "buildings.TH-14.units.14-101.progress,100,TH-14 · apto 14-101 · avance (%),0",
  ].join("\n") + "\n");
  assert.equal(extraccion.warnings.length, 0, extraccion.warnings.join(" · "));
  const resultado = liveData.materializeLiveRoot("buildings", demoData.buildings, values);
  const indice = demoData.buildings.findIndex((building) => building.shortName === "14");
  const unidad = resultado[indice].units.find((candidate) => candidate.code === "14-101");
  assert.equal(unidad.progress, 100);
});

test("el urbanismo se actualiza por el identificador de su área", async () => {
  const { extraccion, values } = await publicar([
    "clave,valor,descripcion,valor actual",
    "urbanismAreas.urban-general.progress,24.9,Urbanismo general · avance ejecutado (%),18.28",
  ].join("\n") + "\n");
  assert.equal(extraccion.warnings.length, 0, extraccion.warnings.join(" · "));
  const resultado = liveData.materializeLiveRoot("urbanismAreas", demoData.urbanismAreas, values);
  const area = resultado.find((candidate) => candidate.id === "urban-general");
  assert.equal(area.progress, 24.9);
});

test("las plantillas generadas sólo contienen claves que el modelo admite", async () => {
  const ingestion = await loadIngestion();
  // Todas las plantillas generadas, no una muestra: cada lista del modelo tiene
  // sus propios campos y su propia forma de nombrarse, así que una que quedara
  // fuera de la comprobación podría estar publicando claves que el contrato
  // rechaza sin que nada lo detectara.
  const { readdir } = await import("node:fs/promises");
  const archivos = (await readdir(new URL("../plantillas/", import.meta.url)))
    .filter((nombre) => nombre.endsWith(".csv"))
    .sort();
  assert.ok(archivos.length >= 15, `esperaba al menos 15 plantillas, hay ${archivos.length}`);
  for (const archivo of archivos) {
    const csv = await readFile(new URL(`../plantillas/${archivo}`, import.meta.url), "utf8");
    // Se rellena cada fila con un número para comprobar que ninguna clave de la
    // plantilla es rechazada por el contrato de claves.
    const relleno = csv.split("\n").map((linea, indice) => {
      if (!linea.trim() || indice === 0) return linea;
      const partes = linea.split(",");
      partes[1] = "1";
      return partes.join(",");
    }).join("\n");
    const extraccion = await ingestion.extractStructuredUpdates(comoCsv(relleno), "csv", defaults);
    assert.equal(extraccion.warnings.length, 0, `${archivo}: ${extraccion.warnings.join(" · ")}`);
    assert.ok(extraccion.updates.length > 0, `${archivo} no produjo ninguna actualización`);
  }
});

test("un plan de Project en XML actualiza los edificios que nombra", async () => {
  // El recorrido que antes se rompía: el corte mensual llegaba en .mpp y se
  // archivaba sin leer. Guardado como XML desde Project, sus tareas mueven el
  // avance de los edificios sin intervención.
  const ingestion = await loadIngestion();
  const plan = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    "<Tasks>",
    "<Task><UID>1</UID><Name>TH-14 Estructura</Name><PercentComplete>60</PercentComplete><Summary>0</Summary></Task>",
    "<Task><UID>2</UID><Name>Reunión semanal</Name><PercentComplete>100</PercentComplete><Summary>0</Summary></Task>",
    "</Tasks></Project>",
  ].join("\n");
  const extraccion = await ingestion.extractStructuredUpdates(comoCsv(plan), "xml", {
    ...defaults,
    sourceName: "Araya 26 edificios CORTE mensual (convertido de MPP).xml",
    knownBuildingTokens: new Set(["14"]),
  });
  // Además del edificio, el plan publica el % de cronograma del propio plan.
  const edificios = extraccion.updates.filter((u) => u.key.startsWith("buildings."));
  assert.equal(edificios.length, 1);
  assert.equal(edificios[0].key, "buildings.TH-14.progress");
  assert.equal(edificios[0].value, 60);
  assert.ok(
    extraccion.updates.some((u) => u.key === "projectSnapshot.scheduleProgress"),
    "el plan también actualiza el % de cronograma",
  );

  const resolveSpatialIdentityUpdates = await loadResolver();
  const [resuelta] = resolveSpatialIdentityUpdates(edificios, {});
  assert.equal(resuelta.key, "buildings.13.progress", "TH-14 vive en la posición 13");

  const resultado = liveData.materializeLiveRoot("buildings", demoData.buildings, {
    [resuelta.key]: resuelta.value,
  });
  assert.equal(resultado[13].shortName, "14");
  assert.equal(resultado[13].progress, 60);
});
