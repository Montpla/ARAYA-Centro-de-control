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
  `SELECT key, revision, source_file_id, cutoff FROM live_data_points WHERE key = 'discoveredSections' OR key LIKE 'discoveredSections.%' ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} fila(s) discoveredSections(.*) en live_data_points ===`);
for (const fila of rows) {
  console.log(`  · ${fila.key} · rev ${fila.revision} · corte ${fila.cutoff} · archivo ${fila.source_file_id || "(ninguno)"}`);
}

const filesToCheck = ["3c82c20a-d81b-476e-9c37-27fefc308762", "de96ff24-aff7-4d83-b083-8ebdcc0bbb63"];
const { stdout: filesOut } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, deleted_at, superseded_by_file_id, review_status FROM uploaded_files WHERE id IN (${filesToCheck.map((id) => `'${id}'`).join(",")});`,
], { maxBuffer: 16 * 1024 * 1024 });
const filesParsed = JSON.parse(filesOut);
const fileRows = filesParsed?.[0]?.results ?? [];
console.log(`\n=== Estado de los archivos fuente ===`);
for (const fila of fileRows) {
  console.log(`  · ${fila.id} · borrado: ${fila.deleted_at || "no"} · sustituido por: ${fila.superseded_by_file_id || "(nadie)"} · revisión: ${fila.review_status}`);
}
