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
  assert.equal(porClave.get("buildings.TH-03.phases.0.progress"), 100);
  assert.equal(
    resultado.updates.find((update) => update.key === "buildings.TH-03.progress").area,
    "obra",
  );
  assert.match(resultado.summary, /por disciplina/);
});

test("la cubicación de TH-76 y TH-77 admite carátula larga y cabeceras reales", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-76-77.xlsx"),
    "xlsx",
    {
      ...defaults,
      area: "finanzas",
      sourceName: "Cubicacion 8 Araya Jul.xlsx",
      knownBuildingTokens: new Set(["76", "77"]),
    },
  );
  const porClave = new Map(resultado.updates.map((update) => [update.key, update]));
  assert.equal(porClave.get("buildings.TH-76.progress").value, 8.25);
  assert.equal(porClave.get("buildings.TH-77.progress").value, 6.5);
  assert.equal(porClave.get("buildings.TH-76.progress").area, "obra");
  assert.deepEqual([...resultado.expectedBuildingCodes].sort(), ["TH-76", "TH-77"]);
});

test("un avance único y explícito del alcance actualiza TH-76 y TH-77", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-alcance-76-77.xlsx"),
    "xlsx",
    {
      ...defaults,
      area: "finanzas",
      sourceName: "Cubicacion 8 Araya Jul.xlsx",
      knownBuildingTokens: new Set(["76", "77"]),
    },
  );
  const porClave = new Map(resultado.updates.map((update) => [update.key, update.value]));
  assert.equal(porClave.get("buildings.TH-76.progress"), 18.45);
  assert.equal(porClave.get("buildings.TH-77.progress"), 18.45);
  assert.match(resultado.summary, /2 edificios actualizados/);
});

test("la carátula de cubicación actualiza edificios, urbanismo y total ponderado", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-caratula-acumulado.xlsx"),
    "xlsx",
    {
      ...defaults,
      area: "finanzas",
      sourceName: "Cubicacion 8 Araya Jul.xlsx",
      knownBuildingTokens: new Set(["76", "77"]),
    },
  );
  const porClave = new Map(resultado.updates.map((update) => [update.key, update]));
  assert.equal(porClave.get("buildings.TH-76.progress").value, 8);
  assert.equal(porClave.get("buildings.TH-77.progress").value, 9);
  assert.equal(porClave.get("urbanismAreas.0.progress").value, 25);
  assert.equal(porClave.get("projectSnapshot.overallProgress").value, 14);
  assert.equal(porClave.get("projectSnapshot.overallProgress").area, "obra");
  assert.deepEqual([...resultado.expectedBuildingCodes].sort(), ["TH-76", "TH-77"]);
});

test("el detalle de partidas de la cubicación actualiza el avance por oficio (Albañilería, Instalaciones...)", async () => {
  // La oficina reportó que "los porcentajes de los apartamentos" no se movían
  // aunque la cubicación traía avance real: la carátula sólo trae el % por
  // edificio, nunca el % por oficio del que cuelga Albañilería/Instalaciones
  // en cada apartamento (lib/unit-progress.ts). Este es el fixture reducido
  // de la hoja de detalle real (Cubicación Nº9) que hizo evidente el hueco.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-detalle-partidas.xlsx"),
    "xlsx",
    {
      ...defaults,
      sourceName: "Cubicacion 9 Araya Agos.xlsx",
    },
  );
  const porClave = new Map(resultado.updates.map((update) => [update.key, update]));
  // Superestructura suma dos edificios: (800+500+500)/(1000+500+500) = 90%.
  assert.equal(porClave.get("constructionDisciplines.Superestructura.progress").value, 90);
  assert.equal(porClave.get("constructionDisciplines.Superestructura.progress").area, "obra");
  // Albañilería: 600/1200 = 50%.
  assert.equal(porClave.get("constructionDisciplines.Albañilería.progress").value, 50);
  // El nombre canónico ("Inst. eléctricas, sanitarias y gas") lleva un punto:
  // la clave no puede traerlo tal cual porque partiría la ruta en un
  // segmento de más. 150/300 = 50%.
  assert.equal(porClave.get("constructionDisciplines.Inst eléctricas, sanitarias y gas.progress").value, 50);
  assert.match(resultado.summary, /3 oficio\(s\) de construcción actualizados/);
});

