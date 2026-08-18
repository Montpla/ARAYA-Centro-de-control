import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../../../../db";
import { unmappedFieldCandidates } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

// Cierre de las propuestas de sección nueva ya atendidas.
//
// La lectura guarda como candidato todo bloque para el que no encuentra campo.
// Desde que esos bloques se publican solos, el candidato queda como registro de
// lo ocurrido — pero seguía marcado "pendiente" para siempre, de modo que la
// lista crecía sin que nadie pudiera distinguir lo atendido de lo que no.
//
// Esta ruta sólo cambia el estado de un candidato y anota quién y por qué. No
// publica ningún dato: lo que el candidato contenía ya entró por el camino
// normal, o se le dio su propio campo en el modelo.

const ESTADOS = ["adaptada", "descartada", "pendiente"] as const;

export async function GET() {
  const auth = await requireApiUser({ finance: true });
  if (!auth.user) return auth.response;

  const db = getDb();
  const pendientes = await db
    .select()
    .from(unmappedFieldCandidates)
    .where(eq(unmappedFieldCandidates.status, "pendiente"));

  const response = Response.json({
    pending: pendientes.map((fila) => ({
      id: fila.id,
      fileId: fila.fileId,
      label: fila.label,
      description: fila.description,
      suggestedArea: fila.suggestedArea,
      evidence: fila.evidence,
      confidence: fila.confidence,
      createdAt: fila.createdAt,
    })),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ finance: true });
  if (!auth.user) return auth.response;

  let payload: { ids?: unknown; status?: unknown; note?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La petición no contiene un JSON válido." }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((valor): valor is string => typeof valor === "string" && valor.length > 0).slice(0, 200)
    : [];
  if (!ids.length) return Response.json({ error: "Indica al menos un candidato." }, { status: 400 });

  const status = ESTADOS.find((estado) => estado === payload.status);
  if (!status) {
    return Response.json({ error: `El estado debe ser uno de: ${ESTADOS.join(", ")}.` }, { status: 400 });
  }
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 400) : "";

  const db = getDb();
  const actualizadas = await db
    .update(unmappedFieldCandidates)
    .set({
      status,
      reviewedByEmail: auth.user.email,
      reviewedByName: auth.user.displayName,
      reviewedAt: new Date().toISOString(),
      reviewNote: note,
    })
    .where(and(
      inArray(unmappedFieldCandidates.id, ids),
      eq(unmappedFieldCandidates.status, "pendiente"),
    ))
    .returning({ id: unmappedFieldCandidates.id });

  const response = Response.json({ updated: actualizadas.map((fila) => fila.id), status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
