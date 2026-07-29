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
import {
  advances,
  antonelyFinanceSource,
  arrearsBreakdown,
  constructionDisciplines,
  costBreakdown,
  cxpAging,
  cxpCategories,
  delayedUrbanismStarts,
  financialProjection,
  financingProcesses,
  juneDataQualityIssues,
  juneReport,
  managementActions,
  payablesReconciliation,
  permits,
  safetyFindings,
  safetyMetrics,
  salesLocations,
  salesModels,
  structuralDelay,
  urbanismReportAreas,
} from "./june-report-data";
import {
  antonelyAdvances,
  antonelyBalanceLines,
  antonelyCostAccounts,
  antonelyDetailTotals,
  antonelyPayableCategories,
  antonelyPayableVendorsAll,
} from "./antonely-finance-data";
import {
  CurrencyCode,
  DEFAULT_DISPLAY_CURRENCY,
  exchangeRateNote,
  formatMoney,
  formatMoneyMillions,
} from "../lib/currency";
import { UploadArea, areaLabels, uploadAreas, uploadStatusLabels } from "../lib/file-routing";
import { LiveDataMap, applyLiveValuesToTargets } from "../lib/live-data";

type View =
  | "resumen"
  | "planificacion"
  | "implantacion"
  | "edificios"
  | "viviendas"
  | "comercial"
  | "urbanismo"
  | "control"
  | "cronologia"
  | "proveedores"
  | "metricas"
  | "fuentes"
  | "agente"
  | "usuarios";

type DashboardUser = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "member";
  financeAccess: boolean;
  active: boolean;
};

type ManagedUser = DashboardUser & {
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  mode?: string;
};

type UploadedFileRecord = {
  id: string;
  originalName: string;
  area: string;
  areaLabel: string;
  section: string;
  description: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  source: "dashboard" | "agent";
  sourceCurrency: CurrencyCode;
  status: string;
  uploaderName: string;
  version: number;
  declaredCutoff: string;
  classificationConfidence: number;
  classificationReason: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};

type UploadResult = {
  duplicate?: boolean;
  message?: string;
  error?: string;
  file?: UploadedFileRecord;
};

type ProjectId = "araya" | "mirador";

type ReportFrequency = "weekly" | "monthly";

type DirectionReportPeriod = {
  frequency: ReportFrequency;
  startDate: string;
  endDate: string;
  label: string;
  generatedAt: string;
};

type LiveSyncState = {
  status: "syncing" | "connected" | "offline";
  revision: number;
  refreshedAt: string;
  latestEvent: {
    revision: number;
    sourceName: string;
    area: string;
    cutoff: string;
    changeCount: number;
    message: string;
    actorName: string;
    createdAt: string;
  } | null;
};

const liveDataTargets: Record<string, unknown> = {
  advances,
  antonelyAdvances,
  antonelyBalanceLines,
  antonelyCostAccounts,
  antonelyDetailTotals,
  antonelyFinanceSource,
  antonelyPayableCategories,
  antonelyPayableVendorsAll,
  arrearsBreakdown,
  buildings,
  constructionDisciplines,
  costBreakdown,
  cubicaciones,
  cxpAging,
  cxpCategories,
  dataSources,
  delayedUrbanismStarts,
  financialProjection,
  financingProcesses,
  juneDataQualityIssues,
  juneReport,
  managementActions,
  monthlyPlan,
  payablesReconciliation,
  permits,
  projectSnapshot,
  safetyFindings,
  safetyMetrics,
  salesLocations,
  salesModels,
  structuralDelay,
  timeline,
  urbanismAreas,
  urbanismReportAreas,
  workPackages,
};

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
    summary: "26 edificios · 156 apartamentos",
    cutoff: projectSnapshot.declaredCutoff,
    demo: false,
  },
  mirador: {
    id: "mirador",
    code: "MP",
    name: "MIRADOR DEL PARQUE",
    summary: "14 edificios · 84 apartamentos",
    cutoff: "15/07/2026",
    demo: true,
  },
};

const navItems: Array<{ id: View; label: string; mark: string }> = [
  { id: "resumen", label: "Resumen ejecutivo", mark: "01" },
  { id: "planificacion", label: "Planificación", mark: "02" },
  { id: "implantacion", label: "Implantación general", mark: "03" },
  { id: "edificios", label: "Edificios", mark: "04" },
  { id: "viviendas", label: "Apartamentos", mark: "05" },
  { id: "comercial", label: "Ventas y cobranza", mark: "06" },
  { id: "urbanismo", label: "Urbanismo", mark: "07" },
  { id: "control", label: "Seguridad y permisos", mark: "08" },
  { id: "cronologia", label: "Cronología", mark: "09" },
  { id: "proveedores", label: "Proveedores", mark: "10" },
  { id: "metricas", label: "Finanzas", mark: "11" },
  { id: "fuentes", label: "Centro de datos", mark: "12" },
  { id: "agente", label: "Agente IA", mark: "AI" },
  { id: "usuarios", label: "Usuarios y accesos", mark: "AD" },
];

const statusLabel = {
  terminada: "Terminada",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

function visualUnitStatus(unit: Unit): Unit["status"] {
  if (unit.status === "bloqueada") return "bloqueada";
  if (unit.progress >= 100) return "terminada";
  if (unit.progress > 0) return "en_curso";
  return "pendiente";
}

function synchronizeSpatialSummary() {
  projectSnapshot.buildingCount = buildings.length;
  projectSnapshot.unitCount = buildings.reduce((total, building) => total + building.units.length, 0);
  projectSnapshot.buildingsPendingIntegration = Math.max(
    0,
    projectSnapshot.masterPlanBuildingCount - buildings.length,
  );
  projectSnapshot.buildings = buildings;
  projectSnapshot.urbanismAreas = urbanismAreas;
}

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const REPORT_SOURCE_CUTOFF = "2026-06-30";

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function monthReportPeriod(value: string): DirectionReportPeriod {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1, 12));
  return {
    frequency: "monthly",
    startDate: `${value}-01`,
    endDate: `${value}-${String(lastDay).padStart(2, "0")}`,
    label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    generatedAt: new Date().toISOString(),
  };
}

function weeklyReportPeriod(startDate: string, endDate: string): DirectionReportPeriod {
  return {
    frequency: "weekly",
    startDate,
    endDate,
    label: `${formatReportDate(startDate)} — ${formatReportDate(endDate)}`,
    generatedAt: new Date().toISOString(),
  };
}

const fileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`;
  return `${number.format(bytes / (1024 * 1024))} MB`;
};

function financialQualityIssues(currency: CurrencyCode) {
  const dop = (value: number) => formatMoney(value, "DOP", currency);
  const usdValue = (value: number) => formatMoney(value, "USD", currency);
  return juneDataQualityIssues.map((issue) => {
    if (issue.title === "Presupuesto total") {
      return { ...issue, detail: `La lámina 29 muestra ${formatMoneyMillions(3428500000, "DOP", currency)}; el Excel y la lámina 30 muestran ${formatMoneyMillions(3591280577.17, "DOP", currency)}. Se usa el Excel como control detallado.` };
    }
    if (issue.title === "Cuentas por pagar") {
      return { ...issue, detail: `La relación consolidada suma ${dop(18597489.63)}; el balance, ${dop(18612245.9)}; y el detalle de Antonely, ${dop(18627534.91)}. Se mantienen las tres cifras para conciliación.` };
    }
    if (issue.title === "Morosidad") {
      return { ...issue, detail: `El desglose suma ${usdValue(136840.44)}, cinco centavos de dólar más que el total declarado de ${usdValue(136840.39)}.` };
    }
    if (issue.title === "Versión comercial") {
      return { ...issue, detail: `El informe de ventas aislado conserva una lámina anterior de 31 clientes y ${usdValue(148281.58)}; prevalece el consolidado actualizado al 06/07/2026.` };
    }
    if (issue.title === "Costes · fuente Antonely") {
      return { ...issue, detail: `Antonely registra ${dop(48988755.86)} en junio y ${dop(712326161.73)} acumulados; el consolidado registra ${dop(48998910.52)} y ${dop(712326162.73)}. Diferencias: ${dop(10154.66)} y ${dop(1)}.` };
    }
    if (issue.title === "Anticipos · balance frente a detalle") {
      return { ...issue, detail: `El balance registra ${dop(9210448.94)} y el detalle de 26 anticipos suma ${dop(9210448.86)}. La diferencia de ${dop(0.08)} queda abierta para conciliación.` };
    }
    return issue;
  });
}

const defaultUploadArea: Record<View, UploadArea> = {
  resumen: "auto",
  planificacion: "planificacion",
  implantacion: "diseno",
  edificios: "obra",
  viviendas: "obra",
  comercial: "comercial",
  urbanismo: "urbanismo",
  control: "seguridad",
  cronologia: "planificacion",
  proveedores: "compras",
  metricas: "finanzas",
  fuentes: "auto",
  agente: "auto",
  usuarios: "direccion",
};

async function uploadProjectFile(
  file: File,
  input: {
    area: UploadArea;
    description?: string;
    declaredCutoff?: string;
    section?: string;
    source: "dashboard" | "agent";
    sourceCurrency?: CurrencyCode | "auto";
  },
) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("area", input.area);
  formData.set("description", input.description ?? "");
  formData.set("declaredCutoff", input.declaredCutoff ?? "");
  formData.set("section", input.section ?? "");
  formData.set("source", input.source);
  formData.set("sourceCurrency", input.sourceCurrency ?? "auto");
  const response = await fetch("/api/files", { method: "POST", body: formData });
  const result = (await response.json()) as UploadResult;
  if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el archivo.");
  window.dispatchEvent(new CustomEvent("araya-files-updated"));
  return result;
}

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
  onUpload,
  onReport,
  project,
  currency,
  onCurrencyChange,
  liveSync,
  currentUser,
  canAccessFinance,
}: {
  view: View;
  onAsk: () => void;
  onUpload: () => void;
  onReport: () => void;
  project: (typeof projects)[ProjectId];
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  liveSync: LiveSyncState;
  currentUser: DashboardUser;
  canAccessFinance: boolean;
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
        {!project.demo && (
          <div className="currency-control" title={exchangeRateNote(currency)}>
            <span>Moneda</span>
            <div role="group" aria-label="Moneda de visualización">
              {(["USD", "DOP"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  className={currency === code ? "active" : ""}
                  aria-pressed={currency === code}
                  onClick={() => onCurrencyChange(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className={`live-state live-sync ${project.demo ? "demo" : liveSync.status}`}
          title={
            project.demo
              ? `Corte documental ${project.cutoff}`
              : liveSync.latestEvent?.message ?? "Sincronización automática de todas las cifras y gráficas"
          }
        >
          <span className="live-dot" />
          {project.demo
            ? `Corte documental · ${project.cutoff}`
            : liveSync.status === "connected"
              ? `Tiempo real · v${liveSync.revision || "base"} · 5 s`
              : liveSync.status === "syncing"
                ? "Sincronizando datos…"
                : "Reconectando datos…"}
        </div>
        <button className="button secondary" onClick={onAsk} disabled={project.demo}>
          Preguntar al agente
        </button>
        <button className="button report-button" onClick={onReport} disabled={project.demo || !canAccessFinance} title={!canAccessFinance ? "Requiere acceso financiero" : undefined}>
          Crear informe
        </button>
        <button className="button primary" onClick={onUpload} disabled={project.demo}>
          + Cargar archivo
        </button>
        <div className="account-control">
          <div>
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.role === "admin" ? "Administrador" : "Usuario autorizado"}</span>
          </div>
          <a className="avatar" aria-label="Cerrar sesión" title="Cerrar sesión" href="/signout-with-chatgpt?return_to=/">
            {currentUser.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BR"}
          </a>
        </div>
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
  const height = 410;
  const plotTop = 22;
  const plotBottom = 292;
  const sidePadding = 70;
  const xFor = (index: number) =>
    sidePadding + (index * (width - sidePadding * 2)) / (monthlyPlan.length - 1);
  const yFor = (value: number) =>
    plotBottom - (value / 100) * (plotBottom - plotTop);
  const monthLabel = (index: number) => {
    const date = new Date(2025, 5 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
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
    <div className="s-curve">
      <div className="s-curve-heading">
        <h3>Curva S — Plan vs. Ejecutado</h3>
        <p>Avance físico acumulado del proyecto (% del monto total) · jun-2025 a ago-2027</p>
      </div>
      <div className="s-curve-plot">
        <div className="chart-scroll">
          <svg
            className="line-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Curva S mensual del plan operativo y la ejecución real desde junio de 2025 hasta agosto de 2027"
          >
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
              <g key={value}>
                <line
                  className="line-chart-grid"
                  x1={sidePadding}
                  x2={width - sidePadding}
                  y1={yFor(value)}
                  y2={yFor(value)}
                />
                <text className="line-chart-axis" x={sidePadding - 17} y={yFor(value) + 4}>
                  {value}
                </text>
              </g>
            ))}
            <line className="line-chart-y-axis" x1={sidePadding} x2={sidePadding} y1={plotTop} y2={plotBottom} />
            <text className="line-chart-y-title" transform={`translate(18 ${plotTop + (plotBottom - plotTop) / 2}) rotate(-90)`}>
              % acumulado
            </text>
            <polyline className="progress-line planned" points={plannedPoints} />
            <polyline className="progress-line actual" points={actualPoints} />
            {monthlyPlan.map((point, index) => (
              <g key={`${point.month}-${index}`}>
                <circle
                  className="progress-point planned"
                  cx={xFor(index)}
                  cy={yFor(point.planned)}
                  r="3.6"
                >
                  <title>{`${monthLabel(index)} · Plan operativo ${number.format(point.planned)}%`}</title>
                </circle>
                {point.planned > 0 && (
                  <text className="line-chart-value planned" x={xFor(index)} y={Math.max(plotTop - 3, yFor(point.planned) - 11)}>
                    {number.format(point.planned)}
                  </text>
                )}
                {point.actual !== null && (
                  <>
                    <circle
                      className="progress-point actual"
                      cx={xFor(index)}
                      cy={yFor(point.actual)}
                      r="3.8"
                    >
                      <title>{`${monthLabel(index)} · Ejecutado real ${number.format(point.actual)}%`}</title>
                    </circle>
                    {point.actual > 0 && (
                      <text className="line-chart-value actual" x={xFor(index)} y={Math.min(plotBottom + 21, yFor(point.actual) + 18)}>
                        {number.format(point.actual)}
                      </text>
                    )}
                  </>
                )}
                <line className="line-chart-tick" x1={xFor(index)} x2={xFor(index)} y1={plotBottom} y2={plotBottom + 6} />
                <text
                  className="line-chart-month"
                  x={xFor(index)}
                  y={plotBottom + 22}
                  transform={`rotate(42 ${xFor(index)} ${plotBottom + 22})`}
                >
                  {monthLabel(index)}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="chart-legend">
          <span><i className="legend plan" />Plan Operativo</span>
          <span><i className="legend actual" />Ejecutado Real</span>
        </div>
      </div>
      <div className="s-curve-insight">
        <strong>Al corte (jun-2026):</strong>
        <span>Ejecutado 18,23% vs. Plan 21,24% → brecha de 3,0 puntos porcentuales. El plan proyecta cierre en agosto-2027; sin corrección, la brecha actual se traduce en un desplazamiento equivalente en el cierre.</span>
      </div>
    </div>
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
  const allUnits = buildings.flatMap((item) => item.units);
  const completed = allUnits.filter((unit) => visualUnitStatus(unit) === "terminada").length;
  const active = allUnits.filter((unit) => visualUnitStatus(unit) === "en_curso").length;
  const pending = allUnits.filter((unit) => ["pendiente", "bloqueada"].includes(visualUnitStatus(unit))).length;

  return (
    <section className="panel site-plan-panel">
      <div className="panel-heading site-plan-heading">
        <div>
          <span className="section-kicker">IMPLANTACIÓN GENERAL · DWG 002</span>
          <h3>Edificios, apartamentos y urbanismo</h3>
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
        <span><strong>{projectSnapshot.unitCount}</strong> apartamentos en seguimiento</span>
        <span><strong>{projectSnapshot.buildingsPendingIntegration}</strong> TH pendientes de integrar</span>
      </div>
      <div className="plan-quick-actions" aria-label="Explorar datos de la implantación">
        <button onClick={() => onNavigate("edificios")}><span>EDIFICIOS</span><strong>Ver conjunto y detalle</strong><i>→</i></button>
        <button onClick={() => onNavigate("viviendas")}><span>APARTAMENTOS</span><strong>Abrir {allUnits.length} fichas</strong><i>→</i></button>
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
        activas las capas de edificios, apartamentos y urbanismo. Están integrados los
        {buildings.length} edificios y {allUnits.length} apartamentos del modelo vivo.
        Los porcentajes, estados y colores cambian con cada nueva revisión.
      </p>
      <div className={`site-plan-image-wrap ${planMode}`}>
        <img
          className="site-plan-image"
          src={planMode === "visual" ? "/araya-visual-masterplan-v3.png" : "/araya-site-plan-clean.png"}
          alt={
            planMode === "visual"
              ? "Implantación visual de ARAYA con edificios, apartamentos, viales, estacionamientos y urbanismo"
              : "Plano técnico de la implantación general de ARAYA"
          }
          width={1200}
          height={1958}
          loading="eager"
        />
        <>
            {buildings.map((building) => {
              const point =
                building.mapCoordinates?.[planMode] ??
                (planMode === "visual"
                  ? visualPlanCoordinates[building.shortName]
                  : planCoordinates[building.shortName]);
              if (!point) return null;
              const buildingVisualStatus =
                building.progress >= 100 ? "done" : building.progress > 0 ? "active" : "pending";
              return (
                <div
                  key={building.id}
                  className="plan-building-hotspot"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <button
                    className={`plan-building-trigger ${buildingVisualStatus}`}
                    title={`Abrir TH-${building.shortName.padStart(2, "0")} · ${number.format(building.progress)}%`}
                    onClick={() => {
                      setSelectedUnit(null);
                      setSelectedUrbanism(null);
                      setPlanBuilding(building);
                    }}
                  >
                    TH-{building.shortName.padStart(2, "0")}
                  </button>
                  <div className="plan-home-statuses" aria-label={`Apartamentos de TH-${building.shortName.padStart(2, "0")}`}>
                    {building.units.map((unit) => (
                      <button
                        key={unit.id}
                        className={visualUnitStatus(unit)}
                        title={`${unit.code} · ${statusLabel[visualUnitStatus(unit)]} · ${unit.progress}%`}
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
                area.mapCoordinates?.[planMode] ??
                (planMode === "visual"
                  ? visualUrbanismMapPoints[area.id]
                  : urbanismMapPoints[area.id]);
              if (!point) return null;
              return (
                <button
                  key={area.id}
                className={`urbanism-map-point ${area.status} ${area.progress !== null && area.progress >= 100 ? "complete" : ""}`}
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
          <h3>{planBuilding.name} · selecciona apartamento</h3>
          <div className="picker-summary">
            <span>Índice de frentes<strong>{number.format(planBuilding.progress)}%</strong></span>
            <span>Fin previsto<strong>{planBuilding.forecastFinish}</strong></span>
            <span>Desvío<strong>{planBuilding.deviationDays > 0 ? `+${planBuilding.deviationDays}` : planBuilding.deviationDays} días</strong></span>
          </div>
          <div className="picker-units">
            {planBuilding.units.map((unit) => (
              <button
                key={unit.id}
                className={`plan-unit ${visualUnitStatus(unit)}`}
                onClick={() => {
                  setSelectedUnit({ building: planBuilding, unit });
                  setPlanBuilding(null);
                }}
              >
                <span>Apartamento</span>
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
            <span className="section-kicker">FICHA DE APARTAMENTO</span>
            <h3>Apartamento {selectedUnit.unit.code}</h3>
          </div>
          <div className="unit-inspector-grid">
            <span>Edificio<strong>{selectedUnit.building.shortName}</strong></span>
            <span>Planta<strong>{selectedUnit.unit.floor}</strong></span>
            <span>Superestructura<strong>{selectedUnit.unit.progress}%</strong></span>
            <span>Estado<strong>{statusLabel[visualUnitStatus(selectedUnit.unit)]}</strong></span>
            <span>Índice del edificio<strong>{number.format(selectedUnit.building.progress)}%</strong></span>
            <span>Fin previsto edificio<strong>{selectedUnit.building.forecastFinish}</strong></span>
          </div>
          <p>
            El avance disponible a nivel apartamento corresponde únicamente a
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
  currency,
  canAccessFinance,
}: {
  onNavigate: (view: View) => void;
  onSelectBuilding: (building: Building) => void;
  currency: CurrencyCode;
  canAccessFinance: boolean;
}) {
  return (
    <div className="view-stack">
      <section className="hero-grid">
        <article className="project-pulse panel">
          <div>
            <div className="section-kicker">CORTE {projectSnapshot.declaredCutoff}</div>
            <h2>El avance físico está {number.format(Math.abs(projectSnapshot.deviationPoints))} puntos {projectSnapshot.deviationPoints < 0 ? "por debajo" : "por encima"} del plan.</h2>
            <p>
              El Centro de Control registra {number.format(projectSnapshot.overallProgress)}%
              ejecutado frente a {number.format(projectSnapshot.plannedProgress)}% previsto.
              El cronograma y cada ficha espacial usan la misma revisión viva.
            </p>
            <div className="project-meta">
              <span>Fin base · {projectSnapshot.baselineFinish}</span>
              <span>Fin previsto · {projectSnapshot.forecastFinish}</span>
            </div>
          </div>
          <ProgressRing value={projectSnapshot.overallProgress} />
        </article>
        <div className="stat-grid">
          <StatCard eyebrow="Plan operativo" value={`${number.format(projectSnapshot.plannedProgress)}%`} detail={`${number.format(projectSnapshot.deviationPoints)} pp de brecha física`} tone="warn" />
          <StatCard eyebrow="Cronograma MPP" value={`${number.format(projectSnapshot.scheduleProgress)}%`} detail="Indicador diferenciado del avance físico" tone="warn" />
          <StatCard eyebrow="Alcance residencial" value={`${buildings.length} edificios`} detail={`${buildings.reduce((total, building) => total + building.units.length, 0)} apartamentos en el modelo vivo`} />
          <StatCard eyebrow="Previsión final" value={`${projectSnapshot.deviationDays >= 0 ? "+" : ""}${projectSnapshot.deviationDays} días`} detail={`${projectSnapshot.forecastFinish} frente a ${projectSnapshot.baselineFinish}`} tone="danger" />
        </div>
      </section>

      <SitePlan onSelectBuilding={onSelectBuilding} onNavigate={onNavigate} />

      <section className="dashboard-grid">
        <article className="panel schedule-card">
          <ProgressChart />
          <button className="text-button s-curve-nav" onClick={() => onNavigate("planificacion")}>
            Abrir planificación
          </button>
        </article>

        <article className="panel attention-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ATENCIÓN DE DIRECCIÓN</span>
              <h3>{canAccessFinance ? 4 : 3} controles prioritarios</h3>
            </div>
            <span className="count-badge">{canAccessFinance ? 4 : 3}</span>
          </div>
          <button className="attention-item" onClick={() => onNavigate("planificacion")}>
            <span className="severity critical">PLAZO</span>
            <strong>Infraestructura proyecta +58 días</strong>
            <small>Fin 07/10/2026 · base 10/08/2026</small>
          </button>
          {canAccessFinance && (
            <button className="attention-item" onClick={() => onNavigate("metricas")}>
              <span className="severity critical">CAJA</span>
              <strong>Proyección diciembre: {formatMoneyMillions(juneReport.finance.projectedCashDecemberDop, "DOP", currency)}</strong>
              <small>Condicionada a desembolsos y nueva financiación</small>
            </button>
          )}
          <button className="attention-item" onClick={() => onNavigate("comercial")}>
            <span className="severity medium">COBRANZA</span>
            <strong>24 clientes con {formatMoney(juneReport.collections.overdueUsd, "USD", currency)} vencidos</strong>
            <small>Actualizado al 06/07/2026 · menos de 1% de morosidad</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("fuentes")}>
            <span className="severity low">CONCILIAR</span>
            <strong>{juneDataQualityIssues.length} alertas de calidad visibles</strong>
            <small>Presupuesto, plan físico, plazo, CxP, fórmulas, morosidad y versión comercial</small>
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
        <StatCard eyebrow="Avance físico" value={`${number.format(projectSnapshot.overallProgress)}%`} detail={`Plan ${number.format(projectSnapshot.plannedProgress)}% · fuente viva`} tone="warn" />
        <StatCard eyebrow="Fin previsto" value={projectSnapshot.forecastFinish} detail={`${projectSnapshot.deviationDays >= 0 ? "+" : ""}${projectSnapshot.deviationDays} días frente a base`} tone="danger" />
        <StatCard eyebrow="Paquetes" value={`${workPackages.length}`} detail="6 con avance registrado" />
        <StatCard eyebrow="Camino crítico" value={`${workPackages.filter((item) => item.critical).length} paquetes`} detail="Marcados como críticos en el MPP" tone="warn" />
      </section>
      <section className="panel schedule-card">
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
      <section className="panel">
        <div className="panel-heading"><div><span className="section-kicker">RECOMENDACIONES DEL INFORME</span><h3>Acciones de recuperación propuestas</h3></div><span className="data-note">No son compromisos confirmados</span></div>
        <div className="action-grid">
          {managementActions.map((action, index) => <article key={action}><span>{String(index + 1).padStart(2, "0")}</span><p>{action}</p></article>)}
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
      <span className="section-kicker">FICHA INDIVIDUAL DE APARTAMENTO</span>
      <h3>{unit.code}</h3>
      <div className="unit-inspector-grid">
        <span>Edificio<strong>TH-{building.shortName.padStart(2, "0")}</strong></span>
        <span>Planta<strong>{unit.floor}</strong></span>
        <span>Superestructura<strong>{unit.progress}%</strong></span>
        <span>Estado<strong>{statusLabel[visualUnitStatus(unit)]}</strong></span>
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
    (unit) => statusFilter === "todos" || visualUnitStatus(unit) === statusFilter,
  );
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">NAVEGACIÓN INTERACTIVA</span><h2>Conjunto de edificios</h2></div>
        <p>Selecciona cualquier TH para consultar sus indicadores y abre un apartamento para ver su ficha individual.</p>
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
          Pulsa un apartamento para abrir su ficha y consultar los datos ya disponibles.
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
              className={`unit-card interactive ${visualUnitStatus(unit)}`}
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
      <section className="report-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="section-kicker">CONJUNTO DE 26 EDIFICIOS</span><h3>Avance por disciplina</h3></div></div>
          <div className="rank-list compact">
            {constructionDisciplines.map((item) => (
              <div key={item.name}>
                <span><strong>{item.name}</strong></span>
                <div><i style={{ width: `${item.progress}%` }} /></div><b>{number.format(item.progress)}%</b>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="section-kicker">SUPERSTRUCTURA</span><h3>Demora proyectada por edificio</h3></div><span className="data-note">Informe de obra</span></div>
          <div className="delay-chip-grid">
            {structuralDelay.map((item) => (
              <span key={item.building} className={item.days >= 15 ? "critical" : item.days >= 8 ? "warn" : ""}>
                <strong>{item.building}</strong><b>+{item.days} d</b>
              </span>
            ))}
          </div>
          <p className="quality-note">14 edificios tienen pedidos de materiales vencidos. Carpintería, ventanas y piezas sanitarias permanecen en 0% en los 26 edificios.</p>
        </article>
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
    .filter(({ unit }) => statusFilter === "todos" || visualUnitStatus(unit) === statusFilter);
  const totalUnits = buildings.reduce((total, building) => total + building.units.length, 0);
  const unitsPerBuilding = buildings.length ? number.format(totalUnits / buildings.length) : "0";

  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">{totalUnits} FICHAS VIVAS</span><h2>Apartamentos individuales</h2></div>
        <p>Cada apartamento se crea o actualiza desde el modelo vivo. Su porcentaje determina automáticamente el estado y el color, salvo que exista un bloqueo explícito.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Apartamentos integrados" value={`${totalUnits}`} detail={`${unitsPerBuilding} de media por edificio`} />
        <StatCard eyebrow="Edificios relacionados" value={`${buildings.length}`} detail="Inventario generado desde datos vivos" />
        <StatCard eyebrow="Dato disponible" value="Superestructura" detail="Avance y estado por apartamento" tone="good" />
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
          <span className="result-count">{unitRows.length} apartamentos visibles</span>
        </div>
        <div className="housing-grid">
          {unitRows.map(({ building, unit }) => (
            <button
              className={`housing-card ${visualUnitStatus(unit)}`}
              key={unit.id}
              onClick={() => setSelectedUnit({ building, unit })}
            >
              <span>TH-{building.shortName.padStart(2, "0")} · PLANTA {unit.floor}</span>
              <strong>{unit.code}</strong>
              <div><i style={{ width: `${unit.progress}%` }} /></div>
              <small>{statusLabel[visualUnitStatus(unit)]} · {unit.progress}%</small>
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

function CommercialView({ currency }: { currency: CurrencyCode }) {
  const [section, setSection] = useState<"reservas" | "vinculacion" | "cobranza">("reservas");
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">INFORME COMERCIAL · JUNIO 2026</span><h2>Ventas, vinculación y cobranza</h2></div>
        <p>Selecciona un bloque para abrir su detalle. Los datos de morosidad están actualizados al 06/07/2026.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Reservas activas" value={`${juneReport.sales.active}`} detail={`${juneReport.sales.reservations} históricas · ${juneReport.sales.withdrawn} desistidas`} />
        <StatCard eyebrow="Fase I" value={`${juneReport.sales.phaseOneActive}`} detail={`${juneReport.sales.phaseOneSales}% del objetivo comercial`} tone="good" />
        <StatCard eyebrow="Fase II" value={`${juneReport.sales.phaseTwoActive}`} detail={`${juneReport.sales.phaseTwoSales}% del objetivo comercial`} />
        <StatCard eyebrow="Cartera vencida" value={formatMoney(juneReport.collections.overdueUsd, "USD", currency)} detail={`${juneReport.collections.overdue} clientes · menos de 1%`} tone="warn" />
      </section>
      <section className="report-tabs" aria-label="Secciones del informe comercial">
        {[
          { id: "reservas", label: "Reservas y producto", detail: "279 reservas" },
          { id: "vinculacion", label: "Vinculación", detail: "198 depurados" },
          { id: "cobranza", label: "Cobranza", detail: "172 contratos" },
        ].map((item) => (
          <button
            key={item.id}
            className={section === item.id ? "active" : ""}
            onClick={() => setSection(item.id as typeof section)}
          >
            <span>{item.label}</span><strong>{item.detail}</strong>
          </button>
        ))}
      </section>

      {section === "reservas" && (
        <section className="report-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">FASE II</span><h3>Mix de producto</h3></div><span className="data-note">Junio: 18 reservas</span></div>
            <div className="rank-list">
              {salesModels.map((model) => (
                <div key={model.name}>
                  <span><strong>{model.name}</strong><small>{model.june} en junio</small></span>
                  <div><i style={{ width: `${(model.value / 32) * 100}%` }} /></div>
                  <b>{model.value}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">UBICACIÓN</span><h3>Reservas activas por frente</h3></div></div>
            <div className="compact-table commercial-table">
              <div className="compact-row head"><span>Ubicación</span><span>Garden</span><span>Sunset</span><span>Balcony</span><span>Total</span></div>
              {salesLocations.map((row) => (
                <div className="compact-row" key={row.name}>
                  <strong>{row.name}</strong><span>{row.garden}</span><span>{row.sunset}</span><span>{row.balcony}</span><b>{row.total}</b>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {section === "vinculacion" && (
        <section className="report-grid">
          <article className="panel pipeline-panel">
            <div className="panel-heading"><div><span className="section-kicker">DEPURACIÓN</span><h3>Estado documental de clientes</h3></div></div>
            <div className="pipeline">
              <div><strong>{juneReport.contracts.reviewed}</strong><span>Depurados</span><i style={{ width: "86.8%" }} /></div>
              <div><strong>{juneReport.contracts.pendingReview}</strong><span>Pendientes</span><i style={{ width: "13.2%" }} /></div>
            </div>
            <p className="section-intro">De los pendientes, {juneReport.contracts.inReview} están en depuración y {juneReport.contracts.awaitingDocuments} esperan documentos.</p>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">FORMALIZACIÓN</span><h3>Expedientes depurados</h3></div></div>
            <div className="status-matrix">
              <div className="good"><strong>{juneReport.contracts.linked}</strong><span>Vinculados</span></div>
              <div><strong>{juneReport.contracts.linking}</strong><span>En vinculación</span></div>
              <div className="warn"><strong>{juneReport.contracts.signing}</strong><span>En firma</span></div>
            </div>
            <p className="section-intro">La fuente registra 164 unidades vinculadas y 3 desistimientos posteriores; el control financiero usa 161 vigentes.</p>
          </article>
        </section>
      )}

      {section === "cobranza" && (
        <section className="report-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">172 CONTRATOS</span><h3>Estado de cobro</h3></div><span className="data-note">Corte 06/07/2026</span></div>
            <div className="collection-bar" aria-label="106 al día, 42 con cuotas pendientes y 24 vencidos">
              <i className="current" style={{ width: `${(106 / 172) * 100}%` }} />
              <i className="pending" style={{ width: `${(42 / 172) * 100}%` }} />
              <i className="overdue" style={{ width: `${(24 / 172) * 100}%` }} />
            </div>
            <div className="collection-legend">
              <span><i className="current" />Al día <strong>106</strong></span>
              <span><i className="pending" />Cuotas pendientes <strong>42</strong></span>
              <span><i className="overdue" />Vencidos <strong>24</strong></span>
            </div>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">MOROSIDAD</span><h3>Composición de la cartera vencida</h3></div><strong>{formatMoney(juneReport.collections.overdueUsd, "USD", currency)}</strong></div>
            <div className="rank-list compact">
              {arrearsBreakdown.map((item) => (
                <div key={item.name}>
                  <span><strong>{item.name}</strong><small>{item.clients} clientes</small></span>
                  <div><i style={{ width: `${(item.amountUsd / juneReport.collections.overdueUsd) * 100}%` }} /></div>
                  <b>{formatMoney(item.amountUsd, "USD", currency)}</b>
                </div>
              ))}
            </div>
            <p className="quality-note">El desglose excede el total declarado en {formatMoney(0.05, "USD", currency)}; se conserva la cifra total de la fuente.</p>
          </article>
        </section>
      )}
    </div>
  );
}

function UrbanismView() {
  const [selectedArea, setSelectedArea] = useState<UrbanismArea>(urbanismAreas[0]);
  const [selectedReportArea, setSelectedReportArea] = useState<(typeof urbanismReportAreas)[number]>(urbanismReportAreas[0]);
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">CAPAS OPERATIVAS DEL PLANO</span><h2>Urbanismo y espacios comunes</h2></div>
        <p>Pulsa cada especialidad o cada área del plano para consultar sus indicadores y fuentes.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Medición físico-financiera" value={`${number.format(projectSnapshot.urbanismProgress)}%`} detail={`Plan ${number.format(projectSnapshot.urbanismPlanned)}% · Excel`} tone="good" />
        <StatCard eyebrow="Actividades terminadas" value="4%" detail="16 de 315 · informe de obra" tone="warn" />
        <StatCard eyebrow="Mayor avance" value="72,76%" detail="Movimiento de tierra" />
        <StatCard eyebrow="Arranques demorados" value={`${delayedUrbanismStarts.length}`} detail="10 a 70 días de retraso" tone="danger" />
      </section>
      <section className="report-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="section-kicker">INFORME DE OBRA</span><h3>Avance por especialidad</h3></div></div>
          <div className="discipline-grid">
            {urbanismReportAreas.map((area) => (
              <button key={area.name} className={selectedReportArea.name === area.name ? "active" : ""} onClick={() => setSelectedReportArea(area)}>
                <span>{area.name}</span><strong>{number.format(area.progress)}%</strong>
                <i><b style={{ width: `${area.progress}%` }} /></i>
              </button>
            ))}
          </div>
        </article>
        <article className="panel selected-report">
          <span className="section-kicker">ESPECIALIDAD SELECCIONADA</span>
          <h3>{selectedReportArea.name}</h3>
          <strong>{number.format(selectedReportArea.progress)}%</strong>
          <p>Progreso de actividades reportado en el informe de obra. Es distinto del indicador físico-financiero consolidado de 18,28%.</p>
          <div className="delay-preview">
            <span>Mayor demora de inicio<strong>70 días</strong></span>
            <span>Última demora registrada<strong>10 días</strong></span>
          </div>
        </article>
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

function ControlView({ currency, canAccessFinance }: { currency: CurrencyCode; canAccessFinance: boolean }) {
  const [section, setSection] = useState<"seguridad" | "permisos" | "financiacion">("seguridad");
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">CONTROL TRANSVERSAL · JUNIO 2026</span><h2>Seguridad, permisos y gestiones</h2></div>
        <p>Abre cada bloque para consultar indicadores, trámites y procesos de financiación.</p>
      </section>
      <section className="report-tabs">
        {[
          { id: "seguridad", label: "Seguridad y salud", detail: "0 accidentes" },
          { id: "permisos", label: "Permisos", detail: "8 aprobados · 1 en proceso" },
          ...(canAccessFinance ? [{ id: "financiacion", label: "Financiación", detail: "6 procesos" }] : []),
        ].map((item) => (
          <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id as typeof section)}>
            <span>{item.label}</span><strong>{item.detail}</strong>
          </button>
        ))}
      </section>

      {section === "seguridad" && (
        <>
          <section className="safety-grid">
            {safetyMetrics.map((metric) => (
              <article className="panel safety-card" key={metric.label}>
                <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
              </article>
            ))}
          </section>
          <section className="report-grid">
            <article className="panel">
              <div className="panel-heading"><div><span className="section-kicker">HALLAZGOS</span><h3>Observaciones del corte</h3></div></div>
              <ul className="quality-list control-list">{safetyFindings.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="section-kicker">SEGUIMIENTO</span><h3>Lectura operativa</h3></div><span className="source-status observada">Observada</span></div>
              <div className="callout good"><strong>Cero accidentes reportados</strong><p>El dato está disponible para las semanas 3 y 4.</p></div>
              <div className="callout warn"><strong>Semana 2 sin reporte</strong><p>La ausencia se mantiene como brecha documental y no se interpreta como cero incidentes.</p></div>
              <div className="callout"><strong>Sin auditorías ni formaciones</strong><p>No se registraron auditorías o capacitaciones formales en la fuente.</p></div>
            </article>
          </section>
        </>
      )}

      {section === "permisos" && (
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">MATRIZ DE TRÁMITES</span><h3>Permisos y no objeciones</h3></div><span className="data-note">8 aprobados · 1 en proceso</span></div>
          <div className="compact-table permit-table">
            <div className="compact-row head"><span>Entidad</span><span>Referencia</span><span>Estado</span><span>Fecha / siguiente paso</span></div>
            {permits.map((permit) => (
              <div className="compact-row" key={`${permit.entity}-${permit.reference}`}>
                <strong>{permit.entity}</strong><span>{permit.reference}</span>
                <b className={permit.status === "Aprobado" ? "good-text" : "warn-text"}>{permit.status}</b><span>{permit.date}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {canAccessFinance && section === "financiacion" && (
        <section className="report-grid">
          <article className="panel finance-processes">
            <div className="panel-heading"><div><span className="section-kicker">GESTIONES FINANCIERAS</span><h3>Procesos activos</h3></div></div>
            {financingProcesses.map((process) => (
              <div className="finance-process" key={process.entity}>
                <span><strong>{process.entity}</strong><small>{process.detail}</small></span>
                <b>{formatMoneyMillions(process.amountDop, "DOP", currency)}</b><i>{process.status}</i>
              </div>
            ))}
          </article>
          <article className="panel decision-panel">
            <span className="section-kicker">SOLICITUD DE APROBACIÓN</span>
            <h3>Línea de crédito AFI</h3>
            <strong>{formatMoneyMillions(100000000, "DOP", currency)}</strong>
            <p>Solicitud incluida en el informe de junio. Se presenta como decisión pendiente, no como financiación confirmada.</p>
            <div className="callout warn"><strong>Condición de caja</strong><p>La proyección financiera cierra diciembre en {formatMoneyMillions(juneReport.finance.projectedCashDecemberDop, "DOP", currency)} si no se materializan los flujos previstos.</p></div>
          </article>
        </section>
      )}
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

function SuppliersView({ suppliers, onAdd, currency, canAccessFinance }: { suppliers: Supplier[]; onAdd: () => void; currency: CurrencyCode; canAccessFinance: boolean }) {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Proveedores operativos" value={`${suppliers.length}`} detail="Registros configurables del dashboard" />
        {canAccessFinance ? (
          <>
            <StatCard eyebrow="Facturas en CxP" value="96" detail="Archivo departamental de Antonely" />
            <StatCard eyebrow="Mayor exposición" value={formatMoneyMillions(antonelyPayableVendorsAll[0].amount, "DOP", currency)} detail={antonelyPayableVendorsAll[0].name} tone="warn" />
            <StatCard eyebrow="CxP departamental" value={formatMoneyMillions(antonelyFinanceSource.payablesDetailDop, "DOP", currency)} detail="Pendiente de conciliación" tone="warn" />
          </>
        ) : (
          <>
            <StatCard eyebrow="En plazo" value={`${suppliers.filter((item) => item.status === "al_dia").length}`} detail="Entregas sin alerta registrada" tone="good" />
            <StatCard eyebrow="En revisión" value={`${suppliers.filter((item) => item.status === "revision").length}`} detail="Seguimiento operativo" tone="warn" />
            <StatCard eyebrow="Con retraso" value={`${suppliers.filter((item) => item.status === "retraso").length}`} detail="Requiere gestión de entrega" tone="danger" />
          </>
        )}
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
                  {canAccessFinance && <span>Contratado<strong>{supplier.amount || "Sin dato"}</strong></span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {canAccessFinance && <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CUENTAS POR PAGAR · ANTONELY</span>
            <h3>Principales proveedores por saldo registrado</h3>
          </div>
          <span className="data-note">43 proveedores · {currency}</span>
        </div>
        <div className="rank-list compact">
          {antonelyPayableVendorsAll.map((supplier) => (
            <div key={supplier.name}>
              <span><strong>{supplier.name}</strong></span>
              <div><i style={{ width: `${Math.max(0, (supplier.amount / antonelyPayableVendorsAll[0].amount) * 100)}%` }} /></div>
              <b>{formatMoneyMillions(supplier.amount, "DOP", currency)}</b>
            </div>
          ))}
        </div>
        <p className="quality-note">Este ranking procede de 96 líneas de factura. Es una vista de obligaciones, no un catálogo contractual ni una evaluación del proveedor.</p>
      </section>}
    </div>
  );
}

function MetricsView({ metrics, onAdd, currency }: { metrics: CustomMetric[]; onAdd: () => void; currency: CurrencyCode }) {
  const [section, setSection] = useState<"flujo" | "cxp" | "anticipos" | "control" | "detalle">("flujo");
  const rd = (value: number) => formatMoney(value, "DOP", currency);
  const rdMillions = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const qualityIssues = financialQualityIssues(currency);
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">INFORME FINANCIERO · JUNIO 2026</span><h2>Presupuesto, caja y obligaciones</h2></div>
        <p>Los importes fuente se conservan en DOP y se muestran en {currency}. {exchangeRateNote(currency)}.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Presupuesto de control" value={rdMillions(juneReport.finance.budgetDop)} detail={`${number.format((juneReport.finance.executedDop / juneReport.finance.budgetDop) * 100)}% ejecutado`} />
        <StatCard eyebrow="Coste acumulado" value={rdMillions(juneReport.finance.executedDop)} detail={`${rdMillions(juneReport.finance.juneExecutedDop)} en junio`} />
        <StatCard eyebrow="Cuentas por pagar" value={rdMillions(juneReport.finance.cxpDop)} detail="60,13% corriente" tone="warn" />
        <StatCard eyebrow="Caja proyectada · dic" value={rdMillions(juneReport.finance.projectedCashDecemberDop)} detail="Requiere materializar financiación" tone="danger" />
      </section>
      <section className="report-tabs finance-tabs">
        {[
          { id: "flujo", label: "Flujo de caja", detail: "Jul–Dic 2026" },
          { id: "cxp", label: "Cuentas por pagar", detail: rdMillions(juneReport.finance.cxpDop) },
          { id: "anticipos", label: "Anticipos", detail: rdMillions(juneReport.finance.advancesPendingDop) },
          { id: "control", label: "Control y balance", detail: rdMillions(juneReport.finance.assetsDop) },
          { id: "detalle", label: "Detalle completo", detail: "29 · 15 · 26 · 41" },
        ].map((item) => (
          <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id as typeof section)}>
            <span>{item.label}</span><strong>{item.detail}</strong>
          </button>
        ))}
      </section>

      {section === "flujo" && (
        <section className="panel">
          <div className="panel-heading">
            <div><span className="section-kicker">PROYECCIÓN DE LIQUIDEZ</span><h3>Ingresos, costes y caja acumulada</h3></div>
            <span className="data-note">Vista en {currency}</span>
          </div>
          <div className="projection-chart">
            {financialProjection.map((month) => (
              <div className="projection-month" key={month.month}>
                <div className="projection-bars">
                  <i className="income" style={{ height: `${Math.max(4, (month.income / 180000000) * 100)}%` }} title={`Ingresos ${rd(month.income)}`} />
                  <i className="cost" style={{ height: `${Math.max(4, (month.costs / 180000000) * 100)}%` }} title={`Costes ${rd(month.costs)}`} />
                </div>
                <strong>{month.month}</strong>
                <small className={month.cumulative < 0 ? "danger-text" : "good-text"}>{rdMillions(month.cumulative)}</small>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="income" />Ingresos</span><span><i className="cost" />Costes</span><span>La cifra bajo cada mes es la caja acumulada.</span></div>
        </section>
      )}

      {section === "cxp" && (
        <section className="report-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">ANTIGÜEDAD</span><h3>Cuentas por pagar</h3></div><strong>{rd(juneReport.finance.cxpDop)}</strong></div>
            <div className="rank-list">
              {cxpAging.map((item) => (
                <div key={item.name}>
                  <span><strong>{item.name}</strong><small>{number.format(item.percent)}%</small></span>
                  <div><i style={{ width: `${item.percent}%` }} /></div><b>{rdMillions(item.amount)}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">CONCENTRACIÓN</span><h3>Principales categorías</h3></div></div>
            <div className="rank-list compact">
              {cxpCategories.map((item) => (
                <div key={item.name}>
                  <span><strong>{item.name}</strong></span>
                  <div><i style={{ width: `${(item.amount / cxpCategories[0].amount) * 100}%` }} /></div><b>{rdMillions(item.amount)}</b>
                </div>
              ))}
            </div>
            <p className="quality-note">La clasificación por categorías coincide con el archivo de Antonely, pero el total departamental no coincide con el consolidado.</p>
          </article>
          <article className="panel reconciliation-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">CONCILIACIÓN DE FUENTES</span><h3>Tres totales de cuentas por pagar</h3></div>
              <span className="data-note">No se sobrescribe ninguna cifra</span>
            </div>
            <div className="compact-table reconciliation-table">
              <div className="compact-row head"><span>Fuente</span><span>Función</span><span>Total</span><span>Diferencia vs. consolidado</span></div>
              {payablesReconciliation.map((item) => (
                <div className="compact-row" key={item.source}>
                  <strong>{item.source}</strong>
                  <span>{item.role}</span>
                  <span>{rd(item.amount)}</span>
                  <span className={item.amount === juneReport.finance.cxpDop ? "good-text" : "danger-text"}>
                    {item.amount === juneReport.finance.cxpDop ? "Base" : rd(item.amount - juneReport.finance.cxpDop)}
                  </span>
                </div>
              ))}
            </div>
            <p className="quality-note">El archivo de Antonely está {rd(30045.28)} por encima de la relación consolidada y {rd(15289.01)} por encima del balance. Requiere conciliación contable antes de cambiar el KPI principal.</p>
          </article>
        </section>
      )}

      {section === "anticipos" && (
        <section className="report-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">SALDO PENDIENTE</span><h3>Anticipos por amortizar</h3></div><strong>{rd(juneReport.finance.advancesPendingDop)}</strong></div>
            <div className="rank-list">
              {advances.map((item) => (
                <div key={item.name}>
                  <span><strong>{item.name}</strong></span>
                  <div><i style={{ width: `${(item.amount / advances[0].amount) * 100}%` }} /></div><b>{rdMillions(item.amount)}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="panel decision-panel">
            <span className="section-kicker">CONTROL DE ANTICIPOS</span>
            <h3>{antonelyDetailTotals.advanceCount} registros</h3>
            <strong>{rdMillions(10035120.72)}</strong>
            <p>Total concedido. El saldo pendiente de amortización es {rdMillions(juneReport.finance.advancesPendingDop)}.</p>
            <div className="callout"><strong>Lectura correcta</strong><p>Los importes “concedido” y “pendiente” no son equivalentes; el dashboard muestra ambos por separado.</p></div>
          </article>
        </section>
      )}

      {section === "control" && (
        <section className="report-grid">
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">COSTES</span><h3>Acumulado y ejecución de junio</h3></div></div>
            <div className="compact-table cost-table">
              <div className="compact-row head"><span>Bloque</span><span>Acumulado</span><span>Junio</span></div>
              {costBreakdown.map((item) => (
                <div className="compact-row" key={item.name}><strong>{item.name}</strong><span>{rdMillions(item.cumulative)}</span><span>{rdMillions(item.june)}</span></div>
              ))}
            </div>
            <p className="quality-note">Antonely registra {rd(48988755.86)} en junio y {rd(712326161.73)} acumulados. Frente al consolidado, las diferencias son {rd(10154.66)} y {rd(1)} respectivamente.</p>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">BALANCE</span><h3>Posición financiera</h3></div></div>
            <div className="balance-grid">
              <div><span>Activos</span><strong>{rdMillions(juneReport.finance.assetsDop)}</strong></div>
              <div><span>Pasivos</span><strong>{rdMillions(juneReport.finance.liabilitiesDop)}</strong></div>
              <div><span>Patrimonio</span><strong>{rdMillions(juneReport.finance.equityDop)}</strong></div>
              <div><span>Disponibilidad</span><strong>{rdMillions(juneReport.finance.liquidityDop)}</strong></div>
              <div><span>Depósitos clientes</span><strong>{rdMillions(juneReport.finance.clientDepositsDop)}</strong></div>
              <div><span>Por ejecutar</span><strong>{rdMillions(juneReport.finance.remainingDop)}</strong></div>
            </div>
          </article>
        </section>
      )}

      {section === "detalle" && (
        <section className="financial-detail-stack">
          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">29 CUENTAS DE COSTE</span><h3>Detalle acumulado por cuenta</h3></div>
              <strong>{rd(antonelyFinanceSource.accumulatedCostsDop)}</strong>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table cost-detail-table">
                <div className="financial-detail-row head"><span>Código</span><span>Cuenta</span><span>A mayo</span><span>Junio</span><span>Acumulado</span></div>
                {antonelyCostAccounts.map((item) => (
                  <div className="financial-detail-row" key={item.code}>
                    <b>{item.code}</b><strong>{item.name}</strong><span>{rd(item.may)}</span><span>{rd(item.june)}</span><span>{rd(item.cumulative)}</span>
                  </div>
                ))}
                <div className="financial-detail-row total-row"><b>Total</b><strong>Fuente Antonely</strong><span>{rd(antonelyFinanceSource.previousAccumulatedDop)}</span><span>{rd(antonelyFinanceSource.juneCostsDop)}</span><span>{rd(antonelyFinanceSource.accumulatedCostsDop)}</span></div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">15 CATEGORÍAS · 96 FACTURAS</span><h3>Cuentas por pagar por antigüedad</h3></div>
              <strong>{rd(antonelyDetailTotals.payablesTotalDop)}</strong>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table cxp-detail-table">
                <div className="financial-detail-row head"><span>Categoría</span><span>Corriente</span><span>&lt; 1 mes</span><span>1 mes</span><span>2 meses</span><span>3 meses</span><span>Anterior</span><span>Total</span></div>
                {antonelyPayableCategories.map((item) => (
                  <div className="financial-detail-row" key={item.name}>
                    <strong>{item.name}</strong><span>{rd(item.current)}</span><span>{rd(item.under1)}</span><span>{rd(item.month1)}</span><span>{rd(item.month2)}</span><span>{rd(item.month3)}</span><span>{rd(item.older)}</span><span>{rd(item.total)}</span>
                  </div>
                ))}
                <div className="financial-detail-row total-row">
                  <strong>Total</strong><span>{rd(antonelyDetailTotals.payablesCurrentDop)}</span><span>{rd(antonelyDetailTotals.payablesUnderOneMonthDop)}</span><span>{rd(antonelyDetailTotals.payablesOneMonthDop)}</span><span>{rd(antonelyDetailTotals.payablesTwoMonthsDop)}</span><span>{rd(antonelyDetailTotals.payablesThreeMonthsDop)}</span><span>{rd(antonelyDetailTotals.payablesOlderDop)}</span><span>{rd(antonelyDetailTotals.payablesTotalDop)}</span>
                </div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">26 ANTICIPOS</span><h3>Concedido y pendiente por documento</h3></div>
              <strong>{rd(antonelyDetailTotals.advancePendingDop)}</strong>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table advance-detail-table">
                <div className="financial-detail-row head"><span>Proveedor</span><span>Referencia</span><span>Fecha</span><span>Categoría</span><span>Concedido</span><span>Pendiente</span></div>
                {antonelyAdvances.map((item) => (
                  <div className="financial-detail-row" key={`${item.vendor}-${item.reference}`}>
                    <strong>{item.vendor}</strong><span>{item.reference}</span><span>{item.date}</span><span>{item.category}</span><span>{rd(item.granted)}</span><span>{rd(item.pending)}</span>
                  </div>
                ))}
                <div className="financial-detail-row total-row"><strong>Total</strong><span>26 documentos</span><span>30/06/2026</span><span>Fuente Antonely</span><span>{rd(antonelyDetailTotals.advanceGrantedDop)}</span><span>{rd(antonelyDetailTotals.advancePendingDop)}</span></div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">41 LÍNEAS DE BALANCE</span><h3>Balance de comprobación completo</h3></div>
              <span className="source-status validada">CUADRADO</span>
            </div>
            <div className="balance-equation">
              <span>Activos<strong>{rd(juneReport.finance.assetsDop)}</strong></span>
              <i>=</i>
              <span>Pasivos<strong>{rd(juneReport.finance.liabilitiesDop)}</strong></span>
              <i>+</i>
              <span>Patrimonio<strong>{rd(juneReport.finance.equityDop)}</strong></span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table balance-detail-table">
                <div className="financial-detail-row head"><span>Sección</span><span>Cuenta</span><span>Importe</span></div>
                {antonelyBalanceLines.map((item, index) => (
                  <div className="financial-detail-row" key={`${item.section}-${item.name}-${index}`}>
                    <b>{item.section}</b><strong>{item.name}</strong><span>{rd(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="quality-note">El balance cuadra exactamente: activos = pasivos + patrimonio. El saldo de anticipos del balance difiere {rd(0.08)} del detalle y permanece señalado.</p>
          </article>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading"><div><span className="section-kicker">CALIDAD DEL DATO</span><h3>Conciliaciones abiertas</h3></div><span className="count-badge">{qualityIssues.length}</span></div>
        <div className="quality-grid">
          {qualityIssues.map((issue) => <article key={issue.title}><strong>{issue.title}</strong><p>{issue.detail}</p></article>)}
        </div>
      </section>

      <details className="panel expandable-library">
        <summary><span><small>INDICADORES ANTERIORES</small><strong>Métricas configurables y cubicaciones</strong></span><b>Abrir</b></summary>
        <div className="metric-library">
          <div className="panel-heading"><div><h3>Métricas físicas, temporales y financieras</h3></div><button className="button primary" onClick={onAdd}>Añadir métrica</button></div>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.id}>
                <div className="metric-card-head"><span>{metric.owner}</span><i className={`trend ${metric.trend}`}>{metric.trend === "up" ? "↗" : metric.trend === "down" ? "↘" : "→"}</i></div>
                <h4>{metric.name}</h4><strong>{metric.id === "metric-cubicacion" ? rd(projectSnapshot.cubicacionesMeasured) : `${metric.value} ${metric.unit}`}</strong>
                <div className="metric-target"><span>Referencia {metric.id === "metric-cubicacion" ? rd(projectSnapshot.cubicacionesAccounting) : `${metric.target} ${metric.unit}`}</span></div>
              </article>
            ))}
          </div>
          <div className="panel-heading subsection-heading"><div><span className="section-kicker">CUBICACIONES</span><h3>Medición frente a contabilidad</h3></div><span className="data-note">Origen DOP · vista {currency}</span></div>
          <div className="simple-table finance-table">
            <div className="table-row table-head"><span>Periodo</span><span>Cubicación</span><span>Contabilidad</span><span>Diferencia</span></div>
            {cubicaciones.map((item) => (
              <div className="table-row" key={item.period}><strong>{item.period}</strong><span>{rd(item.measured)}</span><span>{rd(item.accounting)}</span><span>{rd(item.accounting - item.measured)}</span></div>
            ))}
            <div className="table-row total-row"><strong>Total</strong><span>{rd(projectSnapshot.cubicacionesMeasured)}</span><span>{rd(projectSnapshot.cubicacionesAccounting)}</span><span>{rd(projectSnapshot.cubicacionesDifference)}</span></div>
          </div>
        </div>
      </details>
    </div>
  );
}

function FinanceLockedView() {
  return (
    <section className="panel finance-locked">
      <div className="finance-lock-mark" aria-hidden="true">F</div>
      <span className="section-kicker">ÁREA RESTRINGIDA</span>
      <h2>Finanzas requiere autorización individual.</h2>
      <p>
        Tu usuario puede trabajar con obra, apartamentos, edificios, urbanismo y documentación,
        pero no tiene permiso para consultar cifras financieras. El administrador puede
        conceder o retirar este acceso desde Usuarios y accesos.
      </p>
    </section>
  );
}

async function fetchManagedUsers() {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const payload = await response.json() as { users?: ManagedUser[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar los accesos.");
  return payload.users ?? [];
}

function UsersAdminView({ currentUser }: { currentUser: DashboardUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    role: "member" as "admin" | "member",
    financeAccess: false,
  });

  async function refreshUsers() {
    try {
      setUsers(await fetchManagedUsers());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo consultar los accesos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchManagedUsers()
      .then((loadedUsers) => {
        if (active) setUsers(loadedUsers);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "No se pudo consultar los accesos.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveUser(input: {
    email: string;
    displayName: string;
    role: "admin" | "member";
    financeAccess: boolean;
    active: boolean;
  }) {
    setSaving(input.email);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as { user?: ManagedUser; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el acceso.");
      setMessage(payload.message ?? "Acceso actualizado.");
      await refreshUsers();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el acceso.");
      return false;
    } finally {
      setSaving("");
    }
  }

  async function submitNewUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await saveUser({ ...form, active: true });
    if (saved) {
      setForm({ email: "", displayName: "", role: "member", financeAccess: false });
    }
  }

  return (
    <div className="view-stack">
      <section className="data-view-intro admin-intro">
        <div>
          <span className="section-kicker">ADMINISTRACIÓN DE ACCESO</span>
          <h2>Usuarios y permisos</h2>
        </div>
        <p>
          Cada persona inicia sesión con su cuenta de ChatGPT. Bricket no almacena
          contraseñas; aquí se autoriza el correo y se decide si puede abrir Finanzas.
        </p>
      </section>

      <section className="admin-access-grid">
        <form className="panel access-create-card" onSubmit={submitNewUser}>
          <div className="panel-heading">
            <div><span className="section-kicker">NUEVO ACCESO</span><h3>Autorizar una persona</h3></div>
          </div>
          <label>Nombre<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nombre y apellidos" /></label>
          <label>Correo de acceso<input type="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="persona@empresa.com" /></label>
          <label>Perfil
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as "admin" | "member", financeAccess: event.target.value === "admin" ? true : current.financeAccess }))}>
              <option value="member">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="permission-check">
            <input type="checkbox" checked={form.financeAccess} disabled={form.role === "admin"} onChange={(event) => setForm((current) => ({ ...current, financeAccess: event.target.checked }))} />
            <span><strong>Acceso a Finanzas</strong><small>Permite consultar cifras, documentos e informes financieros.</small></span>
          </label>
          <button className="button primary" type="submit" disabled={Boolean(saving)}>Crear acceso</button>
        </form>

        <section className="panel access-policy-card">
          <span className="section-kicker">MODELO DE SEGURIDAD</span>
          <h3>Acceso por identidad y mínimo privilegio</h3>
          <div className="policy-list">
            <div><b>01</b><span><strong>Inicio de sesión obligatorio</strong><small>La identidad se verifica antes de cargar el dashboard.</small></span></div>
            <div><b>02</b><span><strong>Lista autorizada</strong><small>Sólo los correos dados de alta pueden entrar.</small></span></div>
            <div><b>03</b><span><strong>Finanzas independiente</strong><small>El permiso se concede y retira por persona.</small></span></div>
            <div><b>04</b><span><strong>Auditoría</strong><small>Cada cambio conserva administrador, fecha y detalle.</small></span></div>
          </div>
        </section>
      </section>

      <section className="panel access-directory">
        <div className="panel-heading">
          <div><span className="section-kicker">DIRECTORIO AUTORIZADO</span><h3>{users.length} usuarios configurados</h3></div>
          <span className="data-note">{currentUser.email}</span>
        </div>
        {message && <div className="access-message" role="status">{message}</div>}
        {loading ? (
          <div className="empty-state compact"><strong>Cargando usuarios…</strong></div>
        ) : (
          <div className="access-user-list">
            {users.map((user) => {
              const isSelf = user.email === currentUser.email;
              return (
                <article key={user.email} className={!user.active ? "disabled" : ""}>
                  <div className="user-identity">
                    <span>{user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                    <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
                  </div>
                  <label>Perfil
                    <select
                      value={user.role}
                      disabled={isSelf || saving === user.email}
                      onChange={(event) => void saveUser({ ...user, role: event.target.value as "admin" | "member", financeAccess: event.target.value === "admin" ? true : user.financeAccess })}
                    >
                      <option value="member">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                  <button
                    className={`permission-toggle ${user.financeAccess ? "granted" : ""}`}
                    disabled={user.role === "admin" || saving === user.email}
                    onClick={() => void saveUser({ ...user, financeAccess: !user.financeAccess })}
                  >
                    <span>Finanzas</span><strong>{user.financeAccess ? "Permitido" : "Bloqueado"}</strong>
                  </button>
                  <button
                    className={`permission-toggle ${user.active ? "granted" : "revoked"}`}
                    disabled={isSelf || saving === user.email}
                    onClick={() => void saveUser({ ...user, active: !user.active })}
                  >
                    <span>Acceso general</span><strong>{user.active ? "Activo" : "Desactivado"}</strong>
                  </button>
                  <small className="last-access">{user.lastLoginAt ? `Último acceso ${new Date(user.lastLoginAt).toLocaleString("es-DO")}` : "Aún no ha iniciado sesión"}</small>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CollaborativeFileRegistry() {
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/files", { cache: "no-store" });
        const payload = (await response.json()) as { files?: UploadedFileRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el registro.");
        if (active) {
          setFiles(payload.files ?? []);
          setError("");
        }
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "No se pudo actualizar el registro.");
      } finally {
        if (active) setLoading(false);
      }
    }
    const onFilesUpdated = () => void refresh();
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    window.addEventListener("araya-files-updated", onFilesUpdated);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("araya-files-updated", onFilesUpdated);
    };
  }, []);

  return (
    <section className="panel live-file-registry" aria-live="polite">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">REGISTRO COLABORATIVO · ACTUALIZACIÓN CADA 5 S</span>
          <h3>Últimos archivos recibidos</h3>
        </div>
        <span className="count-badge">{files.length}</span>
      </div>
      {loading ? (
        <div className="empty-state compact"><strong>Actualizando registro…</strong></div>
      ) : error ? (
        <div className="callout warn"><strong>Registro no disponible</strong><p>{error}</p></div>
      ) : files.length === 0 ? (
        <div className="empty-state compact">
          <strong>Aún no hay cargas colaborativas.</strong>
          <p>Los archivos integrados históricamente aparecen debajo. Las nuevas cargas quedarán aquí con usuario, área, versión y estado.</p>
        </div>
      ) : (
        <div className="uploaded-file-list">
          {files.map((file) => (
            <article key={file.id}>
              <div className="uploaded-file-icon">{file.extension.toUpperCase()}</div>
              <div className="uploaded-file-main">
                <strong>{file.originalName}</strong>
                <span>{file.areaLabel} · {fileSize(file.sizeBytes)} · v{file.version}</span>
                <small>Moneda origen: {file.sourceCurrency} · visualización predeterminada: USD</small>
                <small>{file.classificationReason}</small>
              </div>
              <div className="uploaded-file-owner">
                <strong>{file.uploaderName}</strong>
                <span>{new Date(file.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <span className={`upload-status ${file.status}`}>{uploadStatusLabels[file.status] ?? file.status}</span>
              <a className="button secondary" href={file.downloadUrl}>Descargar</a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SourcesView({ onUpload, canAccessFinance }: { onUpload: () => void; canAccessFinance: boolean }) {
  const visibleSources = canAccessFinance
    ? dataSources
    : dataSources.filter((source) => !/financ|balance|flujo|cxp|antonely/i.test(`${source.kind} ${source.file}`));
  const visibleIssues = canAccessFinance
    ? juneDataQualityIssues
    : juneDataQualityIssues.filter((issue) => !/presupuesto|pagar|coste|anticipo|inter[eé]s/i.test(issue.title));
  return (
    <div className="view-stack">
      <section className="panel data-center-intro">
        <div>
          <span className="section-kicker">GRUPO BRICKET · REPOSITORIO DOCUMENTAL</span>
          <h2>Centro de datos del proyecto ARAYA</h2>
          <p>Fuentes de avance, cronogramas y documentación técnica centralizadas con trazabilidad por área, persona y versión.</p>
        </div>
        <button className="button primary" onClick={onUpload}>+ Añadir archivo</button>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Fuentes visibles" value={`${visibleSources.length}`} detail={canAccessFinance ? "Repositorio completo autorizado" : "Documentación operativa autorizada"} />
        <StatCard eyebrow="Registros MPP" value="2.228" detail="2.195 asignaciones y 22 paquetes" />
        <StatCard eyebrow="Alertas de calidad" value={`${visibleIssues.length}`} detail="Visibles según permisos y sin corrección silenciosa" tone="warn" />
        <StatCard eyebrow="Corte declarado" value="30/06/2026" detail="Fecha tomada de los archivos" />
      </section>
      <section className="panel ingestion-workflow">
        <div className="panel-heading">
          <div><span className="section-kicker">CARGA COLABORATIVA</span><h3>Cómo entra un archivo al Centro de Control</h3></div>
          <span className="live-state"><span className="live-dot" /> Actualización cada 5 s</span>
        </div>
        <div className="ingestion-steps">
          <div><b>01</b><strong>Recepción</strong><span>El original se guarda sin modificar.</span></div>
          <div><b>02</b><strong>Clasificación</strong><span>Área sugerida por nombre y descripción.</span></div>
          <div><b>03</b><strong>Normalización</strong><span>Los datos se convierten al modelo único del proyecto.</span></div>
          <div><b>04</b><strong>Sincronización</strong><span>La nueva versión actualiza todas las pantallas.</span></div>
        </div>
        <p className="governance-note">La identidad procede del acceso al dashboard. Cada dato normalizado se publica con fuente, corte, moneda de origen y versión; las contradicciones quedan observadas para evitar sustituciones silenciosas.</p>
      </section>
      <CollaborativeFileRegistry />
      <section className="source-grid">
        {visibleSources.map((source) => (
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
                  Descargar archivo
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
          <div><strong>Avance físico</strong><p>El informe y los Excel son la fuente del 18,23% ejecutado y del KPI planificado de 21,24%.</p></div>
          <div><strong>Avance de cronograma</strong><p>MPP es la fuente del 17%, fechas, actividades y camino crítico.</p></div>
          {canAccessFinance && <div><strong>Finanzas</strong><p>El Excel de junio prevalece para presupuesto, costes, CxP, anticipos, balance y caja.</p></div>}
          {canAccessFinance && <div><strong>Fuente Antonely</strong><p>Amplía el detalle de CxP y proveedores; sus diferencias permanecen abiertas hasta conciliación contable.</p></div>}
          <div><strong>Versiones</strong><p>El PDF duplica el consolidado; los informes parciales amplían datos y la lámina de mayo queda como histórico.</p></div>
          <div><strong>Edificios</strong><p>El índice MPP promedia 32 frentes; las disciplinas del informe de obra son un indicador diferente.</p></div>
          <div><strong>Apartamentos</strong><p>El porcentaje disponible corresponde sólo a superestructura, no a terminación total.</p></div>
          <div><strong>Nuevas cargas</strong><p>R2 conserva el original y D1 registra archivo, usuario, área, moneda, versión y corte. Los datos normalizados se reflejan en todas las vistas en menos de cinco segundos; sin moneda declarada se aplica DOP.</p></div>
        </div>
      </section>
    </div>
  );
}

function AgentPanel({ expanded, onClose, currency }: { expanded: boolean; onClose: () => void; currency: CurrencyCode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Buenos días. Puedo consultar la versión viva y recibir archivos. Los importes se responden en USD por defecto; si una fuente no indica moneda, se registra como DOP. Los datos normalizados actualizan todas las pantallas en menos de cinco segundos y cualquier contradicción queda visible para conciliación.",
      mode: "source-data-engine",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentArea, setAttachmentArea] = useState<UploadArea>("auto");
  const [attachmentCurrency, setAttachmentCurrency] = useState<CurrencyCode | "auto">("auto");
  const [uploading, setUploading] = useState(false);

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
        body: JSON.stringify({ question: trimmed, currency }),
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

  async function sendAttachment() {
    if (!attachment || uploading) return;
    const pendingFile = attachment;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: `Adjunto para integrar: ${pendingFile.name}` },
    ]);
    setUploading(true);
    try {
      const result = await uploadProjectFile(pendingFile, {
        area: attachmentArea,
        description: "Archivo cargado mediante ARAYA Copilot.",
        section: "Agente IA",
        source: "agent",
        sourceCurrency: attachmentCurrency,
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.message ?? `Archivo registrado en ${result.file?.areaLabel ?? "el Centro de datos"}.`,
          mode: "file-registry",
        },
      ]);
      setAttachment(null);
      setAttachmentArea("auto");
      setAttachmentCurrency("auto");
    } catch (uploadError) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: uploadError instanceof Error ? uploadError.message : "No se pudo registrar el archivo.",
          mode: "file-registry",
        },
      ]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className={`agent-panel ${expanded ? "expanded" : ""}`}>
      <div className="agent-header">
        <div className="agent-mark">AI</div>
        <div><strong>ARAYA Copilot</strong><span><i /> Consulta y carga documental</span></div>
        {!expanded && <button className="close-button" onClick={onClose} aria-label="Cerrar agente">×</button>}
      </div>
      <div className="agent-suggestions">
        {[
          "Resume el corte para Dirección",
          "¿Qué paquete tiene mayor desviación?",
          "¿Qué problemas tienen las fuentes?",
          "¿Cómo se clasifica un archivo nuevo?",
        ].map((suggestion) => (
          <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>
        ))}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <div>{message.text}</div>
            {message.role === "assistant" && (
              <small>{message.mode === "openai-tools" ? "IA + herramientas" : message.mode === "file-registry" ? "Registro documental" : "Motor de datos de fuentes"}</small>
            )}
          </div>
        ))}
        {loading && <div className="message assistant typing">Consultando datos…</div>}
        {uploading && <div className="message assistant typing">Guardando, clasificando y registrando…</div>}
      </div>
      <div className="agent-attachment">
        <label>
          <span>Adjuntar archivo</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pptx,.ppt,.pdf,.docx,.doc,.mpp,.dwg,.png,.jpg,.jpeg,.zip"
            onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
          />
        </label>
        {attachment && (
          <div className="agent-attachment-ready">
            <strong>{attachment.name}</strong>
            <small>{fileSize(attachment.size)}</small>
            <select value={attachmentArea} onChange={(event) => setAttachmentArea(event.target.value as UploadArea)}>
              {uploadAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
            </select>
            <select value={attachmentCurrency} onChange={(event) => setAttachmentCurrency(event.target.value as CurrencyCode | "auto")}>
              <option value="auto">Moneda automática · sin indicar = DOP</option>
              <option value="DOP">Origen DOP · peso dominicano</option>
              <option value="USD">Origen USD · dólar estadounidense</option>
            </select>
            <button type="button" onClick={() => void sendAttachment()} disabled={uploading}>Registrar archivo</button>
          </div>
        )}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregunta por cualquier dato del corte…" rows={2} />
        <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar pregunta">↑</button>
      </form>
      <div className="agent-foot">Cada respuesta consulta la versión viva. Las cargas conservan usuario, fuente y corte; las contradicciones quedan observadas.</div>
    </aside>
  );
}

function ReportBuilder({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (period: DirectionReportPeriod) => void;
}) {
  const [frequency, setFrequency] = useState<ReportFrequency>("monthly");
  const [month, setMonth] = useState("2026-06");
  const [startDate, setStartDate] = useState("2026-06-24");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (frequency === "monthly") {
      if (!month) {
        setError("Selecciona el mes que debe figurar en el informe.");
        return;
      }
      onGenerate(monthReportPeriod(month));
      return;
    }
    if (!startDate || !endDate) {
      setError("Selecciona la fecha inicial y final de la semana.");
      return;
    }
    if (startDate > endDate) {
      setError("La fecha final no puede ser anterior a la fecha inicial.");
      return;
    }
    onGenerate(weeklyReportPeriod(startDate, endDate));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal report-builder-modal" role="dialog" aria-modal="true" aria-labelledby="report-builder-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DIRECCIÓN · INFORME DE OBRA</span>
            <h3 id="report-builder-title">Crear informe semanal o mensual</h3>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="upload-intro">
          El documento reúne planificación, obra, urbanismo, ventas, finanzas, seguridad y decisiones pendientes. Los datos proceden del último cierre documental validado.
        </p>
        <div className="report-frequency" role="group" aria-label="Periodicidad del informe">
          <button type="button" className={frequency === "weekly" ? "active" : ""} aria-pressed={frequency === "weekly"} onClick={() => setFrequency("weekly")}>
            <strong>Informe semanal</strong>
            <span>Selecciona un intervalo de fechas</span>
          </button>
          <button type="button" className={frequency === "monthly" ? "active" : ""} aria-pressed={frequency === "monthly"} onClick={() => setFrequency("monthly")}>
            <strong>Informe mensual</strong>
            <span>Selecciona el mes de cierre</span>
          </button>
        </div>
        {frequency === "monthly" ? (
          <label className="report-period-field">
            Mes del informe
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        ) : (
          <div className="form-grid">
            <label>
              Desde
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
        )}
        <div className="report-source-note">
          <strong>Cobertura documental</strong>
          <span>Último cierre validado: {juneReport.cutoff}. El sistema no interpola ni inventa avances entre cortes.</span>
        </div>
        {error && <div className="callout warn"><strong>Revisa el periodo</strong><p>{error}</p></div>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" type="submit">Generar vista previa</button>
        </div>
      </form>
    </div>
  );
}

function DirectionReport({
  period,
  currency,
  onClose,
}: {
  period: DirectionReportPeriod;
  currency: CurrencyCode;
  onClose: () => void;
}) {
  const includesSourceCutoff =
    period.startDate <= REPORT_SOURCE_CUTOFF && period.endDate >= REPORT_SOURCE_CUTOFF;
  const approvedPermits = permits.filter((permit) => permit.status === "Aprobado").length;
  const criticalPackages = workPackages.filter((item) => item.critical);
  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(period.generatedAt));
  const reportKind = period.frequency === "weekly" ? "Informe semanal" : "Informe mensual";
  const dop = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const overdue = formatMoney(juneReport.collections.overdueUsd, "USD", currency);

  return (
    <div className="direction-report-overlay" role="dialog" aria-modal="true" aria-labelledby="direction-report-title">
      <div className="direction-report-toolbar">
        <div>
          <strong>Vista previa para Dirección</strong>
          <span>{reportKind} · {period.label}</span>
        </div>
        <div>
          <button className="button secondary" type="button" onClick={onClose}>Cerrar</button>
          <button className="button primary" type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
      </div>

      <article className="direction-report-document">
        <header className="direction-report-cover">
          <div className="report-brand-row">
            <img src="/bricket-mark.png" alt="Grupo Bricket" />
            <div>
              <span>GRUPO BRICKET · CENTRO DE CONTROL</span>
              <strong>ARAYA Punta Cana</strong>
            </div>
            <img className="report-araya-mark" src="/araya-wordmark.jpg" alt="ARAYA Punta Cana" />
          </div>
          <div className="report-title-block">
            <span>DIRECCIÓN DE PROYECTO</span>
            <h1 id="direction-report-title">{reportKind} de obra</h1>
            <p>{period.label}</p>
          </div>
          <div className="report-meta">
            <span><b>Corte documental</b>{juneReport.cutoff}</span>
            <span><b>Generado</b>{generatedAt}</span>
            <span><b>Moneda visual</b>{currency}</span>
          </div>
        </header>

        <section className={`report-coverage ${includesSourceCutoff ? "verified" : "limited"}`}>
          <strong>{includesSourceCutoff ? "Periodo cubierto por el cierre validado" : "Periodo sin cierre documental exacto"}</strong>
          <p>
            {includesSourceCutoff
              ? `Las cifras corresponden al cierre documental de ${juneReport.cutoff}; las cobranzas tienen corte específico al ${juneReport.collections.cutoff}.`
              : `El periodo seleccionado es ${period.label}, pero el último cierre validado disponible es ${juneReport.cutoff}. Se muestran esos datos como última evidencia disponible, sin interpolaciones.`}
          </p>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <div><span>01 · RESUMEN EJECUTIVO</span><h2>Situación general del proyecto</h2></div>
            <small>Fuente: consolidado de junio 2026</small>
          </div>
          <div className="report-kpi-grid">
            <article><span>Avance real</span><strong>{number.format(juneReport.physical.actual)}%</strong><small>Ejecución física</small></article>
            <article><span>Plan KPI</span><strong>{number.format(juneReport.physical.planned)}%</strong><small>Objetivo documentado</small></article>
            <article className="danger"><span>Desviación</span><strong>{number.format(juneReport.physical.gap)} pp</strong><small>{juneReport.physical.efficiency}% de eficiencia</small></article>
            <article className="warn"><span>Previsión de plazo</span><strong>+{juneReport.physical.mppDelayDays} días</strong><small>Fin previsto {projectSnapshot.forecastFinish}</small></article>
            <article><span>Alcance integrado</span><strong>{projectSnapshot.buildingCount} / {projectSnapshot.masterPlanBuildingCount}</strong><small>Edificios en datos / plano</small></article>
            <article><span>Apartamentos</span><strong>{projectSnapshot.unitCount}</strong><small>26 edificios integrados</small></article>
          </div>
        </section>

        <section className="report-section report-chart-section">
          <div className="report-section-heading">
            <div><span>02 · PLANIFICACIÓN</span><h2>Curva S · plan operativo y ejecución</h2></div>
            <small>Proyección verde · ejecución real roja</small>
          </div>
          <ProgressChart />
          <p className="report-footnote">El KPI principal de plan declara 21,24%; la serie mensual de junio marca 23,29%. Ambas referencias se conservan pendientes de conciliación.</p>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <div><span>03 · PRODUCCIÓN</span><h2>Avance por disciplina y alertas de estructura</h2></div>
            <small>Informe de obra · {juneReport.cutoff}</small>
          </div>
          <div className="report-two-columns">
            <div>
              <h3>Disciplinas</h3>
              <div className="report-progress-list">
                {constructionDisciplines.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}</span>
                    <i><b style={{ width: `${item.progress}%` }} /></i>
                    <strong>{number.format(item.progress)}%</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Mayores retrasos de superestructura</h3>
              <div className="report-delay-grid">
                {structuralDelay.slice(0, 8).map((item) => (
                  <article key={item.building}><strong>{item.building}</strong><span>{item.days} días</span></article>
                ))}
              </div>
              <h3>Paquetes críticos del plan</h3>
              <ul className="report-compact-list">
                {criticalPackages.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.deviationDays} días</strong></li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <div><span>04 · URBANISMO</span><h2>Situación de las obras exteriores</h2></div>
            <small>Real {number.format(projectSnapshot.urbanismProgress)}% · plan {number.format(projectSnapshot.urbanismPlanned)}%</small>
          </div>
          <div className="report-urban-grid">
            {urbanismReportAreas.map((item) => (
              <article key={item.name}>
                <span>{item.name}</span>
                <strong>{number.format(item.progress)}%</strong>
              </article>
            ))}
          </div>
          <p className="report-footnote">{delayedUrbanismStarts.length} inicios de urbanismo figuran retrasados en la fuente; el mayor retraso documentado es de {delayedUrbanismStarts[0].days} días.</p>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <div><span>05 · COMERCIAL Y FINANZAS</span><h2>Ventas, cobranza y posición financiera</h2></div>
            <small>Moneda de visualización: {currency}</small>
          </div>
          <div className="report-kpi-grid compact">
            <article><span>Ventas activas</span><strong>{juneReport.sales.active}</strong><small>{juneReport.sales.juneReservations} reservas en junio</small></article>
            <article className="warn"><span>Cartera vencida</span><strong>{overdue}</strong><small>{juneReport.collections.overdue} clientes</small></article>
            <article><span>Presupuesto</span><strong>{dop(juneReport.finance.budgetDop)}</strong><small>Fuente original DOP</small></article>
            <article><span>Ejecutado acumulado</span><strong>{dop(juneReport.finance.executedDop)}</strong><small>{number.format((juneReport.finance.executedDop / juneReport.finance.budgetDop) * 100)}% del presupuesto</small></article>
            <article className="warn"><span>Cuentas por pagar</span><strong>{dop(juneReport.finance.cxpDop)}</strong><small>Control consolidado</small></article>
            <article className="danger"><span>Caja proyectada a diciembre</span><strong>{dop(juneReport.finance.projectedCashDecemberDop)}</strong><small>Escenario de flujo</small></article>
          </div>
          <p className="report-footnote">{exchangeRateNote(currency)}. Los importes conservan su moneda de origen y solo cambia la presentación.</p>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <div><span>06 · SEGURIDAD Y PERMISOS</span><h2>Control transversal</h2></div>
            <small>{approvedPermits} aprobados · {permits.length - approvedPermits} en proceso</small>
          </div>
          <div className="report-safety-grid">
            {safetyMetrics.map((item) => (
              <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>
            ))}
          </div>
        </section>

        <section className="report-section report-actions-section">
          <div className="report-section-heading">
            <div><span>07 · DECISIONES DE DIRECCIÓN</span><h2>Acciones prioritarias y calidad de datos</h2></div>
            <small>{juneDataQualityIssues.length} conciliaciones abiertas</small>
          </div>
          <ol className="report-actions-list">
            {managementActions.map((action, index) => <li key={action}><b>{String(index + 1).padStart(2, "0")}</b><span>{action}</span></li>)}
          </ol>
          <div className="report-quality-alert">
            <strong>Control de calidad documental</strong>
            <p>El informe toma la versión viva al generarse y mantiene visibles las diferencias entre fuentes; no rellena periodos sin datos normalizados.</p>
          </div>
        </section>

        <footer className="direction-report-footer">
          <span>ARAYA Punta Cana · Centro de Control Grupo Bricket</span>
          <span>{reportKind} · {period.label} · corte fuente {juneReport.cutoff}</span>
        </footer>
      </article>
    </div>
  );
}

function UploadModal({
  initialArea,
  canAccessFinance,
  onClose,
  onComplete,
}: {
  initialArea: UploadArea;
  canAccessFinance: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [area, setArea] = useState<UploadArea>(initialArea);
  const [description, setDescription] = useState("");
  const [declaredCutoff, setDeclaredCutoff] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode | "auto">("auto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await uploadProjectFile(selectedFile, {
        area,
        description,
        declaredCutoff,
        section: areaLabels[area],
        source: "dashboard",
        sourceCurrency,
      });
      onComplete(result.message ?? "Archivo registrado correctamente.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo cargar el archivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal upload-modal" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div><span className="section-kicker">CENTRO DE DATOS · CARGA SEGURA</span><h3>Añadir archivo al proyecto ARAYA</h3></div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="upload-intro">El original se conserva sin modificar. El sistema registra tu identidad y detecta duplicados; al normalizarse, sus datos actualizan todas las pantallas y cualquier contradicción queda observada.</p>
        <div className="upload-dropzone">
          <input
            type="file"
            required
            accept=".xlsx,.xls,.csv,.pptx,.ppt,.pdf,.docx,.doc,.mpp,.dwg,.png,.jpg,.jpeg,.zip"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <strong>{selectedFile ? selectedFile.name : "Selecciona o arrastra un archivo"}</strong>
          <span>{selectedFile ? fileSize(selectedFile.size) : "Excel, CSV, PowerPoint, PDF, Word, MPP, DWG, imagen o ZIP · máximo 50 MB"}</span>
        </div>
        <div className="form-grid">
          <label>
            Área de destino
            <select value={area} onChange={(event) => setArea(event.target.value as UploadArea)}>
              {uploadAreas
                .filter((option) => canAccessFinance || option.id !== "finanzas")
                .map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Fecha de corte declarada
            <input value={declaredCutoff} onChange={(event) => setDeclaredCutoff(event.target.value)} placeholder="Ej. 30/06/2026" />
          </label>
          <label>
            Moneda de origen
            <select value={sourceCurrency} onChange={(event) => setSourceCurrency(event.target.value as CurrencyCode | "auto")}>
              <option value="auto">Automática · sin indicar = DOP</option>
              <option value="DOP">DOP · peso dominicano</option>
              <option value="USD">USD · dólar estadounidense</option>
            </select>
          </label>
          <label className="wide-field">
            Descripción o instrucciones para el agente
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Qué contiene, qué periodo sustituye o con qué archivo debe conciliarse…" />
          </label>
        </div>
        {error && <div className="callout warn"><strong>No se completó la carga</strong><p>{error}</p></div>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" type="submit" disabled={!selectedFile || saving}>{saving ? "Guardando…" : "Guardar y clasificar"}</button>
        </div>
      </form>
    </div>
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
            <span>Apartamentos<strong>{selected.units}</strong></span>
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
          <StatCard eyebrow="Alcance residencial" value="14 edificios" detail="84 apartamentos · 6 por edificio" />
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
              <small>{building.units} apartamentos · dato simulado</small>
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
          <StatCard eyebrow="Apartamentos totales" value="84" detail="14 edificios · 6 por edificio" />
          <StatCard eyebrow="En ejecución" value="36" detail="Estructura o cerramientos" />
          <StatCard eyebrow="Preparadas" value="30" detail="Pendientes de inicio interior" />
          <StatCard eyebrow="Pendientes" value="18" detail="Sin actividad registrada" tone="warn" />
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="section-kicker">INVENTARIO DEMO</span><h3>Apartamentos por edificio</h3></div></div>
          <div className="demo-unit-grid">
            {demoBuildings.map((building) => (
              <article key={building.id}><strong>{building.code}</strong><span>{Array.from({ length: 6 }, (_, index) => <i key={index} title={`${building.code}-${index + 1}`} className={index < Math.ceil(building.progress / 17) ? "active" : ""} />)}</span><small>6 apartamentos · {building.progress}%</small></article>
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
            ["Apartamentos activos", "36", "ud.", "42"],
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

export function DashboardClient({ currentUser }: { currentUser: DashboardUser }) {
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>("araya");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [view, setView] = useState<View>("resumen");
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]);
  const [metrics, setMetrics] = useState<CustomMetric[]>(currentUser.financeAccess ? initialMetrics : []);
  const [supplierRows, setSupplierRows] = useState<Supplier[]>(initialSuppliers);
  const [agentOpen, setAgentOpen] = useState(true);
  const [modal, setModal] = useState<"metric" | "supplier" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false);
  const [directionReport, setDirectionReport] = useState<DirectionReportPeriod | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_DISPLAY_CURRENCY);
  const [liveSync, setLiveSync] = useState<LiveSyncState>({
    status: "syncing",
    revision: 0,
    refreshedAt: "",
    latestEvent: null,
  });
  const activeProject = projects[activeProjectId];
  const availableNavItems = navItems.filter((item) => item.id !== "usuarios" || currentUser.role === "admin");
  const arayaLiveSummary = `${buildings.length} edificios · ${buildings.reduce((total, building) => total + building.units.length, 0)} apartamentos`;

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const timer = window.setTimeout(() => setAgentOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshLiveData() {
      if (refreshing) return;
      refreshing = true;
      try {
        const [liveResponse, dashboardResponse] = await Promise.all([
          fetch("/api/live-data", { cache: "no-store" }),
          fetch("/api/dashboard", { cache: "no-store" }),
        ]);
        if (!liveResponse.ok || !dashboardResponse.ok) throw new Error("Sincronización no disponible");
        const [liveData, dashboardData] = await Promise.all([
          liveResponse.json() as Promise<{
            values?: LiveDataMap;
            revision?: number;
            refreshedAt?: string;
            latestEvent?: LiveSyncState["latestEvent"];
          }>,
          dashboardResponse.json() as Promise<{
            metrics?: CustomMetric[];
            suppliers?: Supplier[];
          }>,
        ]);
        if (!active) return;
        applyLiveValuesToTargets(liveData.values ?? {}, liveDataTargets);
        synchronizeSpatialSummary();
        setMetrics(currentUser.financeAccess
          ? [
            ...(Array.isArray(dashboardData.metrics) ? dashboardData.metrics : []),
            ...initialMetrics,
          ]
          : []);
        setSupplierRows([
          ...(Array.isArray(dashboardData.suppliers) ? dashboardData.suppliers : []),
          ...initialSuppliers,
        ]);
        setLiveSync({
          status: "connected",
          revision: liveData.revision ?? 0,
          refreshedAt: liveData.refreshedAt ?? new Date().toISOString(),
          latestEvent: liveData.latestEvent ?? null,
        });
      } catch {
        if (active) {
          setLiveSync((current) => ({ ...current, status: "offline" }));
        }
      } finally {
        refreshing = false;
      }
    }

    void refreshLiveData();
    const interval = window.setInterval(() => void refreshLiveData(), 5_000);
    const handleFileUpdate = () => void refreshLiveData();
    window.addEventListener("araya-files-updated", handleFileUpdate);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("araya-files-updated", handleFileUpdate);
    };
  }, [currentUser.financeAccess]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    if (activeProjectId === "mirador") {
      return demoBuildings
        .filter((item) => item.code.toLowerCase().includes(term))
        .map((item) => ({
          label: item.code,
          detail: `${item.progress}% de avance · ${item.units} apartamentos · demo`,
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
      ...(currentUser.financeAccess
        ? metrics
          .filter((item) => item.name.toLowerCase().includes(term))
          .map((item) => ({ label: item.name, detail: `${item.value} ${item.unit}`, view: "metricas" as View, building: null }))
        : []),
    ].slice(0, 8);
  }, [activeProjectId, search, supplierRows, metrics, currentUser.financeAccess]);

  function content() {
    if (view === "usuarios" && currentUser.role === "admin") return <UsersAdminView currentUser={currentUser} />;
    if (activeProjectId === "mirador") return <DemoProjectContent view={view} onNavigate={setView} />;
    if (view === "resumen") return <Overview onNavigate={setView} onSelectBuilding={setSelectedBuilding} currency={currency} canAccessFinance={currentUser.financeAccess} />;
    if (view === "planificacion") return <Planning />;
    if (view === "implantacion") return <div className="view-stack"><SitePlan onNavigate={setView} onSelectBuilding={setSelectedBuilding} /></div>;
    if (view === "edificios") return <BuildingsView selected={selectedBuilding} setSelected={setSelectedBuilding} />;
    if (view === "viviendas") return <HousingView />;
    if (view === "comercial") return <CommercialView currency={currency} />;
    if (view === "urbanismo") return <UrbanismView />;
    if (view === "control") return <ControlView currency={currency} canAccessFinance={currentUser.financeAccess} />;
    if (view === "cronologia") return <TimelineView />;
    if (view === "proveedores") return <SuppliersView suppliers={supplierRows} onAdd={() => setModal("supplier")} currency={currency} canAccessFinance={currentUser.financeAccess} />;
    if (view === "metricas") return currentUser.financeAccess ? <MetricsView metrics={metrics} onAdd={() => setModal("metric")} currency={currency} /> : <FinanceLockedView />;
    if (view === "fuentes") return <SourcesView onUpload={() => setUploadOpen(true)} canAccessFinance={currentUser.financeAccess} />;
    return <AgentPanel expanded onClose={() => setView("resumen")} currency={currency} />;
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
            {activeProject.id === "araya" ? (
              <div className="project-wordmark">
                <img src="/araya-wordmark.jpg" alt="ARAYA Punta Cana" />
                <small>{arayaLiveSummary}</small>
              </div>
            ) : (
              <>
                <b>{activeProject.code}</b>
                <div>
                  <strong>{activeProject.name}</strong>
                  <small>{activeProject.summary}</small>
                </div>
              </>
            )}
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
                    setUploadOpen(false);
                    setReportBuilderOpen(false);
                    setDirectionReport(null);
                    setAgentOpen(project.id === "araya");
                  }}
                >
                  {project.id === "araya" ? (
                    <div className="project-wordmark">
                      <img src="/araya-wordmark.jpg" alt="ARAYA Punta Cana" />
                      <small>{arayaLiveSummary}</small>
                    </div>
                  ) : (
                    <>
                      <b>{project.code}</b>
                      <div>
                        <strong>{project.name}</strong>
                        <small>Proyecto ficticio · demostración</small>
                      </div>
                    </>
                  )}
                  <i>{activeProjectId === project.id ? "✓" : ""}</i>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav>
          <span className="nav-label">NAVEGACIÓN</span>
          {availableNavItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                if (item.id === "agente") setAgentOpen(false);
              }}
            >
              <i>{item.mark}</i><span>{item.label}</span>
              {item.id === "fuentes" && <em>{activeProjectId === "araya"
                ? currentUser.financeAccess
                  ? dataSources.length
                  : dataSources.filter((source) => !/financ|balance|flujo|cxp|antonely/i.test(`${source.kind} ${source.file}`)).length
                : 3}</em>}
              {item.id === "metricas" && !currentUser.financeAccess && <em className="restricted">BLOQUEADO</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span><i className="live-dot" /> {activeProjectId === "araya" ? "Datos vivos conectados" : "Fuentes integradas"}</span>
          <small>
            {activeProjectId === "araya"
              ? liveSync.status === "connected"
                ? `Versión ${liveSync.revision || "base"} · refresco cada 5 s`
                : "Reconectando sincronización…"
              : "Proyecto demo · datos simulados"}
          </small>
        </div>
      </aside>

      <main className={`main-area ${agentOpen && view !== "agente" ? "with-agent" : ""}`}>
        <Header
          view={view}
          project={activeProject}
          onAsk={() => setAgentOpen(true)}
          onUpload={() => setUploadOpen(true)}
          onReport={() => setReportBuilderOpen(true)}
          currency={currency}
          onCurrencyChange={setCurrency}
          liveSync={liveSync}
          currentUser={currentUser}
          canAccessFinance={currentUser.financeAccess}
        />
        <div className="global-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={activeProjectId === "araya" ? "Buscar edificio, apartamento, urbanismo, proveedor o métrica…" : "Buscar edificio demo (ej. MP-04)…"}
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
        {activeProjectId === "araya" && (
          <div className={`live-data-ribbon ${liveSync.status}`} role="status" aria-live="polite">
            <span className="live-dot" />
            <strong>Centro de Control sincronizado</strong>
            <span>Gráficas, cifras, porcentajes, cronograma y avance se actualizan automáticamente cada 5 segundos.</span>
            <em>
              {liveSync.latestEvent?.sourceName
                ? `Última fuente: ${liveSync.latestEvent.sourceName}${liveSync.latestEvent.cutoff ? ` · corte ${liveSync.latestEvent.cutoff}` : ""}`
                : "Base consolidada con trazabilidad por fuente, fecha y versión"}
            </em>
          </div>
        )}
        <div className="content">{content()}</div>
      </main>

      {activeProjectId === "araya" && agentOpen && view !== "agente" && <AgentPanel expanded={false} onClose={() => setAgentOpen(false)} currency={currency} />}

      {activeProjectId === "araya" && modal && (
        <RecordModal
          type={modal}
          onClose={() => setModal(null)}
          onSaveMetric={(metric) => setMetrics((current) => [metric, ...current])}
          onSaveSupplier={(supplier) => setSupplierRows((current) => [supplier, ...current])}
        />
      )}

      {activeProjectId === "araya" && uploadOpen && (
        <UploadModal
          initialArea={!currentUser.financeAccess && defaultUploadArea[view] === "finanzas" ? "auto" : defaultUploadArea[view]}
          canAccessFinance={currentUser.financeAccess}
          onClose={() => setUploadOpen(false)}
          onComplete={(message) => {
            setUploadOpen(false);
            setNotice(message);
            window.setTimeout(() => setNotice(""), 6000);
          }}
        />
      )}

      {activeProjectId === "araya" && reportBuilderOpen && (
        <ReportBuilder
          onClose={() => setReportBuilderOpen(false)}
          onGenerate={(period) => {
            setReportBuilderOpen(false);
            setDirectionReport(period);
          }}
        />
      )}

      {activeProjectId === "araya" && directionReport && (
        <DirectionReport
          period={directionReport}
          currency={currency}
          onClose={() => setDirectionReport(null)}
        />
      )}

      {notice && <div className="upload-toast" role="status"><strong>Archivo recibido</strong><span>{notice}</span></div>}
    </div>
  );
}
