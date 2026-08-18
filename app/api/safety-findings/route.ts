import { requireApiUser } from "../../../lib/access-control";
import { publishLiveDataUpdates, normalizeLiveDataUpdates } from "../../../lib/publish-live-data";

export const runtime = "edge";

// Seguimiento de hallazgos de seguridad: quién se hace cargo, para cuándo y con
// qué prueba queda cerrado.
//
// Existe como endpoint propio en vez de reutilizar /api/live-data porque aquel
// exige ser administrador, y quien cierra un hallazgo es el jefe de obra. En
// lugar de rebajar el permiso general —que abriría la puerta a escribir
// cualquier dato, incluidos los financieros—, esta ruta acepta a cualquier
// persona autorizada pero sólo puede escribir una clave: el seguimiento. Nada
// de lo que llegue aquí puede tocar avances, finanzas ni ventas.

const ESTADOS = ["Abierto", "En proceso", "Cerrado"] as const;
const MAX_HALLAZGOS = 60;
const MAX_TEXTO = 300;

function texto(valor: unknown, limite = MAX_TEXTO) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: { tracking?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "El seguimiento no contiene un JSON válido." }, { status: 400 });
  }

  const entrada = Array.isArray(payload.tracking) ? payload.tracking : null;
  if (!entrada) {
    return Response.json({ error: "Falta la lista de seguimiento." }, { status: 400 });
  }
  if (entrada.length > MAX_HALLAZGOS) {
    return Response.json({ error: `No se pueden guardar más de ${MAX_HALLAZGOS} hallazgos.` }, { status: 400 });
  }

  // Se reconstruye campo a campo en vez de guardar lo que llegue: así el
  // navegador no puede colar propiedades extra ni estados fuera del catálogo.
  const tracking: Array<Record<string, string>> = [];
  for (const fila of entrada) {
    if (!fila || typeof fila !== "object") continue;
    const registro = fila as Record<string, unknown>;
    const finding = texto(registro.finding);
    if (!finding) continue;
    const status = ESTADOS.find((estado) => estado === texto(registro.status)) ?? "Abierto";
    const dueDate = texto(registro.dueDate, 10);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return Response.json(
        { error: `La fecha objetivo de "${finding}" no tiene formato AAAA-MM-DD.` },
        { status: 400 },
      );
    }
    tracking.push({
      finding,
      responsible: texto(registro.responsible, 80),
      status,
      dueDate,
      evidence: texto(registro.evidence),
    });
  }

  const cerrados = tracking.filter((fila) => fila.status === "Cerrado").length;
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const normalized = normalizeLiveDataUpdates({
      updates: [{ key: "safetyFindingTracking", value: tracking }],
      area: "obra_seguridad",
      cutoff: hoy,
      // La procedencia distingue lo que escribe una persona de lo que se lee de
      // un archivo: aquí no hay original al que volver si alguien lo discute.
      sourceName: "Seguimiento de hallazgos",
    });
    const event = await publishLiveDataUpdates({
      normalized,
      actor: auth.user,
      area: "obra_seguridad",
      cutoff: hoy,
      sourceName: "Seguimiento de hallazgos",
      message: `Seguimiento de hallazgos actualizado: ${cerrados} de ${tracking.length} cerrados.`,
    });
    const response = Response.json({ revision: event.id, tracking });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el seguimiento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
