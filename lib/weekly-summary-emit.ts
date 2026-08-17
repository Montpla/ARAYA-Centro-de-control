import { and, eq } from "drizzle-orm";

import { getDb } from "../db";
import { notificationEvents } from "../db/schema";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { emitMissingNotifications } from "./notifications";
import { gatherWeeklySummary, isoWeekKey, recordWeeklySnapshot } from "./weekly-summary-data";

// Emisión del resumen semanal como aviso, una sola vez por semana, sin correo
// ni servicios externos: se reutiliza el mismo sistema de avisos que ya llega
// al móvil (VAPID ya configurado). Se engancha al sondeo de control-room, igual
// que los avisos de desviación y facturas vencidas, así que sale solo sin cron.

const WEEKLY_KIND = "weekly_summary";
const WEEKLY_SUBJECT_TYPE = "weekly_summary";

/**
 * Comprueba barato si el resumen de esta semana ISO ya se emitió. En un sondeo
 * de 5 s esto corre constantemente, así que lo primero es una única consulta por
 * índice; sólo el primer sondeo de una semana nueva hace el trabajo pesado.
 */
async function alreadyEmittedThisWeek(weekKey: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: notificationEvents.id })
    .from(notificationEvents)
    .where(and(
      eq(notificationEvents.kind, WEEKLY_KIND),
      eq(notificationEvents.subjectId, weekKey),
    ))
    .limit(1);
  return Boolean(row);
}

/**
 * Emite el resumen de la semana si toca. `force` lo emite aunque ya exista (para
 * la prueba manual del administrador); la deduplicación por semana lo protege
 * igualmente de duplicados en el uso normal.
 */
export async function emitWeeklySummaryIfDue(
  now: Date = new Date(),
  options: { force?: boolean } = {},
): Promise<{ emitted: boolean; reason?: string }> {
  const weekKey = isoWeekKey(now);
  if (!options.force && (await alreadyEmittedThisWeek(weekKey))) {
    return { emitted: false, reason: "ya-emitido" };
  }

  const data = await gatherWeeklySummary(now);
  const result = await emitMissingNotifications([{
    kind: WEEKLY_KIND,
    area: "direccion",
    audience: "all",
    subjectType: WEEKLY_SUBJECT_TYPE,
    subjectId: weekKey,
    title: data.summary.subject,
    body: data.notificationBody,
    view: "resumen",
  }]);

  // La foto de la semana se guarda sólo cuando el aviso es nuevo, para que la
  // comparación de la semana que viene tenga exactamente una foto por semana.
  if (result.created > 0) {
    await recordWeeklySnapshot(data);
  }
  return { emitted: result.created > 0 };
}

/**
 * Lanza la comprobación en segundo plano sin retrasar la respuesta del endpoint,
 * con el mismo patrón que scheduleBusinessAlerts (waitUntil de Cloudflare).
 */
export function scheduleWeeklySummary(now: Date = new Date()) {
  const task = emitWeeklySummaryIfDue(now).catch(() => undefined);
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
}
