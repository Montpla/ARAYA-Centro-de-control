#!/usr/bin/env node
// Auditoría de solo lectura, puntual: para cada área del Centro de Control,
// compara la fecha del archivo más reciente ya integrado con la fecha del
// último punto de datos en vivo (live_data_points) de esa área, para
// detectar áreas cuyo panel pueda estar mostrando datos desactualizados
// frente a lo último subido. También vuelca cualquier archivo que haya
// quedado en un estado de revisión pendiente, ya que la política vigente es
// no dejar nada "en revisión". Se retira tras el diagnóstico.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

const areaRootKeys = {
  obra: ["buildings", "constructionDisciplines", "structuralDelay", "workPackages", "projectCertifications"],
  planificacion: ["monthlyPlan", "timeline"],
  urbanismo: ["urbanismAreas", "urbanismReportAreas", "delayedUrbanismStarts"],
  seguridad: ["safetyMetrics", "safetyFindings", "safetyFindingTracking", "safetyWeeklySeries"],
  legal: ["permits"],
  compras: ["supplierComparisons", "supplierDirectory", "procurementMonthlySchedule", "procurementPackages"],
  comercial: ["arrearsBreakdown", "collectionTargets", "commercialPartners", "salesLocations", "salesModels"],
  finanzas: [
    "advances", "antonelyAdvances", "antonelyBalanceLines", "antonelyCostAccounts",
    "antonelyDetailTotals", "antonelyFinanceSource", "antonelyPayableCategories",
    "antonelyPayableInvoiceLines", "antonelyPayableVendorsAll", "costBreakdown",
    "cubicaciones", "cubicacionCaratula", "cxpAging", "cxpCategories",
    "financialProjection", "financingProcesses", "fiduciaryBalanceSections",
    "fiduciaryManagementReconciliation", "fiduciaryStatementQualityIssues",
    "fiduciaryStatementSummary", "ifcComplianceGroups", "ifcComplianceTracking",
    "monthlyDeviationLines", "payablesReconciliation", "reprogrammedFlowAudit",
    "reprogrammedFlowMonths", "reprogrammedFlowQualityIssues", "reprogrammedFlowScopes",
    "typeABudgetChapters",
  ],
};

console.log("=== Último archivo integrado por área (últimos 180 días) ===");
const lastFiles = await query(`
  SELECT area, MAX(created_at) AS ultimo_archivo, COUNT(*) AS total
  FROM uploaded_files
  WHERE deleted_at = '' AND created_at >= datetime('now', '-180 days')
  GROUP BY area
  ORDER BY area;
`);
console.log(JSON.stringify(lastFiles, null, 2));

console.log("=== Último punto vivo por raíz de clave (todas las raíces mapeadas) ===");
const allRoots = Object.values(areaRootKeys).flat();
const rootsCsv = allRoots.map((r) => `'${r}'`).join(",");
const liveRows = await query(`
  SELECT
    CASE
      ${allRoots.map((r) => `WHEN key = '${r}' OR key LIKE '${r}.%' THEN '${r}'`).join("\n      ")}
    END AS raiz,
    MAX(updated_at) AS ultima_actualizacion,
    COUNT(*) AS puntos
  FROM live_data_points
  WHERE ${allRoots.map((r) => `key = '${r}' OR key LIKE '${r}.%'`).join(" OR ")}
  GROUP BY raiz
  ORDER BY raiz;
`);
console.log(JSON.stringify(liveRows, null, 2));

console.log("=== Comparación por área: archivo más reciente vs. dato vivo más reciente ===");
const liveByRoot = new Map(liveRows.map((r) => [r.raiz, r]));
for (const [area, roots] of Object.entries(areaRootKeys)) {
  const fileRow = lastFiles.find((f) => f.area === area);
  const liveMaxes = roots.map((r) => liveByRoot.get(r)?.ultima_actualizacion).filter(Boolean);
  const liveMax = liveMaxes.length ? liveMaxes.sort().at(-1) : null;
  const rootsWithNoData = roots.filter((r) => !liveByRoot.has(r));
  console.log(JSON.stringify({
    area,
    ultimo_archivo: fileRow?.ultimo_archivo ?? "(sin archivos en 180 días)",
    ultimo_dato_vivo: liveMax ?? "(sin datos vivos)",
    raices_sin_ningun_dato: rootsWithNoData,
    posible_desfase: fileRow && liveMax ? fileRow.ultimo_archivo > liveMax : null,
  }));
}

console.log("=== Áreas sin mapeo de claves vivas (diseño, dirección, sin_clasificar) ===");
const otherAreas = await query(`
  SELECT area, review_status, COUNT(*) AS total, MAX(created_at) AS ultimo
  FROM uploaded_files
  WHERE deleted_at = '' AND area IN ('diseno', 'direccion', 'sin_clasificar')
  GROUP BY area, review_status
  ORDER BY area, ultimo DESC;
`);
console.log(JSON.stringify(otherAreas, null, 2));

console.log("=== Archivos en cualquier estado de revisión pendiente (política: nunca dejar en revisión) ===");
const pending = await query(`
  SELECT id, original_name, area, document_type, review_status, requires_review, created_at
  FROM uploaded_files
  WHERE deleted_at = ''
    AND (review_status IN ('pendiente_extraccion', 'listo_revision', 'cambios_solicitados') OR requires_review = 1)
  ORDER BY created_at DESC
  LIMIT 60;
`);
console.log(JSON.stringify(pending, null, 2));

console.log("=== Archivos aislados/observados recientes (cualquier área, 30 días) ===");
const flagged = await query(`
  SELECT id, original_name, area, review_status, processing_summary, created_at
  FROM uploaded_files
  WHERE deleted_at = ''
    AND review_status IN ('aprobado_con_alertas', 'procesado_con_alertas', 'observado', 'rechazado')
    AND created_at >= datetime('now', '-30 days')
  ORDER BY created_at DESC
  LIMIT 60;
`);
console.log(JSON.stringify(flagged, null, 2));
