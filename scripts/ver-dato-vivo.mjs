#!/usr/bin/env node
// Sólo lectura: muestra el valor efectivo y el historial reciente de una
// clave del modelo vivo (live_data_points / live_data_history), para
// diagnosticar una incidencia de contrato sin modificar nada.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const KEY = process.env.KEY;
if (!KEY) {
  console.error("Falta KEY.");
  process.exit(1);
}

const { stdout: pointStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, area, value_json, source_file_id, revision, updated_at
   FROM live_data_points WHERE key = '${KEY}';`,
], { maxBuffer: 16 * 1024 * 1024 });
const pointRows = JSON.parse(pointStdout)?.[0]?.results ?? [];
console.log(`=== live_data_points: "${KEY}" ===`);
for (const p of pointRows) {
  console.log(`\n· área: ${p.area} · revisión: ${p.revision} · actualizado: ${p.updated_at}`);
  console.log(`  archivo origen: ${p.source_file_id || "(ninguno)"}`);
  console.log(`  valor: ${p.value_json}`);
}
if (!pointRows.length) console.log("(sin fila en live_data_points para esta clave)");

const { stdout: historyStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, key, value_json, source_file_id, created_at
   FROM live_data_history WHERE key = '${KEY}'
   ORDER BY id DESC LIMIT 5;`,
], { maxBuffer: 16 * 1024 * 1024 });
const historyRows = JSON.parse(historyStdout)?.[0]?.results ?? [];
console.log(`\n=== ${historyRows.length} entrada(s) recientes en live_data_history para "${KEY}" ===`);
for (const h of historyRows) {
  console.log(`\n· revisión id: ${h.id} · creado: ${h.created_at} · archivo origen: ${h.source_file_id || "(ninguno)"}`);
  console.log(`  valor: ${h.value_json}`);
}
