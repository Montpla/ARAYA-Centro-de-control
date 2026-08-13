// Pure re-derivation helpers shared by the client dashboard and the server
// API routes. They must never live alongside a data module that also exports
// real financial figures — dashboard-client.tsx imports from here directly,
// and anything exported by a sibling module would ship inside the public
// client JavaScript bundle regardless of the viewer's financeAccess.

const percentEs = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const reprogrammedFlowPercentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

const RECONCILIATION_METRIC_TO_SECTION_ID: Record<string, string> = {
  "Activos": "assets",
  "Pasivos": "liabilities",
  "Patrimonio neto": "equity",
};

// Decisión explícita: el KPI principal de CxP ("Relación consolidada") sigue
// en vivo al archivo departamental de Antonely, igual que "Archivo Antonely".
// "Balance contable" se deja fuera: no tiene fuente en vivo propia todavía y
// su diferencia frente al KPI sigue siendo una conciliación contable real,
// no una copia desincronizada.
export function livePayablesReconciliation<R extends { source: string; amount: number }>(
  reconciliation: readonly R[],
  antonelyPayablesTotalDop: number,
): R[] {
  return reconciliation.map((row) => row.source === "Archivo Antonely" || row.source === "Relación consolidada"
    ? { ...row, amount: antonelyPayablesTotalDop }
    : row);
}

// juneReport.finance duplica en un resumen aparte varios totales que ya
// viven, línea a línea, en otros arreglos en vivo:
// - cxpDop / advancesPendingDop ← antonelyDetailTotals (decisión explícita:
//   ya no esperan conciliación contable, ver payablesReconciliation).
// - assetsDop / liabilitiesDop / equityDop / liquidityDop / clientDepositsDop
//   ← antonelyBalanceLines, que es literalmente "el Excel de gestión" del
//   que procede esta vista de "Control interno" (antonelyBalanceLines ya
//   trae sus propias filas "Total activos"/"Total pasivos"/etc.; esto no es
//   un cambio de política, es conectar un resumen con su propia fuente).
// - projectedCashDecemberDop ← el último mes ("Dic") de financialProjection.
// - remainingDop es un cálculo puro (budgetDop - executedDop); se mantiene
//   consistente aunque budgetDop/executedDop todavía no tengan fuente viva.
// budgetDop, executedDop y juneExecutedDop se dejan tal cual: no hay ningún
// arreglo en vivo que los resuma todavía (llegarían de un nuevo Excel
// consolidado), pero al ser juneReport una raíz registrada, en cuanto se
// publique un valor para esas claves se reflejará solo.
export function liveJuneReportFinance<
  J extends {
    finance: {
      cxpDop: number;
      advancesPendingDop: number;
      projectedCashDecemberDop: number;
      assetsDop: number;
      liabilitiesDop: number;
      equityDop: number;
      liquidityDop: number;
      clientDepositsDop: number;
      budgetDop: number;
      executedDop: number;
      remainingDop: number;
    };
  },
>(
  report: J,
  detail: { payablesTotalDop: number; advancePendingDop: number },
  balanceLines: readonly { section: string; name: string; amount: number }[],
  projection: readonly { month: string; cumulative: number }[],
): J {
  const finance = report.finance;
  const line = (section: string, name: string) =>
    balanceLines.find((item) => item.section === section && item.name === name)?.amount;
  const december = projection.find((item) => item.month === "Dic");
  return {
    ...report,
    finance: {
      ...finance,
      cxpDop: detail.payablesTotalDop,
      advancesPendingDop: detail.advancePendingDop,
      projectedCashDecemberDop: december?.cumulative ?? finance.projectedCashDecemberDop,
      assetsDop: line("Balance", "Total activos") ?? finance.assetsDop,
      liabilitiesDop: line("Balance", "Total pasivos") ?? finance.liabilitiesDop,
      equityDop: line("Balance", "Activos netos") ?? finance.equityDop,
      liquidityDop: line("Bancos", "Total bancos") ?? finance.liquidityDop,
      clientDepositsDop: line("Pasivo corriente", "Depósitos diferidos clientes") ?? finance.clientDepositsDop,
      remainingDop: finance.budgetDop - finance.executedDop,
    },
  };
}

