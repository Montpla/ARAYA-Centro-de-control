#!/usr/bin/env node
// Sólo lectura: historial completo de las disciplinas de urbanismo en D1
// (live_data_history), para saber qué valor tenía cada posición antes de una
// publicación que la pisó. Son porcentajes y nombres, no importes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  "SELECT id, event_id, key, substr(value_json, 1, 700) AS valor, source_name, cutoff, created_at FROM live_data_history WHERE key = 'urbanismReportAreas' OR key LIKE 'urbanismReportAreas.%' ORDER BY id;",
], { maxBuffer: 32 * 1024 * 1024 });
const filas = JSON.parse(stdout)?.[0]?.results ?? [];
console.log(`=== ${filas.length} cambio(s) de urbanismReportAreas en live_data_history ===`);
for (const fila of filas) {
  console.log(`  rev ${fila.event_id} · ${fila.key} = ${fila.valor} · ${fila.source_name} · corte ${fila.cutoff} · ${fila.created_at}`);
}
