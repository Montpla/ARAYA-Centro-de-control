#!/usr/bin/env node
// Sólo lectura: para decidir cómo corregir la incidencia de discoveredSections
// sin dañar nada más, comprueba (a) qué otras claves llevan los eventos 43 y
// 66 (los que aportan los parches discoveredSections.0-4), y (b) el corte
// (cutoff) real de la fila raíz consolidada (history id 571) frente al de
// esos parches -- la comparación de "más reciente" del modelo vivo se hace
// por corte de negocio, no por fecha de publicación.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout: eventosStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT h.event_id, h.key, h.cutoff AS row_cutoff, e.cutoff AS event_cutoff,
          e.status, e.source_name
   FROM live_data_history h
   JOIN live_data_events e ON e.id = h.event_id
   WHERE h.event_id IN (43, 66)
   ORDER BY h.event_id, h.key;`,
], { maxBuffer: 16 * 1024 * 1024 });
const eventoRows = JSON.parse(eventosStdout)?.[0]?.results ?? [];
console.log(`=== ${eventoRows.length} fila(s) de historial para los eventos 43 y 66 ===`);
for (const r of eventoRows) {
  console.log(`\n· evento ${r.event_id} (${r.status}, fuente: ${r.source_name})`);
  console.log(`  clave: ${r.key} · corte de la fila: "${r.row_cutoff}" · corte del evento: "${r.event_cutoff}"`);
}

const { stdout: raizStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT h.id, h.event_id, h.cutoff AS row_cutoff, e.cutoff AS event_cutoff, e.status
   FROM live_data_history h
   JOIN live_data_events e ON e.id = h.event_id
   WHERE h.id = 571;`,
], { maxBuffer: 16 * 1024 * 1024 });
const raizRows = JSON.parse(raizStdout)?.[0]?.results ?? [];
console.log(`\n=== corte de la fila raíz consolidada (history id 571) ===`);
for (const r of raizRows) {
  console.log(`· evento ${r.event_id} (${r.status}) · corte de la fila: "${r.row_cutoff}" · corte del evento: "${r.event_cutoff}"`);
}
