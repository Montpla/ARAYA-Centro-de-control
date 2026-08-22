import { requireApiUser } from "../../../lib/access-control";
import { conditionalJson } from "../../../lib/conditional-json";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import {
  LiveDataUpdate,
  isFinancialLiveKey,
  requiresFinanceAccessForArea,
} from "../../../lib/live-data";
import {
  normalizeLiveDataUpdates,
  publishLiveDataUpdates,
} from "../../../lib/publish-live-data";

export const runtime = "edge";

async function authenticatedUser() {
  const auth = await requireApiUser();
  return { response: auth.response, user: auth.user };
}

function publicEvent(row: Awaited<ReturnType<typeof readEffectiveLiveData>>["latestEvent"]) {
  if (!row) return null;
  return {
    revision: row.id,
    sourceFileId: row.sourceFileId,
    sourceName: row.sourceName,
    area: row.area,
    cutoff: row.cutoff,
    changeCount: row.changeCount,
    message: row.message,
    actorName: row.actorName,
    createdAt: row.createdAt,
  };
}

export async function GET(request: Request) {
  const auth = await authenticatedUser();
  if (!auth.user) return auth.response;

  try {
    const live = await readEffectiveLiveData(auth.user.financeAccess);
    const provenance = Object.fromEntries(live.points.map((point) => [point.key, {
      area: point.area,
      cutoff: point.cutoff,
      revision: point.revision,
      sourceCurrency: point.sourceCurrency,
      sourceFileId: point.sourceFileId,
      sourceName: point.sourceName,
      updatedAt: point.updatedAt,
      updatedByName: point.updatedByName,
    }]));
    // ETag condicional: el 304 sin cuerpo evita re-descargar valores y
    // procedencia completos en cada ciclo de 5s sin cambios. currentUser
    // forma parte del hash a propósito: un cambio de rol/permiso produce un
    // 200 con cuerpo nuevo y el cliente detecta el cambio como siempre.
    return conditionalJson(request, {
      values: live.values,
      provenance,
      revision: live.revision,
      latestEvent: publicEvent(live.latestEvent),
      currentUser: auth.user,
      refreshedAt: new Date().toISOString(),
      refreshIntervalMs: 5_000,
      healthy: true,
    }, { volatile: ["refreshedAt"] });
  } catch {
    const response = Response.json({
      error: "La fuente viva no está disponible temporalmente.",
      currentUser: auth.user,
      refreshedAt: new Date().toISOString(),
      refreshIntervalMs: 5_000,
      healthy: false,
    }, { status: 503 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Retry-After", "5");
    return response;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  let payload: {
    updates?: LiveDataUpdate[];
    area?: string;
    cutoff?: string;
    message?: string;
    sourceFileId?: string;
    sourceName?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La actualización no contiene un JSON válido." }, { status: 400 });
  }

  let normalized: ReturnType<typeof normalizeLiveDataUpdates>;
  try {
    normalized = normalizeLiveDataUpdates({
      updates: payload.updates ?? [],
      area: payload.area,
      cutoff: payload.cutoff,
      sourceFileId: payload.sourceFileId,
      sourceName: payload.sourceName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La actualización no es válida.";
    return Response.json({ error: message }, { status: 400 });
  }

  const hasProtectedUpdate = normalized.some((update) =>
    requiresFinanceAccessForArea(update.area) || isFinancialLiveKey(update.key));
  if (!auth.user.financeAccess && hasProtectedUpdate) {
    return Response.json(
      { error: "No tienes permiso para publicar datos financieros o comerciales." },
      { status: 403 },
    );
  }

  try {
    const event = await publishLiveDataUpdates({
      normalized,
      actor: auth.user,
      area: payload.area,
      cutoff: payload.cutoff,
      sourceFileId: payload.sourceFileId,
      sourceName: payload.sourceName,
      message: payload.message,
    });
    return Response.json({
      event: publicEvent({
        id: event.id,
        sourceFileId: event.sourceFileId,
        sourceName: event.sourceName,
        area: event.area,
        cutoff: event.cutoff,
        changeCount: event.changeCount,
        message: event.message,
        actorName: event.actorName,
        createdAt: event.createdAt,
      }),
      message: `${normalized.length} datos actualizados. Todas las pantallas recibirán la versión ${event.id} en menos de cinco segundos.`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la fuente viva.";
    return Response.json({ error: message }, { status: 500 });
  }
}
