#!/usr/bin/env node
// Diagnóstico de sólo lectura: vuelca las claves live_data_points que
// empiezan por "urbanismReportAreas" para entender por qué la corrección de
// Movimiento de tierra (revisión 102, 72,76%) no se refleja en el panel.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, value_json, revision, source_name, updated_at FROM live_data_points WHERE key LIKE 'urbanismReportAreas%' ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} claves urbanismReportAreas* ===`);
for (const row of rows) {
  console.log(`${row.key} = ${row.value_json} (rev ${row.revision}, fuente "${row.source_name}", ${row.updated_at})`);
}

const { stdout: eventosRaw } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, status, message, verification_json FROM live_data_events WHERE id >= 100 ORDER BY id;`,
], { maxBuffer: 16 * 1024 * 1024 });
const eventos = JSON.parse(eventosRaw)?.[0]?.results ?? [];
console.log(`\n=== ${eventos.length} eventos recientes ===`);
for (const evento of eventos) {
  console.log(`#${evento.id} · ${evento.status} · ${evento.message}`);
  if (evento.verification_json) console.log(`   verificacion: ${evento.verification_json}`);
}
