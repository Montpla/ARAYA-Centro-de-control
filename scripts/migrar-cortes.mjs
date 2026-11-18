#!/usr/bin/env node
// Corrige el corte de las publicaciones ya guardadas con la regla actual de
// detectPeriod (lib/ingestion.ts, #252).
//
// Hasta #252 el corte de un documento sin corte declarado salía de leer
// nombre y descripción juntos (ganaba la fecha de conversión del .mpp:
// 18/11 en vez de "CORTE 30-10-2026"), de la fecha de INICIO de un rango
// semanal, o del día de la carga cuando el nombre sólo traía el mes
// ("Cubicacion_11_Araya_Oct"). Ese corte quedó escrito en live_data_history,
// live_data_events y live_data_points (la caché que usa la guarda de cortes),
// y decide qué valor es el vigente de cada clave.
//
// Sólo se toca una fila cuando su corte es exactamente el que puso el
// sistema (el periodo detectado antes o, si no había, el día de su
// publicación). Un corte que venía dentro del propio documento no se toca.
//
// Simula por defecto: imprime qué cambiaría y qué claves cambiarían de valor
// vigente. APLICAR=1 escribe. No imprime ningún importe: sólo muestra el valor
// de las claves de porcentaje de avance.

import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";

const run = promisify(execFile);
const APLICAR = process.env.APLICAR === "1";

// lib/effective-live-data.ts importa la base de datos del Worker; aquí sólo
// hacen falta sus funciones puras, así que se empaqueta con un sustituto.
const dir = await mkdtemp(join(tmpdir(), "migrar-cortes-"));
const entry = join(dir, "entry.ts");
await writeFile(entry, [
  `export { detectPeriod } from ${JSON.stringify(join(process.cwd(), "lib/ingestion.ts"))};`,
  `export { deriveEffectiveLiveDataSnapshot } from ${JSON.stringify(join(process.cwd(), "lib/effective-live-data.ts"))};`,
].join("\n"));
const bundle = join(dir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
  logLevel: "error",
  plugins: [{
    name: "sin-worker",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "worker", namespace: "stub" }));
      pluginBuild.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const env = {};", loader: "js" }));
    },
  }],
});
const { detectPeriod, deriveEffectiveLiveDataSnapshot } = await import(bundle);

async function d1(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json", "--command", sql,
  ], { maxBuffer: 512 * 1024 * 1024 });
  return JSON.parse(stdout)?.[0]?.results ?? [];
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const files = await d1(`SELECT id, original_name AS name, description, declared_cutoff AS declared,
  detected_period AS detected, created_at AS createdAt FROM uploaded_files WHERE deleted_at = ''`);

const historyRows = await d1(`SELECT h.id AS historyId, h.event_id AS eventId, h.key AS key, h.value_json AS valueJson,
  h.value_type AS valueType, h.area AS area, h.source_file_id AS sourceFileId, h.source_name AS sourceName,
  h.source_currency AS sourceCurrency, h.cutoff AS cutoff, h.actor_email AS actorEmail, h.actor_name AS actorName,
  h.created_at AS createdAt, e.source_file_id AS eventSourceFileId, e.source_name AS eventSourceName,
  e.area AS eventArea, e.cutoff AS eventCutoff, e.change_count AS eventChangeCount, e.message AS eventMessage,
  e.status AS eventStatus, e.actor_name AS eventActorName, e.created_at AS eventCreatedAt,
  f.id AS linkedFileId, f.deleted_at AS linkedFileDeletedAt, f.superseded_by_file_id AS linkedFileSupersededByFileId,
  f.area AS linkedFileArea, f.document_type AS linkedFileDocumentType
  FROM live_data_history h
  INNER JOIN live_data_events e ON e.id = h.event_id
  LEFT JOIN uploaded_files f ON f.id = h.source_file_id
  WHERE e.status = 'published'`);

const day = (value) => String(value ?? "").slice(0, 10);

// Corte que el sistema habría puesto mal y el que corresponde.
const plan = [];
for (const file of files) {
  if (String(file.declared ?? "").trim()) continue;
  const now = new Date(String(file.createdAt).replace(" ", "T") + (String(file.createdAt).includes("Z") ? "" : "Z"));
  const nuevo = detectPeriod(file.name, "", file.description ?? "", Number.isNaN(now.getTime()) ? new Date() : now);
  if (!nuevo || nuevo === file.detected) continue;
  plan.push({ file, nuevo });
}

