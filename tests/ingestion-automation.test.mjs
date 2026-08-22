import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Project publica la fecha ISO y la interfaz la presenta en español", async () => {
  const [projectXml, progress, spatial] = await Promise.all([
    read("lib/project-xml.ts"),
    read("lib/progress-model.ts"),
    read("lib/spatial-live-data.ts"),
  ]);
  assert.match(projectXml, /const finIso = finMax\.match/);
  assert.match(projectXml, /value: `\$\{finIso\[1\]\}-\$\{finIso\[2\]\}-\$\{finIso\[3\]\}`/);
  assert.match(progress, /export function projectDateForDisplay/);
  assert.match(spatial, /projectDateForDisplay\(snapshot\.forecastFinish\)/);
});

test("MPP y DWG tienen conversión programada, idempotente y enlazada al original", async () => {
  const [mppScript, mppWorkflow, dwgScript, dwgWorkflow] = await Promise.all([
    read("scripts/convertir-mpp.mjs"),
    read(".github/workflows/convertir-mpp.yml"),
    read("scripts/convertir-dwg.mjs"),
    read(".github/workflows/convertir-dwg.yml"),
  ]);
  assert.match(mppWorkflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(mppScript, /derivedFromFileId/);
  assert.match(mppScript, /mpp_to_xml/);
  assert.match(dwgWorkflow, /libredwg\/libredwg\/releases\/download\/0\.14/i);
  assert.match(dwgWorkflow, /62ebb73b984f865960f20ed26619ea5f8789d5e3fd088fa40a2598384da81275/);
  assert.match(dwgWorkflow, /actions\/cache@v5/);
  assert.match(dwgScript, /dwg2SVG/);
  assert.match(dwgScript, /dwg_to_png/);
  assert.match(dwgScript, /derivedFromFileId/);
});

test("los ZIP se abren con límites y sólo sus documentos narrativos pasan a lectura asistida", async () => {
  const [reader, ingestion, route] = await Promise.all([
    read("lib/xlsx-reader.ts"),
    read("lib/ingestion.ts"),
    read("app/api/files/route.ts"),
  ]);
  assert.match(reader, /maxCompressionRatio/);
  assert.match(reader, /maxTotalUncompressedBytes/);
  assert.match(ingestion, /export async function archiveDocumentsForAI/);
  assert.match(route, /const documentosNarrativos = aiDocuments\.filter/);
  assert.match(route, /for \(const document of documentosNarrativos\)/);
});

test("el lector queda versionado y reprocesa históricos en lotes acotados", async () => {
  const [schema, route, script, workflow] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/files/route.ts"),
    read("scripts/reprocesar-obsoletos.mjs"),
    read(".github/workflows/reprocesar-obsoletos.yml"),
  ]);
  assert.match(schema, /ingestionVersion: text\("ingestion_version"\)/);
  assert.match(route, /ingestionVersion: CURRENT_INGESTION_VERSION/);
  assert.match(script, /String\(file\.ingestionVersion \|\| ""\) !== currentVersion/);
  assert.match(script, /form\.set\("reprocess", "true"\)/);
  assert.match(script, /form\.set\("reprocessFileId", file\.id\)/);
  assert.match(route, /eq\(uploadedFiles\.id, reprocessFileId\)/);
  assert.match(workflow, /MAX_POR_EJECUCION: "5"/);
});

test("la información sin campo crea secciones provisionales con privacidad por área", async () => {
  const [route, liveData, dashboard] = await Promise.all([
    read("app/api/files/route.ts"),
    read("lib/live-data.ts"),
    read("app/dashboard-client.tsx"),
  ]);
  assert.match(route, /const candidatosProvisionales/);
  assert.match(route, /requiresFinanceAccessForArea\(candidateArea\)/);
  assert.doesNotMatch(liveData, /financialRootSet = new Set\(\[[\s\S]*?"discoveredSections"/);
  assert.match(dashboard, /SECCIONES PROVISIONALES/);
});

test("el XLS de junio se conserva como antecedente y no puede reprocesarse", async () => {
  const [route, supersede, script, decision] = await Promise.all([
    read("app/api/files/route.ts"),
    read("app/api/files/supersede/route.ts"),
    read("scripts/cerrar-historico-junio.mjs"),
    read("historical/data-center/junio-2026/DECISION-avance-fisico-y-cubicaciones.md"),
  ]);
  assert.match(route, /!duplicate\.supersededAt/);
  assert.match(supersede, /supersededByFileId: replacement\.id/);
  assert.match(supersede, /status: "historico"/);
  assert.match(script, /avance-fisico-y-cubicaciones-junio-2026\.xls/);
  assert.match(script, /Number\(b\.publicationRevision \?\? -1\)/);
  assert.match(decision, /18,231973 %/);
  assert.match(decision, /no publica datos vivos/);
});
