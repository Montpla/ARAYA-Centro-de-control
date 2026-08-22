import { desc, eq } from "drizzle-orm";
import { cubicaciones } from "../../demo-data";
import {
  antonelyAdvances,
  antonelyBalanceLines,
  antonelyCostAccounts,
  antonelyDetailTotals,
  antonelyPayableCategories,
} from "../../antonely-finance-data";
import {
  advances,
  antonelyFinanceSource,
  arrearsBreakdown,
  cxpAging,
  financialProjection,
  financingProcesses,
  juneDataQualityIssues,
  juneReport,
  permits,
  payablesReconciliation,
  safetyFindings,
  safetyMetrics,
  salesLocations,
  salesModels,
} from "../../june-report-data";
import {
  juneDeviationSummary,
  monthlyDeviationLines,
  procurementQualityIssues,
  typeABudgetChapters,
  typeABudgetSummary,
} from "../../procurement-data";
import {
  reprogrammedFlowAudit,
  reprogrammedFlowMonths,
  reprogrammedFlowQualityIssues,
  reprogrammedFlowScopes,
} from "../../reprogrammed-flow-data";
import {
  fiduciaryBalanceSections,
  fiduciaryManagementReconciliation,
  fiduciaryStatementQualityIssues,
  fiduciaryStatementSummary,
} from "../../fiduciary-statements-data";
import { dataAuthorityMatrix, dataGovernanceSummary } from "../../data-governance";
import {
  liveAntonelyDetailTotals,
  liveDataAuthorityMatrix,
  liveFiduciaryManagementReconciliation,
  liveFiduciaryStatementSummary,
  liveJuneDeviationSummary,
  liveJuneReportFinance,
  livePayablesReconciliation,
  liveReprogrammedFlowQualityIssues,
  liveTypeABudgetSummary,
} from "../../../lib/live-derivations";
import { getDb } from "../../../db";
import {
  controlActions,
  reportSnapshots,
  uploadedFiles,
} from "../../../db/schema";
import { areaLabels, uploadStatusLabels } from "../../../lib/file-routing";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../../../lib/agent-prompt";
import { requireApiUser } from "../../../lib/access-control";
import { CurrencyCode, DOP_TO_USD, FX_RATE_CUTOFF, formatMoney, formatMoneyMillions } from "../../../lib/currency";
import {
  LiveDataValue,
  materializeLiveRoot,
  redactFinancialFields,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "../../../lib/live-data";
import { buildControlRoomBaseline } from "../../../lib/control-room";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { materializeSpatialLiveData } from "../../../lib/spatial-live-data";
import {
  addAiTokenUsage,
  emptyAiTokenUsage,
  estimateOpenAiCostUsdMicros,
  readOpenAiTokenUsage,
} from "../../../lib/ai-cost";
import { getAiUsageSnapshot, recordAssistantAiRun } from "../../../lib/ai-usage";

const ASSISTANT_PRIMARY_MODEL = "gpt-5.6-luna";
const ASSISTANT_ADVANCED_MODEL = "gpt-5.6-terra";

type ResponsesApiOutput = Array<{
  type: string;
  name?: ToolName;
  arguments?: string;
  call_id?: string;
  content?: Array<{ type: string; text?: string }>;
}>;

type ToolName =
  | "get_project_summary"
  | "get_schedule_deviations"
  | "get_building_units"
  | "get_work_packages"
  | "get_financial_measurements"
  | "get_commercial_status"
  | "get_financial_status"
  | "get_safety_permits"
  | "get_data_quality"
  | "get_uploaded_files"
  | "get_control_room_status"
  | "get_live_data_status";

const tools = [
  {
    type: "function",
    name: "get_project_summary",
    description: "Devuelve avance físico, avance del cronograma, desviación, alcance, fechas y corte del proyecto.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_schedule_deviations",
    description: "Devuelve edificios y paquetes con una desviación mínima frente a la línea base.",
    parameters: {
      type: "object",
      properties: {
        minimum_days: { type: "number", description: "Mínimo de días de desviación." },
      },
      required: ["minimum_days"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_building_units",
    description: "Consulta el índice de frentes, previsión y seis apartamentos de un edificio.",
    parameters: {
      type: "object",
      properties: {
        building: { type: "string", description: "Código numérico del edificio, por ejemplo 3, 12 o 71." },
      },
      required: ["building"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_work_packages",
    description: "Consulta paquetes de trabajo, avance, fin, línea base, desviación y criticidad.",
    parameters: {
      type: "object",
      properties: {
        only_critical: { type: "boolean", description: "Si es verdadero, devuelve sólo paquetes críticos." },
      },
      required: ["only_critical"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_financial_measurements",
    description: "Consulta cubicaciones y contabilidad. La regla del proyecto asigna DOP porque la fuente no rotula moneda.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_commercial_status",
    description: "Consulta reservas, fases, modelos, ubicaciones, vinculación, cobranza y morosidad de junio.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_financial_status",
    description: "Consulta presupuesto, costes, caja, cuentas por pagar, anticipos y posición financiera de junio.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_safety_permits",
    description: "Consulta seguridad, hallazgos, permisos y gestiones de financiación del informe de junio.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_data_quality",
    description: "Devuelve fuentes, cortes, advertencias, inconsistencias y reglas de interpretación.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_uploaded_files",
    description: "Devuelve los últimos archivos cargados por los equipos, con área, persona, versión y estado de validación.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_live_data_status",
    description: "Devuelve la versión viva más reciente y la procedencia de cada dato actualizado.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_control_room_status",
    description: "Consulta calidad del expediente, integridad del plano, alertas de planificación, conciliaciones, acciones asignadas e informes archivados.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
];

function numberForAgent(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function extractOutputText(output: ResponsesApiOutput): string {
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
}

function redactedAgentList<T>(key: string, value: readonly T[]) {
  const mutableValue = JSON.parse(JSON.stringify(value)) as LiveDataValue;
  const redacted = redactFinancialFields(key, mutableValue);
  return Array.isArray(redacted) ? redacted as unknown as T[] : [];
}

async function getLiveDataSnapshot(financeAccess: boolean) {
  try {
    return await readEffectiveLiveData(financeAccess);
  } catch {
    return { values: {}, points: [], latestEvent: null, revision: 0 } as Awaited<ReturnType<typeof readEffectiveLiveData>>;
  }
}

async function executeTool(name: ToolName, args: Record<string, unknown>, canAccessFinance: boolean) {
  const live = await getLiveDataSnapshot(canAccessFinance);
  const spatial = materializeSpatialLiveData(live.values);
  const currentProjectSnapshot = spatial.projectSnapshot;
  const currentMonthlyPlan = spatial.monthlyPlan;
  const currentCubicaciones = materializeLiveRoot("cubicaciones", cubicaciones, live.values);
  const currentFinancialProjection = materializeLiveRoot("financialProjection", financialProjection, live.values);
  let currentJuneReport = materializeLiveRoot("juneReport", juneReport, live.values);
  const currentSalesModels = materializeLiveRoot("salesModels", salesModels, live.values);
  const currentSalesLocations = materializeLiveRoot("salesLocations", salesLocations, live.values);
  const currentArrearsBreakdown = materializeLiveRoot("arrearsBreakdown", arrearsBreakdown, live.values);
  const currentCxpAging = materializeLiveRoot("cxpAging", cxpAging, live.values);
  const currentAdvances = materializeLiveRoot("advances", advances, live.values);
  const currentAntonelyFinanceSource = materializeLiveRoot("antonelyFinanceSource", antonelyFinanceSource, live.values);
  let currentPayablesReconciliation: readonly (typeof payablesReconciliation)[number][] = materializeLiveRoot("payablesReconciliation", payablesReconciliation, live.values);
  const currentAntonelyCostAccounts = materializeLiveRoot("antonelyCostAccounts", antonelyCostAccounts, live.values);
  const currentAntonelyPayableCategories = materializeLiveRoot("antonelyPayableCategories", antonelyPayableCategories, live.values);
  const currentAntonelyAdvances = materializeLiveRoot("antonelyAdvances", antonelyAdvances, live.values);
  const currentAntonelyBalanceLines = materializeLiveRoot("antonelyBalanceLines", antonelyBalanceLines, live.values);
  const currentAntonelyDetailTotals = liveAntonelyDetailTotals(
    materializeLiveRoot("antonelyDetailTotals", antonelyDetailTotals, live.values),
    {
      advances: currentAntonelyAdvances,
      costAccounts: currentAntonelyCostAccounts,
      payableCategories: currentAntonelyPayableCategories,
      balanceLines: currentAntonelyBalanceLines,
    },
  );
  // antonelyAdvances/antonelyCostAccounts/antonelyPayableCategories/
  // antonelyBalanceLines (detalle) se sincronizan al subir un archivo; sus
  // resúmenes (juneReport.finance, la fila "Archivo Antonely" de la
  // conciliación de CxP) eran copias aparte que se quedaban en la semilla
  // original — ver las notas junto a cada función.
  currentJuneReport = liveJuneReportFinance(
    currentJuneReport,
    currentAntonelyDetailTotals,
    currentAntonelyBalanceLines,
    currentFinancialProjection,
    currentAntonelyCostAccounts,
  );
  currentPayablesReconciliation = livePayablesReconciliation(currentPayablesReconciliation, currentAntonelyDetailTotals.payablesTotalDop);
  const currentSafetyMetrics = materializeLiveRoot("safetyMetrics", safetyMetrics, live.values);
  const currentSafetyFindings = materializeLiveRoot("safetyFindings", safetyFindings, live.values);
  const currentPermits = materializeLiveRoot("permits", permits, live.values);
  const currentFinancingProcesses = materializeLiveRoot("financingProcesses", financingProcesses, live.values);
  const currentJuneDataQualityIssues = materializeLiveRoot("juneDataQualityIssues", juneDataQualityIssues, live.values);
  const currentReprogrammedFlowAudit = materializeLiveRoot("reprogrammedFlowAudit", reprogrammedFlowAudit, live.values);
  const currentReprogrammedFlowMonths = materializeLiveRoot("reprogrammedFlowMonths", reprogrammedFlowMonths, live.values);
  const currentReprogrammedFlowScopes = materializeLiveRoot("reprogrammedFlowScopes", reprogrammedFlowScopes, live.values);
  const currentReprogrammedFlowQualityIssues = liveReprogrammedFlowQualityIssues(
    materializeLiveRoot("reprogrammedFlowQualityIssues", reprogrammedFlowQualityIssues, live.values),
    currentProjectSnapshot.overallProgress,
  );
  const currentFiduciaryBalanceSections = materializeLiveRoot("fiduciaryBalanceSections", fiduciaryBalanceSections, live.values);
  const currentFiduciaryManagementReconciliation = liveFiduciaryManagementReconciliation(
    materializeLiveRoot("fiduciaryManagementReconciliation", fiduciaryManagementReconciliation, live.values),
    currentFiduciaryBalanceSections,
  );
  const currentFiduciaryStatementQualityIssues = materializeLiveRoot("fiduciaryStatementQualityIssues", fiduciaryStatementQualityIssues, live.values);
  const currentFiduciaryStatementSummary = liveFiduciaryStatementSummary(
    materializeLiveRoot("fiduciaryStatementSummary", fiduciaryStatementSummary, live.values),
    currentFiduciaryBalanceSections,
  );
  const currentTypeABudgetChapters = materializeLiveRoot("typeABudgetChapters", typeABudgetChapters, live.values);
  const currentTypeABudgetSummary = liveTypeABudgetSummary(
    materializeLiveRoot("typeABudgetSummary", typeABudgetSummary, live.values),
    currentTypeABudgetChapters,
  );
  const currentMonthlyDeviationLines = materializeLiveRoot("monthlyDeviationLines", monthlyDeviationLines, live.values);
  const currentJuneDeviationSummary = liveJuneDeviationSummary(
    materializeLiveRoot("juneDeviationSummary", juneDeviationSummary, live.values),
    currentMonthlyDeviationLines,
  );
  const currentProcurementQualityIssues = materializeLiveRoot("procurementQualityIssues", procurementQualityIssues, live.values);

  if (name === "get_live_data_status") {
    const visiblePoints = live.points;
    const latestEvent = live.latestEvent;
    return {
      revision: latestEvent?.id ?? 0,
      refreshedEverySeconds: 5,
      latestEvent,
      provenance: visiblePoints.map((point) => ({
        key: point.key,
        sourceName: point.sourceName,
        area: point.area,
        cutoff: point.cutoff,
        sourceCurrency: point.sourceCurrency,
        revision: point.revision,
        updatedAt: point.updatedAt,
        updatedBy: point.updatedByName,
      })),
    };
  }
  if (name === "get_control_room_status") {
    const db = getDb();
    const [actionRows, reportRows] = await Promise.all([
      db.select().from(controlActions).orderBy(desc(controlActions.updatedAt)).limit(40),
      db.select().from(reportSnapshots).orderBy(desc(reportSnapshots.createdAt)).limit(20),
    ]);
    const visibleActions = canAccessFinance
      ? actionRows
      : actionRows.filter((row) => !requiresFinanceAccessForArea(row.area));
    const visibleReports = canAccessFinance
      ? reportRows
      : reportRows.filter((row) => !row.includesFinance);
    return {
      ...buildControlRoomBaseline(
        canAccessFinance,
        currentProjectSnapshot,
        currentMonthlyPlan,
      ),
      actions: visibleActions.map((row) => ({
        title: row.title,
        area: row.area,
        severity: row.severity,
        status: row.status,
        responsible: row.assigneeName || "Pendiente",
        dueDate: row.dueDate || "Pendiente",
      })),
      reports: visibleReports.map((row) => ({
        label: row.label,
        frequency: row.frequency,
        liveRevision: row.liveRevision,
        cutoff: row.cutoff,
        createdBy: row.createdByName,
        createdAt: row.createdAt,
      })),
      rule: "El agente puede consultar y explicar. Las decisiones, aprobaciones y cambios de estado se realizan en las pantallas controladas del dashboard.",
    };
  }
  if (name === "get_project_summary") {
    return {
      project: currentProjectSnapshot.project,
      declaredCutoff: currentProjectSnapshot.declaredCutoff,
      physicalProgressExcel: currentProjectSnapshot.overallProgress,
      plannedPhysicalProgressExcel: currentProjectSnapshot.plannedProgress,
      physicalDeviationPoints: currentProjectSnapshot.deviationPoints,
      scheduleProgressMpp: currentProjectSnapshot.scheduleProgress,
      baselineFinish: currentProjectSnapshot.baselineFinish,
      forecastFinish: currentProjectSnapshot.forecastFinish,
      forecastDeviationDays: currentProjectSnapshot.deviationDays,
      buildings: currentProjectSnapshot.buildingCount,
      apartments: currentProjectSnapshot.unitCount,
      sourceLastSaved: currentProjectSnapshot.lastUpdated,
      liveRevision: live.latestEvent?.id ?? 0,
    };
  }
  if (name === "get_schedule_deviations") {
    const minimum = Number(args.minimum_days ?? 0);
    return {
      buildings: currentProjectSnapshot.buildings.filter((item) => item.deviationDays >= minimum),
      workPackages: currentProjectSnapshot.workPackages.filter((item) => item.deviationDays >= minimum),
      note: "El desvío del edificio compara su última fecha prevista con la última fecha de línea base. El porcentaje es un promedio simple de frentes.",
      cutoff: currentProjectSnapshot.declaredCutoff,
    };
  }
  if (name === "get_building_units") {
    const code = String(args.building ?? "").replace(/\D/g, "");
    const building = currentProjectSnapshot.buildings.find((item) => item.shortName === code);
    return {
      building: building ?? null,
      unitProgressMeaning: "El porcentaje de apartamento corresponde únicamente a superestructura.",
      buildingProgressMeaning: "Promedio simple de 32 frentes del MPP; no es avance físico ponderado.",
      cutoff: currentProjectSnapshot.declaredCutoff,
    };
  }
  if (name === "get_work_packages") {
    const onlyCritical = Boolean(args.only_critical);
    return {
      workPackages: onlyCritical
        ? currentProjectSnapshot.workPackages.filter((item) => item.critical)
        : currentProjectSnapshot.workPackages,
      cutoff: currentProjectSnapshot.declaredCutoff,
      source: "Microsoft Project",
    };
  }
  if (name === "get_financial_measurements") {
    if (!canAccessFinance) return { error: "Acceso financiero no autorizado." };
    return {
      periods: currentCubicaciones,
      totalMeasured: currentProjectSnapshot.cubicacionesMeasured,
      totalAccounting: currentProjectSnapshot.cubicacionesAccounting,
      differenceAccountingMinusMeasured: currentProjectSnapshot.cubicacionesDifference,
      sourceCurrency: "DOP",
      displayRule: `USD por defecto · 1 DOP = ${DOP_TO_USD} USD · corte ${FX_RATE_CUTOFF}`,
    };
  }
  if (name === "get_commercial_status") {
    if (!canAccessFinance) return { error: "Acceso financiero y comercial no autorizado." };
    return {
      sales: currentJuneReport.sales,
      contracts: currentJuneReport.contracts,
      collections: currentJuneReport.collections,
      models: currentSalesModels,
      locations: currentSalesLocations,
      arrears: currentArrearsBreakdown,
      source: "Informe consolidado de junio y Excel financiero",
      cutoff: "30/06/2026; morosidad actualizada al 06/07/2026",
    };
  }
  if (name === "get_financial_status") {
    if (!canAccessFinance) return { error: "Acceso financiero no autorizado." };
    return {
      finance: currentJuneReport.finance,
      cxpAging: currentCxpAging,
      advances: currentAdvances,
      antonelyDepartmentalSource: currentAntonelyFinanceSource,
      payablesReconciliation: currentPayablesReconciliation,
      costAccounts: currentAntonelyCostAccounts,
      payablesCategories: currentAntonelyPayableCategories,
      advancesDetail: currentAntonelyAdvances,
      balanceLines: currentAntonelyBalanceLines,
      detailCounts: currentAntonelyDetailTotals,
      fiduciaryOfficialStatements: {
        summary: currentFiduciaryStatementSummary,
        balanceSections: currentFiduciaryBalanceSections,
        managementReconciliation: currentFiduciaryManagementReconciliation,
        qualityIssues: currentFiduciaryStatementQualityIssues,
        rule: "Fiduciaria Universal prevalece para balance y resultados oficiales. El Excel conserva su función de control interno.",
      },
      phaseOneWorkFlow: {
        audit: currentReprogrammedFlowAudit,
        months: currentReprogrammedFlowMonths,
        scopes: currentReprogrammedFlowScopes,
        qualityIssues: currentReprogrammedFlowQualityIssues,
        physicalProgressEffect: `Ninguno. El archivo no contiene mediciones físicas; el avance físico validado sigue en ${numberForAgent(currentProjectSnapshot.overallProgress)}%.`,
      },
      typeABudget: {
        summary: currentTypeABudgetSummary,
        chapters: currentTypeABudgetChapters,
      },
      juneDeviation: {
        summary: currentJuneDeviationSummary,
        lines: currentMonthlyDeviationLines,
      },
      procurementQualityIssues: currentProcurementQualityIssues,
      sourceCurrency: "DOP, salvo importes comerciales identificados expresamente como USD",
      displayRule: `USD por defecto · 1 DOP = ${DOP_TO_USD} USD · corte ${FX_RATE_CUTOFF}`,
      source: "INFORME_JUN_2026_ARAYA_v1_1.xlsx, Datos para Informe Jun-26.xlsx, ARAYA_-Flujo I reprogramado.xlsx, comparativo de presupuesto Tipo A y estados oficiales de Fiduciaria Universal",
      cutoff: currentJuneReport.cutoff,
    };
  }
  if (name === "get_safety_permits") {
    return {
      safetyMetrics: currentSafetyMetrics,
      safetyFindings: currentSafetyFindings,
      permits: currentPermits,
      financingProcesses: canAccessFinance ? currentFinancingProcesses : [],
      source: "Informe consolidado e Informe Obra Araya Junio 2026",
      cutoff: currentJuneReport.cutoff,
    };
  }
  if (name === "get_uploaded_files") {
    const rows = await getDb()
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.deletedAt, ""))
      .orderBy(desc(uploadedFiles.createdAt))
      .limit(20);
    const visibleRows = canAccessFinance ? rows : rows.filter((row) =>
      !requiresFinanceAccessForDocument(row.area, row.documentType));
    return {
      files: visibleRows.map((row) => ({
        file: row.originalName,
        area: areaLabels[row.area as keyof typeof areaLabels] ?? row.area,
        uploader: row.uploaderName,
        version: row.version,
        status: uploadStatusLabels[row.status] ?? row.status,
        sourceCurrency: row.sourceCurrency,
        cutoff: row.declaredCutoff || "No declarado",
        createdAt: row.createdAt,
        classificationReason: row.classificationReason,
        processingStage: row.processingStage,
        processingProgress: row.processingProgress,
        processingSummary: row.processingSummary,
        requiresReview: row.requiresReview,
        project: row.projectId,
        documentType: row.documentType,
        detectedPeriod: row.detectedPeriod || "No identificado",
        extractionMode: row.extractionMode,
        extractionConfidence: row.extractionConfidence,
        extractionSummary: row.extractionSummary,
        discrepancyCount: row.discrepancyCount,
        reviewStatus: row.reviewStatus,
        reviewedBy: row.reviewedByName || "Pendiente",
        publicationRevision: row.publicationRevision,
      })),
      rule: "Cada formato admitido usa lector directo, conversión o Agente de Ingesta. Todo hecho con evidencia, confianza positiva, contrato válido y permiso de área se publica automáticamente; un concepto nuevo crea una sección visual. Si una comprobación objetiva falla, el original conserva el diagnóstico sin forzar una cifra.",
    };
  }
  return {
    sources: canAccessFinance
      ? currentProjectSnapshot.dataSources
      : redactedAgentList("dataSources", currentProjectSnapshot.dataSources),
    juneIssues: canAccessFinance
      ? currentJuneDataQualityIssues
      : redactedAgentList("juneDataQualityIssues", currentJuneDataQualityIssues),
    fiduciaryIssues: canAccessFinance ? currentFiduciaryStatementQualityIssues : [],
    interpretation: {
      physicalProgress: `Excel: ${numberForAgent(currentProjectSnapshot.overallProgress)}% ejecutado frente a ${numberForAgent(currentProjectSnapshot.plannedProgress)}% planificado.`,
      scheduleProgress: `MPP: ${numberForAgent(currentProjectSnapshot.scheduleProgress)}%. Es un indicador distinto y no se sustituye por el del Excel.`,
      buildings: "Índice de frentes = promedio simple de 32 frentes por edificio.",
      units: "El avance disponible por apartamento corresponde sólo a superestructura.",
    },
    governance: canAccessFinance ? {
      summary: dataGovernanceSummary,
      matrix: liveDataAuthorityMatrix(
        dataAuthorityMatrix,
        currentProjectSnapshot.overallProgress,
        currentProjectSnapshot.plannedProgress,
        currentProjectSnapshot.scheduleProgress,
        currentJuneReport.finance.cxpDop,
      ),
    } : undefined,
  };
}

async function fallbackAnswer(question: string, currency: CurrencyCode, canAccessFinance: boolean) {
  const live = await getLiveDataSnapshot(canAccessFinance);
  const currentProjectSnapshot = materializeSpatialLiveData(live.values).projectSnapshot;
  const currentAntonelyBalanceLines = materializeLiveRoot("antonelyBalanceLines", antonelyBalanceLines, live.values);
  const currentAntonelyCostAccounts = materializeLiveRoot("antonelyCostAccounts", antonelyCostAccounts, live.values);
  const currentAntonelyDetailTotals = liveAntonelyDetailTotals(
    materializeLiveRoot("antonelyDetailTotals", antonelyDetailTotals, live.values),
    {
      advances: materializeLiveRoot("antonelyAdvances", antonelyAdvances, live.values),
      costAccounts: currentAntonelyCostAccounts,
      payableCategories: materializeLiveRoot("antonelyPayableCategories", antonelyPayableCategories, live.values),
      balanceLines: currentAntonelyBalanceLines,
    },
  );
  const currentJuneReport = liveJuneReportFinance(
    materializeLiveRoot("juneReport", juneReport, live.values),
    currentAntonelyDetailTotals,
    currentAntonelyBalanceLines,
    materializeLiveRoot("financialProjection", financialProjection, live.values),
    currentAntonelyCostAccounts,
  );
  const currentJuneDataQualityIssues = materializeLiveRoot("juneDataQualityIssues", juneDataQualityIssues, live.values);
  const currentSafetyMetrics = materializeLiveRoot("safetyMetrics", safetyMetrics, live.values);
  const currentReprogrammedFlowAudit = materializeLiveRoot("reprogrammedFlowAudit", reprogrammedFlowAudit, live.values);
  const currentFiduciaryStatementSummary = liveFiduciaryStatementSummary(
    materializeLiveRoot("fiduciaryStatementSummary", fiduciaryStatementSummary, live.values),
    materializeLiveRoot("fiduciaryBalanceSections", fiduciaryBalanceSections, live.values),
  );
  const visibleDataSources = canAccessFinance
    ? currentProjectSnapshot.dataSources
    : redactedAgentList("dataSources", currentProjectSnapshot.dataSources);
  const visibleJuneIssues = canAccessFinance
    ? currentJuneDataQualityIssues
    : redactedAgentList("juneDataQualityIssues", currentJuneDataQualityIssues);
  const normalized = question.toLowerCase();
  const source = `\n\nFuentes: centro de datos ARAYA (${visibleDataSources.length} archivos autorizados) · corte principal ${currentProjectSnapshot.declaredCutoff} · versión viva ${live.latestEvent?.id ?? "base"}.`;
  const dopMillions = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const usdValue = (value: number) => formatMoney(value, "USD", currency);

  if (normalized.includes("archivo") || normalized.includes("adjunt") || normalized.includes("subir") || normalized.includes("cargar")) {
    return `Puedes adjuntar el archivo en este chat o usar “+ Cargar archivo” desde cualquier pestaña. El sistema conserva el original, detecta duplicados e identifica proyecto, área, tipo, periodo y moneda. Después el Agente de Ingesta consulta el esquema y las plantillas aprendidas, contrasta cifras y entidades y publica automáticamente cada hecho con evidencia y contrato válido; un concepto nuevo crea su propia sección visual. Si una comprobación objetiva no cuadra, conserva el original y deja el diagnóstico exacto, sin inventar. La revisión viva se sincroniza en todas las pantallas en menos de cinco segundos.${source}`;
  }

  if (normalized.includes("calidad") || normalized.includes("fuente") || normalized.includes("inconsisten")) {
    return `Hay ${visibleJuneIssues.length} conciliaciones autorizadas. La procedencia de cada dato vivo conserva archivo, área, corte, moneda, responsable y versión. Todas las diferencias permanecen visibles; ninguna cifra se corrige silenciosamente.${source}`;
  }
  if (normalized.includes("venta") || normalized.includes("reserva") || normalized.includes("moros") || normalized.includes("cobran")) {
    const sales = currentJuneReport.sales;
    const collections = currentJuneReport.collections;
    return `Hay ${sales.reservations} reservas históricas, ${sales.active} activas y ${sales.withdrawn} desistidas. Fase I tiene ${sales.phaseOneActive} activas y Fase II, ${sales.phaseTwoActive}. Al ${collections.cutoff}, ${collections.contracts} contratos se distribuyen en ${collections.current} al día, ${collections.installmentsPending} con cuotas pendientes y ${collections.overdue} vencidos por ${usdValue(collections.overdueUsd)}.${source}`;
  }
  if (normalized.includes("seguridad") || normalized.includes("accidente") || normalized.includes("permiso") || normalized.includes("confotur")) {
    const safety = (label: string) => currentSafetyMetrics.find((item) => item.label === label)?.value ?? "sin dato";
    return `Seguridad reporta ${safety("Accidentes")} accidentes, ${safety("Observaciones")} observaciones, ${safety("Reuniones")} reuniones, ${safety("Inspecciones")} inspecciones y ${safety("Acciones")} acciones correctivas. Consulta Seguridad y permisos para ver cada hallazgo y gestión con su versión actual.${source}`;
  }
  if (normalized.includes("plano") || normalized.includes("implantaci") || normalized.includes("urbanismo")) {
    return `El plano general identifica ${currentProjectSnapshot.masterPlanBuildingCount} bloques TH, además de viales, estacionamientos, paisajismo y equipamientos. Hay datos operativos para ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} apartamentos; ${currentProjectSnapshot.buildingsPendingIntegration} bloques siguen visibles como implantación sin avance informado. El urbanismo registra ${numberForAgent(currentProjectSnapshot.urbanismProgress)}% ejecutado frente a ${numberForAgent(currentProjectSnapshot.urbanismPlanned)}% planificado.${source}`;
  }
  if (normalized.includes("flujo") || normalized.includes("reprogram")) {
    return `El flujo de obra reprogramado de la Fase I asciende a ${dopMillions(currentReprogrammedFlowAudit.reprogrammedTotalDop)}. El real de diciembre de 2025 a junio de 2026 es ${dopMillions(currentReprogrammedFlowAudit.actualPeriodDop)} y quedan ${dopMillions(currentReprogrammedFlowAudit.remainingForecastDop)} por ejecutar entre julio de 2026 y julio de 2027. La desviación acumulada de ${dopMillions(currentReprogrammedFlowAudit.cumulativeVarianceRedistributedDop)} se concentra por mitades en agosto y septiembre de 2026. Esta fuente solo contiene importes de Urbanismo y Edificios; no incluye mediciones físicas, por lo que el avance físico validado sigue en ${numberForAgent(currentProjectSnapshot.overallProgress)}%.${source}`;
  }
  if (normalized.includes("fideicomiso") || normalized.includes("balance") || normalized.includes("resultado")) {
    return `Los estados oficiales de Fiduciaria Universal al ${currentFiduciaryStatementSummary.cutoff} muestran activos por ${dopMillions(currentFiduciaryStatementSummary.balance.assetsDop)}, pasivos por ${dopMillions(currentFiduciaryStatementSummary.balance.liabilitiesDop)} y patrimonio neto por ${dopMillions(currentFiduciaryStatementSummary.balance.netEquityDop)}. El patrimonio se compone de aportes por ${dopMillions(currentFiduciaryStatementSummary.balance.contributedEquityDop)}, resultados acumulados por ${dopMillions(currentFiduciaryStatementSummary.balance.accumulatedEquityResultDop)} y resultado del ejercicio por ${dopMillions(currentFiduciaryStatementSummary.balance.periodResultDop)}; la suma cuadra con el total. Estas cifras se mantienen separadas del Excel de control interno por diferencias de alcance y clasificación.${source}`;
  }
  if (normalized.includes("cubic") || normalized.includes("contab") || normalized.includes("dinero") || normalized.includes("financ")) {
    const finance = currentJuneReport.finance;
    return `El presupuesto financiero de control es ${dopMillions(finance.budgetDop)}; se han ejecutado ${dopMillions(finance.executedDop)}, incluyendo ${dopMillions(finance.juneExecutedDop)} en el periodo. Las cuentas por pagar suman ${dopMillions(finance.cxpDop)} y los anticipos pendientes ${dopMillions(finance.advancesPendingDop)}. La caja proyectada cierra diciembre en ${dopMillions(finance.projectedCashDecemberDop)}. Las cantidades sin moneda declarada se tratan como DOP y la visualización predeterminada es USD.${source}`;
  }
  if (normalized.includes("paquete") || normalized.includes("infraestructura") || normalized.includes("crític") || normalized.includes("critic")) {
    const mostDelayed = [...currentProjectSnapshot.workPackages].sort((a, b) => b.deviationDays - a.deviationDays)[0];
    const critical = currentProjectSnapshot.workPackages.filter((item) => item.critical).map((item) => item.name).join(", ");
    return `El paquete con mayor desviación es ${mostDelayed.name}: ${mostDelayed.progress}% de avance y +${mostDelayed.deviationDays} días (fin ${mostDelayed.finish}, base ${mostDelayed.baselineFinish}). Los paquetes marcados como críticos son: ${critical}.${source}`;
  }
  if (normalized.includes("edificio") || normalized.includes("vivienda") || normalized.includes("apartamento")) {
    const match = normalized.match(/(?:edificio|bloque)\s*(\d+)/);
    if (match) {
      const building = currentProjectSnapshot.buildings.find((item) => item.shortName === match[1]);
      if (!building) return `No encuentro el edificio ${match[1]} en el cronograma.${source}`;
      return `El Edificio ${building.shortName} tiene un índice de frentes de ${building.progress.toLocaleString("es-ES")}% y fin previsto ${building.forecastFinish}, con ${building.deviationDays >= 0 ? `+${building.deviationDays}` : building.deviationDays} días frente a su línea base. Sus seis apartamentos muestran ${building.units[0].progress}% de superestructura. Este último dato no representa la terminación total de los apartamentos.${source}`;
    }
    return `El cronograma contiene ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} apartamentos. El detalle de apartamento disponible corresponde sólo a superestructura.${source}`;
  }
  if (normalized.includes("desv") || normalized.includes("retras") || normalized.includes("fecha")) {
    const mostDelayed = [...currentProjectSnapshot.workPackages].sort((a, b) => b.deviationDays - a.deviationDays)[0];
    return `El proyecto termina el ${currentProjectSnapshot.forecastFinish} frente al ${currentProjectSnapshot.baselineFinish} de la línea base: ${currentProjectSnapshot.deviationDays >= 0 ? "+" : ""}${currentProjectSnapshot.deviationDays} días. ${mostDelayed.name} presenta la mayor desviación de paquete, ${mostDelayed.deviationDays >= 0 ? "+" : ""}${mostDelayed.deviationDays} días. En el avance físico, la brecha es de ${numberForAgent(currentProjectSnapshot.deviationPoints)} puntos: ${numberForAgent(currentProjectSnapshot.overallProgress)}% real frente a ${numberForAgent(currentProjectSnapshot.plannedProgress)}% planificado.${source}`;
  }
  return `Resumen para Dirección: avance físico ${numberForAgent(currentProjectSnapshot.overallProgress)}% frente a ${numberForAgent(currentProjectSnapshot.plannedProgress)}% planificado (${numberForAgent(currentProjectSnapshot.deviationPoints)} puntos). El cronograma registra ${numberForAgent(currentProjectSnapshot.scheduleProgress)}%. La previsión final es ${currentProjectSnapshot.forecastFinish}, con ${currentProjectSnapshot.deviationDays >= 0 ? "+" : ""}${currentProjectSnapshot.deviationDays} días frente a la línea base. El alcance es de ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} apartamentos.${source}`;
}

function canAnswerWithoutAi(question: string) {
  return /archivo|adjunt|subir|cargar|calidad|fuente|inconsisten|venta|reserva|moros|cobran|seguridad|accidente|permiso|confotur|plano|implantaci|urbanismo|flujo|reprogram|fideicomiso|balance|resultado|cubic|contab|dinero|financ|paquete|infraestructura|cr[ií]tic|edificio|vivienda|apartamento|desv|retras|fecha|^\s*(resumen|estado|avance)/i.test(question);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const payload = (await request.json()) as { question?: string; currency?: string; advanced?: boolean };
  const question = payload.question?.trim() ?? "";
  const currency: CurrencyCode = payload.currency === "DOP" ? "DOP" : "USD";
  if (!question) return Response.json({ error: "Escribe una pregunta." }, { status: 400 });
  const asksForFinance = /finanz|fideicomiso|presupuesto|costo|coste|caja|flujo|reprogram|balance|resultado|cuentas por pagar|cxp|anticipo|cr[eé]dito|cubicaci[oó]n|comercial|ventas?|reservas?|cobranza|morosidad|desistimiento|clientes?/i.test(question);
  if (asksForFinance && !auth.user.financeAccess) {
    return Response.json({
      answer: "La información financiera está restringida para tu usuario. Un administrador puede concederte acceso desde la pestaña Usuarios y accesos.",
      mode: "access-control",
      promptVersion: AGENT_PROMPT_VERSION,
    });
  }

  const advanced = payload.advanced === true && auth.user.role === "admin";
  if (!advanced && canAnswerWithoutAi(question)) {
    await recordAssistantAiRun({
      userEmail: auth.user.email,
      userName: auth.user.displayName,
      mode: "deterministic",
      status: "completed",
      model: "deterministic",
      turns: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      estimatedCostUsdMicros: 0,
    });
    return Response.json({
      answer: await fallbackAnswer(question, currency, auth.user.financeAccess),
      mode: "source-data-engine",
      promptVersion: AGENT_PROMPT_VERSION,
      estimatedCostUsdMicros: 0,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const budget = await getAiUsageSnapshot();
  if (!apiKey || budget.blocked) {
    await recordAssistantAiRun({
      userEmail: auth.user.email,
      userName: auth.user.displayName,
      mode: "deterministic",
      status: budget.blocked ? "budget_blocked" : "completed",
      model: "deterministic",
      turns: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      estimatedCostUsdMicros: 0,
    });
    return Response.json({
      answer: await fallbackAnswer(question, currency, auth.user.financeAccess),
      mode: "source-data-engine",
      promptVersion: AGENT_PROMPT_VERSION,
      budgetBlocked: budget.blocked,
      estimatedCostUsdMicros: 0,
    });
  }

  const model = advanced
    ? process.env.OPENAI_ADVANCED_MODEL || ASSISTANT_ADVANCED_MODEL
    : process.env.OPENAI_ASSISTANT_MODEL || ASSISTANT_PRIMARY_MODEL;
  const maxTurns = advanced ? 3 : 2;
  const maxOutputTokens = advanced ? 2_500 : 1_400;
  let totalUsage = emptyAiTokenUsage();
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  let response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: AGENT_SYSTEM_PROMPT,
      input: `${question}\n\nMoneda de salida solicitada: ${currency}.`,
      tools,
      tool_choice: "auto",
      text: { verbosity: "low" },
      max_output_tokens: maxOutputTokens,
      service_tier: "default",
      prompt_cache_key: `${AGENT_PROMPT_VERSION}:${advanced ? "advanced" : "normal"}`,
      safety_identifier: "araya-dashboard-user",
    }),
  });

  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (!response.ok) {
      return Response.json({ error: "El agente no está disponible en este momento." }, { status: 502 });
    }
    const data = (await response.json()) as {
      id: string;
      output?: ResponsesApiOutput;
      usage?: unknown;
    };
    totalUsage = addAiTokenUsage(totalUsage, readOpenAiTokenUsage(data));
    const output = data.output ?? [];
    const calls = output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      const estimatedCostUsdMicros = estimateOpenAiCostUsdMicros(model, totalUsage);
      await recordAssistantAiRun({
        userEmail: auth.user.email,
        userName: auth.user.displayName,
        mode: advanced ? "advanced" : "normal",
        status: "completed",
        model,
        turns: turn + 1,
        ...totalUsage,
        estimatedCostUsdMicros,
      });
      return Response.json({
        answer: extractOutputText(output) || "No tengo ese dato registrado.",
        mode: advanced ? "openai-terra" : "openai-luna",
        model,
        usage: totalUsage,
        estimatedCostUsdMicros,
        promptVersion: AGENT_PROMPT_VERSION,
      });
    }
    const outputs = await Promise.all(calls.map(async (call) => ({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(await executeTool(call.name as ToolName, JSON.parse(call.arguments || "{}"), auth.user.financeAccess)),
    })));
    if (turn + 1 >= maxTurns) break;
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        previous_response_id: data.id,
        instructions: AGENT_SYSTEM_PROMPT,
        input: outputs,
        tools,
        text: { verbosity: "low" },
        max_output_tokens: maxOutputTokens,
        service_tier: "default",
        prompt_cache_key: `${AGENT_PROMPT_VERSION}:${advanced ? "advanced" : "normal"}`,
        safety_identifier: "araya-dashboard-user",
      }),
    });
  }

  await recordAssistantAiRun({
    userEmail: auth.user.email,
    userName: auth.user.displayName,
    mode: advanced ? "advanced" : "normal",
    status: "error",
    model,
    turns: maxTurns,
    ...totalUsage,
    estimatedCostUsdMicros: estimateOpenAiCostUsdMicros(model, totalUsage),
    error: "Límite de iteraciones alcanzado",
  });
  return Response.json({ error: "La consulta necesita una revisión manual." }, { status: 422 });
}
