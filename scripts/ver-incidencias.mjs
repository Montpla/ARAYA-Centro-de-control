#!/usr/bin/env node
// Sólo lectura: muestra las incidencias abiertas en automation_incidents,
// detectadas por la auditoría nocturna, para saber qué son exactamente.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, fingerprint, status, severity, area, title, detail,
          source_file_id, assignee_email, attempt_count, next_retry_at,
          first_detected_at, last_seen_at
   FROM automation_incidents
   ORDER BY last_seen_at DESC
   LIMIT 10;`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} incidencia(s) más reciente(s) ===`);
for (const i of rows) {
  console.log(`\n· id: ${i.id} · estado: ${i.status} · severidad: ${i.severity} · área: ${i.area}`);
  console.log(`  título: ${i.title}`);
  if (i.detail) console.log(`  detalle: ${i.detail}`);
  if (i.source_file_id) console.log(`  archivo origen: ${i.source_file_id}`);
  if (i.assignee_email) console.log(`  asignada a: ${i.assignee_email}`);
  console.log(`  intentos: ${i.attempt_count}${i.next_retry_at ? " · próximo reintento: " + i.next_retry_at : ""}`);
  console.log(`  detectada por primera vez: ${i.first_detected_at} · vista por última vez: ${i.last_seen_at}`);
}
