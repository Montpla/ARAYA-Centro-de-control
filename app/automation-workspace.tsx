"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Run = {
  id: number;
  kind: string;
  status: string;
  summary: string;
  startedAt: string;
  completedAt: string;
};

type Incident = {
  id: number;
  status: string;
  severity: string;
  area: string;
  title: string;
  detail: string;
  sourceFileId: string;
  assigneeEmail: string;
  attemptCount: number;
  lastSeenAt: string;
};

type Requirement = {
  id: number;
  area: string;
  documentType: string;
  label: string;
  ownerEmail: string;
  dueAt: string;
  status: string;
  sourceFileId: string;
};

type Period = {
  id: string;
  cadence: string;
  label: string;
  status: string;
  completion: number;
  received: number;
  required: number;
  requirements: Requirement[];
};

type Preferences = {
  notificationAreas: string[];
  criticalOnly: boolean;
  digestFrequency: string;
  quietStart: string;
  quietEnd: string;
  timezoneOffsetMinutes: number;
  onboardingCompletedAt: string;
};

type Snapshot = {
  runs: Run[];
  incidents: Incident[];
  periods: Period[];
  preferences: Preferences;
};

const areas = [
  ["direccion", "Dirección"],
  ["planificacion", "Planificación"],
  ["obra", "Obra"],
  ["urbanismo", "Urbanismo"],
  ["comercial", "Ventas"],
  ["finanzas", "Finanzas"],
  ["compras", "Compras"],
  ["seguridad", "Seguridad"],
] as const;

