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
  const updates = ingestion.extractSafetyUpdates(laminas, {
    area: "obra_seguridad",
    cutoff: "30/06/2026",
    sourceCurrency: "DOP",
    sourceName: "informe-obra-araya-junio-2026.pptx",
  });

  // Sin área y corte, la publicación automática descarta el dato y se queda
  // esperando una revisión manual que nadie sabe que tiene pendiente.
  for (const update of updates) {
    assert.equal(update.area, "obra_seguridad", update.key);
    assert.equal(update.cutoff, "30/06/2026", update.key);
  }

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
  ], { area: "finanzas", cutoff: "30/06/2026", sourceCurrency: "DOP", sourceName: "x.pptx" });
  assert.deepEqual(updates, []);
});

// Matriz de obligaciones del préstamo con IFC.
//
// Estaba escrita a mano en el código: el informe se podía abrir desde el panel,
// pero sustituirlo no cambiaba nada de lo que se veía. La prueba va contra el
// PDF real porque su dificultad está en el propio documento: titula las
// secciones dibujando cada letra por separado y separa la primera letra de
// algunas palabras para ajustar el espaciado.
const pdfTextReal = await import("../lib/pdf-text.ts");

test("el informe IFC rellena la matriz de obligaciones", async () => {
  const bytes = await readFile("historical/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf");
  const lectura = await pdfTextReal.readPdfText(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const updates = ingestion.extractIfcCommitments(lectura.text, {
    area: "finanzas",
    cutoff: "29/07/2026",
    sourceCurrency: "DOP",
    sourceName: "informe-analisis-ifc-2026-07-29.pdf",
  });
  assert.equal(updates[0].area, "finanzas");
  assert.equal(updates.length, 1);
  const grupos = updates[0].value;
  assert.ok(grupos.length >= 5, `sólo ${grupos.length} bloques`);

  const titulos = grupos.map((grupo) => grupo.title);
  assert.ok(titulos.includes("Compromisos Afirmativos"), titulos.join(" | "));
  // Los conectores se recomponen sin partir la palabra anterior.
  assert.ok(titulos.includes("Requisitos de Información"), titulos.join(" | "));
  assert.ok(titulos.includes("Cláusula de Nación Más Favorecida"), titulos.join(" | "));
  // La introducción es contexto, no una obligación.
  assert.ok(!titulos.some((titulo) => /introducci/i.test(titulo)), titulos.join(" | "));

  const afirmativos = grupos.find((grupo) => grupo.title === "Compromisos Afirmativos");
  // El primer compromiso perdía su primera palabra cuando el título se leía
  // carácter a carácter en vez de por piezas.
  assert.ok(
    afirmativos.items.some((item) => item.startsWith("Existencia y Conducción del Negocio:")),
    afirmativos.items[0],
  );

  const negativos = grupos.find((grupo) => grupo.title === "Compromisos Negativos");
  // El PDF dibuja "T ransacciones" para ajustar el espaciado.
  assert.ok(negativos.items.some((item) => item.startsWith("Transacciones de Derivados:")), negativos.items.join(" | "));

  // Y nada de los datos de la fuente incrustada que van tras el texto.
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      assert.match(item, /^[\p{L}\p{N}][\p{L}\p{N} ,.;:%()¿?¡!'"·/-]*$/u, item);
    }
  }
});

test("un PDF cualquiera no genera matriz de obligaciones", () => {
  assert.deepEqual(ingestion.extractIfcCommitments("Informe de obra de junio. El edificio TH-14 va por el 60%.", { area: "obra", cutoff: "30/06/2026", sourceCurrency: "DOP", sourceName: "x.pdf" }), []);
});

// Informe de ventas: el PowerPoint de prosa que la IA leía a medias.
//
// La IA extraía cobranza y contratos pero se dejaba el mix de producto y las
// reservas por fase, así que esos gráficos no se movían. El lector determinista
// los saca de las frases fijas del informe. La prueba va contra el informe de
// junio del repositorio, que es el mismo formato mensual que el de julio.
test("el informe de ventas se lee entero sin IA", async () => {
  const bytes = await readFile("historical/data-center/junio-2026/informe-ventas-araya-junio-2026.pptx");
  const laminas = await readPptxSlideShapes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const texto = laminas.map((formas) => formas.map((forma) => forma.join(" ")).join(" ")).join(" ");
  const updates = ingestion.extractSalesReport(texto, {
    area: "comercial", cutoff: "30/06/2026", sourceCurrency: "USD", sourceName: "informe-ventas.pptx",
  });
  const mapa = Object.fromEntries(updates.map((u) => [u.key, u.value]));

  // Reservas y fases.
  assert.equal(mapa["juneReport.sales.reservations"], 279);
  assert.equal(mapa["juneReport.sales.active"], 228);
  assert.equal(mapa["juneReport.sales.phaseOneActive"], 136);
  assert.equal(mapa["juneReport.sales.withdrawn"], 51);
  // Pipeline de contratos.
  assert.equal(mapa["juneReport.contracts.reviewed"], 198);
  assert.equal(mapa["juneReport.contracts.awaitingDocuments"], 24);
  // Cobranza, que es lo que ya salía bien pero ahora sin depender de la IA.
  assert.equal(mapa["juneReport.collections.contracts"], 172);
  assert.equal(mapa["juneReport.collections.current"], 106);
  assert.equal(mapa["juneReport.collections.overdueUsd"], 148281.58);
  assert.equal(mapa["juneReport.collections.cutoff"], "06/07/2026");
  // Mix de producto: justo lo que la IA se dejaba. Va por nombre; el resolver
  // lo lleva a su posición.
  assert.equal(mapa["salesModels.Sunset.value"], 32);
  assert.equal(mapa["salesModels.Garden.value"], 28);
  // Metas de recaudación.
  assert.equal(mapa["collectionTargets.Fase I.targetUsd"], 22100000);
  assert.equal(mapa["collectionTargets.Fase II.targetUsd"], 25200000);
});

// Las dos frases que el informe declara en prosa (no en tabla): el techo de
// morosidad y el recaudo logrado frente a lo proyectado. Antes se quedaban como
// «propuesta de sección nueva» sin llegar al panel; ahora el lector los saca del
// texto como cualquier otro dato mensual.
test("el lector de ventas saca la morosidad y el recaudo declarados en frase", () => {
  const texto =
    "Informe de ventas ARAYA. Reservas activas 228. " +
    "La morosidad no supera el 1% de la cartera. " +
    "Se ha logrado el recaudo de más del 92% de lo proyectado según ventas formalizadas.";
  const updates = ingestion.extractSalesReport(texto, {
    area: "comercial", cutoff: "30/07/2026", sourceCurrency: "USD", sourceName: "informe-ventas.pptx",
  });
  const mapa = Object.fromEntries(updates.map((u) => [u.key, u.value]));
  assert.equal(mapa["juneReport.collections.arrearsMaxPercent"], 1);
  assert.equal(mapa["juneReport.collections.collectedVsProjectedPercent"], 92);
});

test("el lector de ventas saca el ritmo mensual de reservas por modelo", () => {
  const texto =
    "Informe de ventas ARAYA. Reservas por Modelos. " +
    "Balcony – 6.3 Unidades / Mes; Garden - 4,9 Unidades/Mes; " +
    "Sunset — 6.8 Unidades / Mes; Flex - 3.8 Unidades / Mes.";
  const updates = ingestion.extractSalesReport(texto, {
    area: "comercial", cutoff: "31/07/2026", sourceCurrency: "USD", sourceName: "informe-ventas.pptx",
  });
  const mapa = Object.fromEntries(updates.map((u) => [u.key, u.value]));

  assert.equal(mapa["juneReport.sales.reservationsByModel.Balcony"], 6.3);
  assert.equal(mapa["juneReport.sales.reservationsByModel.Garden"], 4.9);
  assert.equal(mapa["juneReport.sales.reservationsByModel.Sunset"], 6.8);
  assert.equal(mapa["juneReport.sales.reservationsByModel.Flex"], 3.8);
});

test("un PowerPoint que no es de ventas no dispara el lector", () => {
  assert.deepEqual(
    ingestion.extractSalesReport("Informe de obra. Avance físico del edificio TH-14.", {
      area: "obra", cutoff: "30/06/2026", sourceCurrency: "DOP", sourceName: "x.pptx",
    }),
    [],
  );
});
