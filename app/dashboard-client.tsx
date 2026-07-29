"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building,
  CustomMetric,
  Supplier,
  Unit,
  UrbanismArea,
  buildings,
  cubicaciones,
  customMetrics as initialMetrics,
  dataSources,
  monthlyPlan,
  projectSnapshot,
  suppliers as initialSuppliers,
  timeline,
  urbanismAreas,
  workPackages,
} from "./demo-data";

type View =
  | "resumen"
  | "planificacion"
  | "implantacion"
  | "edificios"
  | "viviendas"
  | "urbanismo"
  | "cronologia"
  | "proveedores"
  | "metricas"
  | "fuentes"
  | "agente";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  mode?: string;
};

type ProjectId = "araya" | "mirador";

const projects: Record<ProjectId, {
  id: ProjectId;
  code: string;
  name: string;
  summary: string;
  cutoff: string;
  demo: boolean;
}> = {
  araya: {
    id: "araya",
    code: "AR",
    name: "ARAYA",
    summary: "26 edificios · 156 viviendas",
    cutoff: projectSnapshot.declaredCutoff,
    demo: false,
  },
  mirador: {
    id: "mirador",
    code: "MP",
    name: "MIRADOR DEL PARQUE",
    summary: "14 edificios · 84 viviendas",
    cutoff: "15/07/2026",
    demo: true,
  },
};

const navItems: Array<{ id: View; label: string; mark: string }> = [
  { id: "resumen", label: "Resumen ejecutivo", mark: "01" },
  { id: "planificacion", label: "Planificación", mark: "02" },
  { id: "implantacion", label: "Implantación general", mark: "03" },
  { id: "edificios", label: "Edificios", mark: "04" },
  { id: "viviendas", label: "Viviendas", mark: "05" },
  { id: "urbanismo", label: "Urbanismo", mark: "06" },
  { id: "cronologia", label: "Cronología", mark: "07" },
  { id: "proveedores", label: "Proveedores", mark: "08" },
  { id: "metricas", label: "Métricas y finanzas", mark: "09" },
  { id: "fuentes", label: "Centro de datos", mark: "10" },
  { id: "agente", label: "Agente IA", mark: "AI" },
];

