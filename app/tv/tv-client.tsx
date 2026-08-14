"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Cliente del modo TV/obra. Tres paneles rotatorios (avance, Curva S,
// acciones), refresco condicional con ETag cada 30 segundos y tipografía
// pensada para leerse a metros de distancia. Solo datos no financieros: la
// selección la hace el servidor en /api/tv, no esta pantalla.

const TOKEN_STORAGE_KEY = "bricket-tv-token-v1";
const SLIDE_ROTATION_MS = 15_000;

type TvPlanning = {
  physicalActual: number;
  kpiPlan: number;
  kpiDeviationPoints: number;
  curveCutoffLabel: string;
  baselineFinish: string;
  forecastFinish: string;
  forecastDeviationDays: number;
  delayedPackages: number;
  criticalPackages: number;
};

type TvSpatial = {
  masterPlanBuildings: number;
  integratedBuildings: number;
  apartments: number;
  urbanismAreas: number;
};

type TvSnapshot = {
  project: string;
  label: string;
  revision: number;
  latestEvent: { revision: number; sourceName: string; area: string; createdAt: string } | null;
  planning: TvPlanning;
  spatial: TvSpatial;
  monthlyPlan: Array<{ month: string; planned: number; actual: number | null }>;
  urbanism: { executed: number | null; planned: number | null };
  actions: {
    open: number;
    overdue: number;
    critical: number;
    highlights: Array<{ title: string; dueDate: string; area: string }>;
  };
  refreshIntervalMs: number;
  refreshedAt: string;
};