const fileById = new Map(plan.map((item) => [item.file.id, item]));
const cambios = { history: [], events: new Map() };
for (const row of historyRows) {
  const item = fileById.get(row.sourceFileId);
  if (!item) continue;
  const viejos = new Set([item.file.detected].filter(Boolean));
  if (!item.file.detected) viejos.add(day(row.eventCreatedAt));
  if (viejos.has(row.cutoff)) cambios.history.push({ row, nuevo: item.nuevo });
  if (viejos.has(row.eventCutoff) && row.eventSourceFileId === row.sourceFileId) {
    cambios.events.set(row.eventId, { viejo: row.eventCutoff, nuevo: item.nuevo });
  }
}

console.log(`=== ${plan.length} archivo(s) cuyo corte cambia con la regla actual ===`);
for (const { file, nuevo } of plan) {
  const filas = cambios.history.filter((cambio) => cambio.row.sourceFileId === file.id).length;
  console.log(`  ${file.name}\n     periodo ${file.detected || "(vacío: día de carga)"} → ${nuevo} · ${filas} fila(s) publicadas`);
}
console.log(`\nFilas de historial a corregir: ${cambios.history.length} · publicaciones: ${cambios.events.size}`);

// Impacto en el valor vigente de cada clave.
const cambioPorFila = new Map(cambios.history.map((item) => [item.row.historyId, item]));
const despues = historyRows.map((row) => {
  const cambio = cambioPorFila.get(row.historyId);
  const evento = cambios.events.get(row.eventId);
  return { ...row, cutoff: cambio ? cambio.nuevo : row.cutoff, eventCutoff: evento ? evento.nuevo : row.eventCutoff };
});
const antesSnap = deriveEffectiveLiveDataSnapshot(historyRows, true);
const despuesSnap = deriveEffectiveLiveDataSnapshot(despues, true);
const porcentaje = /(progress|planned|actual|reprogrammed|Progress)$/;
const claves = new Set([...Object.keys(antesSnap.values), ...Object.keys(despuesSnap.values)]);
const diferencias = [...claves].filter((key) =>
  JSON.stringify(antesSnap.values[key]) !== JSON.stringify(despuesSnap.values[key])).sort();
console.log(`\n=== ${diferencias.length} clave(s) cambiarían de valor vigente ===`);
const puntoAntes = new Map(antesSnap.points.map((point) => [point.key, point]));
const puntoDespues = new Map(despuesSnap.points.map((point) => [point.key, point]));
for (const key of diferencias) {
  const antes = puntoAntes.get(key);
  const tras = puntoDespues.get(key);
  const valor = porcentaje.test(key) && typeof antesSnap.values[key] !== "object"
    ? ` · ${antesSnap.values[key]} → ${despuesSnap.values[key]}`
    : "";
  console.log(`  ${key}${valor} · rev ${antes?.revision ?? "-"} (${antes?.sourceName ?? ""}) → rev ${tras?.revision ?? "-"} (${tras?.sourceName ?? ""})`);
}

if (!APLICAR) {
  console.log("\nSimulación (APLICAR=0): no se ha escrito nada.");
  process.exit(0);
}

const sentencias = [];
for (const { row, nuevo } of cambios.history) {
  sentencias.push(`UPDATE live_data_history SET cutoff = ${quote(nuevo)} WHERE id = ${Number(row.historyId)} AND cutoff = ${quote(row.cutoff)};`);
}
for (const [eventId, { viejo, nuevo }] of cambios.events) {
  sentencias.push(`UPDATE live_data_events SET cutoff = ${quote(nuevo)} WHERE id = ${Number(eventId)} AND cutoff = ${quote(viejo)};`);
}
for (const { file, nuevo } of plan) {
  const viejos = [...new Set(cambios.history.filter((c) => c.row.sourceFileId === file.id).map((c) => c.row.cutoff))];
  for (const viejo of viejos) {
    sentencias.push(`UPDATE live_data_points SET cutoff = ${quote(nuevo)} WHERE source_file_id = ${quote(file.id)} AND cutoff = ${quote(viejo)};`);
  }
  sentencias.push(`UPDATE uploaded_files SET detected_period = ${quote(nuevo)} WHERE id = ${quote(file.id)} AND detected_period = ${quote(file.detected ?? "")};`);
}
for (let index = 0; index < sentencias.length; index += 50) {
  await d1(sentencias.slice(index, index + 50).join("\n"));
}
console.log(`\n✔ Aplicado: ${sentencias.length} sentencia(s).`);
