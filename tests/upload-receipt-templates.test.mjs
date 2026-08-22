import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [filesRoute, dashboard, templateRoute] = await Promise.all([
  readFile("app/api/files/route.ts", "utf8"),
  readFile("app/dashboard-client.tsx", "utf8"),
  readFile("app/api/templates/route.ts", "utf8"),
]);

test("cada carga terminada devuelve un recibo comprensible", () => {
  assert.match(filesRoute, /receipt:\s*\{/);
  assert.match(filesRoute, /publishedCount: agentPublishedCount/);
  assert.match(filesRoute, /unchangedCount/);
  assert.match(filesRoute, /ignoredCount: automaticallyDiscardedCount/);
  assert.match(filesRoute, /newSectionCount: extraction\.unmappedCandidates\.length/);
  assert.match(filesRoute, /nextAction:/);
});

test("el recibo permanece abierto hasta que la persona lo cierre", () => {
  assert.match(dashboard, /setCompletedUpload\(result\)/);
  assert.match(dashboard, /RECIBO DE PROCESAMIENTO/);
  assert.match(dashboard, /Cerrar recibo/);
  assert.match(dashboard, /Aislados con diagnóstico/);
});

test("las tres plantillas mensuales se descargan autenticadas y sin valores vigentes", () => {
  assert.match(templateRoute, /requireApiUser\(\)/);
  assert.match(templateRoute, /cubicacionTemplate/);
  assert.match(templateRoute, /ventasTemplate/);
  assert.match(templateRoute, /cronogramaTemplate/);
  assert.match(templateRoute, /blankCurrentValues/);
  assert.match(templateRoute, /Content-Disposition/);
  assert.match(dashboard, /\/api\/templates\?kind=cubicacion/);
  assert.match(dashboard, /\/api\/templates\?kind=ventas/);
  assert.match(dashboard, /\/api\/templates\?kind=cronograma/);
});

test("aportar un documento financiero no concede permiso de lectura", () => {
  assert.doesNotMatch(
    filesRoute,
    /requiresFinanceAccessForArea\(classification\.area\) && !user\.financeAccess[\s\S]{0,180}status: 403/,
  );
  assert.match(filesRoute, /financeProtectedUpload && !user\.financeAccess/);
  assert.match(filesRoute, /Solo las personas autorizadas pueden consultar sus cifras o abrir el expediente/);
});

test("la publicación utiliza el área inferida por el contenido y no la del nombre", () => {
  assert.match(filesRoute, /area:\s*resolvedArea,[\s\S]{0,180}cutoff: effectiveCutoff/);
  assert.doesNotMatch(filesRoute, /normalizeIngestedUpdatesResilient\([\s\S]{0,260}area:\s*classification\.area/);
});
