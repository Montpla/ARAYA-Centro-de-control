#!/usr/bin/env node
// Diagnóstico de sólo lectura: comprueba el estado de los 3 archivos cuyas
// revisiones de datos vivos se publicaron hoy a las 7:16 UTC (9:16 hora de
// España) y su actividad asociada, para confirmar si quedaron validados.
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

const nombres = [
  "ARAYA_-Flujo_I_reprogramado final.xlsx",
  "Avance edificio.xlsx",
  "Avance urbanismo.xlsx",
];
const enLista = nombres.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");

const files = await query(
  `SELECT id, original_name, extension, area, status, processing_stage, processing_progress, processing_summary, requires_review, review_status, created_at FROM uploaded_files WHERE original_name IN (${enLista}) ORDER BY created_at;`,
);
console.log(`=== ${files.length} archivo(s) encontrados por nombre ===`);
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
