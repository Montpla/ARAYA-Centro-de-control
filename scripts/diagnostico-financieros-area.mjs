#!/usr/bin/env node
// Diagnóstico de solo lectura: el monto certificado de cubicación
// (cubicacionCaratula) se aisló en silencio durante meses porque su área no
// coincidía con la del archivo que lo contenía (avance físico, no
// finanzas). Antes de dar por buena la corrección general
// (updateIsAutoPublishable, PR de permitir-financieros-con-otra-area), esto
// vuelca:
//   1) Los archivos más recientes de área "finanzas" o tipo
//      "estado_financiero", con su estado de revisión, para ver si alguno
//      quedó "procesado_con_alertas" (aislado) sin que nadie lo notara.
//   2) El estado actual de cada raíz financiera en live_data_points: fuente,
//      fecha de corte y última actualización, para detectar una raíz
//      sospechosamente vieja frente a archivos más recientes disponibles.
//   3) Los PDF recientes (candidatos al bug simétrico del balance
//      fiduciario + avance de edificios en el mismo documento).
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

console.log("=== Archivos de finanzas (últimos 90 días) ===");
await query(`
  SELECT id, original_name, area, document_type, status, review_status,
         requires_review, publication_revision, created_at
  FROM uploaded_files
  WHERE (area = 'finanzas' OR document_type = 'estado_financiero')
    AND deleted_at = ''
    AND created_at >= datetime('now', '-90 days')
  ORDER BY created_at DESC
  LIMIT 40;
`);

console.log("=== Estado actual de cada raíz financiera en live_data_points ===");
await query(`
  SELECT key, source_name, source_file_id, cutoff, revision, updated_at
  FROM live_data_points
  WHERE key IN (
    'cubicacionCaratula', 'costBreakdown', 'fiduciaryStatementSummary',
    'fiduciaryBalanceSections', 'antonelyBalanceLines', 'antonelyPayableCategories',
    'antonelyDetailTotals', 'antonelyAdvances', 'antonelyCostAccounts',
    'antonelyFinanceSource', 'antonelyPayableInvoiceLines', 'antonelyPayableVendorsAll',
    'cxpAging', 'cxpCategories', 'financialProjection', 'financingProcesses',
    'monthlyDeviationLines', 'payablesReconciliation', 'reprogrammedFlowMonths',
    'reprogrammedFlowAudit', 'reprogrammedFlowScopes', 'typeABudgetChapters',
    'advances', 'ifcComplianceGroups', 'ifcComplianceTracking'
  )
  ORDER BY key;
`);

console.log("=== PDF recientes (candidatos al bug simétrico: edificios + balance fiduciario) ===");
await query(`
  SELECT id, original_name, area, document_type, status, review_status, created_at
  FROM uploaded_files
  WHERE extension = 'pdf'
    AND deleted_at = ''
    AND created_at >= datetime('now', '-90 days')
  ORDER BY created_at DESC
  LIMIT 40;
`);

console.log("=== Archivos aislados con alertas (cualquier área, últimos 30 días) ===");
await query(`
  SELECT id, original_name, area, document_type, review_status, processing_summary, created_at
  FROM uploaded_files
  WHERE review_status IN ('aprobado_con_alertas', 'procesado_con_alertas')
    AND deleted_at = ''
    AND created_at >= datetime('now', '-30 days')
  ORDER BY created_at DESC
  LIMIT 40;
`);