function dateLabel(value: string) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AutomationWorkspace({
  user,
}: {
  user: { role: string; financeAccess: boolean };
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/automation-center", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Automatización no disponible.");
      setSnapshot(payload);
      setPreferences(payload.preferences);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Automatización no disponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(action);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/automation-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json() as { error?: string; snapshot?: Snapshot; sent?: number };
      if (!response.ok) throw new Error(result.error || "No se pudo completar la acción.");
      if (result.snapshot) {
        setSnapshot(result.snapshot);
        setPreferences(result.snapshot.preferences);
      } else {
        await refresh();
      }
      setMessage(action === "send_reminders"
        ? `${result.sent ?? 0} recordatorio(s) preparados.`
        : "Acción completada y registrada.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción.");
    } finally {
      setBusy("");
    }
  }, [refresh]);

  const openIncidents = useMemo(
    () => snapshot?.incidents.filter((item) => ["open", "retrying"].includes(item.status)) ?? [],
    [snapshot],
  );
  const latestAudit = snapshot?.runs.find((run) => run.kind === "global_audit");
  const latestBackup = snapshot?.runs.find((run) => run.kind === "backup_restore");
  const activePeriods = snapshot?.periods.filter((period) => period.status !== "closed").slice(0, 2) ?? [];

  if (loading) return <section className="panel automation-workspace loading">Preparando automatizaciones…</section>;

  return (
    <section className="panel automation-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">AUTOMATIZACIÓN OPERATIVA · SIN COSTE DE IA</span>
          <h3>Auditoría, cierres e incidencias</h3>
          <p>El sistema comprueba, recuerda, reintenta y registra. Las decisiones contables continúan protegidas.</p>
        </div>
        {user.role === "admin" && (
          <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void act("run_audit")}>
            {busy === "run_audit" ? "Comprobando…" : "Comprobar ahora"}
          </button>
        )}
      </div>
      {(error || message) && <div className={`automation-message ${error ? "error" : "ok"}`}>{error || message}</div>}
      <div className="automation-summary-grid">
        <article>
          <span>Última auditoría</span>
          <strong>{latestAudit ? latestAudit.status === "passed" ? "Correcta" : "Observada" : "Pendiente"}</strong>
          <small>{latestAudit?.summary || "Se ejecutará automáticamente esta noche."}</small>
        </article>
        <article>
          <span>Incidencias activas</span>
          <strong>{openIncidents.length}</strong>
          <small>{openIncidents.filter((item) => item.severity === "critical").length} críticas</small>
        </article>
        <article>
          <span>Cierre documental</span>
          <strong>{activePeriods[0]?.completion ?? 0}%</strong>
          <small>{activePeriods[0]?.label || "Periodo pendiente de crear"}</small>
        </article>
        <article>
          <span>Última copia</span>
          <strong>{latestBackup?.status === "passed" ? "Verificada" : latestBackup ? "Observada" : "Pendiente"}</strong>
          <small>{latestBackup ? dateLabel(latestBackup.completedAt || latestBackup.startedAt) : "Se registrará en el próximo backup."}</small>
        </article>
      </div>

      <details className="automation-block" open>
        <summary><span><strong>Cierre semanal y mensual</strong><small>Documentos esperados, responsables y vencimientos</small></span></summary>
        <div className="automation-block-body">
          {activePeriods.map((period) => (
            <article className="period-card" key={period.id}>
              <div className="period-head">
                <div><strong>{period.label}</strong><small>{period.received} de {period.required} recibidos</small></div>
                <b>{period.completion}%</b>
              </div>
              <div className="period-progress"><i style={{ width: `${period.completion}%` }} /></div>
              <ul className="period-requirements">
                {period.requirements.map((requirement) => (
                  <li key={requirement.id} className={requirement.status}>
                    <i aria-hidden="true" />
                    <span><strong>{requirement.label}</strong><small>{requirement.ownerEmail || requirement.area} · límite {requirement.dueAt.slice(0, 10)}</small></span>
                    <em>{requirement.status === "received" ? "Recibido" : requirement.status === "overdue" ? "Vencido" : "Pendiente"}</em>
                  </li>
                ))}
              </ul>
              {user.role === "admin" && (
                <div className="automation-actions">
                  <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void act("send_reminders", { periodId: period.id })}>Recordar pendientes</button>
                  <button className="button primary" type="button" disabled={Boolean(busy) || period.completion < 100} onClick={() => void act("close_period", { periodId: period.id })}>Cerrar periodo</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </details>

      <details className="automation-block" open={openIncidents.length > 0}>
        <summary><span><strong>Centro de incidencias</strong><small>Reintentos controlados y resolución con trazabilidad</small></span><em>{openIncidents.length}</em></summary>
        <div className="automation-block-body incident-list">
          {!openIncidents.length && <p className="empty-automation">No hay incidencias activas.</p>}
          {openIncidents.map((incident) => (
            <article className={`incident-card ${incident.severity}`} key={incident.id}>
              <div><span>{incident.area} · {incident.severity}</span><strong>{incident.title}</strong><p>{incident.detail}</p><small>Visto {dateLabel(incident.lastSeenAt)} · {incident.assigneeEmail || "Administración"}</small></div>
              {user.role === "admin" && (
                <div className="automation-actions vertical">
                  {incident.sourceFileId && <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void act("retry_incident", { incidentId: incident.id })}>Reprocesar</button>}
                  <button className="button" type="button" disabled={Boolean(busy)} onClick={() => void act("resolve_incident", { incidentId: incident.id, resolution: "Comprobada y cerrada desde el Centro de incidencias." })}>Resolver</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </details>

      {preferences && (
        <details className="automation-block">
          <summary><span><strong>Mis notificaciones</strong><small>Prioridad, frecuencia y horario silencioso</small></span></summary>
          <form className="automation-preferences" onSubmit={(event) => {
            event.preventDefault();
            void act("preferences", {
              ...preferences,
              timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            } as unknown as Record<string, unknown>);
          }}>
            <label>Frecuencia
              <select value={preferences.digestFrequency} onChange={(event) => setPreferences({ ...preferences, digestFrequency: event.target.value })}>
                <option value="immediate">Inmediatas</option>
                <option value="daily">Resumen diario</option>
                <option value="weekly">Resumen semanal</option>
                <option value="off">Sólo dentro de la aplicación</option>
              </select>
            </label>
            <label>Silencio desde<input type="time" value={preferences.quietStart} onChange={(event) => setPreferences({ ...preferences, quietStart: event.target.value })} /></label>
            <label>Silencio hasta<input type="time" value={preferences.quietEnd} onChange={(event) => setPreferences({ ...preferences, quietEnd: event.target.value })} /></label>
            <label className="automation-check"><input type="checkbox" checked={preferences.criticalOnly} onChange={(event) => setPreferences({ ...preferences, criticalOnly: event.target.checked })} /> Sólo avisos críticos</label>
            <fieldset>
              <legend>Áreas que quiero seguir</legend>
              {areas.filter(([id]) => user.financeAccess || !["finanzas", "comercial"].includes(id)).map(([id, label]) => (
                <label key={id}><input type="checkbox" checked={preferences.notificationAreas.includes(id)} onChange={(event) => setPreferences({
                  ...preferences,
                  notificationAreas: event.target.checked
                    ? [...preferences.notificationAreas, id]
                    : preferences.notificationAreas.filter((area) => area !== id),
                })} /> {label}</label>
              ))}
            </fieldset>
            <button className="button primary" type="submit" disabled={Boolean(busy)}>Guardar preferencias</button>
          </form>
        </details>
      )}
    </section>
  );
}
