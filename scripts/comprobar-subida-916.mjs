#!/usr/bin/env node
// Diagnóstico de sólo lectura: comprueba el estado de los archivos subidos
// hoy alrededor de las 9:16 (hora local, se comparan en UTC) y su actividad
// asociada, para confirmar si quedaron validados y publicados.
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

const files = await query(
  `SELECT id, original_name, extension, area, status, processing_stage, processing_progress, processing_summary, requires_review, review_status, created_at FROM uploaded_files WHERE created_at LIKE '2026-09-10%' ORDER BY created_at;`,
);
console.log(`=== ${files.length} archivo(s) subidos hoy (2026-09-10) ===`);
for (const f of files) {
  console.log(`\n[${f.id}] ${f.original_name}`);
  console.log(`  area: ${f.area} · estado: ${f.status} · etapa: ${f.processing_stage} (${f.processing_progress}%)`);
  console.log(`  requiere revisión: ${f.requires_review} · review_status: ${f.review_status ?? "-"}`);
  console.log(`  resumen: ${f.processing_summary ?? "(sin resumen)"}`);
  console.log(`  subido: ${f.created_at}`);
}

if (files.length) {
  const ids = files.map((f) => `'${f.id}'`).join(",");
  const actividad = await query(
    `SELECT file_id, event_type, message, created_at FROM file_activity WHERE file_id IN (${ids}) ORDER BY created_at;`,
  );
  console.log(`\n=== ${actividad.length} evento(s) de actividad ===`);
  for (const a of actividad) {
    console.log(`[${a.file_id}] ${a.event_type} · ${a.created_at}`);
    console.log(`   ${a.message}`);
  }
}

const eventos = await query(
  `SELECT id, source_file_id, source_name, change_count, message, status, verification_json, created_at FROM live_data_events WHERE created_at LIKE '2026-09-10%' ORDER BY id;`,
);
console.log(`\n=== ${eventos.length} revisión(es) de datos vivos hoy ===`);
for (const e of eventos) {
  console.log(`#${e.id} · ${e.status} · fuente "${e.source_name}" · ${e.change_count} cambios · ${e.created_at}`);
  console.log(`   ${e.message}`);
  if (e.verification_json) console.log(`   verificacion: ${e.verification_json}`);
}
