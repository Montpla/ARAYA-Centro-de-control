import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// El volcado de diagnóstico (reprocesar.yml con debug=1) acaba en el registro
// de GitHub Actions: no puede llevar importes. Se conservan porcentajes,
// cantidades pequeñas, años y fechas de Excel.
test("el volcado de estructura de un XLSX no imprime importes", () => {
  const salida = execFileSync("python3", ["scripts/diagnosticar-xlsx.py", "tests/fixtures/flujo-finanzas.xlsx"], { encoding: "utf8" });
  assert.match(salida, /\[hoja\]/);
  const importes = salida.match(/(?<![A-Za-z$\d.])[-+]?\d[\d,]*(?:\.\d+)?/g)?.filter((token) => {
    const numero = Number(token.replace(/,/g, ""));
    return Math.abs(numero) > 100 && !(Number.isInteger(numero) && ((numero >= 36526 && numero <= 73050) || (numero >= 1900 && numero <= 2100)));
  }) ?? [];
  assert.deepEqual(importes, []);
});
