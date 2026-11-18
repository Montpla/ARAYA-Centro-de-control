#!/usr/bin/env node
// Sólo lectura: auditoría del flujo de cargas en D1. Cómo terminó cada archivo
// (publicado, sin cambios, descartado, fallido), por qué, con qué corte se
// publicó y cuántas veces hubo que corregir a mano. No imprime valores.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function consulta(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json", "--command", sql,
  ], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout)?.[0]?.results ?? [];
}
const corto = (texto, n = 160) => String(texto ?? "").replace(/\s+/g, " ").slice(0, n);

console.log("=== 1. Archivos por resultado (activos) ===");
for (const f of await consulta(`
  SELECT extension, review_status, COUNT(*) AS n,
         SUM(CASE WHEN publication_revision IS NOT NULL THEN 1 ELSE 0 END) AS publicados
  FROM uploaded_files WHERE deleted_at = '' GROUP BY extension, review_status ORDER BY extension, n DESC;`)) {
  console.log(`  ${f.extension.padEnd(5)} ${String(f.review_status).padEnd(24)} ${String(f.n).padStart(4)} · con revisión publicada ${f.publicados}`);
}

console.log("\n=== 2. Último intento de ingesta por archivo: estado ===");
for (const f of await consulta(`
  WITH ultimo AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY file_id ORDER BY started_at DESC) AS n FROM ingestion_agent_runs)
  SELECT status, COUNT(*) AS n, SUM(proposed_count) AS propuestos, SUM(published_count) AS publicados
  FROM ultimo WHERE n = 1 GROUP BY status ORDER BY n DESC;`)) {
  console.log(`  ${String(f.status).padEnd(28)} ${String(f.n).padStart(4)} · propuestos ${f.propuestos} · publicados ${f.publicados}`);
}

console.log("\n=== 3. Errores de ingesta (agrupados por mensaje) ===");
for (const f of await consulta(`
  SELECT substr(error, 1, 140) AS e, COUNT(*) AS n, MAX(started_at) AS ultimo
  FROM ingestion_agent_runs WHERE error <> '' GROUP BY e ORDER BY n DESC LIMIT 25;`)) {
  console.log(`  ${String(f.n).padStart(3)}× (último ${f.ultimo}) ${corto(f.e, 140)}`);
}

console.log("\n=== 4. Archivos de los últimos 60 días ===");
for (const f of await consulta(`
  WITH ultimo AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY file_id ORDER BY started_at DESC) AS n FROM ingestion_agent_runs)
  SELECT u.created_at, u.original_name, u.extension, u.area, u.detected_period, u.declared_cutoff,
         u.review_status, u.processing_stage, u.publication_revision, u.processing_attempts,
         u.derived_from_file_id <> '' AS derivado, r.status AS run, r.model, r.proposed_count, r.published_count,
         substr(r.error, 1, 160) AS error, substr(u.last_processing_error, 1, 160) AS error_carga
  FROM uploaded_files u LEFT JOIN ultimo r ON r.file_id = u.id AND r.n = 1
  WHERE u.deleted_at = '' AND u.created_at >= datetime('now', '-60 days')
  ORDER BY u.created_at;`)) {
  console.log(`  ${f.created_at.slice(0, 16)} · ${corto(f.original_name, 90)} [${f.extension}${f.derivado ? ", derivado" : ""}]`);
  console.log(`      área ${f.area} · periodo «${f.detected_period}» · corte declarado «${f.declared_cutoff}» · ${f.review_status}/${f.processing_stage} · rev ${f.publication_revision ?? "-"} · intentos ${f.processing_attempts}`);
  console.log(`      ingesta ${f.run ?? "sin registro"} · ${f.model ?? ""} · propuestos ${f.proposed_count ?? 0} · publicados ${f.published_count ?? 0}`);
  if (f.error || f.error_carga) console.log(`      ERROR: ${corto(f.error || f.error_carga)}`);
}

console.log("\n=== 5. Publicaciones: automáticas desde archivo frente a manuales ===");
for (const f of await consulta(`
  SELECT CASE WHEN source_file_id = '' THEN 'manual / script' ELSE 'desde archivo' END AS origen,
         COUNT(*) AS eventos, SUM(change_count) AS datos, MIN(created_at) AS desde, MAX(created_at) AS hasta
  FROM live_data_events WHERE status = 'published' GROUP BY origen;`)) {
  console.log(`  ${f.origen.padEnd(16)} ${String(f.eventos).padStart(4)} revisiones · ${f.datos} datos · ${f.desde} → ${f.hasta}`);
}

console.log("\n=== 6. Revisiones manuales (mensaje) ===");
for (const f of await consulta(`
  SELECT id, created_at, area, cutoff, change_count, substr(message, 1, 150) AS m
  FROM live_data_events WHERE status = 'published' AND source_file_id = '' ORDER BY id;`)) {
  console.log(`  rev ${f.id} · ${f.created_at.slice(0, 10)} · ${f.area} · corte «${f.cutoff}» · ${f.change_count} datos · ${corto(f.m, 150)}`);
}

console.log("\n=== 7. Publicaciones desde archivo cuyo corte es el día de publicación (corte probablemente inventado) ===");
for (const f of await consulta(`
  SELECT e.id, e.created_at, e.cutoff, e.change_count, substr(e.source_name, 1, 100) AS fuente
  FROM live_data_events e
  WHERE e.status = 'published' AND e.source_file_id <> '' AND substr(e.cutoff, 1, 10) = substr(e.created_at, 1, 10)
  ORDER BY e.id;`)) {
  console.log(`  rev ${f.id} · publicado ${f.created_at.slice(0, 10)} · corte ${f.cutoff} · ${f.change_count} datos · ${f.fuente}`);
}
