import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/reprocesar.mjs", import.meta.url), "utf8");

test("con FILE_ID exacto se ignora el filtro por nombre", () => {
  // Se evalúa la misma expresión que usa el script con distintas entradas.
  const linea = script.match(/const FILTRO = (.+);/)?.[1];
  assert.ok(linea, "debe existir la definición de FILTRO");
  const evaluar = (env, FILE_ID) => new Function("process", "FILE_ID", `return ${linea};`)({ env }, FILE_ID);

  assert.equal(evaluar({ FILTRO: "jul" }, "abc"), "");
  assert.equal(evaluar({}, "abc"), "");
  assert.equal(evaluar({}, ""), "jul");
  assert.equal(evaluar({ FILTRO: "Sem" }, ""), "sem");
  // FILE_ID se define antes que FILTRO.
  assert.ok(script.indexOf("const FILE_ID") < script.indexOf("const FILTRO"));
});
