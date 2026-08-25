#!/usr/bin/env node
// Sólo lectura: muestra el/los archivo(s) subido(s) más recientes en
// uploaded_files, con su estado de procesamiento real, para responder si la
// última subida se completó correctamente.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, original_name, area, section, size_bytes, status,
          processing_stage, processing_progress, processing_summary,
          processing_attempts, next_retry_at, last_processing_error,
          requires_review, review_status, document_type, uploader_email,
          uploader_name, created_at, updated_at
   FROM uploaded_files
   WHERE deleted_at = ''
   ORDER BY created_at DESC
   LIMIT 5;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} archivo(s) más reciente(s) ===`);
for (const f of rows) {
  console.log(`\n· id: ${f.id}`);
  console.log(`  nombre: ${f.original_name} (${f.area}${f.section ? "/" + f.section : ""}, ${f.size_bytes} bytes)`);
  console.log(`  subido por: ${f.uploader_name} <${f.uploader_email}>`);
  console.log(`  estado: ${f.status} · etapa: ${f.processing_stage} (${f.processing_progress}%)`);
  console.log(`  revisión: ${f.review_status}${f.requires_review ? " · requiere revisión" : ""}`);
  console.log(`  intentos de proceso: ${f.processing_attempts}${f.next_retry_at ? " · próximo reintento: " + f.next_retry_at : ""}`);
  if (f.last_processing_error) console.log(`  ÚLTIMO ERROR: ${f.last_processing_error}`);
  if (f.processing_summary) console.log(`  resumen: ${f.processing_summary}`);
  console.log(`  tipo detectado: ${f.document_type}`);
  console.log(`  creado: ${f.created_at} · actualizado: ${f.updated_at}`);
}