const statusLabel = {
  terminada: "Terminada",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

const planCoordinates: Record<string, { x: number; y: number }> = {
  "1": { x: 20.4, y: 74.4 },
  "2": { x: 28.7, y: 74.6 },
  "3": { x: 36.7, y: 74.5 },
  "4": { x: 38.4, y: 70.7 },
  "5": { x: 31.1, y: 70.6 },
  "6": { x: 23.3, y: 70.5 },
  "7": { x: 20.7, y: 64.7 },
  "8": { x: 28.7, y: 64.8 },
  "9": { x: 36.7, y: 64.8 },
  "10": { x: 36.7, y: 60.8 },
  "11": { x: 28.7, y: 60.7 },
  "12": { x: 20.6, y: 60.7 },
  "13": { x: 21.6, y: 54.5 },
  "14": { x: 29.8, y: 54.5 },
  "15": { x: 38.1, y: 54.6 },
  "16": { x: 39.1, y: 50.6 },
  "17": { x: 30.6, y: 50.5 },
  "18": { x: 22.1, y: 50.4 },
  "70": { x: 66.6, y: 50.3 },
  "71": { x: 59.0, y: 50.2 },
  "72": { x: 59.0, y: 54.1 },
  "73": { x: 66.6, y: 54.2 },
  "74": { x: 66.5, y: 61.3 },
  "75": { x: 58.9, y: 61.2 },
  "76": { x: 59.0, y: 65.1 },
  "77": { x: 66.6, y: 65.1 },
};

const visualPlanCoordinates: Record<string, { x: number; y: number }> = {
  "1": { x: 19.9, y: 80.21 },
  "2": { x: 28.26, y: 80.37 },
  "3": { x: 36.78, y: 80.62 },
  "4": { x: 37.01, y: 76.94 },
  "5": { x: 28.54, y: 76.72 },
  "6": { x: 20.04, y: 76.5 },
  "7": { x: 20.7, y: 68.13 },
  "8": { x: 28.98, y: 68.26 },
  "9": { x: 37.31, y: 68.45 },
  "10": { x: 37.57, y: 64.89 },
  "11": { x: 29.23, y: 64.7 },
  "12": { x: 20.91, y: 64.51 },
  "13": { x: 21.44, y: 56.34 },
  "14": { x: 29.83, y: 56.52 },
  "15": { x: 38.05, y: 56.68 },
  "16": { x: 38.24, y: 53.12 },
  "17": { x: 30.0, y: 52.97 },
  "18": { x: 21.68, y: 52.81 },
  "70": { x: 67.39, y: 52.81 },
  "71": { x: 58.91, y: 52.62 },
  "72": { x: 58.74, y: 56.24 },
  "73": { x: 67.2, y: 56.4 },
  "74": { x: 67.11, y: 64.67 },
  "75": { x: 58.58, y: 64.45 },
  "76": { x: 58.46, y: 68.16 },
  "77": { x: 66.97, y: 68.32 },
};

const urbanismMapPoints: Record<string, { x: number; y: number; short: string }> = {
  "urban-general": { x: 50.5, y: 69.5, short: "URB" },
  "urban-roads": { x: 87.0, y: 39.0, short: "VIAL" },
  "urban-parking": { x: 70.0, y: 82.0, short: "P" },
  "urban-landscape": { x: 23.0, y: 89.0, short: "PAISAJISMO" },
  "urban-facilities": { x: 50.5, y: 58.5, short: "EQ" },
  "urban-access": { x: 56.5, y: 88.5, short: "ACCESO" },
};

const visualUrbanismMapPoints: Record<string, { x: number; y: number; short: string }> = {
  "urban-general": { x: 50.2, y: 71.4, short: "URB" },
  "urban-roads": { x: 91.0, y: 35.0, short: "VIAL" },
  "urban-parking": { x: 65.3, y: 61.4, short: "P" },
  "urban-landscape": { x: 48.0, y: 46.3, short: "PAISAJISMO" },
  "urban-facilities": { x: 49.2, y: 58.7, short: "EQ" },
  "urban-access": { x: 51.5, y: 89.7, short: "ACCESO" },
};

function ProgressRing({ value }: { value: number }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${number.format(value)}% ejecutado`}
    >
      <div>
        <strong>{number.format(value)}%</strong>
        <span>avance físico</span>
      </div>
    </div>
  );
}

function Header({
  view,
  onAsk,
  project,
}: {
  view: View;
  onAsk: () => void;
  project: (typeof projects)[ProjectId];
}) {
  const label = navItems.find((item) => item.id === view)?.label;
  return (
    <header className="topbar">
      <div>
        <div className="crumb">
          {project.name} / CENTRO DE CONTROL
          {project.demo && <span className="demo-badge">PROYECTO DEMO</span>}
        </div>
        <h1>{label}</h1>
      </div>
      <div className="top-actions">
        <div className="live-state">
          <span className="live-dot" />
          Corte documental · {project.cutoff}
        </div>
        <button className="button secondary" onClick={onAsk} disabled={project.demo}>
          Preguntar al agente
        </button>
        <button className="avatar" aria-label="Perfil de Dirección">DR</button>
      </div>
    </header>
  );
}

function StatCard({
  eyebrow,
  value,
  detail,
  tone = "neutral",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warn" | "danger" | "good";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProgressChart() {
  const width = 1180;
  const height = 190;
  const plotTop = 14;
  const plotBottom = 142;
  const sidePadding = 25;
  const xFor = (index: number) =>
    sidePadding + (index * (width - sidePadding * 2)) / (monthlyPlan.length - 1);
  const yFor = (value: number) =>
    plotBottom - (value / 100) * (plotBottom - plotTop);
  const plannedPoints = monthlyPlan
    .map((point, index) => `${xFor(index)},${yFor(point.planned)}`)
    .join(" ");
  const actualPoints = monthlyPlan
    .map((point, index) =>
      point.actual === null ? null : `${xFor(index)},${yFor(point.actual)}`,
    )
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="chart-scroll">
        <svg
          className="line-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Evolución mensual del plan operativo y del avance ejecutado"
        >
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line
                className="line-chart-grid"
                x1={sidePadding}
                x2={width - sidePadding}
                y1={yFor(value)}
                y2={yFor(value)}
              />
              <text className="line-chart-axis" x={2} y={yFor(value) + 3}>
                {value}%
              </text>
            </g>
          ))}
          <polyline className="progress-line planned" points={plannedPoints} />
          <polyline className="progress-line actual" points={actualPoints} />
          {monthlyPlan.map((point, index) => (
            <g key={`${point.month}-${index}`}>
              <circle
                className="progress-point planned"
                cx={xFor(index)}
                cy={yFor(point.planned)}
                r="3.5"
              >
                <title>{`${point.month} · Plan ${number.format(point.planned)}%`}</title>
              </circle>
              {point.actual !== null && (
                <circle
                  className="progress-point actual"
                  cx={xFor(index)}
                  cy={yFor(point.actual)}
                  r="4"
                >
                  <title>{`${point.month} · Ejecutado ${number.format(point.actual)}%`}</title>
                </circle>
              )}
              <text className="line-chart-month" x={xFor(index)} y="166">
                {point.month}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-legend">
        <span><i className="legend plan" />Plan operativo</span>
        <span><i className="legend actual" />Ejecutado real</span>
      </div>
    </>
  );
}

function SitePlan({
  onSelectBuilding,
  onNavigate,
}: {
  onSelectBuilding: (building: Building) => void;
  onNavigate: (view: View) => void;
}) {
  const [selectedUnit, setSelectedUnit] = useState<{ building: Building; unit: Unit } | null>(null);
  const [planBuilding, setPlanBuilding] = useState<Building | null>(null);
  const [planMode, setPlanMode] = useState<"visual" | "technical">("visual");
  const [selectedUrbanism, setSelectedUrbanism] = useState<UrbanismArea | null>(null);
  const completed = buildings.flatMap((item) => item.units).filter((unit) => unit.status === "terminada").length;
  const active = buildings.flatMap((item) => item.units).filter((unit) => unit.status === "en_curso").length;
  const pending = projectSnapshot.unitCount - completed - active;

  return (
    <section className="panel site-plan-panel">
      <div className="panel-heading site-plan-heading">
        <div>
          <span className="section-kicker">IMPLANTACIÓN GENERAL · DWG 002</span>
          <h3>Edificios, viviendas y urbanismo</h3>
        </div>
        <div className="plan-mode-switch" aria-label="Vista del plano">
          <button
            className={planMode === "visual" ? "active" : ""}
            aria-pressed={planMode === "visual"}
            onClick={() => setPlanMode("visual")}
          >
            Plano visual interactivo
          </button>
          <button
            className={planMode === "technical" ? "active" : ""}
            aria-pressed={planMode === "technical"}
            onClick={() => setPlanMode("technical")}
          >
            Plano técnico
          </button>
        </div>
      </div>
      <div className="plan-data-strip">
        <span><strong>{projectSnapshot.masterPlanBuildingCount}</strong> TH identificados en implantación</span>
        <span><strong>{projectSnapshot.buildingCount}</strong> edificios con datos integrados</span>
        <span><strong>{projectSnapshot.unitCount}</strong> viviendas en seguimiento</span>
        <span><strong>{projectSnapshot.buildingsPendingIntegration}</strong> TH pendientes de integrar</span>
      </div>
      <div className="plan-quick-actions" aria-label="Explorar datos de la implantación">
        <button onClick={() => onNavigate("edificios")}><span>EDIFICIOS</span><strong>Ver conjunto y detalle</strong><i>→</i></button>
        <button onClick={() => onNavigate("viviendas")}><span>VIVIENDAS</span><strong>Abrir 156 fichas</strong><i>→</i></button>
        <button onClick={() => onNavigate("urbanismo")}><span>URBANISMO</span><strong>Explorar áreas y datos</strong><i>→</i></button>
      </div>
      <div className="plan-legend">
        <span><i className="done" />Superestructura terminada · {completed}</span>
        <span><i className="active" />En curso · {active}</span>
        <span><i className="pending" />Pendiente · {pending}</span>
        <span><i className="uninformed" />Sin datos integrados · {projectSnapshot.buildingsPendingIntegration}</span>
      </div>
      <p className="plan-disclaimer">
        La implantación visual conserva la organización del plano DWG y mantiene
        activas las capas de edificios, viviendas y urbanismo. Están integrados los
        26 edificios del cronograma MPP: TH-01 a TH-18 y TH-70 a TH-77.
      </p>
      <div className={`site-plan-image-wrap ${planMode}`}>
        <img
          className="site-plan-image"
          src={planMode === "visual" ? "/araya-visual-masterplan-v3.png" : "/araya-site-plan-clean.png"}
          alt={
            planMode === "visual"
              ? "Implantación visual de ARAYA con edificios, viviendas, viales, estacionamientos y urbanismo"
              : "Plano técnico de la implantación general de ARAYA"
          }
          width={1200}
          height={1958}
          loading="eager"
        />
        <>
            {buildings.map((building) => {
              const point =
                planMode === "visual"
                  ? visualPlanCoordinates[building.shortName]
                  : planCoordinates[building.shortName];
              return (
                <div
                  key={building.id}
                  className="plan-building-hotspot"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <button
                    className={`plan-building-trigger ${
                    building.units[0].status === "terminada"
                      ? "done"
                      : building.units[0].status === "en_curso"
                        ? "active"
                        : "pending"
                    }`}
                    title={`Abrir TH-${building.shortName.padStart(2, "0")} · ${number.format(building.progress)}%`}
                    onClick={() => {
                      setSelectedUnit(null);
                      setSelectedUrbanism(null);
                      setPlanBuilding(building);
                    }}
                  >
                    TH-{building.shortName.padStart(2, "0")}
                  </button>
                  <div className="plan-home-statuses" aria-label={`Viviendas de TH-${building.shortName.padStart(2, "0")}`}>
                    {building.units.map((unit) => (
                      <button
                        key={unit.id}
                        className={unit.status}
                        title={`${unit.code} · ${statusLabel[unit.status]} · ${unit.progress}%`}
                        aria-label={`Abrir ${unit.code}`}
                        onClick={() => {
                          setPlanBuilding(null);
                          setSelectedUrbanism(null);
                          setSelectedUnit({ building, unit });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {urbanismAreas.map((area) => {
              const point =
                planMode === "visual"
                  ? visualUrbanismMapPoints[area.id]
                  : urbanismMapPoints[area.id];
              return (
                <button
                  key={area.id}
                  className={`urbanism-map-point ${area.status}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  title={`Abrir ${area.name}`}
                  onClick={() => {
                    setPlanBuilding(null);
                    setSelectedUnit(null);
                    setSelectedUrbanism(area);
                  }}
                >
                  <span>{point.short}</span>
                  {area.progress !== null && <strong>{number.format(area.progress)}%</strong>}
                </button>
              );
            })}
        </>
      </div>
      {planBuilding && (
        <div className="plan-building-picker" role="dialog" aria-modal="true">
          <button className="close-button" onClick={() => setPlanBuilding(null)} aria-label="Cerrar">×</button>
          <span className="section-kicker">TH-{planBuilding.shortName.padStart(2, "0")}</span>
          <h3>{planBuilding.name} · selecciona vivienda</h3>
          <div className="picker-summary">
            <span>Índice de frentes<strong>{number.format(planBuilding.progress)}%</strong></span>
            <span>Fin previsto<strong>{planBuilding.forecastFinish}</strong></span>
            <span>Desvío<strong>{planBuilding.deviationDays > 0 ? `+${planBuilding.deviationDays}` : planBuilding.deviationDays} días</strong></span>
          </div>
          <div className="picker-units">
            {planBuilding.units.map((unit) => (
              <button
                key={unit.id}
                className={`plan-unit ${unit.status}`}
                onClick={() => {
                  setSelectedUnit({ building: planBuilding, unit });
                  setPlanBuilding(null);
                }}
              >
                <span>Vivienda</span>
                <strong>{unit.code.split("-")[1]}</strong>
                <small>{unit.progress}% estructura</small>
              </button>
            ))}
          </div>
          <button
            className="button secondary"
            onClick={() => {
              onSelectBuilding(planBuilding);
              onNavigate("edificios");
              setPlanBuilding(null);
            }}
          >
            Abrir edificio completo
          </button>
        </div>
      )}
      {selectedUnit && (
        <div className="unit-inspector" role="dialog" aria-modal="true">
          <button className="close-button" onClick={() => setSelectedUnit(null)} aria-label="Cerrar">×</button>
          <div>
            <span className="section-kicker">FICHA DE VIVIENDA</span>
            <h3>Vivienda {selectedUnit.unit.code}</h3>
          </div>
          <div className="unit-inspector-grid">
            <span>Edificio<strong>{selectedUnit.building.shortName}</strong></span>
            <span>Planta<strong>{selectedUnit.unit.floor}</strong></span>
            <span>Superestructura<strong>{selectedUnit.unit.progress}%</strong></span>
            <span>Estado<strong>{statusLabel[selectedUnit.unit.status]}</strong></span>
            <span>Índice del edificio<strong>{number.format(selectedUnit.building.progress)}%</strong></span>
            <span>Fin previsto edificio<strong>{selectedUnit.building.forecastFinish}</strong></span>
          </div>
          <p>
            El avance disponible a nivel vivienda corresponde únicamente a
            superestructura. Los próximos documentos permitirán añadir
            albañilería, instalaciones, acabados, incidencias y responsables.
          </p>
          <button
            className="button primary"
            onClick={() => {
              onSelectBuilding(selectedUnit.building);
              onNavigate("edificios");
              setSelectedUnit(null);
            }}
          >
            Abrir detalle del edificio
          </button>
        </div>
      )}
      {selectedUrbanism && (
        <div className="plan-urbanism-picker" role="dialog" aria-modal="true">
          <button className="close-button" onClick={() => setSelectedUrbanism(null)} aria-label="Cerrar">×</button>
          <span className="section-kicker">{selectedUrbanism.category}</span>
          <h3>{selectedUrbanism.name}</h3>
          <div className={`data-status ${selectedUrbanism.status}`}>
            {selectedUrbanism.status === "integrado" ? "Datos integrados" : "Pendiente de datos"}
          </div>
          <p>{selectedUrbanism.detail}</p>
          <div className="picker-summary">
            <span>Ejecutado<strong>{selectedUrbanism.progress === null ? "—" : `${number.format(selectedUrbanism.progress)}%`}</strong></span>
            <span>Plan<strong>{selectedUrbanism.planned === null ? "—" : `${number.format(selectedUrbanism.planned)}%`}</strong></span>
            <span>Fuente<strong>{selectedUrbanism.source}</strong></span>
          </div>
          <button className="button primary" onClick={() => onNavigate("urbanismo")}>Abrir urbanismo completo</button>
        </div>
      )}
    </section>
  );
}

