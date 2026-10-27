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

test("un Excel conocido se resuelve con el lector directo sin gastar IA", () => {
  assert.match(filesRoute, /new Set\(\["ppt", "pptx", "doc", "docx", "pdf", "jpg", "jpeg", "png"\]\)/);
  assert.doesNotMatch(filesRoute, /extensionesNarrativas[^;]+"xls"/);
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

test("safetyMetrics no se pisa con un reporte semanal más antiguo que el ya publicado", () => {
  // safetyMetrics es una fotografía sin fecha propia (no una serie como
  // safetyWeeklySeries). Cuando se suben varias semanas de golpe, sin esta
  // regla la que se procese después gana aunque sea más vieja -pasó en
  // producción: 4 reportes semanales de seguridad subidos juntos dejaron el
  // panel mostrando la semana del 10-15 de agosto en vez de la más reciente-.
  assert.match(prompt, /safetyMetrics no tiene fecha propia/);
  assert.match(prompt, /read_current_value sobre safetyWeeklySeries/);
  assert.match(prompt, /no publiques safetyMetrics con sus cifras/);
});

test("el reproceso puede apuntar al expediente exacto sin tocar copias homónimas", () => {
  assert.match(reprocessWorkflow, /file_id:/);
  assert.match(reprocessWorkflow, /FILE_ID: \$\{\{ inputs\.file_id \}\}/);
  assert.match(reprocessScript, /!FILE_ID \|\| f\.id === FILE_ID/);
  assert.match(reprocessScript, /!f\.supersededByFileId/);
  assert.match(reprocessScript, /form\.set\("reprocessFileId", f\.id\)/);
});

test("un xlsx/csv sin plantilla reconocida recibe el mismo colchón de IA que un documento narrativo", () => {
  // extensionesNarrativas sigue intacto, y las dos condiciones que deciden
  // cuándo correr la IA siguen usando literalmente documentoNarrativo/
  // documentosNarrativos (lo exigen tests ya existentes en
  // ingestion-automation.test.mjs y live-ingestion-lifecycle-notifications.
  // test.mjs): la extensión al caso estructurado vive dentro de cómo se
  // calcula documentosNarrativos, no en una condición ni una lista paralela.
  assert.match(filesRoute, /new Set\(\["ppt", "pptx", "doc", "docx", "pdf", "jpg", "jpeg", "png"\]\)/);
  assert.doesNotMatch(filesRoute, /extensionesNarrativas[^;]+"xls"/);
  assert.match(filesRoute, /extensionesEstructuradasConLector = new Set\(\["xlsx", "csv"\]\)/);
  assert.match(filesRoute, /documentoEstructuradoSinCobertura =\s*\n\s*extensionesEstructuradasConLector\.has\(extension\) && deterministicExtraction\.updates\.length === 0/);
  assert.match(filesRoute, /const documentosNarrativos = aiDocuments\.filter\(\(document\) =>\s*\n\s*extensionesNarrativas\.has\(document\.extension\) \|\|\s*\n\s*\(documentoEstructuradoSinCobertura && extensionesEstructuradasConLector\.has\(document\.extension\)\)\);/);
  // El caso común (xlsx bien formado, con actualizaciones deterministas)
  // nunca debe entrar al bloque de IA: sigue costando $0.
  assert.match(filesRoute, /if \(documentoNarrativo && \(!deterministicExtraction\.updates\.length \|\| lecturaParcial\) && !aiBudget\.blocked\)/);
  assert.match(filesRoute, /\} else if \(documentoNarrativo && \(!deterministicExtraction\.updates\.length \|\| lecturaParcial\) && aiBudget\.blocked\)/);
});

test("un rechazo determinista tras una extracción de IA no se reintenta tres veces", () => {
  // El catch de POST clasifica el error y lo manda en el receipt "observed";
  // scheduleBackgroundUploadProcessing lee ese campo para no reproducir todo
  // el handler (con su posible llamada a OpenAI ya pagada) cuando el fallo
  // es determinista y va a repetirse igual.
  assert.match(filesRoute, /const retryWorthy = error instanceof Error && \/SQLITE_BUSY/);
  assert.match(filesRoute, /outcome: "observed",\s*\n\s*retryWorthy,/);
  assert.match(filesRoute, /const terminal = observed && payload\.receipt\?\.retryWorthy !== true;/);
  assert.match(filesRoute, /if \(response\.ok && \(!observed \|\| terminal\)\)/);
});
