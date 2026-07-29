import { desc } from "drizzle-orm";
import { cubicaciones, projectSnapshot } from "../../demo-data";
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
import { getDb } from "../../../db";
import { liveDataEvents, liveDataPoints, uploadedFiles } from "../../../db/schema";
import { areaLabels, uploadStatusLabels } from "../../../lib/file-routing";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../../../lib/agent-prompt";
import { CurrencyCode, DOP_TO_USD, FX_RATE_CUTOFF, formatMoney, formatMoneyMillions } from "../../../lib/currency";
import { LiveDataMap, materializeLiveRoot } from "../../../lib/live-data";

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
];

function numberForAgent(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

async function getLiveDataSnapshot() {
  try {
    const db = getDb();
    const [rows, events] = await Promise.all([
      db.select().from(liveDataPoints),
      db.select().from(liveDataEvents).orderBy(desc(liveDataEvents.id)).limit(1),
    ]);
    const values: LiveDataMap = {};
    rows.forEach((row) => {
      try {
        values[row.key] = JSON.parse(row.valueJson);
      } catch {
        // Keep a malformed isolated value from affecting the remaining live data.
      }
    });
    return { values, points: rows, latestEvent: events[0] ?? null };
  } catch {
    return { values: {} as LiveDataMap, points: [], latestEvent: null };
  }
}

async function executeTool(name: ToolName, args: Record<string, unknown>) {
  const live = await getLiveDataSnapshot();
  const currentProjectSnapshot = materializeLiveRoot("projectSnapshot", projectSnapshot, live.values);
  const currentCubicaciones = materializeLiveRoot("cubicaciones", cubicaciones, live.values);
  const currentJuneReport = materializeLiveRoot("juneReport", juneReport, live.values);
  const currentSalesModels = materializeLiveRoot("salesModels", salesModels, live.values);
  const currentSalesLocations = materializeLiveRoot("salesLocations", salesLocations, live.values);
  const currentArrearsBreakdown = materializeLiveRoot("arrearsBreakdown", arrearsBreakdown, live.values);
  const currentCxpAging = materializeLiveRoot("cxpAging", cxpAging, live.values);
  const currentAdvances = materializeLiveRoot("advances", advances, live.values);
  const currentAntonelyFinanceSource = materializeLiveRoot("antonelyFinanceSource", antonelyFinanceSource, live.values);
  const currentPayablesReconciliation = materializeLiveRoot("payablesReconciliation", payablesReconciliation, live.values);
  const currentAntonelyCostAccounts = materializeLiveRoot("antonelyCostAccounts", antonelyCostAccounts, live.values);
  const currentAntonelyPayableCategories = materializeLiveRoot("antonelyPayableCategories", antonelyPayableCategories, live.values);
  const currentAntonelyAdvances = materializeLiveRoot("antonelyAdvances", antonelyAdvances, live.values);
  const currentAntonelyBalanceLines = materializeLiveRoot("antonelyBalanceLines", antonelyBalanceLines, live.values);
  const currentAntonelyDetailTotals = materializeLiveRoot("antonelyDetailTotals", antonelyDetailTotals, live.values);
  const currentSafetyMetrics = materializeLiveRoot("safetyMetrics", safetyMetrics, live.values);
  const currentSafetyFindings = materializeLiveRoot("safetyFindings", safetyFindings, live.values);
  const currentPermits = materializeLiveRoot("permits", permits, live.values);
  const currentFinancingProcesses = materializeLiveRoot("financingProcesses", financingProcesses, live.values);
  const currentJuneDataQualityIssues = materializeLiveRoot("juneDataQualityIssues", juneDataQualityIssues, live.values);

  if (name === "get_live_data_status") {
    return {
      revision: live.latestEvent?.id ?? 0,
      refreshedEverySeconds: 5,
      latestEvent: live.latestEvent,
      provenance: live.points.map((point) => ({
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
      sourceCurrency: "DOP, salvo importes comerciales identificados expresamente como USD",
      displayRule: `USD por defecto · 1 DOP = ${DOP_TO_USD} USD · corte ${FX_RATE_CUTOFF}`,
      source: "INFORME_JUN_2026_ARAYA_v1_1.xlsx y Datos para Informe Jun-26.xlsx",
      cutoff: currentJuneReport.cutoff,
    };
  }
  if (name === "get_safety_permits") {
    return {
      safetyMetrics: currentSafetyMetrics,
      safetyFindings: currentSafetyFindings,
      permits: currentPermits,
      financingProcesses: currentFinancingProcesses,
      source: "Informe consolidado e Informe Obra Araya Junio 2026",
      cutoff: currentJuneReport.cutoff,
    };
  }
  if (name === "get_uploaded_files") {
    const rows = await getDb().select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt)).limit(20);
    return {
      files: rows.map((row) => ({
        file: row.originalName,
        area: areaLabels[row.area as keyof typeof areaLabels] ?? row.area,
        uploader: row.uploaderName,
        version: row.version,
        status: uploadStatusLabels[row.status] ?? row.status,
        sourceCurrency: row.sourceCurrency,
        cutoff: row.declaredCutoff || "No declarado",
        createdAt: row.createdAt,
        classificationReason: row.classificationReason,
      })),
      rule: "El archivo original aparece inmediatamente. Sus datos normalizados publican una nueva versión que actualiza todas las pantallas en menos de cinco segundos; las contradicciones quedan observadas.",
    };
  }
  return {
    sources: currentProjectSnapshot.dataSources,
    juneIssues: currentJuneDataQualityIssues,
    interpretation: {
      physicalProgress: "Excel: 18,23% ejecutado frente a 21,24% planificado.",
      scheduleProgress: "MPP: 17%. Es un indicador distinto y no se sustituye por el del Excel.",
      buildings: "Índice de frentes = promedio simple de 32 frentes por edificio.",
      units: "El avance disponible por apartamento corresponde sólo a superestructura.",
    },
  };
}

async function fallbackAnswer(question: string, currency: CurrencyCode) {
  const live = await getLiveDataSnapshot();
  const currentProjectSnapshot = materializeLiveRoot("projectSnapshot", projectSnapshot, live.values);
  const currentJuneReport = materializeLiveRoot("juneReport", juneReport, live.values);
  const currentJuneDataQualityIssues = materializeLiveRoot("juneDataQualityIssues", juneDataQualityIssues, live.values);
  const currentSafetyMetrics = materializeLiveRoot("safetyMetrics", safetyMetrics, live.values);
  const normalized = question.toLowerCase();
  const source = `\n\nFuentes: centro de datos ARAYA (${currentProjectSnapshot.dataSources.length} archivos integrados) · corte principal ${currentProjectSnapshot.declaredCutoff} · versión viva ${live.latestEvent?.id ?? "base"}.`;
  const dopMillions = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const usdValue = (value: number) => formatMoney(value, "USD", currency);

  if (normalized.includes("archivo") || normalized.includes("adjunt") || normalized.includes("subir") || normalized.includes("cargar")) {
    return `Puedes adjuntar el archivo en este chat o usar “+ Cargar archivo” desde cualquier pestaña. El sistema sugiere el área, conserva el original y registra usuario y versión. Cuando sus datos quedan normalizados, publica una versión viva que actualiza gráficas, cifras, porcentajes, cronograma y avance en menos de cinco segundos; cualquier contradicción queda observada y no se sustituye silenciosamente.${source}`;
  }

  if (normalized.includes("calidad") || normalized.includes("fuente") || normalized.includes("inconsisten")) {
    return `Hay ${currentJuneDataQualityIssues.length} conciliaciones principales. La procedencia de cada dato vivo conserva archivo, área, corte, moneda, responsable y versión. Todas las diferencias permanecen visibles; ninguna cifra se corrige silenciosamente.${source}`;
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
    return `El plano general identifica ${currentProjectSnapshot.masterPlanBuildingCount} bloques TH, además de viales, estacionamientos, paisajismo y equipamientos. Hay datos operativos para ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} viviendas; ${currentProjectSnapshot.buildingsPendingIntegration} bloques siguen visibles como implantación sin avance informado. El urbanismo registra ${numberForAgent(currentProjectSnapshot.urbanismProgress)}% ejecutado frente a ${numberForAgent(currentProjectSnapshot.urbanismPlanned)}% planificado.${source}`;
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
      return `El Edificio ${building.shortName} tiene un índice de frentes de ${building.progress.toLocaleString("es-ES")}% y fin previsto ${building.forecastFinish}, con ${building.deviationDays >= 0 ? `+${building.deviationDays}` : building.deviationDays} días frente a su línea base. Sus seis apartamentos muestran ${building.units[0].progress}% de superestructura. Este último dato no representa la terminación total de las viviendas.${source}`;
    }
    return `El cronograma contiene ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} apartamentos. El detalle de apartamento disponible corresponde sólo a superestructura.${source}`;
  }
  if (normalized.includes("desv") || normalized.includes("retras") || normalized.includes("fecha")) {
    const mostDelayed = [...currentProjectSnapshot.workPackages].sort((a, b) => b.deviationDays - a.deviationDays)[0];
    return `El proyecto termina el ${currentProjectSnapshot.forecastFinish} frente al ${currentProjectSnapshot.baselineFinish} de la línea base: ${currentProjectSnapshot.deviationDays >= 0 ? "+" : ""}${currentProjectSnapshot.deviationDays} días. ${mostDelayed.name} presenta la mayor desviación de paquete, ${mostDelayed.deviationDays >= 0 ? "+" : ""}${mostDelayed.deviationDays} días. En el avance físico, la brecha es de ${numberForAgent(currentProjectSnapshot.deviationPoints)} puntos: ${numberForAgent(currentProjectSnapshot.overallProgress)}% real frente a ${numberForAgent(currentProjectSnapshot.plannedProgress)}% planificado.${source}`;
  }
  return `Resumen para Dirección: avance físico ${numberForAgent(currentProjectSnapshot.overallProgress)}% frente a ${numberForAgent(currentProjectSnapshot.plannedProgress)}% planificado (${numberForAgent(currentProjectSnapshot.deviationPoints)} puntos). El cronograma registra ${numberForAgent(currentProjectSnapshot.scheduleProgress)}%. La previsión final es ${currentProjectSnapshot.forecastFinish}, con ${currentProjectSnapshot.deviationDays >= 0 ? "+" : ""}${currentProjectSnapshot.deviationDays} días frente a la línea base. El alcance es de ${currentProjectSnapshot.buildingCount} edificios y ${currentProjectSnapshot.unitCount} apartamentos.${source}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { question?: string; currency?: string };
  const question = payload.question?.trim() ?? "";
  const currency: CurrencyCode = payload.currency === "DOP" ? "DOP" : "USD";
  if (!question) return Response.json({ error: "Escribe una pregunta." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      answer: await fallbackAnswer(question, currency),
      mode: "source-data-engine",
      promptVersion: AGENT_PROMPT_VERSION,
    });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  let response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
      reasoning: { effort: "low" },
      instructions: AGENT_SYSTEM_PROMPT,
      input: `${question}\n\nMoneda de salida solicitada: ${currency}.`,
      tools,
      tool_choice: "auto",
      text: { verbosity: "low" },
      safety_identifier: "araya-dashboard-user",
    }),
  });

  for (let turn = 0; turn < 4; turn += 1) {
    if (!response.ok) {
      return Response.json({ error: "El agente no está disponible en este momento." }, { status: 502 });
    }
    const data = (await response.json()) as {
      id: string;
      output_text?: string;
      output?: Array<{ type: string; name?: ToolName; arguments?: string; call_id?: string }>;
    };
    const calls = (data.output ?? []).filter((item) => item.type === "function_call");
    if (!calls.length) {
      return Response.json({
        answer: data.output_text || "No tengo ese dato registrado.",
        mode: "openai-tools",
        promptVersion: AGENT_PROMPT_VERSION,
      });
    }
    const outputs = await Promise.all(calls.map(async (call) => ({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(await executeTool(call.name as ToolName, JSON.parse(call.arguments || "{}"))),
    })));
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        previous_response_id: data.id,
        instructions: AGENT_SYSTEM_PROMPT,
        input: outputs,
        tools,
        text: { verbosity: "low" },
      }),
    });
  }

  return Response.json({ error: "La consulta necesita una revisión manual." }, { status: 422 });
}