function Overview({
  onNavigate,
  onSelectBuilding,
}: {
  onNavigate: (view: View) => void;
  onSelectBuilding: (building: Building) => void;
}) {
  return (
    <div className="view-stack">
      <section className="hero-grid">
        <article className="project-pulse panel">
          <div>
            <div className="section-kicker">CORTE 30/06/2026</div>
            <h2>El avance físico está 3,00 puntos por debajo del plan.</h2>
            <p>
              Excel registra 18,23% ejecutado frente a 21,24% previsto. El
              cronograma MPP marca 17% y proyecta el cierre siete días después
              de la línea base.
            </p>
            <div className="project-meta">
              <span>Fin base · 31 may 2027</span>
              <span>Fin previsto · 07 jun 2027</span>
            </div>
          </div>
          <ProgressRing value={projectSnapshot.overallProgress} />
        </article>
        <div className="stat-grid">
          <StatCard eyebrow="Plan operativo" value="21,24%" detail="-3,00 pp de brecha física" tone="warn" />
          <StatCard eyebrow="Cronograma MPP" value="17%" detail="Indicador pendiente de conciliación" tone="warn" />
          <StatCard eyebrow="Alcance residencial" value="26 edificios" detail="156 apartamentos · 6 por edificio" />
          <StatCard eyebrow="Previsión final" value="+7 días" detail="07/06/2027 frente a línea base" tone="danger" />
        </div>
      </section>

      <SitePlan onSelectBuilding={onSelectBuilding} onNavigate={onNavigate} />

      <section className="dashboard-grid">
        <article className="panel schedule-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CURVA DE AVANCE</span>
              <h3>Plan frente a ejecución</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate("planificacion")}>
              Abrir planificación
            </button>
          </div>
          <ProgressChart />
        </article>

        <article className="panel attention-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ATENCIÓN DE DIRECCIÓN</span>
              <h3>3 controles prioritarios</h3>
            </div>
            <span className="count-badge">3</span>
          </div>
          <button className="attention-item" onClick={() => onNavigate("planificacion")}>
            <span className="severity critical">PLAZO</span>
            <strong>Infraestructura proyecta +58 días</strong>
            <small>Fin 07/10/2026 · base 10/08/2026</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("fuentes")}>
            <span className="severity medium">CONCILIAR</span>
            <strong>Excel 18,23% frente a MPP 17%</strong>
            <small>Son indicadores distintos; falta regla formal de conciliación</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("metricas")}>
            <span className="severity low">VALIDAR</span>
            <strong>Moneda de cubicaciones no identificada</strong>
            <small>No se convierte ni se etiqueta como USD hasta confirmación</small>
          </button>
        </article>
      </section>

    </div>
  );
}

