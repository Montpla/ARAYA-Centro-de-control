"use client";

import { FormEvent, useMemo, useState } from "react";
import { areaLabels, userAreas } from "../lib/file-routing";

export type ArchivedReportSnapshot = {
  generatedAt: string;
  liveRevision: number;
  cutoff: string;
  executive: {
    physicalActual: number;
    kpiPlan: number;
    deviationPoints: number;
    baselineFinish: string;
    forecastFinish: string;
    forecastDeviationDays: number;
    integratedBuildings: number;
    apartments: number;
    urbanismActual: number;
    urbanismPlan: number;
  };
  monthlyPlan: Array<{ month: string; planned: number; actual: number | null }>;
  production: Record<string, unknown>;
  commercial: Record<string, unknown>;
  finance: Record<string, unknown> | null;
  safety: Record<string, unknown>;
  managementActions: string[];
  spatial: Record<string, unknown>;
  planning: Record<string, unknown>;
  reconciliationSummary: Record<string, number>;
  financeIncluded: boolean;
  rule: string;
};

export type ControlRoomSnapshot = {
  generatedAt: string;
  currentUser: {
    email: string;
    role: string;
    financeAccess: boolean;
  };
  assignees: Array<{
    email: string;
    displayName: string;
    area: string;
    financeAccess: boolean;
  }>;
  documents: {
    total: number;
    approved: number;
    pending: number;
    observed: number;
    rejected: number;
    discrepancies: number;
    pendingProposals: number;
    dossierScore: number | null;
    lastUploadAt: string;
    areas: Array<{
      area: string;
      files: number;
      integratedFiles: number;
      pendingFiles: number;
      livePoints: number;
      lastCutoff: string;
    }>;
  };
  live: {
    revision: number;
    pointCount: number;
    lastPublishedAt: string;
    latestSource: string;
    refreshIntervalMs: number;
  };
  cutoff: string;
  spatial: {
    masterPlanBuildings: number;
    integratedBuildings: number;
    pendingBuildings: number;
    mappedBuildings: number;
    invalidBuildingCoordinates: number;
    apartments: number;
    duplicateApartmentCodes: string[];
    apartmentsWithAllDisciplines: number;
    apartmentsWithResponsible: number;
    apartmentsWithOpenIssues: number;
    urbanismAreas: number;
    mappedUrbanismAreas: number;
    pendingUrbanismFields: number;
  };
  planning: {
    physicalActual: number;
    kpiPlan: number;
    kpiDeviationPoints: number;
    curvePlanAtCutoff: number | null;
    curveActualAtCutoff: number | null;
    curveCutoffLabel: string;
    baselineFinish: string;
    forecastFinish: string;
    forecastDeviationDays: number;
    delayedPackages: number;
    criticalPackages: number;
    maxPackageDeviationDays: number;
  };
  reconciliations: Array<{
    id: string;
    area: string;
    severity: "critical" | "medium" | "low";
    title: string;
    detail: string;
    view: string;
    source: string;
    restricted: boolean;
  }>;
  reconciliationSummary: {
    total: number;
    critical: number;
    restricted: number;
  };
  actions: Array<{
    id: string;
    title: string;
    description: string;
    area: string;
    relatedView: string;
    severity: string;
    status: string;
    assigneeEmail: string;
    assigneeName: string;
    dueDate: string;
    sourceFileId: string;
    createdByName: string;
    completedAt: string;
    createdAt: string;
    updatedAt: string;
    canEdit: boolean;
  }>;
  actionSummary: {
    total: number;
    open: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
  };
  actionActivity: Array<{
    id: number;
    actionId: string;
    eventType: string;
    message: string;
    actorName: string;
    createdAt: string;
    actionTitle: string | null;
    area: string | null;
  }>;
  reports: Array<{
    id: string;
    frequency: string;
    startDate: string;
    endDate: string;
    label: string;
    currency: string;
    liveRevision: number;
    cutoff: string;
    includesFinance: boolean;
    createdByName: string;
    createdAt: string;
    snapshot: ArchivedReportSnapshot | null;
  }>;
};

