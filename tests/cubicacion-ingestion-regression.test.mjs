import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [filesRoute, reviewRoute, prompt, reprocessWorkflow, reprocessScript] = await Promise.all([
  readFile("app/api/files/route.ts", "utf8"),
  readFile("app/api/files/review/route.ts", "utf8"),
  readFile("lib/ai-document-extraction.ts", "utf8"),
  readFile(".github/workflows/reprocesar.yml", "utf8"),
  readFile("scripts/reprocesar.mjs", "utf8"),
]);

test("un Excel complejo complementa la lectura directa con IA sin pisarla", () => {
  assert.match(filesRoute, /\["ppt", "pptx", "doc", "docx", "pdf", "xls", "xlsx"/);
  assert.match(filesRoute, /deterministicExtraction\.expectedBuildingCodes/);
  assert.match(filesRoute, /missingExpectedBuildingCodes/);
});

test("una cubicación incompleta publica lo válido y cierra el diagnóstico sin inventar", () => {
  assert.match(filesRoute, /No se inventó avance para \$\{missingExpectedBuildingCodes\.join/);
  assert.match(filesRoute, /reviewStatus: "aprobado_con_alertas"/);
  assert.match(reviewRoute, /Falta el avance físico de TH-/);
  assert.match(reviewRoute, /La cubicación está incompleta/);
});

test("el alcance no confunde el inventario histórico con los edificios cubicados", () => {
  assert.match(filesRoute, /deterministicExtraction\.expectedBuildingCodes/);
  assert.match(reprocessScript, /diagnóstico de edificios/);
});

test("un original mixto conserva el avance en Obra y los importes en Finanzas", () => {
  assert.match(filesRoute, /\^buildings\\\.\/\.test\(update\.key\)[\s\S]*?area: "obra"/);
  assert.match(filesRoute, /publicationActor = automaticPublicationRequested/);
  assert.match(filesRoute, /canPublishInArea = automaticPublicationRequested \|\| !financeProtectedUpload \|\| user\.financeAccess/);
  assert.match(filesRoute, /!requiresFinanceAccessForArea\(update\.area\)/);
});

test("la IA distingue una cubicación de TH-76 y TH-77 del avance global", () => {
  assert.match(prompt, /buildings\.TH-76\.progress y buildings\.TH-77\.progress/);
  assert.match(prompt, /No lo publiques como projectSnapshot\.overallProgress/);
});

test("el reproceso puede apuntar al expediente exacto sin tocar copias homónimas", () => {
  assert.match(reprocessWorkflow, /file_id:/);
  assert.match(reprocessWorkflow, /FILE_ID: \$\{\{ inputs\.file_id \}\}/);
  assert.match(reprocessScript, /!FILE_ID \|\| f\.id === FILE_ID/);
  assert.match(reprocessScript, /!f\.supersededByFileId/);
  assert.match(reprocessScript, /form\.set\("reprocessFileId", f\.id\)/);
});