// Los conteos y totales de antonelyDetailTotals resumen lo que ya está línea
// a línea en sus arreglos hermanos (antonelyAdvances, antonelyCostAccounts,
// antonelyPayableCategories, antonelyBalanceLines). Cuando se sube un nuevo
// detalle, la extracción sólo publica el arreglo correspondiente; esta
// función mantiene el resumen sincronizado con esas líneas en vez de
// quedarse en la semilla original. A diferencia de payablesTotalDop (ver
// payablesReconciliation), aquí no hay ninguna diferencia de alcance
// documentada entre el resumen y el detalle — las copias originales partían
// todas del mismo número, así que sincronizar no pisa ninguna conciliación
// pendiente. payableInvoiceCount/payableVendorCount se dejan fuera: su
// detalle (antonelyPayableInvoiceLines/antonelyPayableVendorsAll) no llega
// hasta el cliente del dashboard, sólo hasta /api/payables.
export function liveAntonelyDetailTotals<
  T extends {
    advanceGrantedDop: number;
    advancePendingDop: number;
    advanceCount: number;
    costAccountCount: number;
    payableCategoryCount: number;
    balanceLineCount: number;
  },
  A extends { granted: number; pending: number },
>(
  totals: T,
  detail: {
    advances: readonly A[];
    costAccounts: readonly unknown[];
    payableCategories: readonly unknown[];
    balanceLines: readonly unknown[];
  },
): T {
  return {
    ...totals,
    ...(detail.advances.length ? {
      advanceGrantedDop: detail.advances.reduce((sum, item) => sum + item.granted, 0),
      advancePendingDop: detail.advances.reduce((sum, item) => sum + item.pending, 0),
      advanceCount: detail.advances.length,
    } : {}),
    ...(detail.costAccounts.length ? { costAccountCount: detail.costAccounts.length } : {}),
    ...(detail.payableCategories.length ? { payableCategoryCount: detail.payableCategories.length } : {}),
    ...(detail.balanceLines.length ? { balanceLineCount: detail.balanceLines.length } : {}),
  };
}

// packageCount/offerCount/comparisonCount/auditedScheduledTotalDop son
// conteos y sumas puras de procurementPackages/supplierComparisons/
// procurementMonthlySchedule (verificado). sourceReportedTotalDop y
// omittedFromSourceFormulaDop describen un hallazgo concreto (una fórmula
// del origen que omite un paquete específico, ver procurementQualityIssues)
// y se dejan fijos: derivarlos por nombre de paquete sería frágil si un
// futuro archivo cambia esa nomenclatura. phaseBuildings tampoco se deriva:
// es el alcance del documento, no un conteo de sus arreglos.
export function liveProcurementAudit<
  T extends {
    packageCount: number;
    offerCount: number;
    comparisonCount: number;
    auditedScheduledTotalDop: number;
  },
  P extends { scheduledTotalDop: number },
  C extends { offers: readonly unknown[] },
  M extends { cumulativeDop: number },
>(
  audit: T,
  packages: readonly P[],
  comparisons: readonly C[],
  monthlySchedule: readonly M[],
): T {
  if (!packages.length && !comparisons.length && !monthlySchedule.length) return audit;
  return {
    ...audit,
    packageCount: packages.length || audit.packageCount,
    offerCount: comparisons.length ? comparisons.reduce((sum, item) => sum + item.offers.length, 0) : audit.offerCount,
    comparisonCount: comparisons.length || audit.comparisonCount,
    auditedScheduledTotalDop: monthlySchedule.length
      ? monthlySchedule[monthlySchedule.length - 1].cumulativeDop
      : audit.auditedScheduledTotalDop,
  };
}