test("el detalle de partidas de la cubicación no confunde un subgrupo con el cierre del oficio", async () => {
  // "Hormigón." (subgrupo dentro de SUPERESTRUCTURA) y "ARAYA-E02 EDIFICIO 2"
  // (encabezado de edificio) no son ninguno de los 9 oficios: no deben cerrar
  // el oficio en curso ni colarse como uno nuevo.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-detalle-partidas.xlsx"),
    "xlsx",
    { ...defaults, sourceName: "Cubicacion 9 Araya Agos.xlsx" },
  );
  const claves = resultado.updates.map((update) => update.key);
  assert.equal(claves.length, 3);
  assert.ok(!claves.some((key) => /hormigon|edificio/i.test(key)));
});

test("una celda vacía-con-estilo no le roba el valor a la celda siguiente", async () => {
  // Bug real encontrado con "Costo Ago-26.xlsx": el patrón `<c r="X" s="1"/>`
  // -una celda vacía pero con estilo, la forma real en que Excel escribe una
  // celda sin contenido dentro de una tabla con formato- se emparejaba con el
  // `</c>` de la SIGUIENTE celda en vez de reconocerse como autocontenida,
  // porque `[^>]*` no excluye "/". El valor de la celda de después migraba
  // entero a la vacía anterior y esa celda desaparecía sin avisar. Terreno
  // (fila de "1-1-1 Terreno" en el fixture) reproduce el caso: la columna C
  // vacía justo antes de D con el valor.
  const filas = await xlsxReader.readXlsxRows(await leerFixture("costo-por-categoria.xlsx"));
  const terreno = filas.find((fila) => fila.A === "1-1-1 Terreno");
  assert.equal(terreno.C, undefined, "la celda vacía-con-estilo no debe tener valor");
  assert.equal(terreno.D, "1000", "el valor de la celda siguiente debe quedarse en su propia columna");
});

test("el desglose de costos por partida se agrupa por el capítulo contable (1/2/3)", async () => {
  // costBreakdown del panel sólo tiene tres categorías (Construcción,
  // Operación, Otros); el propio código de partida ya las agrupa así (1 =
  // obra, 2 = comercialización y fiduciaria, 3 = legal y financiero), así
  // que no hace falta inventar un criterio de reparto.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("costo-por-categoria.xlsx"),
    "xlsx",
    { ...defaults, sourceName: "Costo Ago-26.xlsx" },
  );
  const porClave = new Map(resultado.updates.map((update) => [update.key, update]));
  // Construcción suma Terreno (1000, sin movimiento en agosto) + Urbanismo
  // (700 acumulado, 200 de movimiento): 1700 acumulado, 200 de movimiento.
  assert.equal(porClave.get("costBreakdown.Construcción.cumulative").value, 1700);
  assert.equal(porClave.get("costBreakdown.Construcción.june").value, 200);
  assert.equal(porClave.get("costBreakdown.Construcción.cumulative").area, "finanzas");
  assert.equal(porClave.get("costBreakdown.Operación.cumulative").value, 350);
  assert.equal(porClave.get("costBreakdown.Operación.june").value, 50);
  assert.equal(porClave.get("costBreakdown.Otros.cumulative").value, 110);
  assert.equal(porClave.get("costBreakdown.Otros.june").value, 10);
  // La fila "Total" no tiene código de capítulo: no debe generar una cuarta clave.
  assert.equal(resultado.updates.length, 6);
});

