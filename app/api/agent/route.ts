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
import { uploadedFiles } from "../../../db/schema";
import { areaLabels, uploadStatusLabels } from "../../../lib/file-routing";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../../../lib/agent-prompt";
import { CurrencyCode, DOP_TO_USD, FX_RATE_CUTOFF, formatMoney, formatMoneyMillions } from "../../../lib/currency";

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
  | "get_uploaded_files";

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
];

async function executeTool(name: ToolName, args: Record<string, unknown>) {
  if (name === "get_project_summary") {
    return {
      project: projectSnapshot.project,
      declaredCutoff: projectSnapshot.declaredCutoff,
      physicalProgressExcel: projectSnapshot.overallProgress,
      plannedPhysicalProgressExcel: projectSnapshot.plannedProgress,
      physicalDeviationPoints: projectSnapshot.deviationPoints,
      scheduleProgressMpp: projectSnapshot.scheduleProgress,
      baselineFinish: projectSnapshot.baselineFinish,
      forecastFinish: projectSnapshot.forecastFinish,
      forecastDeviationDays: projectSnapshot.deviationDays,
      buildings: projectSnapshot.buildingCount,
      apartments: projectSnapshot.unitCount,
      sourceLastSaved: projectSnapshot.lastUpdated,
    };
  }
  if (name === "get_schedule_deviations") {
    const minimum = Number(args.minimum_days ?? 0);
    return {
      buildings: projectSnapshot.buildings.filter((item) => item.deviationDays >= minimum),
      workPackages: projectSnapshot.workPackages.filter((item) => item.deviationDays >= minimum),
      note: "El desvío del edificio compara su última fecha prevista con la última fecha de línea base. El porcentaje es un promedio simple de frentes.",
      cutoff: projectSnapshot.declaredCutoff,
    };
  }
  if (name === "get_building_units") {
    const code = String(args.building ?? "").replace(/\D/g, "");
    const building = projectSnapshot.buildings.find((item) => item.shortName === code);
    return {
      building: building ?? null,
      unitProgressMeaning: "El porcentaje de apartamento corresponde únicamente a superestructura.",
      buildingProgressMeaning: "Promedio simple de 32 frentes del MPP; no es avance físico ponderado.",
      cutoff: projectSnapshot.declaredCutoff,
    };
  }
  if (name === "get_work_packages") {
    const onlyCritical = Boolean(args.only_critical);
    return {
      workPackages: onlyCritical
        ? projectSnapshot.workPackages.filter((item) => item.critical)
        : projectSnapshot.workPackages,
      cutoff: projectSnapshot.declaredCutoff,
      source: "Microsoft Project",
    };
  }
  if (name === "get_financial_measurements") {
    return {
      periods: cubicaciones,
      totalMeasured: projectSnapshot.cubicacionesMeasured,
      totalAccounting: projectSnapshot.cubicacionesAccounting,
      differenceAccountingMinusMeasured: projectSnapshot.cubicacionesDifference,
      sourceCurrency: "DOP",
      displayRule: `USD por defecto · 1 DOP = ${DOP_TO_USD} USD · corte ${FX_RATE_CUTOFF}`,
    };
  }
  if (name === "get_commercial_status") {
    return {
      sales: juneReport.sales,
      contracts: juneReport.contracts,
      collections: juneReport.collections,
      models: salesModels,
      locations: salesLocations,
      arrears: arrearsBreakdown,
      source: "Informe consolidado de junio y Excel financiero",
      cutoff: "30/06/2026; morosidad actualizada al 06/07/2026",
    };
  }
  if (name === "get_financial_status") {
    return {
      finance: juneReport.finance,
      cxpAging,
      advances,
      antonelyDepartmentalSource: antonelyFinanceSource,
      payablesReconciliation,
      costAccounts: antonelyCostAccounts,
      payablesCategories: antonelyPayableCategories,
      advancesDetail: antonelyAdvances,
      balanceLines: antonelyBalanceLines,
      detailCounts: antonelyDetailTotals,
      sourceCurrency: "DOP, salvo importes comerciales identificados expresamente como USD",
      displayRule: `USD por defecto · 1 DOP = ${DOP_TO_USD} USD · corte ${FX_RATE_CUTOFF}`,
      source: "INFORME_JUN_2026_ARAYA_v1_1.xlsx y Datos para Informe Jun-26.xlsx",
      cutoff: juneReport.cutoff,
    };
  }
  if (name === "get_safety_permits") {
    return {
      safetyMetrics,
      safetyFindings,
      permits,
      financingProcesses,
      source: "Informe consolidado e Informe Obra Araya Junio 2026",
      cutoff: juneReport.cutoff,
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
      rule: "Una carga nueva queda pendiente de revisión y no sustituye cifras consolidadas automáticamente.",
    };
  }
  return {
    sources: projectSnapshot.dataSources,
    juneIssues: juneDataQualityIssues,
    interpretation: {
      physicalProgress: "Excel: 18,23% ejecutado frente a 21,24% planificado.",
      scheduleProgress: "MPP: 17%. Es un indicador distinto y no se sustituye por el del Excel.",
      buildings: "Índice de frentes = promedio simple de 32 frentes por edificio.",
      units: "El avance disponible por apartamento corresponde sólo a superestructura.",
    },
  };
}