function Planning() {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Avance físico" value="18,23%" detail="Plan 21,24% · Excel" tone="warn" />
        <StatCard eyebrow="Fin previsto" value="07 jun 2027" detail="+7 días naturales frente a base" tone="danger" />
        <StatCard eyebrow="Paquetes" value={`${workPackages.length}`} detail="6 con avance registrado" />
        <StatCard eyebrow="Camino crítico" value="5 paquetes" detail="Marcados como críticos en el MPP" tone="warn" />
      </section>
      <section className="panel schedule-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CURVA S</span>
            <h3>Plan operativo completo</h3>
          </div>
          <span className="data-note">Excel · corte 30/06/2026</span>
        </div>
        <ProgressChart />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CRONOGRAMA MAESTRO</span>
            <h3>Paquetes y desviaciones de fin</h3>
          </div>
          <span className="data-note">MPP · guardado 14/07/2026</span>
        </div>
        <div className="simple-table package-table">
          <div className="table-row table-head">
            <span>Paquete</span><span>Avance</span><span>Fin / línea base</span><span>Desviación</span>
          </div>
          {workPackages.map((item) => (
            <div className="table-row" key={item.name}>
              <strong>{item.name}{item.critical ? " · crítico" : ""}</strong>
              <span>{number.format(item.progress)}%</span>
              <span>{item.finish} / {item.baselineFinish}</span>
              <span className={item.deviationDays >= 14 ? "danger-text" : "warn-text"}>
                +{item.deviationDays} días
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UnitDetailPanel({
  building,
  unit,
  onClose,
}: {
  building: Building;
  unit: Unit;
  onClose: () => void;
}) {
  return (
    <aside className="data-detail-panel" role="dialog" aria-modal="true" aria-label={`Detalle de ${unit.code}`}>
      <button className="close-button" onClick={onClose} aria-label="Cerrar detalle">×</button>
      <span className="section-kicker">FICHA INDIVIDUAL DE VIVIENDA</span>
      <h3>{unit.code}</h3>
      <div className="unit-inspector-grid">
        <span>Edificio<strong>TH-{building.shortName.padStart(2, "0")}</strong></span>
        <span>Planta<strong>{unit.floor}</strong></span>
        <span>Superestructura<strong>{unit.progress}%</strong></span>
        <span>Estado<strong>{statusLabel[unit.status]}</strong></span>
        <span>Fase disponible<strong>{unit.phase}</strong></span>
        <span>Desvío<strong>{unit.deviationDays > 0 ? `+${unit.deviationDays}` : unit.deviationDays} días</strong></span>
      </div>
      <div className="data-coverage">
        <div><span>DATOS DISPONIBLES</span><strong>Superestructura · edificio · planta · estado</strong></div>
        <div className="pending"><span>PENDIENTES DE INCORPORAR</span><strong>Albañilería · instalaciones · acabados · incidencias · responsable</strong></div>
      </div>
      <p>Esta ficha queda preparada para crecer con los próximos archivos y datos que se incorporen al centro de control.</p>
    </aside>
  );
}

function BuildingsView({
  selected,
  setSelected,
}: {
  selected: Building;
  setSelected: (building: Building) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const units = selected.units.filter(
    (unit) => statusFilter === "todos" || unit.status === statusFilter,
  );
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">NAVEGACIÓN INTERACTIVA</span><h2>Conjunto de edificios</h2></div>
        <p>Selecciona cualquier TH para consultar sus indicadores y abre una vivienda para ver su ficha individual.</p>
      </section>
      <section className="building-tabs">
        {buildings.map((building) => (
          <button
            key={building.id}
            className={building.id === selected.id ? "active" : ""}
            onClick={() => {
              setSelected(building);
              setSelectedUnit(null);
            }}
          >
            <span>TH-{building.shortName.padStart(2, "0")}</span>
            <strong>{number.format(building.progress)}%</strong>
          </button>
        ))}
      </section>
      <section className="panel building-detail">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DETALLE NORMALIZADO DEL EDIFICIO</span>
            <h3>{selected.name}</h3>
          </div>
          <div className="inline-stats">
            <span><strong>{number.format(selected.progress)}%</strong> índice de frentes</span>
            <span><strong>{selected.forecastFinish}</strong> fin previsto</span>
            <span className={selected.deviationDays > 0 ? "danger-text" : ""}>
              <strong>{selected.deviationDays > 0 ? `+${selected.deviationDays}` : selected.deviationDays}</strong> días
            </span>
          </div>
        </div>
        <p className="section-intro">
          El porcentaje del edificio es el promedio simple de 32 frentes del MPP.
          Pulsa una vivienda para abrir su ficha y consultar los datos ya disponibles.
        </p>
        <div className="filter-row">
          {["todos", "en_curso", "pendiente", "terminada"].map((filter) => (
            <button
              key={filter}
              className={statusFilter === filter ? "active" : ""}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === "todos" ? "Todas" : statusLabel[filter as keyof typeof statusLabel]}
            </button>
          ))}
        </div>
        <div className="unit-grid">
          {units.map((unit) => (
            <button
              className={`unit-card interactive ${unit.status}`}
              key={unit.id}
              onClick={() => setSelectedUnit(unit)}
            >
              <div><strong>{unit.code}</strong><span>Planta {unit.floor}</span></div>
              <b>{unit.progress}%</b>
              <small>{unit.phase}</small>
              <div className="unit-progress"><i style={{ width: `${unit.progress}%` }} /></div>
              <em>Abrir ficha →</em>
            </button>
          ))}
        </div>
        {selectedUnit && <UnitDetailPanel building={selected} unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
      </section>
    </div>
  );
}

function HousingView() {
  const [buildingFilter, setBuildingFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedUnit, setSelectedUnit] = useState<{ building: Building; unit: Unit } | null>(null);
  const unitRows = buildings
    .filter((building) => buildingFilter === "todos" || building.id === buildingFilter)
    .flatMap((building) => building.units.map((unit) => ({ building, unit })))
    .filter(({ unit }) => statusFilter === "todos" || unit.status === statusFilter);

  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">156 FICHAS PREPARADAS</span><h2>Viviendas individuales</h2></div>
        <p>Filtra por edificio o estado y pulsa cualquier vivienda. Las fichas se completarán progresivamente con los nuevos datos.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Viviendas integradas" value={`${projectSnapshot.unitCount}`} detail="6 por cada edificio activo" />
        <StatCard eyebrow="Edificios relacionados" value={`${projectSnapshot.buildingCount}`} detail="TH-01 a TH-18 y TH-70 a TH-77" />
        <StatCard eyebrow="Dato disponible" value="Superestructura" detail="Avance y estado por vivienda" tone="good" />
        <StatCard eyebrow="Próxima ampliación" value="5 áreas" detail="Instalaciones, acabados, incidencias y más" />
      </section>
      <section className="panel housing-explorer">
        <div className="housing-controls">
          <label>
            Edificio
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="todos">Todos los edificios</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>TH-{building.shortName.padStart(2, "0")} · {building.name}</option>
              ))}
            </select>
          </label>
          <div className="filter-row">
            {["todos", "en_curso", "pendiente", "terminada"].map((filter) => (
              <button key={filter} className={statusFilter === filter ? "active" : ""} onClick={() => setStatusFilter(filter)}>
                {filter === "todos" ? "Todas" : statusLabel[filter as keyof typeof statusLabel]}
              </button>
            ))}
          </div>
          <span className="result-count">{unitRows.length} viviendas visibles</span>
        </div>
        <div className="housing-grid">
          {unitRows.map(({ building, unit }) => (
            <button
              className={`housing-card ${unit.status}`}
              key={unit.id}
              onClick={() => setSelectedUnit({ building, unit })}
            >
              <span>TH-{building.shortName.padStart(2, "0")} · PLANTA {unit.floor}</span>
              <strong>{unit.code}</strong>
              <div><i style={{ width: `${unit.progress}%` }} /></div>
              <small>{statusLabel[unit.status]} · {unit.progress}%</small>
            </button>
          ))}
        </div>
        {selectedUnit && (
          <UnitDetailPanel
            building={selectedUnit.building}
            unit={selectedUnit.unit}
            onClose={() => setSelectedUnit(null)}
          />
        )}
      </section>
    </div>
  );
}

