import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("reprocesar.mjs ignora FILTRO cuando se indica FILE_ID", async () => {
  const src = await readFile("scripts/reprocesar.mjs", "utf8");
  // Con FILE_ID el filtro queda vacío (includes("") casa con todo).
  assert.match(src, /const FILTRO = FILE_ID \? "" : \(process\.env\.FILTRO \?\? "jul"\)\.toLowerCase\(\);/);
  // FILE_ID se declara antes de usarse para calcular FILTRO.
  assert.ok(src.indexOf("const FILE_ID") < src.indexOf("const FILTRO"));
  // Sin FILE_ID se conserva el valor por defecto «jul».
  assert.match(src, /process\.env\.FILTRO \?\? "jul"/);
});
