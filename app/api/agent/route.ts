import { projectSnapshot } from "../../demo-data";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../../../lib/agent-prompt";

type ToolName =
  | "get_project_summary"
  | "get_schedule_deviations"
  | "get_building_units"
  | "get_timeline"
  | "get_suppliers";

const tools = [
  {
    type: "function",
    name: "get_project_summary",
    description: "Devuelve el avance general, avance previsto, desviación, presupuesto e incidencias del proyecto.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_schedule_deviations",
    description: "Devuelve las desviaciones de plazo por edificio y las viviendas bloqueadas.",
    parameters: {
      type: "object",
      properties: {
        minimum_days: { type: "number", description: "Mínimo de días de desviación a incluir." },
      },
      required: ["minimum_days"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_building_units",
    description: "Consulta el avance y estado de las viviendas de un edificio.",
    parameters: {
      type: "object",
      properties: {
        building: { type: "string", description: "Código A, B, C o ZC." },
      },
      required: ["building"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_timeline",
    description: "Consulta los últimos hitos, avances, entregas e incidencias de la cronología.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", minimum: 1, maximum: 10 } },
      required: ["limit"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_suppliers",
    description: "Consulta proveedores, estado, puntuación, próxima entrega e importe.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["todos", "al_dia", "revision", "retraso"] },
      },
      required: ["status"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function executeTool(name: ToolName, args: Record<string, unknown>) {
  if (name === "get_project_summary") {
    return {
      project: projectSnapshot.project,
      overallProgress: projectSnapshot.overallProgress,
      plannedProgress: projectSnapshot.plannedProgress,
      deviationDays: projectSnapshot.deviationDays,
      budgetExecuted: projectSnapshot.budgetExecuted,
      openIncidents: projectSnapshot.openIncidents,
      criticalIncidents: projectSnapshot.criticalIncidents,
      lastUpdated: projectSnapshot.lastUpdated,
    };
  }
  if (name === "get_schedule_deviations") {
    const minimum = Number(args.minimum_days ?? 0);
    return {
      buildings: projectSnapshot.buildings.filter((item) => item.deviationDays >= minimum),
      blockedUnits: projectSnapshot.buildings
        .flatMap((item) => item.units.map((unit) => ({ building: item.shortName, ...unit })))
        .filter((unit) => unit.deviationDays >= minimum),
      lastUpdated: projectSnapshot.lastUpdated,
    };
  }
  if (name === "get_building_units") {
    const code = String(args.building ?? "").toUpperCase();
    const building = projectSnapshot.buildings.find((item) => item.shortName === code);
    return { building: building ?? null, lastUpdated: projectSnapshot.lastUpdated };
  }
  if (name === "get_timeline") {
    return {
      events: projectSnapshot.timeline.slice(0, Number(args.limit ?? 5)),
      lastUpdated: projectSnapshot.lastUpdated,
    };
  }
  const status = String(args.status ?? "todos");
  return {
    suppliers:
      status === "todos"
        ? projectSnapshot.suppliers
        : projectSnapshot.suppliers.filter((item) => item.status === status),
    lastUpdated: projectSnapshot.lastUpdated,
  };
}

function fallbackAnswer(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("proveedor") || normalized.includes("entrega")) {
    const delayed = projectSnapshot.suppliers.filter((item) => item.status !== "al_dia");
    return `Hay ${delayed.length} proveedores que requieren atención. Carpinterías Vega figura con retraso y nueva entrega prevista el 2 de agosto; Cerámicas Bahía está en revisión. Conviene confirmar hoy el impacto sobre el Edificio B.\n\nFuente: Centro de Control ARAYA · actualizado ${projectSnapshot.lastUpdated}`;
  }
  if (normalized.includes("edificio b") || normalized.includes("bloque b")) {
    const building = projectSnapshot.buildings[1];
    const blocked = building.units.filter((item) => item.status === "bloqueada");
    return `El Edificio B está al ${building.progress}% frente al ${building.planProgress}% previsto: desviación de ${building.deviationDays} días. Tiene ${blocked.length} viviendas bloqueadas. La causa visible más reciente es la reprogramación de carpintería.\n\nFuente: Centro de Control ARAYA · actualizado ${projectSnapshot.lastUpdated}`;
  }
  if (normalized.includes("desv") || normalized.includes("retras")) {
    return `La obra acumula 8 días de desviación. El mayor foco es el Edificio B, con 9 días; Zonas comunes tiene 6 días y el Edificio A, 3. Recomiendo revisar carpintería exterior y el patinillo técnico.\n\nFuente: Centro de Control ARAYA · actualizado ${projectSnapshot.lastUpdated}`;
  }
  if (normalized.includes("vivienda") || normalized.includes("unidad")) {
    const units = projectSnapshot.buildings.flatMap((item) => item.units);
    const blocked = units.filter((item) => item.status === "bloqueada").length;
    return `El proyecto tiene ${units.length} unidades registradas y ${blocked} bloqueadas en los datos actuales. Puedes pedirme el detalle por edificio: A, B, C o ZC.\n\nFuente: Centro de Control ARAYA · actualizado ${projectSnapshot.lastUpdated}`;
  }
  return `ARAYA está al 55% de avance frente al 59% previsto, con 8 días de desviación. Hay 11 incidencias abiertas, 2 críticas y un 47,2% del presupuesto ejecutado. El Edificio B concentra el mayor riesgo de plazo.\n\nFuente: Centro de Control ARAYA · actualizado ${projectSnapshot.lastUpdated}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { question?: string };
  const question = payload.question?.trim() ?? "";
  if (!question) {
    return Response.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      answer: fallbackAnswer(question),
      mode: "demo-data-engine",
      promptVersion: AGENT_PROMPT_VERSION,
    });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
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
      return Response.json(
        { error: "El agente no está disponible en este momento." },
        { status: 502 },
      );
    }
    const data = (await response.json()) as {
      id: string;
      output_text?: string;
      output?: Array<{
        type: string;
        name?: ToolName;
        arguments?: string;
        call_id?: string;
      }>;
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
      output: JSON.stringify(
        executeTool(call.name as ToolName, JSON.parse(call.arguments || "{}")),
      ),
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

  return Response.json(
    { error: "La consulta necesita una revisión manual." },
    { status: 422 },
  );
}

