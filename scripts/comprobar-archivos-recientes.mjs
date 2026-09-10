#!/usr/bin/env node
// Comprobación puntual, solo lectura: confirma que todo lo subido en las
// últimas 48 horas ya quedó procesado e integrado (nada en revisión
// pendiente, nada aislado sin explicación) y que el motor de datos vivos
// sigue tocando registros recientemente. Se retira tras la comprobación.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

console.log("=== Archivos subidos en las últimas 48 horas ===");
const recent = await query(`
  SELECT id, original_name, area, document_type, review_status, requires_review,
         publication_revision, processing_summary, created_at
  FROM uploaded_files
  WHERE deleted_at = '' AND created_at >= datetime('now', '-48 hours')
  ORDER BY created_at DESC
  LIMIT 80;
`);
console.log(JSON.stringify(recent, null, 2));

console.log("=== ¿Alguno sigue pendiente de procesar o de revisión? ===");
const pending = recent.filter((f) =>
  ["pendiente_extraccion", "listo_revision", "cambios_solicitados"].includes(f.review_status) ||
  f.requires_review === 1
);
console.log(JSON.stringify(pending, null, 2));

console.log("=== Último punto vivo tocado (cualquier clave, para confirmar que el motor sigue activo) ===");
const lastLive = await query(`
  SELECT key, source_name, cutoff, revision, updated_at
  FROM live_data_points
  ORDER BY updated_at DESC
  LIMIT 15;
`);
console.log(JSON.stringify(lastLive, null, 2));

console.log("=== Revisiones de publicación más recientes por archivo (últimas 48h) ===");
const revisions = recent.map((f) => ({
  original_name: f.original_name,
  area: f.area,
  review_status: f.review_status,
  publication_revision: f.publication_revision,
  created_at: f.created_at,
}));
console.log(JSON.stringify(revisions, null, 2));