function formatPoints(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function CurveChart({ plan }: { plan: TvSnapshot["monthlyPlan"] }) {
  const width = 1600;
  const height = 640;
  const margin = { top: 30, right: 40, bottom: 70, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const stepX = plan.length > 1 ? innerWidth / (plan.length - 1) : innerWidth;
  const x = (index: number) => margin.left + index * stepX;
  const y = (value: number) => margin.top + innerHeight * (1 - value / 100);
  const plannedPath = plan.map((entry, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(entry.planned).toFixed(1)}`).join(" ");
  const actualEntries = plan
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.actual !== null && entry.actual !== undefined);
  const actualPath = actualEntries.map((entry, position) => `${position === 0 ? "M" : "L"}${x(entry.index).toFixed(1)},${y(entry.actual as number).toFixed(1)}`).join(" ");
  return (
    <svg className="tv-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva S: plan operativo frente a ejecutado real">
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="tv-curve-grid" />
          <text x={margin.left - 14} y={y(tick) + 8} className="tv-curve-axis" textAnchor="end">{tick}%</text>
        </g>
      ))}
      {plan.map((entry, index) => (
        index % 2 === 0
          ? (
            <text
              key={`${entry.month}-${index}`}
              x={x(index)}
              y={height - margin.bottom + 40}
              className="tv-curve-axis"
              textAnchor="end"
              transform={`rotate(-35 ${x(index)} ${height - margin.bottom + 40})`}
            >
              {entry.month}
            </text>
          )
          : null
      ))}
      <path d={plannedPath} className="tv-curve-planned" />
      {actualPath ? <path d={actualPath} className="tv-curve-actual" /> : null}
      {actualEntries.map((entry) => (
        <circle key={`actual-${entry.index}`} cx={x(entry.index)} cy={y(entry.actual as number)} r={7} className="tv-curve-actual-dot" />
      ))}
    </svg>
  );
}

export function TvClient({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [snapshot, setSnapshot] = useState<TvSnapshot | null>(null);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const [clock, setClock] = useState("");
  const etagRef = useRef({ etag: "" });

  // El token de la URL se guarda y se retira de la barra de direcciones para
  // que no quede a la vista ni en capturas de pantalla.
  useEffect(() => {
    if (initialToken) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, initialToken);
      window.history.replaceState(null, "", "/tv");
      return;
    }
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    if (stored) setToken(stored);
    else setError("Falta el enlace de pantalla. Pide a un administrador el enlace del modo TV.");
  }, [initialToken]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const headers = new Headers({ Authorization: `Bearer ${token}` });
      if (etagRef.current.etag) headers.set("If-None-Match", etagRef.current.etag);
      const response = await fetch("/api/tv", { cache: "no-store", headers });
      if (response.status === 304) {
        setError("");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "La pantalla no pudo sincronizar.");
      }
      const etag = response.headers.get("ETag");
      if (etag) etagRef.current.etag = etag;
      const payload = await response.json() as TvSnapshot;
      setSnapshot(payload);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "La pantalla no pudo sincronizar.");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), snapshot?.refreshIntervalMs ?? 30_000);
    return () => window.clearInterval(interval);
  }, [token, refresh, snapshot?.refreshIntervalMs]);

  useEffect(() => {
    const interval = window.setInterval(() => setSlide((current) => (current + 1) % 3), SLIDE_ROTATION_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const interval = window.setInterval(tick, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const deviationClass = useMemo(() => {
    const deviation = snapshot?.planning.kpiDeviationPoints ?? 0;
    if (deviation <= -3) return "tv-bad";
    if (deviation < 0) return "tv-warn";
    return "tv-good";
  }, [snapshot?.planning.kpiDeviationPoints]);

  if (!snapshot) {
    return (
      <main className="tv-shell" onClick={() => setSlide((current) => (current + 1) % 3)}>
        <section className="tv-empty">
          <img src="/bricket-mark.png" alt="" />
          <h1>Centro de Control ARAYA · Modo TV</h1>
          <p>{error || "Conectando con el Centro de Control…"}</p>
        </section>
      </main>
    );
  }

  const planning = snapshot.planning;
  return (
    <main className="tv-shell" onClick={() => setSlide((current) => (current + 1) % 3)}>
      <header className="tv-header">
        <div className="tv-brand">
          <img src="/bricket-mark.png" alt="" />
          <div>
            <strong>{snapshot.project}</strong>
            <span>Centro de Control · {snapshot.label || "Pantalla de obra"}</span>
          </div>
        </div>
        <div className="tv-clock">
          <strong>{clock}</strong>
          <span>{error ? "Sin conexión · mostrando el último dato" : `Revisión ${snapshot.revision}`}</span>
        </div>
      </header>

      {slide === 0 ? (
        <section className="tv-slide" aria-label="Avance del proyecto">
          <h2>Avance físico · corte {planning.curveCutoffLabel || "—"}</h2>
          <div className="tv-kpi-grid">
            <article className="tv-kpi">
              <span>Ejecutado</span>
              <strong>{formatPercent(planning.physicalActual)}</strong>
            </article>
            <article className="tv-kpi">
              <span>Plan operativo</span>
              <strong>{formatPercent(planning.kpiPlan)}</strong>
            </article>
            <article className={`tv-kpi ${deviationClass}`}>
              <span>Desviación</span>
              <strong>{formatPoints(planning.kpiDeviationPoints)} pts</strong>
            </article>
            <article className={`tv-kpi ${planning.forecastDeviationDays > 0 ? "tv-warn" : "tv-good"}`}>
              <span>Fin previsto</span>
              <strong>{planning.forecastFinish}</strong>
              <small>{planning.forecastDeviationDays > 0 ? `+${planning.forecastDeviationDays} días sobre línea base` : "En línea base"}</small>
            </article>
            <article className="tv-kpi">
              <span>Edificios con datos</span>
              <strong>{snapshot.spatial.integratedBuildings} / {snapshot.spatial.masterPlanBuildings}</strong>
            </article>
            <article className="tv-kpi">
              <span>Apartamentos</span>
              <strong>{snapshot.spatial.apartments}</strong>
            </article>
            <article className="tv-kpi">
              <span>Urbanismo ejecutado</span>
              <strong>{formatPercent(snapshot.urbanism.executed)}</strong>
              <small>Plan {formatPercent(snapshot.urbanism.planned)}</small>
            </article>
            <article className={`tv-kpi ${planning.criticalPackages > 0 ? "tv-warn" : ""}`}>
              <span>Paquetes con retraso</span>
              <strong>{planning.delayedPackages}</strong>
              <small>{planning.criticalPackages} críticos</small>
            </article>
          </div>
        </section>
      ) : null}

      {slide === 1 ? (
        <section className="tv-slide" aria-label="Curva S">
          <h2>Curva S · plan operativo frente a ejecutado real</h2>
          <CurveChart plan={snapshot.monthlyPlan} />
          <div className="tv-legend">
            <span className="tv-legend-planned">Plan operativo</span>
            <span className="tv-legend-actual">Ejecutado real</span>
          </div>
        </section>
      ) : null}

      {slide === 2 ? (
        <section className="tv-slide" aria-label="Acciones y actividad">
          <h2>Acciones prioritarias</h2>
          <div className="tv-kpi-grid tv-kpi-grid-3">
            <article className="tv-kpi">
              <span>Abiertas</span>
              <strong>{snapshot.actions.open}</strong>
            </article>
            <article className={`tv-kpi ${snapshot.actions.overdue > 0 ? "tv-bad" : "tv-good"}`}>
              <span>Vencidas</span>
              <strong>{snapshot.actions.overdue}</strong>
            </article>
            <article className={`tv-kpi ${snapshot.actions.critical > 0 ? "tv-warn" : ""}`}>
              <span>Críticas</span>
              <strong>{snapshot.actions.critical}</strong>
            </article>
          </div>
          {snapshot.actions.highlights.length ? (
            <ul className="tv-action-list">
              {snapshot.actions.highlights.map((action) => (
                <li key={`${action.title}-${action.dueDate}`}>
                  <strong>{action.title}</strong>
                  <span>{action.area || "general"} · vencía el {action.dueDate}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tv-all-clear">Sin acciones vencidas. Todo al día.</p>
          )}
        </section>
      ) : null}

      <footer className="tv-footer">
        <span>
          {snapshot.latestEvent
            ? `Última fuente: ${snapshot.latestEvent.sourceName || "—"} · ${snapshot.latestEvent.area || ""} · revisión ${snapshot.latestEvent.revision}`
            : "Sin revisiones publicadas todavía"}
        </span>
        <span className="tv-dots" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <i key={index} className={index === slide ? "tv-dot tv-dot-active" : "tv-dot"} />
          ))}
        </span>
      </footer>
    </main>
  );
}