function fallbackAnswer(question: string, currency: CurrencyCode) {
  const normalized = question.toLowerCase();
  const source = `\n\nFuentes: centro de datos ARAYA (${projectSnapshot.dataSources.length} archivos integrados) · corte principal ${projectSnapshot.declaredCutoff}.`;
  const dop = (value: number) => formatMoney(value, "DOP", currency);
  const dopMillions = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const usdValue = (value: number) => formatMoney(value, "USD", currency);

  if (normalized.includes("archivo") || normalized.includes("adjunt") || normalized.includes("subir") || normalized.includes("cargar")) {
    return `Puedes adjuntar el archivo en este chat o usar “+ Cargar archivo” desde cualquier pestaña. El sistema sugerirá el área, conservará el original, registrará usuario y versión y lo dejará pendiente de revisión. Si el archivo contradice una cifra consolidada, mostrará la conciliación sin reemplazarla automáticamente.${source}`;
  }

  if (normalized.includes("calidad") || normalized.includes("fuente") || normalized.includes("inconsisten")) {
    return `Hay ${juneDataQualityIssues.length} conciliaciones principales. Las nuevas incluyen el archivo de Antonely: costes de junio ${dop(48988755.86)} frente a ${dop(48998910.52)} del consolidado y tres totales de CxP entre ${dop(18597489.63)} y ${dop(18627534.91)}. Todas permanecen visibles; ninguna cifra se corrige silenciosamente.${source}`;
  }
  if (normalized.includes("venta") || normalized.includes("reserva") || normalized.includes("moros") || normalized.includes("cobran")) {
    return `Hay 279 reservas históricas, 228 activas y 51 desistidas. Fase I tiene 136 activas y Fase II, 92. Al 06/07/2026, 172 contratos se distribuyen en 106 al día, 42 con cuotas pendientes y 24 vencidos por ${usdValue(136840.39)}. La morosidad declarada es inferior al 1%.${source}`;
  }
  if (normalized.includes("seguridad") || normalized.includes("accidente") || normalized.includes("permiso") || normalized.includes("confotur")) {
    return `Seguridad reporta 0 accidentes en las semanas 3 y 4, 22 observaciones, 21 reuniones, 12 inspecciones y 3 acciones correctivas en proceso. Falta el reporte de la semana 2. Hay 8 permisos aprobados y el CONFOTUR definitivo permanece en proceso, pendiente de consejo.${source}`;
  }
  if (normalized.includes("plano") || normalized.includes("implantaci") || normalized.includes("urbanismo")) {
    return `El plano general DWG identifica 77 bloques TH, además de viales, estacionamientos, zonas verdes y equipamientos. El dashboard tiene datos operativos integrados para 26 edificios (TH-01 a TH-18 y TH-70 a TH-77), que representan 156 viviendas; los otros 51 TH quedan visibles como implantación sin estado de avance. El urbanismo registra 18,28% ejecutado frente a 16,18% planificado.${source}`;
  }
  if (normalized.includes("cubic") || normalized.includes("contab") || normalized.includes("dinero") || normalized.includes("financ")) {
    return `El presupuesto financiero de control es ${dopMillions(3591280577.17)}; se han ejecutado ${dopMillions(712326162.73)}, incluyendo ${dopMillions(48998910.52)} en junio. Las cuentas por pagar consolidadas suman ${dopMillions(18597489.63)} y los anticipos pendientes ${dopMillions(9210448.86)}. La caja proyectada cierra diciembre en ${dopMillions(-125196511.23)}. Las cubicaciones sin etiqueta se tratan como DOP según la regla del proyecto.${source}`;
  }
  if (normalized.includes("paquete") || normalized.includes("infraestructura") || normalized.includes("crític") || normalized.includes("critic")) {
    const mostDelayed = [...projectSnapshot.workPackages].sort((a, b) => b.deviationDays - a.deviationDays)[0];
    const critical = projectSnapshot.workPackages.filter((item) => item.critical).map((item) => item.name).join(", ");
    return `El paquete con mayor desviación es ${mostDelayed.name}: ${mostDelayed.progress}% de avance y +${mostDelayed.deviationDays} días (fin ${mostDelayed.finish}, base ${mostDelayed.baselineFinish}). Los paquetes marcados como críticos son: ${critical}.${source}`;
  }
  if (normalized.includes("edificio") || normalized.includes("vivienda") || normalized.includes("apartamento")) {
    const match = normalized.match(/(?:edificio|bloque)\s*(\d+)/);
    if (match) {
      const building = projectSnapshot.buildings.find((item) => item.shortName === match[1]);
      if (!building) return `No encuentro el edificio ${match[1]} en el cronograma.${source}`;
      return `El Edificio ${building.shortName} tiene un índice de frentes de ${building.progress.toLocaleString("es-ES")}% y fin previsto ${building.forecastFinish}, con ${building.deviationDays >= 0 ? `+${building.deviationDays}` : building.deviationDays} días frente a su línea base. Sus seis apartamentos muestran ${building.units[0].progress}% de superestructura. Este último dato no representa la terminación total de las viviendas.${source}`;
    }
    return `El cronograma contiene 26 edificios y 156 apartamentos, seis por edificio: 101, 102, 201, 202, 301 y 302. El detalle de apartamento disponible corresponde sólo a superestructura.${source}`;
  }
  if (normalized.includes("desv") || normalized.includes("retras") || normalized.includes("fecha")) {
    return `El proyecto termina el 07/06/2027 frente al 31/05/2027 de la línea base: +7 días naturales. Infraestructura presenta la mayor desviación de paquete, +58 días. En el avance físico, la brecha es de -3,00 puntos: 18,23% real frente a 21,24% planificado.${source}`;
  }
  return `Resumen para Dirección: avance físico 18,23% frente a 21,24% planificado (-3,00 puntos). El MPP registra 17% de avance de cronograma. La previsión final es 07/06/2027, siete días después de la línea base. El alcance normalizado es de 26 edificios y 156 apartamentos. La prioridad es recuperar infraestructura y conciliar formalmente los porcentajes Excel/MPP.${source}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { question?: string; currency?: string };
  const question = payload.question?.trim() ?? "";
  const currency: CurrencyCode = payload.currency === "DOP" ? "DOP" : "USD";
  if (!question) return Response.json({ error: "Escribe una pregunta." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      answer: fallbackAnswer(question, currency),
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
