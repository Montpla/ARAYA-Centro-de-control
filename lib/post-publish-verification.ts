import { eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import { liveDataEvents, uploadedFiles } from "../db/schema";
import { validateLiveDataContract } from "./live-data-contract";
import { readEffectiveLiveData } from "./effective-live-data";
import {
  affectedViewsForUpdates,
  type FinancialUpdateLike,
} from "./financial-governance";
import { isFinancialLiveKey } from "./live-data";
import { emitMissingNotifications } from "./notifications";
import { scheduleNotificationDispatch } from "./notification-dispatch";

export type PublicationVerification = {
  status: "passed" | "failed";
  revision: number;
  checkedKeys: number;
  visibleKeys: number;
  affectedViews: string[];
  issues: string[];
  checkedAt: string;
};

/**
 * Read-after-write de cada revisión. La transacción D1 garantiza que todas las
 * claves se escriben juntas; esta segunda barrera confirma que la revisión
 * publicada es la que realmente gana en el snapshot vivo y vuelve a ejecutar
 * los controles financieros sobre el estado ya persistido.
 */
export async function verifyPublishedLiveData(input: {
  eventId: number;
  updates: FinancialUpdateLike[];
  sourceFileIds: string[];
  actor: { email: string; displayName: string };
}): Promise<PublicationVerification> {
  const snapshot = await readEffectiveLiveData(true);
  const pointByKey = new Map(snapshot.points.map((point) => [point.key, point]));
  const issues: string[] = [];
  let visibleKeys = 0;

  for (const update of input.updates) {
    const point = pointByKey.get(update.key);
    if (!point) {
      issues.push(`${update.key}: no aparece en el snapshot vivo.`);
      continue;
    }
    visibleKeys += 1;
    if (point.revision !== input.eventId) {
      issues.push(`${update.key}: la revisión visible es ${point.revision}, no ${input.eventId}.`);
      continue;
    }
    if (point.valueJson !== update.valueJson) {
      issues.push(`${update.key}: el valor persistido no coincide con el valor publicado.`);
      continue;
    }
    const contract = validateLiveDataContract(update.key, point.valueJson, snapshot.values);
    if (!contract.valid) issues.push(`${update.key}: ${contract.reason ?? "contrato vivo no válido"}.`);
  }

  const checkedAt = new Date().toISOString();
  const verification: PublicationVerification = {
    status: issues.length ? "failed" : "passed",
    revision: input.eventId,
    checkedKeys: input.updates.length,
    visibleKeys,
    affectedViews: affectedViewsForUpdates(input.updates),
    issues: issues.slice(0, 30),
    checkedAt,
  };
  const db = getDb();
  await db.update(liveDataEvents).set({
    affectedViewsJson: JSON.stringify(verification.affectedViews),
    verificationJson: JSON.stringify(verification),
  }).where(eq(liveDataEvents.id, input.eventId));

  if (verification.status === "failed") {
    // Antes esta alerta sólo salía si la publicación venía ligada a un
    // archivo (sourceFileIds). Una corrección manual sin archivo de origen
    // -como la que fijó "Movimiento de tierra" al 72,76%- podía fallar esta
    // misma comprobación y quedar guardada como "failed" en el evento sin que
    // nadie se enterase, hasta que alguien lo notara a simple vista en el
    // panel. Ahora toda publicación fallida avisa, tenga o no archivo de
    // origen.
    if (input.sourceFileIds.length) {
      await db.update(uploadedFiles).set({
        requiresReview: true,
        reviewStatus: "verificacion_posterior_fallida",
        processingSummary: `La revisión ${input.eventId} se publicó, pero la comprobación transversal detectó ${issues.length} incidencia(s). No vuelvas a subir el original: abre su diagnóstico.`,
        updatedAt: checkedAt,
      }).where(inArray(uploadedFiles.id, input.sourceFileIds));
    }
    await emitMissingNotifications([{
      kind: "post_publish_verification_failed",
      area: input.updates.some((update) => isFinancialLiveKey(update.key)) ? "finanzas" : "direccion",
      audience: input.updates.some((update) => isFinancialLiveKey(update.key)) ? "finance" : "admin",
      actorEmail: input.actor.email,
      actorName: input.actor.displayName,
      subjectType: "live_revision_verification",
      subjectId: String(input.eventId),
      title: `Comprobación posterior pendiente · revisión ${input.eventId}`,
      body: input.sourceFileIds.length
        ? `${issues.length} incidencia(s) impiden confirmar la sincronización transversal. El original permanece protegido.`
        : `${issues.length} incidencia(s) impiden confirmar la sincronización transversal de una corrección sin archivo de origen.`,
      view: "fuentes",
      payload: { revision: input.eventId, sourceFileIds: input.sourceFileIds, issues: issues.slice(0, 8) },
    }]);
    scheduleNotificationDispatch();
  }

  return verification;
}
