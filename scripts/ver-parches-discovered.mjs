#!/usr/bin/env node
// Sólo lectura: busca en live_data_history cualquier clave que empiece por
// "discoveredSections." (un parche por elemento, no la raíz) y si su evento
// sigue "published" -- para confirmar si un parche suelto de antes del 24 de
// agosto está desalineando la reconstrucción del contrato para la raíz.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT h.id, h.key, h.created_at, e.id AS event_id, e.status AS event_status,
          e.created_at AS event_created_at
   FROM live_data_history h
   JOIN live_data_events e ON e.id = h.event_id
   WHERE h.key LIKE 'discoveredSections.%'
   ORDER BY h.id DESC
   LIMIT 30;`,
], { maxBuffer: 16 * 1024 * 1024 });

const rows = JSON.parse(stdout)?.[0]?.results ?? [];
console.log(`=== ${rows.length} fila(s) en live_data_history con clave "discoveredSections.*" ===`);
for (const r of rows) {
  console.log(`\n· history id: ${r.id} · clave: ${r.key}`);
  console.log(`  evento id: ${r.event_id} · estado del evento: ${r.event_status}`);
  console.log(`  creado: ${r.created_at} · evento creado: ${r.event_created_at}`);
}
