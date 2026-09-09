#!/usr/bin/env node
// Diagnóstico de sólo lectura: vuelca todas las claves live_data_points que
// empiezan por "urbanismReportAreas" para entender por qué el panel de
// Urbanismo no refleja el 8% de Infraestructura eléctrica publicado en la
// revisión 100.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, value_json, value_type, revision, source_name, updated_at FROM live_data_points WHERE key LIKE 'urbanismReportAreas%' ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} claves urbanismReportAreas* en live_data_points ===`);
for (const row of rows) {
  console.log(`${row.key} = ${row.value_json} (tipo ${row.value_type}, rev ${row.revision}, fuente "${row.source_name}", ${row.updated_at})`);
}
