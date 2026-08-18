import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile("lib/ingestion.ts", "utf8");

// Este fichero se evalúa como data URL, que no resuelve rutas relativas, así
// que los imports locales se sustituyen por sustitutos. Aquí sólo se prueba el
// clasificador documental, que no usa ninguno de ellos.
//
// La sustitución mira el módulo y no la lista de nombres importados: escribirla
// contra la lista exacta hacía que añadir un lector nuevo —o una función más a
// uno existente— dejara el import intacto, y el fallo aparecía como un volcado
// de base64 ilegible en vez de decir qué faltaba.
const sustitutos = {
  "./live-data": "const isLiveDataKey = () => true;",
  "./ooxml-tables": [
    "const readOfficeTables = async () => [];",
    "const readPptxSlideShapes = async () => [];",
  ].join("\n"),
  "./xlsx-reader": [
    "const readXlsxSheets = async () => [];",
    "const readZipEntries = async () => [];",
    "const rowsToRecords = () => ({ headerRow: -1, records: [] });",
  ].join("\n"),
  "./project-xml": [
    "const isProjectXml = () => false;",
    'const buildingCodeFromTaskName = () => "";',
    'const extractProjectXmlUpdates = () => ({ updates: [], warnings: [], summary: "", taskCount: 0 });',
  ].join("\n"),
  "./pdf-text": [
    'const readPdfText = async () => ({ text: "", streams: 0, scanned: false });',
    "const findBuildingProgress = () => [];",
  ].join("\n"),
  "./progress-model": [
    "const PHASE_WEIGHTS = [];",
    "const buildingProgressFromPhases = () => 0;",
  ].join("\n"),
};

const executableSource = source.replace(
  /import \{[^}]*\} from "(\.\/[^"]+)";/g,
  (_linea, modulo) => {
    const sustituto = sustitutos[modulo];
    if (!sustituto) {
      throw new Error(
        `lib/ingestion.ts importa "${modulo}" y esta prueba no tiene un sustituto para él. ` +
          "Añádelo al mapa `sustitutos` de tests/ingestion-classifier.test.mjs.",
      );
    }
    return sustituto;
  },
);
const transpiled = ts.transpileModule(executableSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const ingestion = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
const cases = JSON.parse(await readFile("tests/fixtures/ingestion-eval-cases.json", "utf8"));

test("deterministic ingestion classifier passes the 24-document evaluation set", () => {
  assert.ok(cases.length >= 20);
  for (const item of cases) {
    const result = ingestion.analyzeDocument({
      fileName: item.fileName,
      description: item.description,
      extension: item.extension,
      declaredCutoff: "",
      area: item.area,
      classificationConfidence: 0.9,
    });
    assert.equal(result.documentType, item.expectedType, item.fileName);
    assert.equal(result.detectedPeriod, item.expectedPeriod, item.fileName);
  }
});

test("structured CSV prepares model updates without publishing them", async () => {
  const bytes = new TextEncoder().encode(
    "key,value,area,cutoff,moneda\nprojectSnapshot.overallProgress,18.9,obra,2026-07-30,DOP",
  ).buffer;
  const result = await ingestion.extractStructuredUpdates(bytes, "csv", {
    area: "obra",
    cutoff: "2026-07-30",
    sourceCurrency: "DOP",
    sourceName: "avance.csv",
  });
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].key, "projectSnapshot.overallProgress");
  assert.equal(result.updates[0].value, 18.9);
  assert.match(result.summary, /preparados para contraste/);
});

test("semicolon CSV preserves decimal commas", async () => {
  const bytes = new TextEncoder().encode(
    "clave;valor;area;corte;moneda\nprojectSnapshot.overallProgress;18,23;obra;2026-06-30;DOP",
  ).buffer;
  const result = await ingestion.extractStructuredUpdates(bytes, "csv", {
    area: "obra",
    cutoff: "2026-06-30",
    sourceCurrency: "DOP",
    sourceName: "avance-europeo.csv",
  });
  assert.equal(result.updates[0].value, 18.23);
});

// Seguridad y Salud leída del informe de obra real.
//
// Es el área que nunca se actualizaba sola: sus indicadores no están en
// ninguna tabla, sino en cuadros de texto sueltos (el número en uno, su
// etiqueta en el siguiente), y de un PowerPoint sólo se leían tablas. La
// prueba se hace contra el .pptx de junio que está en el repositorio, porque
// lo que hay que garantizar es que ese documento —el que se sube cada mes—
// rellena el área sin intervención.
// ooxml-tables.ts es el único de estos módulos con una importación local, y
// evaluado sin empaquetador no se resuelve sin extensión: se transpila igual
// que ingestion.ts, enchufándole el lector de ZIP de verdad (hace falta el
// real, porque un .pptx es un ZIP y aquí se abre uno auténtico).
globalThis.__xlsxReader = await import("../lib/xlsx-reader.ts");
const ooxmlSource = (await readFile("lib/ooxml-tables.ts", "utf8")).replace(
  /import \{[^}]*\} from "\.\/xlsx-reader";/,
  "const { decodeXml, readZipEntries } = globalThis.__xlsxReader;",
);
const ooxmlTranspiled = ts.transpileModule(ooxmlSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { readPptxSlideShapes } = await import(
  `data:text/javascript;base64,${Buffer.from(ooxmlTranspiled).toString("base64")}`
);

test("el informe de obra rellena seguridad sin intervención", async () => {
  const bytes = await readFile("historical/data-center/junio-2026/informe-obra-araya-junio-2026.pptx");
  const laminas = await readPptxSlideShapes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const updates = ingestion.extractSafetyUpdates(laminas);

  const metricas = updates.find((update) => update.key === "safetyMetrics");
  assert.ok(metricas, "no se leyeron los indicadores de seguridad del informe");
  assert.ok(metricas.value.length >= 5, `sólo se leyeron ${metricas.value.length} indicadores`);

  const accidentes = metricas.value.find((metrica) => /accidente/i.test(metrica.label));
  assert.ok(accidentes, "falta el indicador de accidentes");
  assert.equal(accidentes.value, "0");

  const personal = metricas.value.find((metrica) => /personal/i.test(metrica.label));
  assert.equal(personal.value, "120");

  // El número de diapositiva del pie no puede colarse como indicador.
  assert.ok(
    !metricas.value.some((metrica) => /fideicomiso|punta cana/i.test(metrica.label)),
    "el pie de página se coló como indicador",
  );

  const hallazgos = updates.find((update) => update.key === "safetyFindings");
  assert.ok(hallazgos, "no se leyeron los hallazgos de campo");
  assert.ok(hallazgos.value.some((linea) => /EPP/i.test(linea)), "falta el hallazgo de EPP");
  assert.ok(hallazgos.value.length >= 4, `sólo se leyeron ${hallazgos.value.length} hallazgos`);
});

test("una lámina sin seguridad no inventa indicadores", () => {
  const updates = ingestion.extractSafetyUpdates([
    [["Resumen financiero"], ["1.234.567"], ["Coste acumulado"], ["Junio 2026"]],
  ]);
  assert.deepEqual(updates, []);
});