// typeABudgetSummary es una suma pura de typeABudgetChapters (verificado
// campo a campo: originalPerBuildingDop = Σ chapters.originalDop, etc.). Los
// multiplicadores de 77 edificios son un alcance fijo del documento (no
// dependen de buildings.length), así que se conservan como constantes; sólo
// se recalculan si el arreglo de capítulos trae una fuente nueva.
export function liveTypeABudgetSummary<
  T extends {
    originalPerBuildingDop: number;
    updatedPerBuildingDop: number;
    differencePerBuildingDop: number;
    deviationPerBuilding: number;
    original77BuildingsDop: number;
    updated77BuildingsDop: number;
    difference77BuildingsDop: number;
  },
  C extends { originalDop: number; updatedDop: number; differenceDop: number },
>(summary: T, chapters: readonly C[]): T {
  if (!chapters.length) return summary;
  const originalPerBuildingDop = chapters.reduce((sum, item) => sum + item.originalDop, 0);
  const updatedPerBuildingDop = chapters.reduce((sum, item) => sum + item.updatedDop, 0);
  const differencePerBuildingDop = chapters.reduce((sum, item) => sum + item.differenceDop, 0);
  return {
    ...summary,
    originalPerBuildingDop,
    updatedPerBuildingDop,
    differencePerBuildingDop,
    deviationPerBuilding: originalPerBuildingDop ? differencePerBuildingDop / originalPerBuildingDop : 0,
    original77BuildingsDop: originalPerBuildingDop * 77,
    updated77BuildingsDop: updatedPerBuildingDop * 77,
    difference77BuildingsDop: differencePerBuildingDop * 77,
  };
}

// juneDeviationSummary es una suma pura de monthlyDeviationLines (verificado
// campo a campo). El multiplicador de 26 edificios es el alcance fijo de
// este documento (Fase I), no buildings.length.
export function liveJuneDeviationSummary<
  T extends {
    originalPerBuildingDop: number;
    updatedPerBuildingDop: number;
    differencePerBuildingDop: number;
    deviationPerBuilding: number;
    original26BuildingsDop: number;
    updated26BuildingsDop: number;
    difference26BuildingsDop: number;
    weightedProjectImpactDop: number;
    weightedProjectImpactRatio: number;
  },
  L extends { originalDop: number; updatedDop: number; differenceDop: number; projectImpactDop: number },
>(summary: T, lines: readonly L[]): T {
  if (!lines.length) return summary;
  const originalPerBuildingDop = lines.reduce((sum, item) => sum + item.originalDop, 0);
  const updatedPerBuildingDop = lines.reduce((sum, item) => sum + item.updatedDop, 0);
  const differencePerBuildingDop = lines.reduce((sum, item) => sum + item.differenceDop, 0);
  const weightedProjectImpactDop = lines.reduce((sum, item) => sum + item.projectImpactDop, 0);
  const original26BuildingsDop = originalPerBuildingDop * 26;
  return {
    ...summary,
    originalPerBuildingDop,
    updatedPerBuildingDop,
    differencePerBuildingDop,
    deviationPerBuilding: originalPerBuildingDop ? differencePerBuildingDop / originalPerBuildingDop : 0,
    original26BuildingsDop,
    updated26BuildingsDop: updatedPerBuildingDop * 26,
    difference26BuildingsDop: differencePerBuildingDop * 26,
    weightedProjectImpactDop,
    weightedProjectImpactRatio: original26BuildingsDop ? weightedProjectImpactDop / original26BuildingsDop : 0,
  };
}

