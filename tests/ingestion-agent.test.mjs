import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (await readFile("lib/ingestion-agent.ts", "utf8"))
  .replace('import "server-only";', "")
  .replace(/import type \{ LiveDataUpdate \} from "\.\/live-data";/, "");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const agent = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

test("monthly variants of a known document share a reusable template fingerprint", async () => {
  const july = await agent.documentTemplateFingerprint({
    fileName: "Cubicacion 8 Araya Julio 2026.xlsx",
    extension: "xlsx",
    area: "obra",
    documentType: "avance_obra",
  });
  const august = await agent.documentTemplateFingerprint({
    fileName: "Cubicacion 9 Araya Agosto 2026.xlsx",
    extension: "xlsx",
    area: "obra",
    documentType: "avance_obra",
  });
  assert.equal(july.namePattern, "cubicacion-{n}-araya-{mes}-{n}");
  assert.equal(august.namePattern, july.namePattern);
  assert.equal(august.fingerprint, july.fingerprint);

  const finance = await agent.documentTemplateFingerprint({
    fileName: "Cubicacion 9 Araya Agosto 2026.xlsx",
    extension: "xlsx",
    area: "finanzas",
    documentType: "estado_financiero",
  });
  assert.notEqual(finance.fingerprint, july.fingerprint);
});

test("dynamic sections choose KPI, bars, chronology and table from their data shape", () => {
  assert.equal(agent.deriveDynamicSectionConfig("18.23").visualization, "kpi");
  assert.equal(agent.deriveDynamicSectionConfig(JSON.stringify({ TH76: 8.04, TH77: 8.33 })).visualization, "bars");
  assert.equal(agent.deriveDynamicSectionConfig(JSON.stringify({ "jun-2026": 18.23, "jul-2026": 22.71 })).visualization, "line");
  assert.equal(agent.deriveDynamicSectionConfig(JSON.stringify([
    { supplier: "A", status: "activo" },
    { supplier: "B", status: "revisión" },
  ])).visualization, "table");
});

test("the independent reconciliation rejects invalid percentages and overlapping writes", () => {
  const valid = agent.reconcileIngestionUpdates([
    { key: "projectSnapshot.overallProgress", value: 22.71 },
    { key: "buildings.75.progress", value: 8.04 },
  ]);
  assert.equal(valid.safe, true);
  assert.equal(valid.percentageKeys, 2);

  const invalid = agent.reconcileIngestionUpdates([
    { key: "projectSnapshot", value: { overallProgress: 22.71 } },
    { key: "projectSnapshot.overallProgress", value: 120 },
  ]);
  assert.equal(invalid.safe, false);
  assert.match(invalid.issues.join(" "), /fuera de 0-100/);
  assert.ok(invalid.conflictingKeys.includes("projectSnapshot"));
});

test("template mappings are compact, stable and deduplicated", () => {
  assert.deepEqual(agent.templateMappingFromUpdates([
    { key: "buildings.75.progress", area: "obra", sourceCurrency: "DOP", valueType: "number" },
    { key: "buildings.75.progress", area: "obra", sourceCurrency: "DOP", valueType: "number" },
    { key: "buildings.76.progress", area: "obra", sourceCurrency: "DOP", valueType: "number" },
  ]).map((item) => item.key), ["buildings.75.progress", "buildings.76.progress"]);
});

test("the agent eval registry contains at least twenty real ARAYA document cases", async () => {
  const cases = JSON.parse(await readFile("tests/fixtures/ingestion-agent-eval-cases.json", "utf8"));
  assert.ok(cases.length >= 20);
  for (const item of cases) {
    assert.equal(typeof item.fileName, "string");
    assert.ok(item.fileName.length > 4);
    assert.ok(["deterministic", "agent", "conversion"].includes(item.route));
    assert.ok(Array.isArray(item.expectedRoots));
    assert.equal(typeof item.expectedBehavior, "string");
  }
  const cubicacion = cases.find((item) => item.fileName === "Cubicacion 8 Araya Jul.xlsx");
  assert.deepEqual(cubicacion.expectedRoots.sort(), ["buildings", "projectSnapshot", "urbanismAreas"].sort());
  assert.match(cubicacion.expectedBehavior, /22,71/);
});

test("new document concepts render through the schema-driven visual component", async () => {
  const [dashboard, css, contract] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("lib/live-data-contract.ts", "utf8"),
  ]);
  assert.match(dashboard, /function DynamicDiscoveredSection/);
  assert.match(dashboard, /visualization === "kpi"/);
  assert.match(dashboard, /visualization === "bars"/);
  assert.match(dashboard, /visualization === "line"/);
  assert.match(dashboard, /visualization === "table"/);
  assert.match(css, /\.dynamic-section-line polyline/);
  assert.match(contract, /visualization: "list"/);
  assert.match(contract, /series: \[\{ label: "", value: 0 \}\]/);
});
