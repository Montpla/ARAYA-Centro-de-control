#!/usr/bin/env node
// Sólo lectura: vuelca directamente de D1 las filas live_data_points cuya
// clave empieza por "discoveredSections." para entender por qué el panel
// sólo muestra una de las que se insertaron manualmente.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, revision, source_file_id, value_json FROM live_data_points WHERE key LIKE 'discoveredSections.%' ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} fila(s) discoveredSections.* en live_data_points ===`);
for (const fila of rows) {
  console.log(`\n--- ${fila.key} (rev ${fila.revision}) ---`);
  console.log(`archivo: ${fila.source_file_id}`);
  console.log(`valor: ${fila.value_json}`);
}
