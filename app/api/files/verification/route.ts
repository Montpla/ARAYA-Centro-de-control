import { and, count, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  documentDataProposals,
  fileActivity,
  ingestionAgentRuns,
  liveDataHistory,
  uploadedFiles,
} from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import { scheduleNotificationDispatch } from "../../../../lib/notification-dispatch";
import { emitMissingNotifications } from "../../../../lib/notifications";
import {
  evaluateUploadVerification,
  mergeVerificationChecks,
  PROGRESS_KEY,
  type VerificationCheck,
} from "../../../../lib/upload-verification";

export const runtime = "edge";

// Comprueba si una carga entró bien en el Centro de Control (ver
// lib/upload-verification.ts). La llama .github/workflows/verificar-carga.yml
// en cuanto termina de procesarse un archivo. Con notify=true deja el veredicto
// en el historial del archivo y avisa en el panel y en el móvil a la cuenta que
// ejecuta la verificación. Sólo devuelve claves, motivos y porcentajes, nunca importes.

// note: texto opcional que sustituye al resumen en el aviso (lo usa el paso de
// arreglo automático para contar qué hizo).
// extraChecks: comprobaciones hechas fuera (la coherencia del panel, que el
// workflow calcula con lo que sirve producción) que se suman al veredicto.
type VerificationPayload = { fileId?: string; notify?: boolean; note?: string; extraChecks?: unknown };

function sanitizeExtraChecks(value: unknown): VerificationCheck[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const severity = record.severity;
    if (severity !== "ok" && severity !== "aviso" && severity !== "anomalia") return [];
    const id = String(record.id ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 40);
    const detail = String(record.detail ?? "").slice(0, 300);
    return id && detail ? [{ id, severity, detail }] : [];
  });
}

const KEY_CHUNK = 50;

