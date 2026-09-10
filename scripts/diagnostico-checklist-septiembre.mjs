#!/usr/bin/env node
// Diagnóstico de sólo lectura: por qué "Cronograma actualizado", "Avance de
// urbanismo" y "Seguridad y permisos" siguen PENDIENTE en el checklist de
// septiembre pese a que sus datos avanzaron. reconcileReportingPeriods exige
// area+documentType EXACTOS (lib/automation-center.ts); esto vuelca cómo
// quedó clasificado cada archivo de este mes para ver si el emparejamiento
// falla por eso.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout)?.[0]?.results ?? [];
}

const archivos = await query(
  `SELECT id, original_name, area, document_type, status, created_at, declared_cutoff, detected_period FROM uploaded_files WHERE created_at LIKE '2026-09%' AND deleted_at = '' ORDER BY created_at;`,
);
console.log(`=== ${archivos.length} archivo(s) de septiembre (activos) ===`);
for (const f of archivos) {
  console.log(`  · ${f.original_name}`);
  console.log(`    area: ${f.area} · documentType: ${f.document_type} · estado: ${f.status} · subido: ${f.created_at}`);
}

const requisitos = await query(
  `SELECT id, period_id, area, document_type, label, status, source_file_id FROM reporting_requirements WHERE period_id LIKE 'month-2026-09%' ORDER BY id;`,
);
console.log(`\n=== ${requisitos.length} requisito(s) del checklist de septiembre ===`);
for (const r of requisitos) {
  console.log(`  · ${r.label} → area="${r.area}" documentType="${r.document_type}" · estado: ${r.status} · fuente: ${r.source_file_id || "(ninguna)"}`);
}
