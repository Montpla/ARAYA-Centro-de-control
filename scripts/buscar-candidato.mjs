#!/usr/bin/env node
// Búsqueda de sólo lectura en unmapped_field_candidates por fragmento de
// etiqueta, directamente en D1 (no pasa por la app), para encontrar
// candidatos que ya no están "pendiente" y por tanto no aparecen en
// ver-propuestas.mjs ni en ver-seccion-descubierta.mjs.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const FRAGMENTO = (process.env.FRAGMENTO ?? "").toLowerCase();
if (!FRAGMENTO) {
  console.error("✖ Falta FRAGMENTO.");
  process.exit(1);
}

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, file_id, label, description, suggested_area, evidence, confidence, status, review_note, created_at, value_json FROM unmapped_field_candidates WHERE lower(label) LIKE '%${FRAGMENTO}%';`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} candidato(s) con "${FRAGMENTO}" en la etiqueta ===`);
for (const fila of rows) {
  console.log(`\n--- ${fila.label} (${fila.id}) ---`);
  console.log(`archivo: ${fila.file_id}`);
  console.log(`área sugerida: ${fila.suggested_area} · confianza: ${fila.confidence}`);
  console.log(`estado: ${fila.status}`);
  console.log(`descripción: ${fila.description}`);
  console.log(`evidencia: ${fila.evidence}`);
  console.log(`nota de revisión: ${fila.review_note || "(ninguna)"}`);
  console.log(`creado: ${fila.created_at}`);
  console.log(`valor: ${fila.value_json}`);
}
