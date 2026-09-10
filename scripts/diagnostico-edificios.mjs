#!/usr/bin/env node
// Diagnóstico puntual: la oficina reporta que "los colores cambian pero los
// porcentajes no" en edificios. Vuelca el valor, revisión y fecha (corte y
// actualización) de cada punto vivo buildings.*.progress, para distinguir si
// (a) el valor realmente no cambió porque no llegó dato nuevo para ese
// edificio, (b) cambió pero no se ve, o (c) algo se publicó a medias.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT key, value_json, revision, cutoff, updated_at, source_name, source_file_id
   FROM live_data_points
   WHERE key LIKE 'buildings.%.progress'
   ORDER BY key;`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(stdout);

const { stdout: recientes } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, original_name, area, document_type, status, processing_stage,
          publication_revision, requires_review, review_status, created_at, updated_at
   FROM uploaded_files
   WHERE (area IN ('obra','planificacion') OR document_type IN ('avance_obra','cronograma'))
     AND deleted_at = ''
   ORDER BY created_at DESC
   LIMIT 15;`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(recientes);