// file_activity guarda "AAAA-MM-DD HH:MM:SS" y algunas marcas se escriben en
// ISO; se comparan en la misma forma.
const sqlTime = (value: string) => String(value ?? "").replace("T", " ").slice(0, 19);

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  if (auth.user.role !== "admin") {
    return Response.json({ error: "Sólo un administrador puede verificar una carga." }, { status: 403 });
  }

  let payload: VerificationPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no contiene un JSON válido." }, { status: 400 });
  }
  const fileId = String(payload.fileId ?? "").trim().slice(0, 160);
  if (!fileId) return Response.json({ error: "Indica el archivo a verificar." }, { status: 400 });
  const note = String(payload.note ?? "").trim().slice(0, 400);

  const db = getDb();
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!file) return Response.json({ error: "El archivo no existe." }, { status: 404 });

  const [[run], discards, [pending], history] = await Promise.all([
    db.select().from(ingestionAgentRuns).where(eq(ingestionAgentRuns.fileId, fileId))
      .orderBy(desc(ingestionAgentRuns.startedAt)).limit(1),
    db.select({ message: fileActivity.message, createdAt: fileActivity.createdAt }).from(fileActivity)
      .where(and(eq(fileActivity.fileId, fileId), eq(fileActivity.eventType, "datos_descartados")))
      .orderBy(desc(fileActivity.id)).limit(1),
    db.select({ total: count() }).from(documentDataProposals).where(and(
      eq(documentDataProposals.fileId, fileId),
      eq(documentDataProposals.status, "pendiente"),
      ...(file.proposalGeneration ? [eq(documentDataProposals.generation, file.proposalGeneration)] : []),
    )),
    db.select({ id: liveDataHistory.id, key: liveDataHistory.key, valueJson: liveDataHistory.valueJson })
      .from(liveDataHistory).where(eq(liveDataHistory.sourceFileId, fileId)),
  ]);

  // Retrocesos: para cada porcentaje de avance que publicó esta carga, el valor
  // anterior publicado por OTRO archivo.
  const latestByKey = new Map<string, { id: number; value: number }>();
  for (const row of history) {
    if (!PROGRESS_KEY.test(row.key)) continue;
    const value = Number(JSON.parse(row.valueJson));
    if (!Number.isFinite(value)) continue;
    const current = latestByKey.get(row.key);
    if (!current || row.id > current.id) latestByKey.set(row.key, { id: row.id, value });
  }
  const regressions: Array<{ key: string; before: number; after: number; beforeSource: string }> = [];
  const keys = [...latestByKey.keys()];
  for (let index = 0; index < keys.length; index += KEY_CHUNK) {
    const chunk = keys.slice(index, index + KEY_CHUNK);
    const maxId = Math.max(...chunk.map((key) => latestByKey.get(key)!.id));
    const previous = await db.select({
      id: liveDataHistory.id,
      key: liveDataHistory.key,
      valueJson: liveDataHistory.valueJson,
      sourceFileId: liveDataHistory.sourceFileId,
      sourceName: liveDataHistory.sourceName,
    }).from(liveDataHistory)
      .where(and(inArray(liveDataHistory.key, chunk), lt(liveDataHistory.id, maxId)))
      .orderBy(desc(liveDataHistory.id));
    for (const key of chunk) {
      const mine = latestByKey.get(key)!;
      const before = previous.find((row) => row.key === key && row.id < mine.id && row.sourceFileId !== fileId);
      if (!before) continue;
      const beforeValue = Number(JSON.parse(before.valueJson));
      if (Number.isFinite(beforeValue)) regressions.push({ key, before: beforeValue, after: mine.value, beforeSource: before.sourceName });
    }
  }

  const fileResult = evaluateUploadVerification({
    file: {
      originalName: file.originalName,
      extension: file.extension,
      processingStage: file.processingStage,
      status: file.status,
      reviewStatus: file.reviewStatus,
      requiresReview: Boolean(file.requiresReview),
      lastProcessingError: file.lastProcessingError,
      detectedPeriod: file.detectedPeriod,
      derivedFromFileId: file.derivedFromFileId,
      supersededByFileId: file.supersededByFileId,
      deletedAt: file.deletedAt,
      publicationRevision: file.publicationRevision,
      createdAt: file.createdAt,
      extractionSummary: `${file.extractionSummary} ${file.processingSummary}`,
    },
    run: run ? { status: run.status, proposedCount: run.proposedCount, publishedCount: run.publishedCount, error: run.error } : null,
    // Sólo el descarte del último procesamiento: uno de un intento anterior ya
    // superado no es un problema vivo.
    discardMessages: discards.filter((item) => !run || sqlTime(item.createdAt) >= sqlTime(run.startedAt))
      .map((item) => item.message),
    pendingProposals: Number(pending?.total ?? 0),
    regressions,
  });

  const result = mergeVerificationChecks(fileResult, sanitizeExtraChecks(payload.extraChecks));

  if (payload.notify && result.verdict !== "pendiente") {
    await db.insert(fileActivity).values({
      fileId,
      eventType: "verificacion_carga",
      message: `${note ? `${note} · ` : ""}${result.verdict}: ${result.checks.map((check) => `[${check.severity}] ${check.detail}`).join(" · ")}`.slice(0, 1900),
      actorEmail: "sistema@araya",
      actorName: "Verificación automática",
    }).catch(() => undefined);
    const ok = result.verdict === "ok";
    await emitMissingNotifications([{
      kind: ok ? "upload_verified" : "upload_verification_attention",
      area: "direccion",
      // Directo a quien ejecuta la verificación (la cuenta del dueño en el
      // workflow), no a todos los administradores.
      audience: `user:${auth.user.email}`,
      actorEmail: "sistema@araya",
      actorName: "Verificación automática",
      subjectType: "upload_verification",
      subjectId: `${fileId}:${file.updatedAt}${note ? `:${note.length}:${note.slice(0, 40)}` : ""}`,
      title: ok
        ? `✔ Integrado: ${file.originalName}`.slice(0, 160)
        : `⚠ Revisar carga: ${file.originalName}`.slice(0, 160),
      body: (note || result.summary).slice(0, 400),
      view: "fuentes",
      payload: { fileId, verdict: result.verdict },
    }]).catch(() => undefined);
    scheduleNotificationDispatch();
  }

  return Response.json({
    file: { id: file.id, name: file.originalName, stage: file.processingStage, revision: file.publicationRevision },
    ...result,
  });
}
