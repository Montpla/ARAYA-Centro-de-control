#!/usr/bin/env node
// Diagnóstico puntual: la oficina reporta que ni seguridad ni finanzas se han
// actualizado. Vuelca los archivos recientes de esas áreas/tipos y su estado
// de publicación, y las claves vivas más recientes de cada dominio, para
// distinguir "no llegó archivo", "llegó pero no publicó" y "publicó pero el
// panel no lo refleja".
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 16 * 1024 * 1024 });
  console.log(stdout);
}

console.log("=== Archivos de finanzas/seguridad de los últimos 60 días ===");
await query(`
  SELECT id, original_name, area, document_type, status, processing_stage,
         publication_revision, requires_review, review_status, declared_cutoff,
         created_at, updated_at
  FROM uploaded_files
  WHERE (area IN ('finanzas', 'seguridad') OR document_type IN ('estado_financiero', 'seguridad_permisos'))
    AND deleted_at = ''
    AND created_at >= datetime('now', '-60 days')
  ORDER BY created_at DESC;
`);

console.log("=== Últimas claves vivas publicadas en cada dominio ===");
await query(`
  SELECT key, value_json, revision, cutoff, updated_at, source_name, source_file_id
  FROM live_data_points
  WHERE area IN ('finanzas', 'seguridad')
     OR key LIKE 'antonely%' OR key LIKE 'cxp%' OR key LIKE 'costBreakdown%'
     OR key LIKE 'financialProjection%' OR key LIKE 'safety%' OR key LIKE 'permits%'
  ORDER BY updated_at DESC
  LIMIT 40;
`);

console.log("=== Requisitos de checklist de seguridad y finanzas (agosto y septiembre) ===");
await query(`
  SELECT rp.id AS periodo, rr.label, rr.area, rr.status, rr.source_file_id, rr.due_at
  FROM reporting_requirements rr
  JOIN reporting_periods rp ON rp.id = rr.period_id
  WHERE rp.id LIKE 'month-2026-08%' OR rp.id LIKE 'month-2026-09%'
  ORDER BY rp.id, rr.label;
`);