type ControlTab =
  | "quality"
  | "spatial"
  | "planning"
  | "reconciliations"
  | "reports"
  | "actions";

const tabLabels: Array<{ id: ControlTab; label: string }> = [
  { id: "quality", label: "Calidad y cobertura" },
  { id: "spatial", label: "Plano operativo" },
  { id: "planning", label: "Planificación" },
  { id: "reconciliations", label: "Conciliaciones" },
  { id: "reports", label: "Informes" },
  { id: "actions", label: "Acciones" },
];

const statusLabels: Record<string, string> = {
  open: "Abierta",
  in_progress: "En curso",
  blocked: "Bloqueada",
  completed: "Completada",
};

const severityLabels: Record<string, string> = {
  critical: "Crítica",
  medium: "Media",
  low: "Baja",
};

function dateTime(value: string) {
  if (!value) return "Sin actividad";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percent(value: number | null) {
  return value === null ? "Pendiente" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

function areaName(area: string) {
  return areaLabels[area as keyof typeof areaLabels] ?? area;
}

export function ControlRoomPanel({
  snapshot,
  loading,
  error,
  currentView,
  onNavigate,
  onCreateReport,
  onOpenReport,
  onRefresh,
}: {
  snapshot: ControlRoomSnapshot | null;
  loading: boolean;
  error: string;
  currentView: string;
  onNavigate: (view: string) => void;
  onCreateReport: () => void;
  onOpenReport: (report: ControlRoomSnapshot["reports"][number]) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<ControlTab>("quality");
  const [showActionForm, setShowActionForm] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedActionId, setSelectedActionId] = useState("");
  const [comment, setComment] = useState("");
  const [actionForm, setActionForm] = useState({
    title: "",
    description: "",
    area: "direccion",
    severity: "medium",
    dueDate: "",
    assigneeEmail: "",
  });
  const selectedAction = snapshot?.actions.find((action) => action.id === selectedActionId) ?? null;
  const selectedActivity = useMemo(
    () =>
      snapshot?.actionActivity.filter((activity) => activity.actionId === selectedActionId) ?? [],
    [snapshot, selectedActionId],
  );

  async function mutate(payload: Record<string, unknown>) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/control-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          requestKey: crypto.randomUUID(),
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo registrar la operación.");
      setMessage(result.message || "Cambio registrado y sincronizado.");
      onRefresh();
      return true;
    } catch (mutationError) {
      setMessage(
        mutationError instanceof Error ? mutationError.message : "No se pudo registrar la operación.",
      );
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createAction(event: FormEvent) {
    event.preventDefault();
    const created = await mutate({
      operation: "create_action",
      ...actionForm,
      relatedView: currentView,
    });
    if (!created) return;
    setActionForm({
      title: "",
      description: "",
      area: "direccion",
      severity: "medium",
      dueDate: "",
      assigneeEmail: "",
    });
    setShowActionForm(false);
    setTab("actions");
  }

  if (!snapshot) {
    return (
      <section className="control-room-shell">
        <div className="control-room-empty">
          <span>SALA OPERATIVA</span>
          <h2>{loading ? "Sincronizando controles…" : "Control operativo no disponible"}</h2>
          <p>{error || "El dashboard volverá a intentarlo en el próximo refresco."}</p>
          {!loading && <button type="button" onClick={onRefresh}>Reintentar</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="control-room-shell" aria-label="Sala operativa del Centro de Control">
      <div className="control-room-heading">
        <div>
          <span>CONTROL OPERATIVO · CORTE {snapshot.cutoff}</span>
          <h2>Calidad, decisiones y seguimiento en un solo lugar</h2>
          <p>
            Lectura automática de registros y controles. Las cifras sensibles continúan sujetas a validación humana.
          </p>
        </div>
        <div className="control-room-live">
          <i />
          <strong>Revisión {snapshot.live.revision || "base"}</strong>
          <small>{dateTime(snapshot.generatedAt)}</small>
        </div>
      </div>

      <div className="control-room-summary">
        <button type="button" onClick={() => setTab("quality")}>
          <span>Expediente validado</span>
          <strong>{snapshot.documents.dossierScore === null ? "Sin cargas" : `${snapshot.documents.dossierScore}%`}</strong>
          <small>{snapshot.documents.approved} de {snapshot.documents.total} archivos colaborativos</small>
        </button>
        <button type="button" onClick={() => setTab("spatial")}>
          <span>Plano integrado</span>
          <strong>{snapshot.spatial.integratedBuildings}/{snapshot.spatial.masterPlanBuildings}</strong>
          <small>{snapshot.spatial.apartments} apartamentos vinculados</small>
        </button>
        <button type="button" onClick={() => setTab("reconciliations")}>
          <span>Conciliaciones abiertas</span>
          <strong>{snapshot.reconciliationSummary.total}</strong>
          <small>{snapshot.reconciliationSummary.critical} críticas</small>
        </button>
        <button type="button" onClick={() => setTab("actions")}>
          <span>Acciones activas</span>
          <strong>{snapshot.actionSummary.open + snapshot.actionSummary.inProgress + snapshot.actionSummary.blocked}</strong>
          <small>{snapshot.actionSummary.overdue} vencidas</small>
        </button>
      </div>

      <div className="control-room-tabs" role="tablist" aria-label="Áreas del control operativo">
        {tabLabels.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "quality" && (
        <div className="control-room-body">
          <div className="control-room-metrics">
            <article><span>Por validar</span><strong>{snapshot.documents.pending}</strong><small>Requieren decisión humana</small></article>
            <article><span>Propuestas pendientes</span><strong>{snapshot.documents.pendingProposals}</strong><small>Sin publicar</small></article>
            <article><span>Discrepancias</span><strong>{snapshot.documents.discrepancies}</strong><small>Valor vigente frente a propuesto</small></article>
            <article><span>Puntos vivos</span><strong>{snapshot.live.pointCount}</strong><small>Actualización cada 5 segundos</small></article>
          </div>
          <div className="control-room-table">
            <div className="control-room-table-head">
              <strong>Cobertura por área</strong>
              <button type="button" onClick={() => onNavigate("fuentes")}>Abrir Centro de datos</button>
            </div>
            {snapshot.documents.areas.length ? snapshot.documents.areas.map((area) => (
              <button key={area.area} type="button" onClick={() => onNavigate("fuentes")}>
                <span><strong>{areaName(area.area)}</strong><small>Último corte: {area.lastCutoff || "pendiente"}</small></span>
                <em>{area.files} archivos</em>
                <em>{area.pendingFiles} pendientes</em>
                <em>{area.livePoints} datos vivos</em>
              </button>
            )) : (
              <div className="control-room-no-data">
                Todavía no hay cargas colaborativas. Las 22 fuentes históricas permanecen disponibles en el Centro de datos.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "spatial" && (
        <div className="control-room-body">
          <div className="control-room-metrics">
            <article><span>Edificios posicionados</span><strong>{snapshot.spatial.mappedBuildings}</strong><small>{snapshot.spatial.invalidBuildingCoordinates} coordenadas pendientes</small></article>
            <article><span>Apartamentos únicos</span><strong>{snapshot.spatial.apartments}</strong><small>{snapshot.spatial.duplicateApartmentCodes.length} códigos duplicados</small></article>
            <article><span>Disciplinas completas</span><strong>{snapshot.spatial.apartmentsWithAllDisciplines}</strong><small>De {snapshot.spatial.apartments} apartamentos</small></article>
            <article><span>Puntos de urbanismo</span><strong>{snapshot.spatial.mappedUrbanismAreas}/{snapshot.spatial.urbanismAreas}</strong><small>{snapshot.spatial.pendingUrbanismFields} campos por documentar</small></article>
          </div>
          <div className="control-room-callout">
            <div>
              <span>INTEGRIDAD ESPACIAL</span>
              <h3>{snapshot.spatial.pendingBuildings} edificios del plano general pendientes de integrar</h3>
              <p>
                Los edificios, apartamentos y áreas urbanas existentes conservan su posición en el masterplan visual y en el plano técnico.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate("implantacion")}>Abrir plano interactivo</button>
          </div>
        </div>
      )}

      {tab === "planning" && (
        <div className="control-room-body">
          <div className="control-room-metrics">
            <article><span>Avance físico</span><strong>{percent(snapshot.planning.physicalActual)}</strong><small>KPI plan: {percent(snapshot.planning.kpiPlan)}</small></article>
            <article><span>Curva S al corte</span><strong>{percent(snapshot.planning.curveActualAtCutoff)}</strong><small>Serie plan: {percent(snapshot.planning.curvePlanAtCutoff)}</small></article>
            <article><span>Paquetes desviados</span><strong>{snapshot.planning.delayedPackages}</strong><small>Máximo {snapshot.planning.maxPackageDeviationDays} días</small></article>
            <article><span>Paquetes críticos</span><strong>{snapshot.planning.criticalPackages}</strong><small>Fin previsto {snapshot.planning.forecastFinish}</small></article>
          </div>
          <div className="control-room-callout warning">
            <div>
              <span>CONTROL DE PLAZO</span>
              <h3>Previsión: {snapshot.planning.forecastDeviationDays} días frente a línea base</h3>
              <p>
                Línea base {snapshot.planning.baselineFinish} · previsión {snapshot.planning.forecastFinish}. El KPI plan y la serie de la Curva S se conservan como referencias distintas.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate("planificacion")}>Abrir planificación</button>
          </div>
        </div>
      )}

      {tab === "reconciliations" && (
        <div className="control-room-body">
          <div className="control-findings">
            {snapshot.reconciliations.map((finding) => (
              <button
                key={finding.id}
                type="button"
                className={finding.severity}
                onClick={() => onNavigate(finding.view)}
              >
                <i>{severityLabels[finding.severity]}</i>
                <span>
                  <strong>{finding.title}</strong>
                  <small>{finding.detail}</small>
                  <em>{finding.source} · {areaName(finding.area)}</em>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="control-room-body">
          <div className="control-room-table-head">
            <div><strong>Archivo de informes de Dirección</strong><small>Instantáneas ligadas a la revisión viva usada al generarlas.</small></div>
            <button
              type="button"
              onClick={onCreateReport}
              disabled={!snapshot.currentUser.financeAccess}
              title={!snapshot.currentUser.financeAccess ? "Requiere acceso financiero" : undefined}
            >
              Crear informe
            </button>
          </div>
          <div className="control-report-list">
            {snapshot.reports.length ? snapshot.reports.map((report) => (
              <button key={report.id} type="button" onClick={() => onOpenReport(report)}>
                <i>{report.frequency === "weekly" ? "SEM" : "MES"}</i>
                <span><strong>{report.label}</strong><small>Revisión {report.liveRevision || "base"} · corte {report.cutoff}</small></span>
                <em>{report.currency}</em>
                <b>{dateTime(report.createdAt)}</b>
              </button>
            )) : (
              <div className="control-room-no-data">
                Aún no hay informes archivados. El siguiente informe semanal o mensual quedará versionado aquí.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "actions" && (
        <div className="control-room-body">
          <div className="control-room-table-head">
            <div><strong>Acciones y decisiones</strong><small>Responsable, vencimiento, comentarios e historial.</small></div>
            <button type="button" onClick={() => setShowActionForm((open) => !open)}>
              {showActionForm ? "Cerrar formulario" : "Nueva acción"}
            </button>
          </div>
          {showActionForm && (
            <form className="control-action-form" onSubmit={createAction}>
              <label>Título<input required value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Área<select value={actionForm.area} onChange={(event) => setActionForm((current) => ({ ...current, area: event.target.value }))}>
                {userAreas.filter((area) => snapshot.currentUser.financeAccess || area !== "finanzas").map((area) => <option key={area} value={area}>{areaName(area)}</option>)}
              </select></label>
              <label>Prioridad<select value={actionForm.severity} onChange={(event) => setActionForm((current) => ({ ...current, severity: event.target.value }))}>
                <option value="critical">Crítica</option><option value="medium">Media</option><option value="low">Baja</option>
              </select></label>
              <label>Fecha objetivo<input type="date" value={actionForm.dueDate} onChange={(event) => setActionForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
              {snapshot.currentUser.role === "admin" && (
                <label>Responsable<select value={actionForm.assigneeEmail} onChange={(event) => setActionForm((current) => ({ ...current, assigneeEmail: event.target.value }))}>
                  <option value="">Administrador actual</option>
                  {snapshot.assignees.filter((person) => actionForm.area !== "finanzas" || person.financeAccess).map((person) => <option key={person.email} value={person.email}>{person.displayName} · {areaName(person.area)}</option>)}
                </select></label>
              )}
              <label className="wide">Descripción<textarea value={actionForm.description} onChange={(event) => setActionForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <button type="submit" disabled={working}>{working ? "Guardando…" : "Registrar acción"}</button>
            </form>
          )}
          <div className="control-actions-layout">
            <div className="control-action-list">
              {snapshot.actions.length ? snapshot.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`${selectedActionId === action.id ? "selected" : ""} ${action.severity}`}
                  onClick={() => setSelectedActionId(action.id)}
                >
                  <i>{severityLabels[action.severity] ?? action.severity}</i>
                  <span><strong>{action.title}</strong><small>{areaName(action.area)} · {action.assigneeName || "Sin responsable"}</small></span>
                  <em>{statusLabels[action.status] ?? action.status}</em>
                  <b>{action.dueDate || "Sin fecha"}</b>
                </button>
              )) : <div className="control-room-no-data">No hay acciones registradas.</div>}
            </div>
            {selectedAction && (
              <aside className="control-action-detail">
                <span>{areaName(selectedAction.area)} · {severityLabels[selectedAction.severity]}</span>
                <h3>{selectedAction.title}</h3>
                <p>{selectedAction.description || "Sin descripción adicional."}</p>
                <dl>
                  <div><dt>Responsable</dt><dd>{selectedAction.assigneeName || "Pendiente"}</dd></div>
                  <div><dt>Fecha objetivo</dt><dd>{selectedAction.dueDate || "Pendiente"}</dd></div>
                  <div><dt>Estado</dt><dd>{statusLabels[selectedAction.status]}</dd></div>
                  <div><dt>Creada por</dt><dd>{selectedAction.createdByName}</dd></div>
                </dl>
                {selectedAction.canEdit && (
                  <div className="control-action-statuses">
                    {Object.entries(statusLabels).map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        disabled={working || selectedAction.status === status}
                        onClick={() => void mutate({ operation: "update_action", actionId: selectedAction.id, status })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {selectedAction.sourceFileId && <button type="button" className="control-action-source" onClick={() => onNavigate("fuentes")}>Abrir documento vinculado</button>}
                {selectedAction.canEdit && (
                  <form className="control-action-comment" onSubmit={async (event) => {
                    event.preventDefault();
                    const saved = await mutate({ operation: "comment_action", actionId: selectedAction.id, message: comment });
                    if (saved) setComment("");
                  }}>
                    <textarea placeholder="Añadir comentario o evidencia…" value={comment} onChange={(event) => setComment(event.target.value)} />
                    <button type="submit" disabled={working || !comment.trim()}>Registrar comentario</button>
                  </form>
                )}
                <div className="control-action-activity">
                  {selectedActivity.map((activity) => <div key={activity.id}><strong>{activity.actorName}</strong><span>{activity.message}</span><small>{dateTime(activity.createdAt)}</small></div>)}
                </div>
              </aside>
            )}
          </div>
          {message && <div className="control-room-message" role="status">{message}</div>}
        </div>
      )}
    </section>
  );
}
