#!/usr/bin/env node
// Segundo diagnóstico, de solo lectura: el primero (diagnostico-financieros-
// area.mjs) sólo buscó por coincidencia EXACTA de clave en live_data_points
// (p. ej. "costBreakdown"), y ese desglose se publica por campo
// ("costBreakdown.Construcción.cumulative"), así que no habría aparecido
// aunque estuviera aislado. También encontró varios archivos financieros
// "aprobado_con_alertas" con entradas aisladas -CXP 07-26.pdf entre ellos,
// justo con antonelyPayableCategories, una raíz financiera- que conviene
// mirar dato a dato antes de descartar el bug de área como causa.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 16 * 1024 * 1024 });
  console.log(stdout);
}

console.log("=== costBreakdown / reprogrammedFlow* / demás raíces por PREFIJO (LIKE) ===");
await query(`
  SELECT key, source_name, source_file_id, cutoff, revision, updated_at
  FROM live_data_points
  WHERE key LIKE 'costBreakdown%' OR key LIKE 'reprogrammedFlow%'
     OR key LIKE 'antonely%' OR key LIKE 'cxp%' OR key LIKE 'fiduciary%'
     OR key LIKE 'financialProjection%' OR key LIKE 'financingProcesses%'
     OR key LIKE 'monthlyDeviationLines%' OR key LIKE 'payablesReconciliation%'
     OR key LIKE 'typeABudgetChapters%' OR key LIKE 'advances%'
     OR key LIKE 'ifcCompliance%' OR key LIKE 'cubicacion%'
  ORDER BY key;
`);

console.log("=== Costo Ago-26.xlsx: ¿cómo quedó clasificado? ===");
await query(`
  SELECT id, original_name, area, document_type, status, review_status,
         requires_review, publication_revision, processing_summary, created_at
  FROM uploaded_files
  WHERE id = '152808d6-daa3-404b-bcd7-69c298d66b31';
`);

console.log("=== Propuestas de CXP 07-26.pdf (área de cada dato + estado) ===");
await query(`
  SELECT key, area, status, notes, confidence
  FROM document_data_proposals
  WHERE file_id = 'cc4f593e-f489-4fde-bcb4-b5acaf6eedbe'
  ORDER BY created_at DESC
  LIMIT 40;
`);

console.log("=== Propuestas de ARAYA_-Flujo_I_reprogramado (área de cada dato + estado) ===");
await query(`
  SELECT key, area, status, notes, confidence
  FROM document_data_proposals
  WHERE file_id = '166db59f-c9a3-4a2c-992e-a61b11f1adce'
  ORDER BY created_at DESC
  LIMIT 40;
`);

console.log("=== Propuestas de BCE 07-26.pdf (área de cada dato + estado) ===");
await query(`
  SELECT key, area, status, notes, confidence
  FROM document_data_proposals
  WHERE file_id = 'fe3054cb-0ae4-4b7d-a32b-11d5e1618f15'
  ORDER BY created_at DESC
  LIMIT 40;
`);

console.log("=== Propuestas de Costo Ago-26.xlsx (área de cada dato + estado) ===");
await query(`
  SELECT key, area, status, notes, confidence
  FROM document_data_proposals
  WHERE file_id = '152808d6-daa3-404b-bcd7-69c298d66b31'
  ORDER BY created_at DESC
  LIMIT 40;
`);
