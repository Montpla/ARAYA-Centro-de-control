#!/usr/bin/env node
// Sólo lectura: claves cuya publicación más reciente sin corte es posterior a
// la ganadora fechada. Son las que cambiarían de valor vigente si la consulta
// de D1 aplicara la regla documentada en compareEffectiveRevision (una
// corrección sin periodo gana por orden de publicación). No imprime valores.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const FECHA = `CASE
  WHEN COALESCE(NULLIF(h.cutoff, ''), NULLIF(e.cutoff, '')) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*' THEN 1
  ELSE 0 END`;
const consulta = `
WITH filas AS (
  SELECT h.key AS key, e.id AS rev, h.source_name AS fuente,
         COALESCE(NULLIF(h.cutoff, ''), e.cutoff) AS corte, ${FECHA} AS fechada
  FROM live_data_history h
  INNER JOIN live_data_events e ON e.id = h.event_id
  LEFT JOIN uploaded_files f ON f.id = h.source_file_id
  WHERE e.status = 'published'
    AND (h.source_file_id = '' OR f.id IS NULL OR (f.deleted_at = '' AND f.superseded_by_file_id = ''))
),
fechada AS (
  SELECT key, rev, fuente, corte, ROW_NUMBER() OVER (PARTITION BY key ORDER BY substr(corte, 1, 10) DESC, rev DESC) AS n
  FROM filas WHERE fechada = 1
),
sin_fecha AS (
  SELECT key, rev, fuente, ROW_NUMBER() OVER (PARTITION BY key ORDER BY rev DESC) AS n
  FROM filas WHERE fechada = 0
)
SELECT s.key AS key, s.rev AS rev_sin_corte, s.fuente AS fuente_sin_corte,
       d.rev AS rev_fechada, d.fuente AS fuente_fechada, d.corte AS corte_fechada
FROM sin_fecha s INNER JOIN fechada d ON d.key = s.key AND d.n = 1
WHERE s.n = 1 AND s.rev > d.rev
ORDER BY s.key;`;

const run = promisify(execFile);
const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json", "--command", consulta,
], { maxBuffer: 32 * 1024 * 1024 });
const filas = JSON.parse(stdout)?.[0]?.results ?? [];
console.log(`=== ${filas.length} clave(s) donde una publicación sin corte es posterior a la ganadora fechada ===`);
for (const f of filas) {
  console.log(`  ${f.key} · sin corte rev ${f.rev_sin_corte} (${f.fuente_sin_corte}) · fechada rev ${f.rev_fechada} corte ${f.corte_fechada} (${f.fuente_fechada})`);
}