export function liveDataAuthorityMatrix<T extends { id: string; decision: string; status: string }>(
  matrix: readonly T[],
  overallProgress: number,
  plannedProgress: number,
  scheduleProgress: number,
  cxpDop: number,
): T[] {
  return matrix.map((item) => {
    if (item.id === "physical-progress") {
      return {
        ...item,
        decision: `${percentEs.format(overallProgress)}% ejecutado frente a ${percentEs.format(plannedProgress)}% planificado. Solo cambia con una medición física posterior validada.`,
      };
    }
    if (item.id === "schedule-progress") {
      return {
        ...item,
        decision: `El ${percentEs.format(scheduleProgress)}% del MPP no sustituye el ${percentEs.format(overallProgress)}% físico: miden conceptos diferentes.`,
      };
    }
    if (item.id === "management-payables") {
      // Decisión explícita: el KPI de gestión dejó de esperar conciliación y
      // ahora sigue en vivo el archivo departamental de Antonely (ver
      // liveJuneReportFinance / livePayablesReconciliation).
      return {
        ...item,
        status: "conciliado",
        decision: `El KPI de gestión sigue en vivo el archivo departamental de Antonely: DOP ${percentEs.format(cxpDop)}.`,
      };
    }
    return item;
  });
}

// assetsDop/liabilitiesDop/netEquityDop duplican exactamente los totalDop de
// "assets"/"liabilities"/"equity" en fiduciaryBalanceSections (mismo estado
// oficial, dos campos separados). Cuando se sube un nuevo Balance de
// Comprobación, la extracción sólo publica fiduciaryBalanceSections —el resto
// de balance (grossEquityDop, liquidityDop, etc.) depende de nombres de
// línea que cambian de un corte a otro y no se pueden derivar con
// confianza—, así que esta función mantiene sincronizados sólo esos tres
// totales agregados con la fuente viva, sin tocar monthlyResult,
// accumulatedResult ni trialBalance (esos sólo cambian si un futuro estado
// de resultados o balance de comprobación los publica directamente).
export function liveFiduciaryStatementSummary<
  S extends { balance: { assetsDop: number; liabilitiesDop: number; netEquityDop: number } },
  T extends { id: string; totalDop: number },
>(summary: S, sections: readonly T[]): S {
  const totalFor = (id: string) => sections.find((section) => section.id === id)?.totalDop;
  return {
    ...summary,
    balance: {
      ...summary.balance,
      assetsDop: totalFor("assets") ?? summary.balance.assetsDop,
      liabilitiesDop: totalFor("liabilities") ?? summary.balance.liabilitiesDop,
      netEquityDop: totalFor("equity") ?? summary.balance.netEquityDop,
    },
  };
}

// Sólo "Activos"/"Pasivos"/"Patrimonio neto" tienen una columna officialDop
// que corresponde 1:1 a un totalDop de fiduciaryBalanceSections (por id, no
// por nombre de línea). Las filas de detalle ("Disponibilidades", "Cuentas
// por pagar"...) dependen de qué línea concreta trae cada balance de
// comprobación —los nombres cambian de un corte a otro, incluso de idioma,
// como pasó en jul-26— así que no se derivan automáticamente: se quedan
// congeladas hasta que alguien las revise a mano.
export function liveFiduciaryManagementReconciliation<
  R extends { metric: string; officialDop: number; managementDop: number; differenceDop: number },
  T extends { id: string; totalDop: number },
>(reconciliation: readonly R[], sections: readonly T[]): R[] {
  return reconciliation.map((row) => {
    const sectionId = RECONCILIATION_METRIC_TO_SECTION_ID[row.metric];
    const officialDop = sectionId ? sections.find((section) => section.id === sectionId)?.totalDop : undefined;
    if (officialDop === undefined) return row;
    return { ...row, officialDop, differenceDop: row.managementDop - officialDop };
  });
}