function UrbanismView() {
  const [selectedArea, setSelectedArea] = useState<UrbanismArea>(urbanismAreas[0]);
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">CAPAS OPERATIVAS DEL PLANO</span><h2>Urbanismo y espacios comunes</h2></div>
        <p>Pulsa cada área para consultar la información disponible y los campos que faltan por incorporar.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Urbanismo ejecutado" value={`${number.format(projectSnapshot.urbanismProgress)}%`} detail={`Plan ${number.format(projectSnapshot.urbanismPlanned)}%`} tone="good" />
        <StatCard eyebrow="Áreas identificadas" value={`${urbanismAreas.length}`} detail="Plano DWG y fotografía" />
        <StatCard eyebrow="Áreas con indicador" value="1" detail="Consolidado de urbanismo" />
        <StatCard eyebrow="Pendientes de detalle" value={`${urbanismAreas.length - 1}`} detail="Preparadas para nuevos datos" tone="warn" />
      </section>
      <section className="urbanism-workspace">
        <div className="urbanism-area-grid">
          {urbanismAreas.map((area) => (
            <button
              key={area.id}
              className={`urbanism-area-card ${area.status} ${selectedArea.id === area.id ? "active" : ""}`}
              onClick={() => setSelectedArea(area)}
            >
              <span>{area.category}</span>
              <strong>{area.name}</strong>
              <b>{area.progress === null ? "Sin dato" : `${number.format(area.progress)}%`}</b>
              <small>{area.source}</small>
            </button>
          ))}
        </div>
        <aside className="panel urbanism-detail">
          <span className="section-kicker">{selectedArea.category}</span>
          <h3>{selectedArea.name}</h3>
          <div className={`data-status ${selectedArea.status}`}>{selectedArea.status === "integrado" ? "Datos integrados" : "Pendiente de datos"}</div>
          <p>{selectedArea.detail}</p>
          <div className="urbanism-values">
            <span>Ejecutado<strong>{selectedArea.progress === null ? "—" : `${number.format(selectedArea.progress)}%`}</strong></span>
            <span>Plan<strong>{selectedArea.planned === null ? "—" : `${number.format(selectedArea.planned)}%`}</strong></span>
            <span>Fuente<strong>{selectedArea.source}</strong></span>
          </div>
          <div className="pending-fields">
            <span>DATOS QUE PODREMOS AÑADIR</span>
            <div>{selectedArea.pendingFields.map((field) => <i key={field}>{field}</i>)}</div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TimelineView() {
  const [filter, setFilter] = useState("todos");
  const visible = timeline.filter((event) => filter === "todos" || event.type === filter);
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">TRAZABILIDAD DOCUMENTAL</span>
          <h3>Cortes, actualizaciones y fechas de control</h3>
        </div>
        <div className="filter-row compact">
          {["todos", "avance", "hito", "entrega"].map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
              {item === "todos" ? "Todo" : item}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline">
        {visible.map((event) => (
          <article className="timeline-event" key={event.id}>
            <div className={`timeline-marker ${event.type}`} />
            <div className="timeline-date"><strong>{event.date}</strong><span>{event.time}</span></div>
            <div className="timeline-copy">
              <span className="event-type">{event.type}</span>
              <h4>{event.title}</h4>
              <p>{event.detail}</p>
              <small>{event.building} · {event.author}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SuppliersView({ suppliers, onAdd }: { suppliers: Supplier[]; onAdd: () => void }) {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Proveedores importados" value={`${suppliers.length}`} detail="No hay catálogo en las fuentes adjuntas" />
        <StatCard eyebrow="Contratos" value="Sin dato" detail="Pendiente de fuente contractual" />
        <StatCard eyebrow="Entregas" value="Sin dato" detail="Pendiente de planificación de suministro" />
        <StatCard eyebrow="Importes" value="Sin dato" detail="No se infiere desde cubicaciones" />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CADENA DE SUMINISTRO</span>
            <h3>Proveedores incorporados al Centro de Control</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Nuevo proveedor</button>
        </div>
        {suppliers.length === 0 ? (
          <div className="empty-state">
            <strong>No se han recibido datos de proveedores.</strong>
            <p>El panel queda preparado para añadir empresas, categorías, contactos, entregas e importes sin inventar registros.</p>
          </div>
        ) : (
          <div className="supplier-grid">
            {suppliers.map((supplier) => (
              <article className="supplier-card" key={supplier.id}>
                <div className="supplier-head">
                  <div className="supplier-logo">{supplier.name.slice(0, 2).toUpperCase()}</div>
                  <div><strong>{supplier.name}</strong><span>{supplier.category}</span></div>
                  <i className={`supplier-status ${supplier.status}`} />
                </div>
                <div className="supplier-details">
                  <span>Contacto<strong>{supplier.contact || "Sin dato"}</strong></span>
                  <span>Próxima entrega<strong>{supplier.nextDelivery || "Sin dato"}</strong></span>
                  <span>Contratado<strong>{supplier.amount || "Sin dato"}</strong></span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricsView({ metrics, onAdd }: { metrics: CustomMetric[]; onAdd: () => void }) {
  return (
    <div className="view-stack">
      <section className="panel metric-library">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">INDICADORES CONFIGURABLES</span>
            <h3>Métricas físicas, temporales y financieras</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Añadir métrica</button>
        </div>
        <p className="section-intro">
          Los importes se mantienen en la moneda original porque el Excel no
          identifica la divisa. No se ha realizado ninguna conversión.
        </p>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.id}>
              <div className="metric-card-head">
                <span>{metric.owner}</span>
                <i className={`trend ${metric.trend}`}>{metric.trend === "up" ? "↗" : metric.trend === "down" ? "↘" : "→"}</i>
              </div>
              <h4>{metric.name}</h4>
              <strong>{metric.value} <small>{metric.unit}</small></strong>
              <div className="metric-target"><span>Referencia {metric.target} {metric.unit}</span></div>
            </article>
          ))}
          <button className="metric-add-card" onClick={onAdd}>
            <span>+</span><strong>Nueva métrica</strong><small>Nombre, unidad, objetivo y responsable</small>
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CUBICACIONES</span>
            <h3>Medición frente a contabilidad</h3>
          </div>
          <span className="data-note">Moneda no indicada en la fuente</span>
        </div>
        <div className="simple-table finance-table">
          <div className="table-row table-head">
            <span>Periodo</span><span>Cubicación</span><span>Contabilidad</span><span>Diferencia</span>
          </div>
          {cubicaciones.map((item) => (
            <div className="table-row" key={item.period}>
              <strong>{item.period}</strong>
              <span>{number.format(item.measured)}</span>
              <span>{number.format(item.accounting)}</span>
              <span>{number.format(item.accounting - item.measured)}</span>
            </div>
          ))}
          <div className="table-row total-row">
            <strong>Total</strong>
            <span>{number.format(projectSnapshot.cubicacionesMeasured)}</span>
            <span>{number.format(projectSnapshot.cubicacionesAccounting)}</span>
            <span>{number.format(projectSnapshot.cubicacionesDifference)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourcesView() {
  return (
    <div className="view-stack">
      <section className="panel data-center-intro">
        <div>
          <span className="section-kicker">GRUPO BRICKET · REPOSITORIO DOCUMENTAL</span>
          <h2>Centro de datos del proyecto ARAYA</h2>
          <p>Fuentes de avance, cronogramas y documentación técnica centralizadas para consulta y control.</p>
        </div>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Fuentes integradas" value={`${dataSources.length}`} detail="1 Excel · 1 Microsoft Project · 1 DWG" />
        <StatCard eyebrow="Registros MPP" value="2.228" detail="2.195 asignaciones y 22 paquetes" />
        <StatCard eyebrow="Alertas de calidad" value="4" detail="Todas visibles y sin corrección silenciosa" tone="warn" />
        <StatCard eyebrow="Corte declarado" value="30/06/2026" detail="Fecha tomada de los archivos" />
      </section>
      <section className="source-grid">
        {dataSources.map((source) => (
          <article className="panel source-card" key={source.id}>
            <div className="panel-heading">
              <div><span className="section-kicker">{source.kind}</span><h3>{source.file}</h3></div>
              <span className={`source-status ${source.status}`}>{source.status}</span>
            </div>
            <div className="source-meta">
              <span>Corte declarado<strong>{source.declaredCutoff}</strong></span>
              <span>Guardado<strong>{source.savedAt}</strong></span>
              <span>Contenido<strong>{source.records}</strong></span>
            </div>
            <ul className="quality-list">
              {source.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
            {source.downloadUrl && (
              <div className="source-actions">
                <a className="button secondary" href={source.downloadUrl} download={source.file}>
                  Descargar archivo DWG
                </a>
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">CRITERIOS DE GOBIERNO DEL DATO</span><h3>Cómo se interpreta este corte</h3></div>
        </div>
        <div className="governance-grid">
          <div><strong>Avance físico</strong><p>Excel es la fuente del 18,23% ejecutado y 21,24% planificado.</p></div>
          <div><strong>Avance de cronograma</strong><p>MPP es la fuente del 17%, fechas, actividades y camino crítico.</p></div>
          <div><strong>Edificios</strong><p>El índice mostrado promedia 32 frentes por edificio; no sustituye una ponderación económica.</p></div>
          <div><strong>Viviendas</strong><p>El porcentaje disponible corresponde sólo a superestructura, no a terminación total.</p></div>
        </div>
      </section>
    </div>
  );
}

function AgentPanel({ expanded, onClose }: { expanded: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Buenos días. Puedo consultar el corte real: avance, desviaciones, implantación general, 26 edificios, 156 viviendas, urbanismo, paquetes, cubicaciones y calidad de fuentes. ¿Qué necesitas saber?",
      mode: "source-data-engine",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string; mode?: string };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.answer ?? payload.error ?? "No he podido resolver la consulta.",
          mode: payload.mode,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: "No puedo conectar con los datos ahora. Vuelve a intentarlo en unos segundos." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <aside className={`agent-panel ${expanded ? "expanded" : ""}`}>
      <div className="agent-header">
        <div className="agent-mark">AI</div>
        <div><strong>ARAYA Copilot</strong><span><i /> Consulta de datos · solo lectura</span></div>
        {!expanded && <button className="close-button" onClick={onClose} aria-label="Cerrar agente">×</button>}
      </div>
      <div className="agent-suggestions">
        {[
          "Resume el corte para Dirección",
          "¿Qué paquete tiene mayor desviación?",
          "¿Qué problemas tienen las fuentes?",
          "¿Cuál es la diferencia de cubicaciones?",
        ].map((suggestion) => (
          <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>
        ))}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <div>{message.text}</div>
            {message.role === "assistant" && (
              <small>{message.mode === "openai-tools" ? "IA + herramientas" : "Motor de datos de fuentes"}</small>
            )}
          </div>
        ))}
        {loading && <div className="message assistant typing">Consultando datos…</div>}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregunta por cualquier dato del corte…" rows={2} />
        <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar pregunta">↑</button>
      </form>
      <div className="agent-foot">Cada respuesta indica la fuente y el corte usado.</div>
    </aside>
  );
}

function RecordModal({
  type,
  onClose,
  onSaveMetric,
  onSaveSupplier,
}: {
  type: "metric" | "supplier";
  onClose: () => void;
  onSaveMetric: (metric: CustomMetric) => void;
  onSaveSupplier: (supplier: Supplier) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    let saved = false;
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: type, ...payload }),
      });
      if (response.ok) {
        const data = await response.json();
        if (type === "metric" && data.metric) onSaveMetric(data.metric);
        if (type === "supplier" && data.supplier) onSaveSupplier(data.supplier);
        saved = true;
      }
    } catch {
      saved = false;
    }
    if (!saved && type === "metric") {
      onSaveMetric({
        id: crypto.randomUUID(),
        name: String(payload.name),
        value: String(payload.value),
        target: String(payload.target),
        unit: String(payload.unit),
        owner: String(payload.owner),
        trend: "flat",
      });
    }
    if (!saved && type === "supplier") {
      onSaveSupplier({
        id: crypto.randomUUID(),
        name: String(payload.name),
        category: String(payload.category),
        contact: String(payload.contact),
        status: "revision",
        score: 80,
        nextDelivery: String(payload.nextDelivery),
        amount: String(payload.amount),
      });
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="section-kicker">NUEVO REGISTRO</span><h3>{type === "metric" ? "Añadir métrica" : "Añadir proveedor"}</h3></div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          {type === "metric" ? (
            <>
              <label>Nombre<input name="name" required placeholder="Ej. Consumo de hormigón" /></label>
              <div className="form-grid">
                <label>Valor<input name="value" required placeholder="48" /></label>
                <label>Objetivo<input name="target" required placeholder="52" /></label>
              </div>
              <div className="form-grid">
                <label>Unidad<input name="unit" placeholder="%, días, cantidad…" /></label>
                <label>Responsable<input name="owner" placeholder="Producción" /></label>
              </div>
            </>
          ) : (
            <>
              <label>Empresa<input name="name" required placeholder="Nombre del proveedor" /></label>
              <label>Categoría<input name="category" required placeholder="Estructura, instalaciones…" /></label>
              <label>Contacto<input name="contact" placeholder="Nombre y apellidos" /></label>
              <div className="form-grid">
                <label>Próxima entrega<input name="nextDelivery" placeholder="Fecha y hora" /></label>
                <label>Importe contratado<input name="amount" placeholder="Importe y moneda" /></label>
              </div>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const demoBuildings = [
  54, 51, 48, 45, 43, 41, 38, 36, 34, 31, 28, 25, 19, 12,
].map((progress, index) => ({
  id: index + 1,
  code: `MP-${String(index + 1).padStart(2, "0")}`,
  progress,
  units: 6,
  status: progress >= 45 ? "En curso" : progress >= 25 ? "Preparado" : "Pendiente",
}));

const demoUrbanism = [
  { name: "Vial principal y accesos", progress: 42, planned: 46, owner: "Infraestructura" },
  { name: "Redes de abastecimiento", progress: 37, planned: 40, owner: "Instalaciones" },
  { name: "Parque central", progress: 24, planned: 28, owner: "Paisajismo" },
  { name: "Aparcamientos exteriores", progress: 31, planned: 35, owner: "Urbanización" },
];

const demoMilestones = [
  { date: "15 jul 2026", title: "Cierre del corte quincenal", detail: "Avance consolidado de estructura y urbanización.", type: "Corte" },
  { date: "29 jul 2026", title: "Inicio de fachadas MP-01 a MP-04", detail: "Hito previsto; pendiente de validación de producción.", type: "Hito" },
  { date: "12 ago 2026", title: "Prueba de la red de abastecimiento", detail: "Ensayo de presión del primer sector.", type: "Control" },
  { date: "30 nov 2027", title: "Fin contractual", detail: "Fecha base usada en esta simulación.", type: "Entrega" },
];

function DemoMasterplan() {
  const [selected, setSelected] = useState(demoBuildings[0]);
  return (
    <section className="panel demo-plan-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">IMPLANTACIÓN INTERACTIVA · DEMOSTRACIÓN</span>
          <h3>Mirador del Parque</h3>
        </div>
        <span className="data-note">Selecciona un edificio</span>
      </div>
      <div className="demo-plan-layout">
        <div className="demo-masterplan" aria-label="Plano esquemático de Mirador del Parque">
          <div className="demo-green demo-green-one">PARQUE CENTRAL</div>
          <div className="demo-green demo-green-two">JARDINES</div>
          <div className="demo-road demo-road-main">VIAL PRINCIPAL</div>
          <div className="demo-road demo-road-cross">ACCESO</div>
          {demoBuildings.map((building) => (
            <button
              key={building.id}
              className={`demo-building demo-building-${building.id} ${selected.id === building.id ? "selected" : ""}`}
              onClick={() => setSelected(building)}
              aria-label={`Abrir ${building.code}`}
            >
              <strong>{building.code}</strong>
              <span>{building.progress}%</span>
            </button>
          ))}
        </div>
        <aside className="demo-plan-detail">
          <span className="section-kicker">EDIFICIO SELECCIONADO</span>
          <h3>{selected.code}</h3>
          <strong className="demo-detail-progress">{selected.progress}%</strong>
          <p>Índice sintético de avance para mostrar el funcionamiento del segundo proyecto.</p>
          <div className="picker-summary">
            <span>Viviendas<strong>{selected.units}</strong></span>
            <span>Estado<strong>{selected.status}</strong></span>
            <span>Uso<strong>Residencial</strong></span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DemoOverview({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <div className="view-stack">
      <section className="demo-notice">
        <strong>Proyecto ficticio de demostración.</strong>
        <span>Todos los nombres, cifras y documentos de Mirador del Parque son simulados.</span>
      </section>
      <section className="hero-grid">
        <article className="project-pulse panel demo-pulse">
          <div>
            <div className="section-kicker">CORTE SIMULADO 15/07/2026</div>
            <h2>La promoción avanza al 36,8%, con una desviación de 2,7 puntos.</h2>
            <p>
              La estructura de los primeros cuatro edificios concentra el avance.
              Urbanización y fachadas son los siguientes frentes de control.
            </p>
            <div className="project-meta">
              <span>Fin base · 30 nov 2027</span>
              <span>Fin previsto · 12 dic 2027</span>
            </div>
          </div>
          <ProgressRing value={36.8} />
        </article>
        <div className="stat-grid">
          <StatCard eyebrow="Plan simulado" value="39,5%" detail="-2,7 pp de brecha física" tone="warn" />
          <StatCard eyebrow="Alcance residencial" value="14 edificios" detail="84 viviendas · 6 por edificio" />
          <StatCard eyebrow="Urbanización" value="33,5%" detail="4 áreas activas" />
          <StatCard eyebrow="Previsión final" value="+12 días" detail="12/12/2027 frente a línea base" tone="danger" />
        </div>
      </section>
      <DemoMasterplan />
      <section className="dashboard-grid">
        <article className="panel attention-card">
          <div className="panel-heading">
            <div><span className="section-kicker">CONTROL DE DIRECCIÓN</span><h3>Prioridades simuladas</h3></div>
            <span className="count-badge">3</span>
          </div>
          <button className="attention-item" onClick={() => onNavigate("planificacion")}>
            <span className="severity critical">PLAZO</span><strong>Fachadas acumulan 8 días de demora</strong><small>Revisar secuencia MP-01 a MP-04</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("urbanismo")}>
            <span className="severity medium">URBANISMO</span><strong>Parque central por debajo del plan</strong><small>24% real frente a 28% previsto</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("proveedores")}>
            <span className="severity low">SUMINISTRO</span><strong>Confirmar entrega de carpinterías</strong><small>Fecha simulada · 29/07/2026</small>
          </button>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div><span className="section-kicker">PROGRESO POR FASE</span><h3>Situación del proyecto</h3></div>
          </div>
          <div className="demo-progress-list">
            {[
              ["Estructura", 58],
              ["Fachadas", 26],
              ["Instalaciones", 19],
              ["Urbanización", 33.5],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span><strong>{label}</strong><b>{value}%</b></span>
                <i><em style={{ width: `${value}%` }} /></i>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function DemoProjectContent({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  if (view === "resumen") return <DemoOverview onNavigate={onNavigate} />;
  if (view === "implantacion") return <div className="view-stack"><section className="demo-notice"><strong>Plano esquemático de demostración.</strong><span>No corresponde a una promoción real.</span></section><DemoMasterplan /></div>;

  if (view === "planificacion") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Planificación simulada.</strong><span>Datos creados únicamente para probar el cambio entre proyectos.</span></section>
        <section className="stat-grid wide">
          <StatCard eyebrow="Avance físico" value="36,8%" detail="Plan simulado 39,5%" tone="warn" />
          <StatCard eyebrow="Fin previsto" value="12 dic 2027" detail="+12 días frente a base" tone="danger" />
          <StatCard eyebrow="Fases activas" value="4" detail="Estructura, fachadas, instalaciones y urbanismo" />
          <StatCard eyebrow="Hitos próximos" value="3" detail="Dentro de los próximos 30 días" />
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">CRONOGRAMA DEMO</span><h3>Fases principales</h3></div></div>
          <div className="simple-table demo-table">
            <div className="table-row table-head"><span>Fase</span><span>Avance</span><span>Fin previsto</span><span>Desviación</span></div>
            {[
              ["Estructura", "58%", "18/12/2026", "+3 días"],
              ["Fachadas", "26%", "28/04/2027", "+8 días"],
              ["Instalaciones", "19%", "16/07/2027", "+5 días"],
              ["Urbanización", "33,5%", "30/09/2027", "+4 días"],
            ].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span key={cell}>{cell}</span>)}</div>)}
          </div>
        </section>
      </div>
    );
  }

  if (view === "edificios") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Edificios de demostración.</strong><span>14 bloques residenciales simulados.</span></section>
        <section className="demo-building-grid">
          {demoBuildings.map((building) => (
            <article className="panel demo-building-card" key={building.id}>
              <span className="section-kicker">{building.status}</span>
              <h3>{building.code}</h3>
              <strong>{building.progress}%</strong>
              <div className="demo-card-track"><i style={{ width: `${building.progress}%` }} /></div>
              <small>{building.units} viviendas · dato simulado</small>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (view === "viviendas") {
    return (
      <div className="view-stack">
        <section className="stat-grid wide">
          <StatCard eyebrow="Viviendas totales" value="84" detail="14 edificios · 6 por edificio" />
          <StatCard eyebrow="En ejecución" value="36" detail="Estructura o cerramientos" />
          <StatCard eyebrow="Preparadas" value="30" detail="Pendientes de inicio interior" />
          <StatCard eyebrow="Pendientes" value="18" detail="Sin actividad registrada" tone="warn" />
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">INVENTARIO DEMO</span><h3>Viviendas por edificio</h3></div></div>
          <div className="demo-unit-grid">
            {demoBuildings.map((building) => (
              <article key={building.id}><strong>{building.code}</strong><span>{Array.from({ length: 6 }, (_, index) => <i key={index} title={`${building.code}-${index + 1}`} className={index < Math.ceil(building.progress / 17) ? "active" : ""} />)}</span><small>6 viviendas · {building.progress}%</small></article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (view === "urbanismo") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Urbanismo simulado.</strong><span>Cuatro áreas configuradas para la demostración.</span></section>
        <section className="demo-urban-grid">
          {demoUrbanism.map((area) => (
            <article className="panel" key={area.name}>
              <span className="section-kicker">{area.owner}</span><h3>{area.name}</h3>
              <strong className="demo-detail-progress">{area.progress}%</strong>
              <div className="demo-card-track"><i style={{ width: `${area.progress}%` }} /></div>
              <small>Plan {area.planned}% · Brecha {number.format(area.progress - area.planned)} pp</small>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (view === "cronologia") {
    return (
      <section className="panel timeline-panel">
        <div className="panel-heading"><div><span className="section-kicker">TRAZABILIDAD DEMO</span><h3>Hitos y controles simulados</h3></div></div>
        <div className="timeline">
          {demoMilestones.map((event) => (
            <article className="timeline-event" key={event.title}>
              <div className="timeline-marker hito" /><div className="timeline-date"><strong>{event.date}</strong><span>Demo</span></div>
              <div className="timeline-copy"><span className="event-type">{event.type}</span><h4>{event.title}</h4><p>{event.detail}</p><small>Mirador del Parque · Sistema</small></div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (view === "proveedores") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Proveedores ficticios.</strong><span>No representan empresas reales ni contratos existentes.</span></section>
        <section className="supplier-grid">
          {[
            ["Hormigones Central", "Estructura", "22/07/2026", "En plazo"],
            ["Aluminios Horizonte", "Carpinterías", "29/07/2026", "Revisión"],
            ["Jardines del Este", "Paisajismo", "12/08/2026", "En plazo"],
          ].map((supplier) => (
            <article className="supplier-card panel" key={supplier[0]}>
              <div className="supplier-head"><div className="supplier-logo">{supplier[0].slice(0, 2).toUpperCase()}</div><div><strong>{supplier[0]}</strong><span>{supplier[1]}</span></div></div>
              <div className="supplier-details"><span>Próxima entrega<strong>{supplier[2]}</strong></span><span>Estado<strong>{supplier[3]}</strong></span><span>Origen<strong>Dato demo</strong></span></div>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (view === "metricas") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Métricas simuladas.</strong><span>No deben utilizarse para decisiones económicas o contractuales.</span></section>
        <section className="metric-grid">
          {[
            ["Avance físico", "36,8", "%", "39,5"],
            ["Desviación de plazo", "12", "días", "0"],
            ["Viviendas activas", "36", "ud.", "42"],
            ["Urbanización", "33,5", "%", "37"],
          ].map((metric) => (
            <article className="metric-card panel" key={metric[0]}><div className="metric-card-head"><span>MIRADOR · DEMO</span></div><h4>{metric[0]}</h4><strong>{metric[1]} <small>{metric[2]}</small></strong><div className="metric-target"><span>Referencia {metric[3]} {metric[2]}</span></div></article>
          ))}
        </section>
      </div>
    );
  }

  if (view === "fuentes") {
    return (
      <div className="view-stack">
        <section className="demo-notice"><strong>Centro de datos ficticio.</strong><span>Los documentos siguientes son referencias visuales y no existen como archivos descargables.</span></section>
        <section className="source-grid">
          {[
            ["XLSX", "Avance_Mirador_Demo.xlsx", "15/07/2026", "168 registros simulados"],
            ["MPP", "Plan_Maestro_Mirador_Demo.mpp", "14/07/2026", "642 tareas simuladas"],
            ["PDF", "Implantacion_Mirador_Demo.pdf", "10/07/2026", "Plano conceptual"],
          ].map((source) => (
            <article className="panel source-card" key={source[1]}><div className="panel-heading"><div><span className="section-kicker">{source[0]}</span><h3>{source[1]}</h3></div><span className="source-status">DEMO</span></div><div className="source-meta"><span>Corte<strong>{source[2]}</strong></span><span>Contenido<strong>{source[3]}</strong></span><span>Estado<strong>Simulado</strong></span></div></article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <section className="panel empty-state">
      <strong>El agente IA permanece vinculado únicamente a los datos reales de ARAYA.</strong>
      <p>Cambia a ARAYA desde el selector de proyecto para realizar consultas documentales.</p>
    </section>
  );
}

export function DashboardClient() {
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>("araya");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [view, setView] = useState<View>("resumen");
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]);
  const [metrics, setMetrics] = useState<CustomMetric[]>(initialMetrics);
  const [supplierRows, setSupplierRows] = useState<Supplier[]>(initialSuppliers);
  const [agentOpen, setAgentOpen] = useState(true);
  const [modal, setModal] = useState<"metric" | "supplier" | null>(null);
  const [search, setSearch] = useState("");
  const activeProject = projects[activeProjectId];

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.metrics) && data.metrics.length) {
          setMetrics((current) => [...data.metrics, ...current]);
        }
        if (Array.isArray(data.suppliers) && data.suppliers.length) {
          setSupplierRows((current) => [...data.suppliers, ...current]);
        }
      })
      .catch(() => undefined);
  }, []);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    if (activeProjectId === "mirador") {
      return demoBuildings
        .filter((item) => item.code.toLowerCase().includes(term))
        .map((item) => ({
          label: item.code,
          detail: `${item.progress}% de avance · ${item.units} viviendas · demo`,
          view: "edificios" as View,
          building: null,
        }))
        .slice(0, 8);
    }
    return [
      ...buildings
        .filter((item) => item.name.toLowerCase().includes(term) || item.shortName === term)
        .map((item) => ({ label: item.name, detail: `${number.format(item.progress)}% índice de frentes`, view: "edificios" as View, building: item })),
      ...buildings.flatMap((building) =>
        building.units
          .filter((unit) => unit.code.toLowerCase().includes(term))
          .map((unit) => ({ label: unit.code, detail: `${building.name} · ${unit.progress}% superestructura`, view: "viviendas" as View, building })),
      ),
      ...urbanismAreas
        .filter((item) => item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: item.category, view: "urbanismo" as View, building: null })),
      ...supplierRows
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: item.category, view: "proveedores" as View, building: null })),
      ...metrics
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: `${item.value} ${item.unit}`, view: "metricas" as View, building: null })),
    ].slice(0, 8);
  }, [activeProjectId, search, supplierRows, metrics]);

  function content() {
    if (activeProjectId === "mirador") return <DemoProjectContent view={view} onNavigate={setView} />;
    if (view === "resumen") return <Overview onNavigate={setView} onSelectBuilding={setSelectedBuilding} />;
    if (view === "planificacion") return <Planning />;
    if (view === "implantacion") return <div className="view-stack"><SitePlan onNavigate={setView} onSelectBuilding={setSelectedBuilding} /></div>;
    if (view === "edificios") return <BuildingsView selected={selectedBuilding} setSelected={setSelectedBuilding} />;
    if (view === "viviendas") return <HousingView />;
    if (view === "urbanismo") return <UrbanismView />;
    if (view === "cronologia") return <TimelineView />;
    if (view === "proveedores") return <SuppliersView suppliers={supplierRows} onAdd={() => setModal("supplier")} />;
    if (view === "metricas") return <MetricsView metrics={metrics} onAdd={() => setModal("metric")} />;
    if (view === "fuentes") return <SourcesView />;
    return <AgentPanel expanded onClose={() => setView("resumen")} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/bricket-mark.png" alt="" />
          </div>
          <div><strong>BRICKET</strong><span>Centro de Control</span></div>
        </div>
        <div className="project-selector">
          <span>PROYECTO ACTIVO</span>
          <button
            className="project-selector-trigger"
            onClick={() => setProjectMenuOpen((open) => !open)}
            aria-expanded={projectMenuOpen}
            aria-haspopup="listbox"
          >
            <b>{activeProject.code}</b>
            <div>
              <strong>{activeProject.name}</strong>
              <small>{activeProject.summary}</small>
            </div>
            <i>{projectMenuOpen ? "⌃" : "⌄"}</i>
          </button>
          {projectMenuOpen && (
            <div className="project-menu" role="listbox" aria-label="Seleccionar proyecto activo">
              {(Object.values(projects) as Array<(typeof projects)[ProjectId]>).map((project) => (
                <button
                  key={project.id}
                  className={activeProjectId === project.id ? "selected" : ""}
                  role="option"
                  aria-selected={activeProjectId === project.id}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setProjectMenuOpen(false);
                    setView("resumen");
                    setSearch("");
                    setModal(null);
                    setAgentOpen(project.id === "araya");
                  }}
                >
                  <b>{project.code}</b>
                  <div>
                    <strong>{project.name}</strong>
                    <small>{project.demo ? "Proyecto ficticio · demostración" : project.summary}</small>
                  </div>
                  <i>{activeProjectId === project.id ? "✓" : ""}</i>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav>
          <span className="nav-label">NAVEGACIÓN</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                if (item.id === "agente") setAgentOpen(false);
              }}
            >
              <i>{item.mark}</i><span>{item.label}</span>
              {item.id === "fuentes" && <em>{activeProjectId === "araya" ? dataSources.length : 3}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span><i className="live-dot" /> Fuentes integradas</span>
          <small>{activeProjectId === "araya" ? "Último archivo · 28/07/2026 17:26" : "Proyecto demo · datos simulados"}</small>
        </div>
      </aside>

      <main className={`main-area ${agentOpen && view !== "agente" ? "with-agent" : ""}`}>
        <Header view={view} project={activeProject} onAsk={() => setAgentOpen(true)} />
        <div className="global-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={activeProjectId === "araya" ? "Buscar edificio, vivienda, urbanismo, proveedor o métrica…" : "Buscar edificio demo (ej. MP-04)…"}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  key={`${result.view}-${result.label}`}
                  onClick={() => {
                    if (result.building) setSelectedBuilding(result.building);
                    setView(result.view);
                    setSearch("");
                  }}
                >
                  <strong>{result.label}</strong><span>{result.detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="content">{content()}</div>
      </main>

      {activeProjectId === "araya" && agentOpen && view !== "agente" && <AgentPanel expanded={false} onClose={() => setAgentOpen(false)} />}

      {activeProjectId === "araya" && modal && (
        <RecordModal
          type={modal}
          onClose={() => setModal(null)}
          onSaveMetric={(metric) => setMetrics((current) => [metric, ...current])}
          onSaveSupplier={(supplier) => setSupplierRows((current) => [supplier, ...current])}
        />
      )}
    </div>
  );
}
