import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { fileActivity, notificationEvents, uploadedFiles } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { requiresFinanceAccessForDocument } from "../../../../lib/live-data";
import { scheduleNotificationDispatch } from "../../../../lib/notification-dispatch";

export const runtime = "edge";

type SupersedePayload = {
  fileId?: string;
  replacementFileId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  if (auth.user.role !== "admin") {
    return Response.json({ error: "Sólo un administrador puede cerrar un expediente como histórico." }, { status: 403 });
  }

  let payload: SupersedePayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no contiene un JSON válido." }, { status: 400 });
  }
  const fileId = String(payload.fileId ?? "").trim().slice(0, 160);
  const replacementFileId = String(payload.replacementFileId ?? "").trim().slice(0, 160);
  const reason = String(payload.reason ?? "").trim().slice(0, 1_000);
  if (!fileId || !replacementFileId || fileId === replacementFileId || !reason) {
    return Response.json({ error: "Indica origen, sustituto distinto y motivo de la sustitución." }, { status: 400 });
  }

  const db = getDb();
  const [[source], [replacement]] = await Promise.all([
    db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1),
    db.select().from(uploadedFiles).where(eq(uploadedFiles.id, replacementFileId)).limit(1),
  ]);
  if (!source || source.deletedAt) return Response.json({ error: "El expediente de origen no está activo." }, { status: 404 });
  if (!replacement || replacement.deletedAt || replacement.supersededAt) {
    return Response.json({ error: "El expediente sustituto no está activo o también fue superado." }, { status: 400 });
  }
  if (replacement.publicationRevision === null) {
    return Response.json({ error: "El sustituto debe estar publicado antes de cerrar la fuente anterior." }, { status: 409 });
  }
  if (source.publicationRevision !== null) {
    return Response.json({
      error: "La fuente anterior ya publicó datos. Retírala con el ciclo documental para recomputar el tablero antes de marcarla como histórica.",
    }, { status: 409 });
  }
  const protectedFiles = [source, replacement].some((file) =>
    requiresFinanceAccessForDocument(file.area, file.documentType));
  if (protectedFiles && !auth.user.financeAccess) {
    return Response.json({ error: "Necesitas acceso a Finanzas para relacionar estos expedientes." }, { status: 403 });
  }
  if (source.supersededByFileId) {
    const sameDecision = source.supersededByFileId === replacement.id;
    return Response.json({
      idempotent: sameDecision,
      supersededAt: source.supersededAt,
      message: sameDecision
        ? "El expediente ya constaba como histórico con ese sustituto."
        : "El expediente ya tiene otro sustituto registrado.",
    }, { status: sameDecision ? 200 : 409 });
  }

  const now = new Date().toISOString();
  const [closed] = await db.update(uploadedFiles).set({
    status: "historico",
    processingStage: "historico",
    processingProgress: 100,
    processingSummary: `Fuente histórica sustituida por ${replacement.originalName}.`,
    requiresReview: false,
    reviewStatus: "superado",
    reviewedByEmail: auth.user.email,
    reviewedByName: auth.user.displayName,
    reviewedAt: now,
    reviewNote: reason,
    supersededByFileId: replacement.id,
    supersededAt: now,
    updatedAt: now,
  }).where(and(
    eq(uploadedFiles.id, source.id),
    eq(uploadedFiles.deletedAt, ""),
    eq(uploadedFiles.supersededByFileId, ""),
    eq(uploadedFiles.updatedAt, source.updatedAt),
  )).returning();
  if (!closed) {
    return Response.json({ error: "El expediente cambió mientras se cerraba; vuelve a intentarlo." }, { status: 409 });
  }

  await db.insert(fileActivity).values({
    fileId: source.id,
    eventType: "archivo_superado",
    message: `Conservado como histórico. Sustituto: ${replacement.originalName}. Motivo: ${reason}`,
    actorEmail: auth.user.email,
    actorName: auth.user.displayName,
    createdAt: now,
  });
  await db.insert(notificationEvents).values({
    kind: "file_superseded",
    projectId: source.projectId || "araya",
    area: protectedFiles ? source.area : "direccion",
    audience: protectedFiles ? "finance" : "all",
    actorEmail: auth.user.email,
    actorName: auth.user.displayName,
    subjectType: "uploaded_file",
    subjectId: source.id,
    title: "Fuente documental sustituida",
    body: `${source.originalName} queda como histórico; prevalece ${replacement.originalName}.`,
    view: "fuentes",
    payloadJson: JSON.stringify({ fileId: source.id, replacementFileId: replacement.id }),
    createdAt: now,
  });
  scheduleNotificationDispatch();

  return Response.json({
    idempotent: false,
    supersededAt: now,
    message: "El archivo se conserva con trazabilidad histórica y no volverá a reprocesarse ni a publicar datos obsoletos.",
  });
}
