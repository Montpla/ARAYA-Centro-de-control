import { requireApiUser } from "../../../lib/access-control";
import { publishLiveDataUpdates, normalizeLiveDataUpdates } from "../../../lib/publish-live-data";

export const runtime = "edge";

// Seguimiento de las obligaciones del préstamo con IFC: quién responde de cada
// compromiso, para cuándo y con qué prueba queda cerrado.
//
// Gemela de /api/safety-findings y por el mismo motivo —sólo puede escribir su
// propia clave, así que ampliar quién la usa no abre la puerta a nada más—,
// pero con una diferencia: el bloque IFC forma parte de la información
// financiera, así que aquí sí se exige esa autorización. Se comprueba al
// entrar para poder explicarlo, en vez de dejar que la publicación falle
// después con un mensaje genérico.

const ESTADOS = ["", "Abierto", "En proceso", "Cerrado"] as const;
const MAX_OBLIGACIONES = 120;
const MAX_TEXTO = 400;

function texto(valor: unknown, limite = MAX_TEXTO) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ finance: true });
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
  if (entrada.length > MAX_OBLIGACIONES) {
    return Response.json({ error: `No se pueden guardar más de ${MAX_OBLIGACIONES} obligaciones.` }, { status: 400 });
  }

  // Se reconstruye campo a campo: así el navegador no puede colar propiedades
  // extra ni estados fuera del catálogo.
  const tracking: Array<Record<string, string>> = [];
  for (const fila of entrada) {
    if (!fila || typeof fila !== "object") continue;
    const registro = fila as Record<string, unknown>;
    const commitment = texto(registro.commitment) || texto(registro.item);
    if (!commitment) continue;
    const propuesto = texto(registro.status, 20);
    const status = ESTADOS.find((estado) => estado === propuesto) ?? "";
    const dueDate = texto(registro.dueDate, 10);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return Response.json(
        { error: `La fecha objetivo de "${commitment.slice(0, 60)}" no tiene formato AAAA-MM-DD.` },
        { status: 400 },
      );
    }
    tracking.push({
      commitment,
      responsible: texto(registro.responsible, 80),
      status,
      dueDate,
      evidence: texto(registro.evidence),
    });
  }

  const cerradas = tracking.filter((fila) => fila.status === "Cerrado").length;
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const normalized = normalizeLiveDataUpdates({
      updates: [{ key: "ifcComplianceTracking", value: tracking }],
      area: "finanzas",
      cutoff: hoy,
      sourceName: "Seguimiento de obligaciones IFC",
    });
    const event = await publishLiveDataUpdates({
      normalized,
      actor: auth.user,
      area: "finanzas",
      cutoff: hoy,
      sourceName: "Seguimiento de obligaciones IFC",
      message: `Seguimiento de obligaciones IFC actualizado: ${cerradas} de ${tracking.length} cerradas.`,
    });
    const response = Response.json({ revision: event.id, tracking });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el seguimiento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
