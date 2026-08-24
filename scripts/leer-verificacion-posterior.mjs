#!/usr/bin/env node
// Lee, sólo lectura, el detalle de la comprobación posterior de una revisión
// (live_data_events.verification_json) para diagnosticar por qué quedó
// "verificacion_posterior_fallida" sin tocar ningún dato del panel.
//
// El JSON de verificación nunca contiene cifras: sus mensajes son del tipo
// "clave: la revisión visible es X, no Y" o "clave: el valor persistido no
// coincide con el valor publicado" — nombres de clave y estado, nunca importes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const REVISION = process.env.REVISION;
if (!REVISION) {
  console.error("✖ Falta REVISION (id de live_data_events a inspeccionar).");
  process.exit(1);
}

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command", `SELECT id, source_name, verification_json FROM live_data_events WHERE id = ${Number(REVISION)};`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const row = parsed?.[0]?.results?.[0];
if (!row) {
  console.log(`Sin fila para la revisión ${REVISION}.`);
  process.exit(0);
}
console.log(`=== Verificación posterior de la revisión ${row.id} ===`);
if (!row.verification_json) {
  console.log("(sin verification_json registrado)");
  process.exit(0);
}
const verification = JSON.parse(row.verification_json);
console.log(`estado: ${verification.status}`);
console.log(`claves comprobadas: ${verification.checkedKeys} · visibles: ${verification.visibleKeys}`);
console.log(`vistas afectadas: ${(verification.affectedViews ?? []).join(", ") || "(ninguna)"}`);
console.log(`comprobado: ${verification.checkedAt}`);
console.log(`\nincidencias (${(verification.issues ?? []).length}):`);
for (const issue of verification.issues ?? []) {
  console.log(`  · ${issue}`);
}
