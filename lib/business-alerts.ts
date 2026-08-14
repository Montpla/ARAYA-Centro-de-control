// Avisos de negocio derivados del estado que los endpoints sondeados acaban
// de calcular. La detección trabaja sobre el payload ya construido (cero
// consultas extra cuando no hay candidatos) y la emisión es idempotente por
// (kind, subjectType, subjectId) vía emitMissingNotifications, así que puede
// ejecutarse en cada ciclo de 5s sin duplicar avisos. La entrega push usa la
// misma infraestructura VAPID y el mismo filtrado de audiencia fail-closed
// (área/rol/permiso financiero) que el resto de notificaciones.

import { getRequestExecutionContext } from "vinext/shims/request-context";
import { requiresFinanceAccessForArea } from "./live-data";
import { NotificationInput, emitMissingNotifications } from "./notifications";

// Puntos porcentuales de avance físico por debajo del plan operativo del
// mismo mes que disparan el aviso. Se emite una sola vez por mes de corte.
export const DEVIATION_ALERT_POINTS = 3;

// Facturas con antigüedad de 2 meses o más al corte, en la escala del detalle
// CxP (0 = al corriente … 5 = más de 3 meses). Se emite una vez por cada
// combinación corte + número de facturas afectadas.
export const PAYABLE_AGING_ALERT_INDEX = 3;

function decimalComma(value: number) {
  return Math.abs(value).toFixed(1).replace(".", ",");
}

type PlanningSummary = {
  kpiDeviationPoints?: number | null;
  curveCutoffLabel?: string;
};

type ControlRoomAction = {
  id: string | number;
  title: string;
  area?: string;
  status?: string;
  dueDate?: string;
  assigneeName?: string;
};

export function controlRoomAlertCandidates(payload: {
  planning?: PlanningSummary;
  actions?: ControlRoomAction[];
}): NotificationInput[] {
  const candidates: NotificationInput[] = [];

  const deviation = Number(payload.planning?.kpiDeviationPoints);
  const cutoffLabel = payload.planning?.curveCutoffLabel?.trim() ?? "";
  if (cutoffLabel && Number.isFinite(deviation) && deviation <= -DEVIATION_ALERT_POINTS) {
    candidates.push({
      kind: "deviation_alert",
      area: "planificacion",
      audience: "all",
      subjectType: "planning_cutoff",
      subjectId: `${cutoffLabel}:${DEVIATION_ALERT_POINTS}`,
      title: `Desviación física de -${decimalComma(deviation)} puntos · corte ${cutoffLabel}`,
      body: `El avance ejecutado está ${decimalComma(deviation)} puntos por debajo del plan operativo del mismo mes (umbral de aviso: ${DEVIATION_ALERT_POINTS} puntos).`,
      view: "planificacion",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const action of payload.actions ?? []) {
    if (!action?.dueDate || action.status === "completed" || action.dueDate >= today) continue;
    const area = action.area?.trim().toLowerCase() ?? "";
    candidates.push({
      kind: "action_overdue",
      area: area || "direccion",
      audience: !area
        ? "all"
        : requiresFinanceAccessForArea(area)
          ? "finance"
          : `area:${area}`,
      subjectType: "control_action",
      subjectId: `${action.id}:${action.dueDate}`,
      title: `Acción vencida: ${action.title}`,
      body: action.assigneeName
        ? `Vencía el ${action.dueDate} y sigue abierta. Responsable: ${action.assigneeName}.`
        : `Vencía el ${action.dueDate} y sigue abierta.`,
      view: "resumen",
    });
  }

  return candidates;
}

export function payablesAlertCandidates(dataset: {
  cutoff?: string;
  invoices?: Array<{ amountDop: number; agingIndex: number }>;
}): NotificationInput[] {
  const aged = (dataset.invoices ?? []).filter((invoice) =>
    invoice.amountDop > 0 && invoice.agingIndex >= PAYABLE_AGING_ALERT_INDEX);
  if (!aged.length) return [];
  const totalDop = aged.reduce((sum, invoice) => sum + invoice.amountDop, 0);
  const cutoff = dataset.cutoff?.trim() || "sin-corte";
  return [{
    kind: "payables_aging_alert",
    area: "finanzas",
    audience: "finance",
    subjectType: "payables_cutoff",
    subjectId: `${cutoff}:${aged.length}`,
    title: `${aged.length} facturas con 2 meses o más de antigüedad`,
    body: `Suman DOP ${Math.round(totalDop).toLocaleString("es-DO")} al corte ${cutoff}. Revisa el detalle en Proveedores.`,
    view: "proveedores",
  }];
}

// Emite en segundo plano sin retrasar la respuesta del endpoint: Cloudflare
// mantiene viva la tarea con waitUntil (mismo patrón que
// scheduleNotificationDispatch); las filas duraderas y el relevo de
// /api/notifications reintentan cualquier entrega pendiente.
export function scheduleBusinessAlerts(candidates: NotificationInput[]) {
  if (!candidates.length) return;
  const task = emitMissingNotifications(candidates).catch(() => undefined);
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  else void task;
}
