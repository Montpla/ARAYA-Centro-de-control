import { cubicaciones, projectSnapshot } from "../../demo-data";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../../../lib/agent-prompt";

type ToolName =
  | "get_project_summary"
  | "get_schedule_deviations"
  | "get_building_units"
  | "get_work_packages"
  | "get_financial_measurements"
  | "get_data_quality";

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
    description: "Consulta cubicaciones y contabilidad. La moneda no está identificada en la fuente.",
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
];

function executeTool(name: ToolName, args: Record<string, unknown>) {
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
      currency: projectSnapshot.currency,
      warning: "No convertir ni denominar como USD, EUR o VES hasta identificar la moneda de la fuente.",
    };
  }
  return {
    sources: projectSnapshot.dataSources,
    interpretation: {
      physicalProgress: "Excel: 18,23% ejecutado frente a 21,24% planificado.",
      scheduleProgress: "MPP: 17%. Es un indicador distinto y no se sustituye por el del Excel.",
      buildings: "Índice de frentes = promedio simple de 32 frentes por edificio.",
      units: "El avance disponible por apartamento corresponde sólo a superestructura.",
    },
  };
}

function fallbackAnswer(question: string) {
  const normalized = question.toLowerCase();
  const source = `\n\nFuentes: Excel de gráficos + cronograma MPP + plano general DWG · corte declarado ${projectSnapshot.declaredCutoff}.`;

  if (normalized.includes("calidad") || normalized.includes("fuente") || normalized.includes("inconsisten")) {
    return `Hay cuatro observaciones de calidad: (1) el Excel se llama Fase II, pero la hoja de cubicaciones dice Fase I; (2) la moneda no está identificada; (3) el MPP no tiene fecha de estado interna, por lo que se usa el corte del nombre del archivo; y (4) el 18,23% del Excel y el 17% del MPP son indicadores distintos que deben conciliarse.${source}`;
  }
  if (normalized.includes("plano") || normalized.includes("implantaci") || normalized.includes("urbanismo")) {
    return `El plano general DWG identifica 77 bloques TH, además de viales, estacionamientos, zonas verdes y equipamientos. El dashboard tiene datos operativos integrados para 26 edificios (TH-01 a TH-18 y TH-70 a TH-77), que representan 156 viviendas; los otros 51 TH quedan visibles como implantación sin estado de avance. El urbanismo registra 18,28% ejecutado frente a 16,18% planificado.${source}`;
  }
  if (normalized.includes("cubic") || normalized.includes("contab") || normalized.includes("dinero") || normalized.includes("financ")) {
    return `Las cubicaciones acumuladas suman ${projectSnapshot.cubicacionesMeasured.toLocaleString("es-ES", { maximumFractionDigits: 2 })} y contabilidad suma ${projectSnapshot.cubicacionesAccounting.toLocaleString("es-ES", { maximumFractionDigits: 2 })}. La diferencia contabilidad menos cubicaciones es ${projectSnapshot.cubicacionesDifference.toLocaleString("es-ES", { maximumFractionDigits: 2 })}. La fuente no identifica la moneda, por lo que no debe etiquetarse ni convertirse todavía.${source}`;
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
  const payload = (await request.json()) as { question?: string };
  const question = payload.question?.trim() ?? "";
  if (!question) return Response.json({ error: "Escribe una pregunta." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      answer: fallbackAnswer(question),
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
      input: question,
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
    const outputs = calls.map((call) => ({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(executeTool(call.name as ToolName, JSON.parse(call.arguments || "{}"))),
    }));
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
