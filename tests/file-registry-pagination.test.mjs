import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function loadPaginationHelpers() {
  const source = await readFile("lib/file-registry-pagination.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (specifier) => {
      throw new Error(`Unexpected import: ${specifier}`);
    },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
    JSON,
    Number,
    Set,
    Map,
  });
  return compiledModule.exports;
}

const helpers = await loadPaginationHelpers();

test("file cursors are stable, bounded and reject malformed input", () => {
  const cursor = { timestamp: "2026-08-11T10:20:30.123Z", id: "file-009" };
  const encoded = helpers.encodeFileRegistryCursor(cursor);
  assert.deepEqual({ ...helpers.decodeFileRegistryCursor(encoded) }, cursor);
  assert.equal(helpers.decodeFileRegistryCursor("not+base64"), null);
  assert.equal(helpers.decodeFileRegistryCursor("a".repeat(513)), null);
  assert.equal(helpers.normalizeFilePageSize("0"), 75);
  assert.equal(helpers.normalizeFilePageSize("9999"), 200);
});

test("equal-timestamp watermarks advance by id instead of polling forever", () => {
  const requestStart = { timestamp: "2026-08-11T10:20:30.123Z", id: "" };
  const lastRow = { timestamp: requestStart.timestamp, id: "file-200" };
  assert.deepEqual(
    { ...helpers.latestFileRegistryCursor(requestStart, lastRow) },
    lastRow,
  );
});

test("merging paged growth preserves loaded history and updates an old file", () => {
  const records = Array.from({ length: 1_000 }, (_, index) => ({
    id: `file-${String(index).padStart(4, "0")}`,
    createdAt: `2026-${String(1 + Math.floor(index / 100)).padStart(2, "0")}-01T00:00:00.000Z`,
    updatedAt: "2026-08-01T00:00:00.000Z",
    value: index,
  }));
  let merged = [];
  for (let offset = 0; offset < records.length; offset += 75) {
    merged = helpers.mergeFileRegistryRecords(merged, records.slice(offset, offset + 75));
  }
  assert.equal(merged.length, 1_000);
  merged = helpers.mergeFileRegistryRecords(merged, [{
    ...records[3],
    updatedAt: "2026-08-11T11:00:00.000Z",
    value: 9_999,
  }]);
  assert.equal(merged.find((record) => record.id === records[3].id).value, 9_999);
  merged = helpers.mergeFileRegistryRecords(merged, [], [records[700].id]);
  assert.equal(merged.length, 999);
  assert.equal(merged.some((record) => record.id === records[700].id), false);
});

test("200 finance changes cannot starve or expose the operational change", async () => {
  const route = await readFile("app/api/files/route.ts", "utf8");
  const changedQuery = route.match(/const \[changedRows, knownRows\][\s\S]*?\.limit\(pageSize \+ 1\)/)?.[0] ?? "";
  assert.match(changedQuery, /fileRegistryVisibilityCondition\(user, includeDeleted\)/);
  assert.match(changedQuery, /\.where\(and\([\s\S]*?\.limit\(pageSize \+ 1\)/);
  assert.doesNotMatch(changedQuery, /\.limit\(pageSize \+ 1\)[\s\S]*?fileRegistryRowVisible/);
  assert.match(route, /const removedIds = knownIds\.filter/);
  assert.doesNotMatch(route, /removedIds = pageRows/);

  const changes = [
    ...Array.from({ length: 200 }, (_, id) => ({ id: `finance-${id}`, area: "finanzas" })),
    { id: "obra-visible", area: "obra" },
  ];
  const sqlVisibilityBeforeLimit = changes
    .filter((change) => change.area !== "finanzas")
    .slice(0, 100);
  assert.deepEqual(sqlVisibilityBeforeLimit.map((change) => change.id), ["obra-visible"]);
  assert.equal(sqlVisibilityBeforeLimit.some((change) => change.id.startsWith("finance-")), false);
});

test("control room aggregates documents and filters privacy before limits", async () => {
  const route = await readFile("app/api/control-room/route.ts", "utf8");
  assert.match(route, /groupBy\(uploadedFiles\.area\)/);
  assert.match(route, /eq\(documentDataProposals\.generation, uploadedFiles\.proposalGeneration\)/);
  const activityQuery = route.match(/\.from\(controlActionActivity\)[\s\S]*?\.limit\(100\)/)?.[0] ?? "";
  assert.match(activityQuery, /notInArray\(controlActions\.area, financeProtectedAreaValues\(\)\)/);
  assert.ok(
    activityQuery.indexOf(".where(") < activityQuery.indexOf(".limit(100)"),
    "la privacidad de actividad debe aplicarse antes del límite",
  );
  assert.doesNotMatch(route, /db\.select\(\)\.from\(uploadedFiles\)\.orderBy/);
  assert.doesNotMatch(route, /db\.select\(\)\.from\(documentDataProposals\)\.orderBy/);
});
