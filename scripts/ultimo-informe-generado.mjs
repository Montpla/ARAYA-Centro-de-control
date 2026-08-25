#!/usr/bin/env node
// Sólo lectura: muestra los informes (report_snapshots) más recientes, para
// comprobar si el que se acaba de generar quedó guardado correctamente.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout: horaStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command", "SELECT datetime('now') AS ahora;",
], { maxBuffer: 16 * 1024 * 1024 });
const ahora = JSON.parse(horaStdout)?.[0]?.results?.[0]?.ahora;
console.log(`Hora del servidor (UTC): ${ahora}\n`);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, frequency, start_date, end_date, label, currency,
          live_revision, cutoff, report_type, request_key,
          includes_finance, created_by_email, created_by_name, created_at,
          length(snapshot_json) AS snapshot_bytes
   FROM report_snapshots
   ORDER BY created_at DESC
   LIMIT 5;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} informe(s) más reciente(s) en report_snapshots ===`);
for (const r of rows) {
  console.log(`\n· id: ${r.id}`);
  console.log(`  etiqueta: ${r.label}`);
  console.log(`  tipo: ${r.report_type} · frecuencia: ${r.frequency} · moneda: ${r.currency}`);
  console.log(`  periodo: ${r.start_date} a ${r.end_date} · corte: ${r.cutoff || "(sin corte)"}`);
  console.log(`  revisión del modelo vivo usada: ${r.live_revision}`);
  console.log(`  incluye finanzas: ${r.includes_finance ? "sí" : "no"}`);
  console.log(`  generado por: ${r.created_by_name} <${r.created_by_email}>`);
  console.log(`  tamaño del contenido: ${r.snapshot_bytes} bytes`);
  console.log(`  creado: ${r.created_at}`);
}

const { stdout: autoStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, kind, status, summary, actor_email, actor_name, started_at, completed_at
   FROM automation_runs
   ORDER BY started_at DESC
   LIMIT 8;`,
], { maxBuffer: 16 * 1024 * 1024 });
const autoRows = JSON.parse(autoStdout)?.[0]?.results ?? [];
console.log(`\n=== ${autoRows.length} ejecución(es) de automatización más reciente(s) ===`);
for (const a of autoRows) {
  console.log(`\n· id: ${a.id} · tipo: ${a.kind} · estado: ${a.status}`);
  console.log(`  actor: ${a.actor_name} <${a.actor_email}>`);
  console.log(`  iniciado: ${a.started_at}${a.completed_at ? " · completado: " + a.completed_at : " · (sin completar)"}`);
  if (a.summary) console.log(`  resumen: ${a.summary}`);
}
