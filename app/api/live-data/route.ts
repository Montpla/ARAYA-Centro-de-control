import { desc } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { liveDataEvents, liveDataPoints } from "../../../db/schema";
import {
  LiveDataMap,
  LiveDataUpdate,
  isLiveDataKey,
  liveValueType,
} from "../../../lib/live-data";

export const runtime = "edge";

const MAX_UPDATES = 250;
const MAX_VALUE_SIZE = 250_000;

async function authenticatedUser() {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      response: Response.json(
        { error: "Debes iniciar sesión para consultar o actualizar los datos vivos." },
        { status: 401 },
      ),
      user: null,
    };
  }
  return { response: null, user };
}

function publicEvent(row: typeof liveDataEvents.$inferSelect | undefined) {
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

export async function GET() {
  const auth = await authenticatedUser();
  if (!auth.user) return auth.response;

  try {
    const db = getDb();
    const [rows, events] = await Promise.all([
      db.select().from(liveDataPoints),
      db.select().from(liveDataEvents).orderBy(desc(liveDataEvents.id)).limit(1),
    ]);
    const values: LiveDataMap = {};
    const provenance: Record<string, {
      area: string;
      cutoff: string;
      revision: number;
      sourceCurrency: string;
      sourceFileId: string;
      sourceName: string;
      updatedAt: string;
      updatedByName: string;
    }> = {};
    rows.forEach((row) => {
      try {
        values[row.key] = JSON.parse(row.valueJson);
        provenance[row.key] = {
          area: row.area,
          cutoff: row.cutoff,
          revision: row.revision,
          sourceCurrency: row.sourceCurrency,
          sourceFileId: row.sourceFileId,
          sourceName: row.sourceName,
          updatedAt: row.updatedAt,
          updatedByName: row.updatedByName,
        };
      } catch {
        // A malformed row is isolated instead of blocking the remaining live data.
      }
    });
    const response = Response.json({
      values,
      provenance,
      revision: events[0]?.id ?? 0,
      latestEvent: publicEvent(events[0]),
      refreshedAt: new Date().toISOString(),
      refreshIntervalMs: 5_000,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return Response.json({
      values: {},
      provenance: {},
      revision: 0,
      latestEvent: null,
      refreshedAt: new Date().toISOString(),
      refreshIntervalMs: 5_000,
      demo: true,
    });
  }
}

export async function POST(request: Request) {
  const auth = await authenticatedUser();
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

  if (!Array.isArray(payload.updates) || payload.updates.length === 0) {
    return Response.json({ error: "Incluye al menos un dato para actualizar." }, { status: 400 });
  }
  if (payload.updates.length > MAX_UPDATES) {
    return Response.json({ error: `Una actualización admite como máximo ${MAX_UPDATES} datos.` }, { status: 413 });
  }

  let normalized: Array<{
    area: string;
    cutoff: string;
    key: string;
    sourceCurrency: string;
    sourceFileId: string;
    sourceName: string;
    valueJson: string;
    valueType: string;
  }>;
  try {
    normalized = payload.updates.map((update) => {
      const key = String(update?.key ?? "").trim();
      if (!isLiveDataKey(key)) throw new Error(`La clave ${key || "(vacía)"} no pertenece al modelo vivo de ARAYA.`);
      const valueJson = JSON.stringify(update.value);
      if (valueJson === undefined || valueJson.length > MAX_VALUE_SIZE) {
        throw new Error(`El valor de ${key} no es válido o supera el tamaño permitido.`);
      }
      return {
        area: String(update.area ?? payload.area ?? "direccion").slice(0, 80),
        cutoff: String(update.cutoff ?? payload.cutoff ?? "").slice(0, 40),
        key,
        sourceCurrency: update.sourceCurrency === "USD" ? "USD" : "DOP",
        sourceFileId: String(update.sourceFileId ?? payload.sourceFileId ?? "").slice(0, 80),
        sourceName: String(update.sourceName ?? payload.sourceName ?? "Actualización manual").slice(0, 255),
        valueJson,
        valueType: liveValueType(update.value),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La actualización no es válida.";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const db = getDb();
    const [event] = await db
      .insert(liveDataEvents)
      .values({
        sourceFileId: String(payload.sourceFileId ?? normalized[0].sourceFileId).slice(0, 80),
        sourceName: String(payload.sourceName ?? normalized[0].sourceName).slice(0, 255),
        area: String(payload.area ?? normalized[0].area).slice(0, 80),
        cutoff: String(payload.cutoff ?? normalized[0].cutoff).slice(0, 40),
        changeCount: normalized.length,
        message: String(payload.message ?? `${normalized.length} datos actualizados en el Centro de Control.`).slice(0, 500),
        actorEmail: auth.user.email,
        actorName: auth.user.displayName,
      })
      .returning();
    const updatedAt = new Date().toISOString();
    for (const update of normalized) {
      await db
        .insert(liveDataPoints)
        .values({
          ...update,
          revision: event.id,
          updatedByEmail: auth.user.email,
          updatedByName: auth.user.displayName,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: liveDataPoints.key,
          set: {
            valueJson: update.valueJson,
            valueType: update.valueType,
            area: update.area,
            sourceFileId: update.sourceFileId,
            sourceName: update.sourceName,
            sourceCurrency: update.sourceCurrency,
            cutoff: update.cutoff,
            revision: event.id,
            updatedByEmail: auth.user.email,
            updatedByName: auth.user.displayName,
            updatedAt,
          },
        });
    }
    return Response.json({
      event: publicEvent(event),
      message: `${normalized.length} datos actualizados. Todas las pantallas recibirán la versión ${event.id} en menos de cinco segundos.`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la fuente viva.";
    return Response.json({ error: message }, { status: 500 });
  }
}
