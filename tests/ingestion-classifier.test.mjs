import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile("lib/ingestion.ts", "utf8");
// Este fichero se evalúa como data URL, que no resuelve rutas relativas, así
// que los dos imports locales se sustituyen por sustitutos. Aquí sólo se prueba
// el clasificador documental, que no usa ninguno de los dos.
const executableSource = source
  .replace(
    /import \{ LiveDataUpdate, LiveDataValue, isLiveDataKey \} from "\.\/live-data";/,
    "const isLiveDataKey = () => true;",
  )
  .replace(
    /import \{ extractProjectXmlUpdates, isProjectXml \} from "\.\/project-xml";/,
    "const isProjectXml = () => false;\nconst extractProjectXmlUpdates = () => ({ updates: [], warnings: [], summary: \"\", taskCount: 0 });",
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

test("structured CSV prepares model updates without publishing them", () => {
  const bytes = new TextEncoder().encode(
    "key,value,area,cutoff,moneda\nprojectSnapshot.overallProgress,18.9,obra,2026-07-30,DOP",
  ).buffer;
  const result = ingestion.extractStructuredUpdates(bytes, "csv", {
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

test("semicolon CSV preserves decimal commas", () => {
  const bytes = new TextEncoder().encode(
    "clave;valor;area;corte;moneda\nprojectSnapshot.overallProgress;18,23;obra;2026-06-30;DOP",
  ).buffer;
  const result = ingestion.extractStructuredUpdates(bytes, "csv", {
    area: "obra",
    cutoff: "2026-06-30",
    sourceCurrency: "DOP",
    sourceName: "avance-europeo.csv",
  });
  assert.equal(result.updates[0].value, 18.23);
});
