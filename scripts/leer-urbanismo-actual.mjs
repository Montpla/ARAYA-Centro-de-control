#!/usr/bin/env node
// Diagnóstico de sólo lectura: vuelca las claves live_data_points que
// empiezan por "urbanismReportAreas" para confirmar el índice y el valor
// actuales de cada disciplina antes de corregir "Movimiento de tierra".
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, value_json, revision, source_name FROM live_data_points WHERE key LIKE 'urbanismReportAreas%' ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} claves urbanismReportAreas* ===`);
for (const row of rows) {
  console.log(`${row.key} = ${row.value_json} (rev ${row.revision}, fuente "${row.source_name}")`);
}
