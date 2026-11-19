import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [responder, verificar, instrucciones, reglas] = await Promise.all([
  readFile(".github/workflows/responder-carga.yml", "utf8"),
  readFile(".github/workflows/verificar-carga.yml", "utf8"),
  readFile(".github/claude/arreglar-carga.md", "utf8"),
  readFile(".github/claude/reglas-de-prioridad.md", "utf8"),
]);

test("sólo el dueño puede decidir desde una incidencia de carga", () => {
  assert.match(responder, /author_association == 'OWNER'/);
  assert.match(responder, /startsWith\(github\.event\.issue\.title, '🔎 Revisar carga:'\)/);
  for (const orden of ["/deshacer", "/decido", "/[A-Za-z]"]) assert.ok(responder.includes(orden), orden);
});

test("la respuesta vuelve a la misma incidencia y entra por el circuito de siempre", () => {
  assert.match(responder, /gh workflow run verificar-carga\.yml[\s\S]*-f incidencia="\$ISSUE"/);
  assert.match(verificar, /ISSUE: \$\{\{ needs\.verificar\.outputs\.issue \|\| inputs\.incidencia \}\}/);
});

test("el aviso dice qué responder: opciones o cómo deshacer una decisión tomada", () => {
  assert.match(verificar, /Responde en la incidencia #\$ISSUE de GitHub con \/A, \/B o una frase/);
  assert.match(verificar, /responde \/deshacer en la incidencia #\$ISSUE/);
});

test("Claude decide los conflictos con las reglas y aprende las decisiones del dueño", () => {
  assert.match(instrucciones, /Conflictos entre fuentes: decide, no preguntes/);
  assert.match(instrucciones, /reglas-de-prioridad\.md/);
  assert.match(instrucciones, /Apréndela/);
  assert.match(reglas, /## Decisiones del dueño/);
  assert.match(reglas, /lib\/source-precedence\.ts/);
});