// El detalle de "Sin indicador de avance físico" cita el avance físico
// vigente dentro del texto (no en un campo numérico aparte), así que la
// línea base arriba se queda fija. Esta función sustituye esa frase con el
// porcentaje vivo en el momento de mostrarla, igual que liveDataAuthorityMatrix.
export function liveReprogrammedFlowQualityIssues<T extends { title: string; detail: string }>(
  issues: readonly T[],
  overallProgress: number,
): T[] {
  return issues.map((issue) => issue.title === "Sin indicador de avance físico"
    ? { ...issue, detail: `El libro registra importes presupuestados, reales y reprogramados, pero no contiene mediciones físicas, cantidades ejecutadas ni porcentajes de avance de obra. El avance físico permanece en ${reprogrammedFlowPercentFormatter.format(overallProgress)}%.` }
    : issue);
}

// governedMetrics/reconciledMetrics/separatedMetrics/observedMetrics son
// conteos puros de dataAuthorityMatrix por status (verificado). registeredSources
// se deja fijo: cuenta fuentes canónicas registradas en sourceGovernance, un
// catálogo que no cambia con cada carga.
export function liveDataGovernanceSummary<
  T extends {
    governedMetrics: number;
    reconciledMetrics: number;
    separatedMetrics: number;
    observedMetrics: number;
  },
  M extends { status: string },
>(summary: T, matrix: readonly M[]): T {
  if (!matrix.length) return summary;
  return {
    ...summary,
    governedMetrics: matrix.length,
    reconciledMetrics: matrix.filter((item) => item.status === "conciliado").length,
    separatedMetrics: matrix.filter((item) => item.status === "separado").length,
    observedMetrics: matrix.filter((item) => item.status === "observado").length,
  };
}

// El directorio de proveedores ya agrupa cada fila de contacto por empresa
// (nombre normalizado); estos conteos se derivan sumando/filtrando sobre esas
// filas agrupadas, no sobre las filas sueltas del origen. Eso cambia
// ligeramente el criterio de creditRelationships/cashRelationships/
// pendingNegotiation frente al cálculo original (por proveedor con al menos
// una relación de ese tipo, no por fila) — un criterio más correcto para un
// contador "cuántos proveedores", y el único derivable en vivo sin conservar
// las filas sueltas del Excel de origen como raíz propia.
export function liveSupplierContactAudit<
  T extends {
    sourceRows: number;
    uniqueSuppliers: number;
    large: number;
    medium: number;
    small: number;
    creditRelationships: number;
    cashRelationships: number;
    pendingNegotiation: number;
    creditLimitDop: number;
    missingLegalId: number;
    missingEmail: number;
  },
  S extends {
    size: string;
    relationships: readonly string[];
    creditLimitDop: number;
    legalIds: readonly unknown[];
    emails: readonly unknown[];
    sourceRows: readonly unknown[];
  },
>(audit: T, directory: readonly S[]): T {
  if (!directory.length) return audit;
  const hasRelationship = (needle: string) =>
    directory.filter((supplier) =>
      supplier.relationships.some((item) => item.toLocaleLowerCase("es").includes(needle)),
    ).length;
  return {
    ...audit,
    sourceRows: directory.reduce((sum, supplier) => sum + supplier.sourceRows.length, 0),
    uniqueSuppliers: directory.length,
    large: directory.filter((supplier) => supplier.size.toLocaleUpperCase("es") === "GRANDE").length,
    medium: directory.filter((supplier) => supplier.size.toLocaleUpperCase("es") === "MEDIANA").length,
    small: directory.filter((supplier) => supplier.size.toLocaleUpperCase("es") === "PEQUENA").length,
    creditRelationships: hasRelationship("credito"),
    cashRelationships: hasRelationship("contado"),
    pendingNegotiation: hasRelationship("sin negociacion"),
    creditLimitDop: directory.reduce((sum, supplier) => sum + supplier.creditLimitDop, 0),
    missingLegalId: directory.filter((supplier) => supplier.legalIds.length === 0).length,
    missingEmail: directory.filter((supplier) => supplier.emails.length === 0).length,
  };
}