test("el monto certificado de la cubicación se añade a la carátula sin perder otras cubicaciones", async () => {
  // "Avance edificio.xlsx" (Cubicación 9) trae, en otra hoja, el monto
  // certificado del periodo -el número financiero real de la cubicación
  // mensual- que ni la carátula de avance físico ni el detalle de partidas
  // leían. cubicacionCaratula es una lista con una entrada por cubicación:
  // como cada mes trae un número nuevo, la entrada anterior (Cubicación
  // Nº8, de un mes distinto) debe seguir intacta en el resultado.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-monto-resumen.xlsx"),
    "xlsx",
    {
      ...defaults,
      sourceName: "Avance edificio.xlsx",
      currentCubicacionCaratula: [
        { label: "Cubicación Nº8", montoDop: 33639335.59, cutoff: "2026-07-31" },
      ],
    },
  );
  assert.equal(resultado.updates.length, 1);
  const [update] = resultado.updates;
  assert.equal(update.key, "cubicacionCaratula");
  assert.equal(update.area, "finanzas");
  // vm.runInNewContext produce objetos de otro realm: deepEqual los rechaza
  // por prototipo aunque su contenido sea idéntico, así que se compara la
  // forma serializada.
  assert.equal(JSON.stringify(update.value), JSON.stringify([
    { label: "Cubicación Nº8", montoDop: 33639335.59, cutoff: "2026-07-31" },
    { label: "Cubicación Nº9", montoDop: 28030340.5, cutoff: "2026-07-31" },
  ]));
});

test("una corrección del monto de una cubicación reemplaza la entrada anterior, no la duplica", async () => {
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("cubicacion-monto-resumen.xlsx"),
    "xlsx",
    {
      ...defaults,
      sourceName: "Avance edificio.xlsx",
      currentCubicacionCaratula: [
        { label: "Cubicación Nº8", montoDop: 33639335.59, cutoff: "2026-07-31" },
        { label: "Cubicación Nº9", montoDop: 1, cutoff: "2026-06-30" },
      ],
    },
  );
  assert.equal(JSON.stringify(resultado.updates[0].value), JSON.stringify([
    { label: "Cubicación Nº8", montoDop: 33639335.59, cutoff: "2026-07-31" },
    { label: "Cubicación Nº9", montoDop: 28030340.5, cutoff: "2026-07-31" },
  ]));
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

test("la Curva S del Excel maestro actualiza el plan y lo ejecutado mes a mes", async () => {
  // jun-25 es el mes 0 del calendario de monthlyPlan; los dos ultimos meses de
  // "EJECUTADO REAL" en el fixture son ceros de formula (aun no ocurrieron) y
  // se publican tal cual, igual que hace Excel.
  const ingestion = await loadIngestion();
  const resultado = await ingestion.extractStructuredUpdates(
    await leerFixture("curva-s.xlsx"),
    "xlsx",
    defaults,
  );
  assert.equal(resultado.warnings.length, 0, resultado.warnings.join(" · "));
  const porClave = new Map(resultado.updates.map((update) => [update.key, update.value]));
  assert.equal(porClave.get("monthlyPlan.0.planned"), 0);
  assert.equal(porClave.get("monthlyPlan.0.actual"), 0);
  assert.equal(porClave.get("monthlyPlan.1.planned"), 5);
  assert.equal(porClave.get("monthlyPlan.1.actual"), 4);
  assert.equal(porClave.get("monthlyPlan.3.planned"), 15);
  assert.equal(porClave.get("monthlyPlan.3.actual"), 13);
  assert.equal(porClave.get("monthlyPlan.5.planned"), 25);
  assert.equal(porClave.get("monthlyPlan.5.actual"), 0);
  assert.equal(resultado.updates.length, 12);
  assert.match(resultado.summary, /Curva S actualizada: 6 meses/);
  assert.equal(
    resultado.updates.find((update) => update.key === "monthlyPlan.1.planned").area,
    "obra",
  );
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
