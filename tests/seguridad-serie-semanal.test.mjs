import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La serie semanal de Seguridad lleva eventsWeek: null cuando el reporte sólo
// imprime el acumulado. La publicación automática rechazaba cualquier null y
// descartaba la serie entera ("clave no admitida para publicación automática").
test("la publicación automática admite null dentro de una fila, no como valor suelto", async () => {
  const route = await readFile("app/api/files/route.ts", "utf8");
  const cuerpo = route.slice(route.indexOf("function isSafeLiveValue"), route.indexOf("function knownBuildingTokens"));
  assert.match(cuerpo, /if \(value === null\) return depth > 0;/);
  assert.doesNotMatch(cuerpo, /if \(value === null\) return false;/);
});

test("migrar-cortes trata como heredado el inicio del rango y el día de publicación", async () => {
  const script = await readFile("scripts/migrar-cortes.mjs", "utf8");
  assert.match(script, /fechasDelNombre\(file\.name\)\.includes\(declarado\)/);
  assert.match(script, /day\(row\.eventCreatedAt\)\]\.filter\(Boolean\)/);
});
