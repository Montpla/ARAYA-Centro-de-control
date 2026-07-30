import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  fileActivity,
  liveDataEvents,
  liveDataHistory,
  liveDataPoints,
  uploadedFiles,
} from "../db/schema";
import {
  LiveDataUpdate,
  isLiveDataKey,
  liveValueType,
} from "./live-data";

const MAX_UPDATES = 250;
const MAX_VALUE_SIZE = 250_000;

export type LiveDataActor = {
  email: string;
  displayName: string;
};

export type NormalizedLiveDataUpdate = {
  area: string;
  cutoff: string;
  key: string;
  sourceCurrency: "DOP" | "USD";
  sourceFileId: string;
  sourceName: string;
  valueJson: string;
  valueType: string;
};

export function normalizeLiveDataUpdates(input: {
  updates: LiveDataUpdate[];
  area?: string;
  cutoff?: string;
  sourceFileId?: string;
  sourceName?: string;
}) {
  if (!Array.isArray(input.updates) || input.updates.length === 0) {
    throw new Error("Incluye al menos un dato para actualizar.");
  }
  if (input.updates.length > MAX_UPDATES) {
    throw new Error(`Una actualización admite como máximo ${MAX_UPDATES} datos.`);
  }
  return input.updates.map((update) => {
    const key = String(update?.key ?? "").trim();
    if (!isLiveDataKey(key)) throw new Error(`La clave ${key || "(vacía)"} no pertenece al modelo vivo de ARAYA.`);
    const valueJson = JSON.stringify(update.value);
    if (valueJson === undefined || valueJson.length > MAX_VALUE_SIZE) {
      throw new Error(`El valor de ${key} no es válido o supera el tamaño permitido.`);
    }
    return {
      area: String(update.area ?? input.area ?? "direccion").slice(0, 80),
      cutoff: String(update.cutoff ?? input.cutoff ?? "").slice(0, 40),
      key,
      sourceCurrency: update.sourceCurrency === "USD" ? "USD" as const : "DOP" as const,
      sourceFileId: String(update.sourceFileId ?? input.sourceFileId ?? "").slice(0, 80),
      sourceName: String(update.sourceName ?? input.sourceName ?? "Actualización manual").slice(0, 255),
      valueJson,
      valueType: liveValueType(update.value),
    } satisfies NormalizedLiveDataUpdate;
  });
}

export async function publishLiveDataUpdates(input: {
  normalized: NormalizedLiveDataUpdate[];
  actor: LiveDataActor;
  area?: string;
  cutoff?: string;
  sourceFileId?: string;
  sourceName?: string;
  message?: string;
}) {
  if (!input.normalized.length) throw new Error("No hay cambios preparados para publicar.");
  const db = getDb();
  const [event] = await db
    .insert(liveDataEvents)
    .values({
      sourceFileId: String(input.sourceFileId ?? input.normalized[0].sourceFileId).slice(0, 80),
      sourceName: String(input.sourceName ?? input.normalized[0].sourceName).slice(0, 255),
      area: String(input.area ?? input.normalized[0].area).slice(0, 80),
      cutoff: String(input.cutoff ?? input.normalized[0].cutoff).slice(0, 40),
      changeCount: input.normalized.length,
      message: String(input.message ?? `${input.normalized.length} datos actualizados en el Centro de Control.`).slice(0, 500),
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
    })
    .returning();
  const updatedAt = new Date().toISOString();
  for (const update of input.normalized) {
    await db.insert(liveDataHistory).values({
      eventId: event.id,
      key: update.key,
      valueJson: update.valueJson,
      valueType: update.valueType,
      area: update.area,
      sourceFileId: update.sourceFileId,
      sourceName: update.sourceName,
      sourceCurrency: update.sourceCurrency,
      cutoff: update.cutoff,
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
      createdAt: updatedAt,
    });
    await db
      .insert(liveDataPoints)
      .values({
        ...update,
        revision: event.id,
        updatedByEmail: input.actor.email,
        updatedByName: input.actor.displayName,
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
          updatedByEmail: input.actor.email,
          updatedByName: input.actor.displayName,
          updatedAt,
        },
      });
  }
  const linkedFileIds = [...new Set(input.normalized.map((update) => update.sourceFileId).filter(Boolean))];
  for (const fileId of linkedFileIds) {
    const [linkedFile] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
    if (!linkedFile) continue;
    await db
      .update(uploadedFiles)
      .set({
        status: "integrado",
        processingStage: "sincronizado",
        processingProgress: 100,
        processingSummary: `${input.normalized.length} datos normalizados y publicados en la revisión ${event.id}.`,
        requiresReview: false,
        reviewStatus: "aprobado",
        reviewedByEmail: input.actor.email,
        reviewedByName: input.actor.displayName,
        reviewedAt: updatedAt,
        publicationRevision: event.id,
        publishedAt: updatedAt,
        updatedAt,
      })
      .where(eq(uploadedFiles.id, fileId));
    await db.insert(fileActivity).values({
      fileId,
      eventType: "datos_publicados",
      message: `${input.normalized.length} datos publicados en la revisión ${event.id}; las pantallas han quedado sincronizadas.`,
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
      createdAt: updatedAt,
    });
  }
  return event;
}
