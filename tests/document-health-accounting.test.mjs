import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [controlRoomRoute, recentCheck, candidateCheck] = await Promise.all([
  readFile("app/api/control-room/route.ts", "utf8"),
  readFile("scripts/comprobar-cargas.mjs", "utf8"),
  readFile("scripts/ver-propuestas.mjs", "utf8"),
]);

test("el Centro de Control cuenta el cierre real y no un único literal de estado", () => {
  assert.match(controlRoomRoute, /requiresReview\} = 0/);
  assert.match(controlRoomRoute, /requiresReview\} = 1/);
  assert.doesNotMatch(controlRoomRoute, /reviewStatus\} = 'aprobado' then 1/);
});

test("el diagnóstico sólo reclama expedientes vigentes que requieren revisión", () => {
  assert.match(recentCheck, /!file\.deletedAt && !historico/);
  assert.match(recentCheck, /activo && file\.requiresReview/);
  assert.match(recentCheck, /HISTÓRICO/);
});

test("la lista de secciones nuevas omite candidatos e históricos ya cerrados", () => {
  assert.match(candidateCheck, /!file\.supersededByFileId/);
  assert.match(candidateCheck, /candidate\.status === "pendiente"/);
});
