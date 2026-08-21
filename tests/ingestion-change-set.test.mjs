import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile("lib/ingestion-change-set.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const changeSet = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);

test("unchanged facts do not create another live revision", () => {
  assert.equal(
    changeSet.liveValueJsonEquals('{"b":2,"a":{"y":4,"x":3}}', '{"a":{"x":3,"y":4},"b":2}'),
    true,
  );
  const result = changeSet.partitionChangedLiveUpdates([
    { key: "projectSnapshot.overallProgress", valueJson: "22.71" },
    { key: "projectSnapshot.plannedProgress", valueJson: "26.61" },
    { key: "safetyMetrics.accidentCount", valueJson: "0" },
  ], [
    { key: "projectSnapshot.overallProgress", valueJson: "22.71" },
    { key: "projectSnapshot.plannedProgress", valueJson: "26.60" },
  ]);
  assert.deepEqual(result.unchanged.map((item) => item.key), ["projectSnapshot.overallProgress"]);
  assert.deepEqual(result.changed.map((item) => item.key), [
    "projectSnapshot.plannedProgress",
    "safetyMetrics.accidentCount",
  ]);
});

test("confidence follows the fact after identity resolution and filtering", () => {
  const confidences = changeSet.resolveNormalizedUpdateConfidences([
    { key: "buildings.76.progress", valueJson: "8.33" },
    { key: "buildings.75.progress", valueJson: "8.04" },
    { key: "discoveredSections.3", valueJson: '{"title":"Tema"}' },
  ], [
    { key: "buildings.75.progress", valueJson: "8.04", confidence: 0.91 },
    { key: "discoveredSections.3", valueJson: '{"title":"Tema"}', confidence: 0.84 },
    { key: "buildings.76.progress", valueJson: "8.33", confidence: 0.97 },
  ]);
  assert.deepEqual(confidences, [0.97, 0.91, 0.84]);
});

test("recurring dynamic concepts update their existing visual section", () => {
  const slots = changeSet.planDynamicSectionSlots([
    { title: "Actos seguros", area: "seguridad" },
    { title: "Nueva métrica", area: "obra" },
    { title: "Nueva métrica", area: "obra" },
  ], {
    "discoveredSections.2": {
      id: "seguridad-actos",
      title: "ACTOS SEGUROS",
      area: "seguridad",
    },
  });
  assert.deepEqual(slots, [
    { key: "discoveredSections.2", existingId: "seguridad-actos" },
    { key: "discoveredSections.3", existingId: "" },
    { key: "discoveredSections.3", existingId: "" },
  ]);
});
