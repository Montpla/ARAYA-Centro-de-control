"use client";

import { Component, ChangeEvent, FormEvent, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type {
  Building,
  CustomMetric,
  Supplier,
  Unit,
  UnitDiscipline,
  UrbanismArea,
} from "./demo-data";
import type { DashboardBootstrapData } from "../lib/dashboard-bootstrap-types";
import { mergeFileRegistryRecords } from "../lib/file-registry-pagination";
import {
  unitDisciplines as sharedUnitDisciplines,
  unitOverallProgress as sharedUnitOverallProgress,
} from "../lib/unit-progress";
import { computedView } from "../lib/computed-view";
import {
  liveAntonelyDetailTotals,
  liveDataAuthorityMatrix,
  liveDataGovernanceSummary,
  liveFiduciaryManagementReconciliation,
  liveFiduciaryStatementSummary,
  liveJuneDeviationSummary,
  liveJuneReportFinance,
  livePayablesReconciliation,
  liveProcurementAudit,
  liveReprogrammedFlowQualityIssues,
  liveSupplierContactAudit,
  liveTypeABudgetSummary,
} from "../lib/live-derivations";

let buildings: DashboardBootstrapData["demo"]["buildings"] = [];
let cubicaciones: DashboardBootstrapData["demo"]["cubicaciones"] = [];
let initialMetrics: DashboardBootstrapData["demo"]["customMetrics"] = [];
let dataSources: DashboardBootstrapData["demo"]["dataSources"] = [];
let monthlyPlan: DashboardBootstrapData["demo"]["monthlyPlan"] = [];
let projectSnapshot = {} as DashboardBootstrapData["demo"]["projectSnapshot"];
let initialSuppliers: DashboardBootstrapData["demo"]["suppliers"] = [];
let timeline: DashboardBootstrapData["demo"]["timeline"] = [];
let urbanismAreas: DashboardBootstrapData["demo"]["urbanismAreas"] = [];
let workPackages: DashboardBootstrapData["demo"]["workPackages"] = [];

let advances: DashboardBootstrapData["june"]["advances"] = [];
let antonelyFinanceSource = {} as DashboardBootstrapData["june"]["antonelyFinanceSource"];
let arrearsBreakdown: DashboardBootstrapData["june"]["arrearsBreakdown"] = [];
let constructionDisciplines: DashboardBootstrapData["june"]["constructionDisciplines"] = [];
let costBreakdown: DashboardBootstrapData["june"]["costBreakdown"] = [];
let cxpAging: DashboardBootstrapData["june"]["cxpAging"] = [];
let cxpCategories: DashboardBootstrapData["june"]["cxpCategories"] = [];
let delayedUrbanismStarts: DashboardBootstrapData["june"]["delayedUrbanismStarts"] = [];
let financialProjection: DashboardBootstrapData["june"]["financialProjection"] = [];
let financingProcesses: DashboardBootstrapData["june"]["financingProcesses"] = [];
let juneDataQualityIssues: DashboardBootstrapData["june"]["juneDataQualityIssues"] = [];
let juneReport = {} as DashboardBootstrapData["june"]["juneReport"];
let managementActions: DashboardBootstrapData["june"]["managementActions"] = [];
let payablesReconciliation: DashboardBootstrapData["june"]["payablesReconciliation"] = [];
let permits: DashboardBootstrapData["june"]["permits"] = [];
let safetyFindings: DashboardBootstrapData["june"]["safetyFindings"] = [];
let safetyMetrics: DashboardBootstrapData["june"]["safetyMetrics"] = [];
let salesLocations: DashboardBootstrapData["june"]["salesLocations"] = [];
let salesModels: DashboardBootstrapData["june"]["salesModels"] = [];
let structuralDelay: DashboardBootstrapData["june"]["structuralDelay"] = [];
let urbanismReportAreas: DashboardBootstrapData["june"]["urbanismReportAreas"] = [];

let antonelyAdvances: DashboardBootstrapData["antonely"]["antonelyAdvances"] = [];
let antonelyBalanceLines: DashboardBootstrapData["antonely"]["antonelyBalanceLines"] = [];
let antonelyCostAccounts: DashboardBootstrapData["antonely"]["antonelyCostAccounts"] = [];
let antonelyDetailTotals = {} as DashboardBootstrapData["antonely"]["antonelyDetailTotals"];
let antonelyPayableCategories: DashboardBootstrapData["antonely"]["antonelyPayableCategories"] = [];
let antonelyPayableVendorsAll: DashboardBootstrapData["antonely"]["antonelyPayableVendorsAll"] = [];

let ifcComplianceGroups: DashboardBootstrapData["procurement"]["ifcComplianceGroups"] = [];
let juneDeviationSummary = {} as DashboardBootstrapData["procurement"]["juneDeviationSummary"];
let monthlyDeviationLines: DashboardBootstrapData["procurement"]["monthlyDeviationLines"] = [];
let procurementAudit = {} as DashboardBootstrapData["procurement"]["procurementAudit"];
let procurementMonthlySchedule: DashboardBootstrapData["procurement"]["procurementMonthlySchedule"] = [];
let procurementPackages: DashboardBootstrapData["procurement"]["procurementPackages"] = [];
let procurementQualityIssues: DashboardBootstrapData["procurement"]["procurementQualityIssues"] = [];
let supplierComparisons: DashboardBootstrapData["procurement"]["supplierComparisons"] = [];
let supplierContactAudit = {} as DashboardBootstrapData["procurement"]["supplierContactAudit"];
let supplierDirectory: DashboardBootstrapData["procurement"]["supplierDirectory"] = [];
let typeABudgetChapters: DashboardBootstrapData["procurement"]["typeABudgetChapters"] = [];
let typeABudgetSummary = {} as DashboardBootstrapData["procurement"]["typeABudgetSummary"];

let reprogrammedFlowAudit = {} as DashboardBootstrapData["reprogrammedFlow"]["reprogrammedFlowAudit"];
let reprogrammedFlowMonths: DashboardBootstrapData["reprogrammedFlow"]["reprogrammedFlowMonths"] = [];
let reprogrammedFlowQualityIssues: DashboardBootstrapData["reprogrammedFlow"]["reprogrammedFlowQualityIssues"] = [];
let reprogrammedFlowScopes: DashboardBootstrapData["reprogrammedFlow"]["reprogrammedFlowScopes"] = [];

let fiduciaryBalanceSections: DashboardBootstrapData["fiduciary"]["fiduciaryBalanceSections"] = [];
let fiduciaryManagementReconciliation: DashboardBootstrapData["fiduciary"]["fiduciaryManagementReconciliation"] = [];
let fiduciaryStatementQualityIssues: DashboardBootstrapData["fiduciary"]["fiduciaryStatementQualityIssues"] = [];
let fiduciaryStatementSummary = {} as DashboardBootstrapData["fiduciary"]["fiduciaryStatementSummary"];

let dataAuthorityMatrix: DashboardBootstrapData["governance"]["dataAuthorityMatrix"] = [];
let dataGovernanceSummary = {} as DashboardBootstrapData["governance"]["dataGovernanceSummary"];
let sourceGovernance: DashboardBootstrapData["governance"]["sourceGovernance"] = {};
import {
  CurrencyCode,
  DEFAULT_DISPLAY_CURRENCY,
  exchangeRateNote,
  formatMoney,
  formatMoneyMillions,
} from "../lib/currency";
import {
  UploadArea,
  UserArea,
  areaLabels,
  documentTypeLabels,
  reviewStatusLabels,
  uploadAreas,
  uploadStatusLabels,
  userAreas,
} from "../lib/file-routing";
import {
  LiveDataMap,
  applyLiveValuesToTargets,
  requiresFinanceAccessForArea,
} from "../lib/live-data";
import {
  ArchivedReportSnapshot,
  ControlRoomPanel,
  ControlRoomSnapshot,
} from "./control-room-panel";
import {
  BiometricGate,
  DeviceBootScreen,
  DeviceCenter,
  OfflineAccessGate,
  enrollPlatformBiometric,
  platformBiometricAvailable,
  readBiometricRecord,
  removeBiometricRecord,
  verifyPlatformBiometric,
} from "./device-center";
import type {
  DeviceNotificationItem,
  DeviceNotificationPermission,
  LocalBiometricRecord,
} from "./device-center";

// DashboardClient llama a esto en cada render (no sólo al montar). Sin este
// guard, cada actualización de estado (cada poll de 5s) volvía a pisar todas
// las variables módulo-nivel con la instantánea estática del SSR, borrando
// en el acto cualquier valor recién derivado por synchronizeSpatialSummary()
// que reasigna la variable a un objeto nuevo (spread) en vez de mutar el
// existente in place. Los campos mutados in place (projectSnapshot.x = y,
// monthlyPlan[i] = {...}) sobrevivían porque seguían siendo el mismo objeto;
// los reasignados (juneReport = liveJuneReportFinance(...), etc.) no.
let dashboardBootstrapInstalled = false;
function installDashboardBootstrap(bootstrap: DashboardBootstrapData) {
  if (dashboardBootstrapInstalled) return;
  dashboardBootstrapInstalled = true;
  ({
    buildings,
    cubicaciones,
    customMetrics: initialMetrics,
    dataSources,
    monthlyPlan,
    projectSnapshot,
    suppliers: initialSuppliers,
    timeline,
    urbanismAreas,
    workPackages,
  } = bootstrap.demo);
  ({
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
  } = bootstrap.june);
  ({
    antonelyAdvances,
    antonelyBalanceLines,
    antonelyCostAccounts,
    antonelyPayableCategories,
    antonelyPayableVendorsAll,
  } = bootstrap.antonely);
  // antonelyDetailTotals, typeABudgetSummary, juneDeviationSummary,
  // procurementAudit, supplierContactAudit y dataGovernanceSummary son
  // resúmenes puros de otros arreglos en vivo (antonelyAdvances,
  // typeABudgetChapters, monthlyDeviationLines, ...). En vez de guardar una
  // copia que haya que recordar resincronizar cada vez que llega un dato
  // nuevo (el bug de "el plan operativo se quedó en junio" de esta misma
  // sesión), se envuelven con computedView: cada lectura de un campo
  // recalcula sobre los datos en vivo actuales, así que no existe copia que
  // se pueda quedar congelada.
  const baseAntonelyDetailTotals = bootstrap.antonely.antonelyDetailTotals;
  antonelyDetailTotals = computedView(baseAntonelyDetailTotals, () =>
    liveAntonelyDetailTotals(baseAntonelyDetailTotals, {
      advances: antonelyAdvances,
      costAccounts: antonelyCostAccounts,
      payableCategories: antonelyPayableCategories,
      balanceLines: antonelyBalanceLines,
    }));
  ({
    ifcComplianceGroups,
    monthlyDeviationLines,
    procurementMonthlySchedule,
    procurementPackages,
    procurementQualityIssues,
    supplierComparisons,
    supplierDirectory,
    typeABudgetChapters,
  } = bootstrap.procurement);
  const baseJuneDeviationSummary = bootstrap.procurement.juneDeviationSummary;
  juneDeviationSummary = computedView(baseJuneDeviationSummary, () =>
    liveJuneDeviationSummary(baseJuneDeviationSummary, monthlyDeviationLines));
  const baseProcurementAudit = bootstrap.procurement.procurementAudit;
  procurementAudit = computedView(baseProcurementAudit, () =>
    liveProcurementAudit(baseProcurementAudit, procurementPackages, supplierComparisons, procurementMonthlySchedule));
  const baseSupplierContactAudit = bootstrap.procurement.supplierContactAudit;
  supplierContactAudit = computedView(baseSupplierContactAudit, () =>
    liveSupplierContactAudit(baseSupplierContactAudit, supplierDirectory));
  const baseTypeABudgetSummary = bootstrap.procurement.typeABudgetSummary;
  typeABudgetSummary = computedView(baseTypeABudgetSummary, () =>
    liveTypeABudgetSummary(baseTypeABudgetSummary, typeABudgetChapters));
  ({
    reprogrammedFlowAudit,
    reprogrammedFlowMonths,
    reprogrammedFlowQualityIssues,
    reprogrammedFlowScopes,
  } = bootstrap.reprogrammedFlow);
  ({
    fiduciaryBalanceSections,
    fiduciaryManagementReconciliation,
    fiduciaryStatementQualityIssues,
    fiduciaryStatementSummary,
  } = bootstrap.fiduciary);
  ({
    dataAuthorityMatrix,
    sourceGovernance,
  } = bootstrap.governance);
  const baseDataGovernanceSummary = bootstrap.governance.dataGovernanceSummary;
  dataGovernanceSummary = computedView(baseDataGovernanceSummary, () =>
    liveDataGovernanceSummary(baseDataGovernanceSummary, dataAuthorityMatrix));

  liveDataTargets = {
    advances,
    antonelyAdvances,
    antonelyBalanceLines,
    antonelyCostAccounts,
    // antonelyDetailTotals deliberadamente fuera: es un computedView (ver
    // más arriba), y applyLiveValuesToTargets clona un valor base la
    // primera vez que ve un target y lo cachea para siempre — si el target
    // es un Proxy que recalcula solo, ese clon lo congelaría en su primer
    // valor calculado, deshaciendo el propósito de computedView.
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
    fiduciaryBalanceSections,
    fiduciaryManagementReconciliation,
    fiduciaryStatementQualityIssues,
    fiduciaryStatementSummary,
    juneDataQualityIssues,
    juneReport,
    managementActions,
    monthlyDeviationLines,
    monthlyPlan,
    payablesReconciliation,
    permits,
    procurementMonthlySchedule,
    procurementPackages,
    procurementQualityIssues,
    projectSnapshot,
    reprogrammedFlowAudit,
    reprogrammedFlowMonths,
    reprogrammedFlowQualityIssues,
    reprogrammedFlowScopes,
    safetyFindings,
    safetyMetrics,
    salesLocations,
    salesModels,
    structuralDelay,
    supplierComparisons,
    supplierDirectory,
    timeline,
    typeABudgetChapters,
    urbanismAreas,
    urbanismReportAreas,
    workPackages,
  };
  const visibleSourceIds = dataSources.map((source) => source.id);
  if (workspaceAreaConfigs.fuentes) {
    workspaceAreaConfigs.fuentes.sourceIds = visibleSourceIds;
    workspaceAreaConfigs.fuentes.modules[0].sourceIds = visibleSourceIds;
  }
  statCardLinks["Datos gobernados"] = {
    view: "fuentes",
    sourceIds: dataAuthorityMatrix.map((item) => item.primarySourceId),
  };
  projects.araya.cutoff = projectSnapshot.declaredCutoff;
}

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

export type DashboardUser = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "member";
  area: UserArea;
  financeAccess: boolean;
  active: boolean;
  avatarUrl: string;
};

type ManagedUser = DashboardUser & {
  lastLoginAt: string;
  deletedAt: string;
  deletedByEmail: string;
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
  processingStage: string;
  processingProgress: number;
  processingSummary: string;
  requiresReview: boolean;
  projectId: string;
  documentType: string;
  detectedPeriod: string;
  extractionMode: string;
  extractionConfidence: number;
  extractionSummary: string;
  discrepancyCount: number;
  reviewStatus: string;
  reviewedByName: string;
  reviewedAt: string;
  reviewNote: string;
  publicationRevision: number | null;
  publishedAt: string;
  deletedAt: string;
  deletedByName: string;
  deleteReason: string;
  restoredAt: string;
  createdAt: string;
  updatedAt: string;
  canManage: boolean;
  downloadUrl: string;
};

type FileRegistrySummary = {
  total: number;
  active: number;
  deleted: number;
  pendingReview: number;
  synchronized: number;
  observed: number;
  averageProgress: number;
  discrepancies: number;
  lastUploadAt: string;
};

type FileRegistryPayload = {
  files?: UploadedFileRecord[];
  removedIds?: string[];
  hasMore?: boolean;
  nextCursor?: string | null;
  changeCursor?: string;
  nextChangeCursor?: string;
  summary?: FileRegistrySummary;
  error?: string;
};

type FileViewerState = {
  url: string;
  title: string;
};

type UploadResult = {
  duplicate?: boolean;
  message?: string;
  error?: string;
  file?: UploadedFileRecord;
};

type DocumentDataProposal = {
  id: string;
  key: string;
  label: string;
  value: unknown;
  previousValue: unknown;
  valueType: string;
  area: string;
  sourceCurrency: CurrencyCode;
  cutoff: string;
  confidence: number;
  discrepancy: boolean;
  status: string;
  notes: string;
};

type UnmappedFieldCandidate = {
  id: string;
  label: string;
  description: string;
  value: unknown;
  suggestedArea: string;
  suggestedAreaLabel: string;
  evidence: string;
  confidence: number;
  status: string;
  reviewedByName: string;
  reviewedAt: string;
  reviewNote: string;
  createdAt: string;
};

type FileReviewDetail = {
  file: Pick<
    UploadedFileRecord,
    | "id"
    | "originalName"
    | "area"
    | "areaLabel"
    | "documentType"
    | "detectedPeriod"
    | "extractionMode"
    | "extractionConfidence"
    | "extractionSummary"
    | "discrepancyCount"
    | "reviewStatus"
    | "reviewNote"
    | "reviewedByName"
    | "reviewedAt"
    | "publicationRevision"
    | "publishedAt"
    | "status"
    | "sourceCurrency"
    | "declaredCutoff"
    | "classificationReason"
    | "processingSummary"
    | "downloadUrl"
  >;
  proposals: DocumentDataProposal[];
  unmappedCandidates: UnmappedFieldCandidate[];
  reviews: Array<{
    id: number;
    action: string;
    note: string;
    proposalCount: number;
    publicationRevision: number | null;
    actorName: string;
    createdAt: string;
  }>;
  activity: Array<{
    id: number;
    eventType: string;
    message: string;
    actorName: string;
    createdAt: string;
  }>;
  permissions: {
    canReview: boolean;
    canAccessFinance: boolean;
  };
};

type ProjectId = "araya" | "mirador";

type ReportFrequency = "weekly" | "monthly";

type ReportType = "global" | "obra_seguridad" | "finanzas" | "ventas";

const reportTypeOptions: Array<{ id: ReportType; label: string; detail: string; requiresFinance: boolean }> = [
  { id: "global", label: "Informe general", detail: "Planificación, obra, urbanismo, ventas, finanzas, seguridad y decisiones.", requiresFinance: true },
  { id: "obra_seguridad", label: "Obra y Seguridad", detail: "Planificación, producción, urbanismo, seguridad y permisos.", requiresFinance: false },
  { id: "finanzas", label: "Finanzas", detail: "Presupuesto, cuentas por pagar, anticipos y fideicomiso.", requiresFinance: true },
  { id: "ventas", label: "Ventas y cobranza", detail: "Reservas, contratos, cartera y modelos comerciales.", requiresFinance: true },
];

type DirectionReportPeriod = {
  frequency: ReportFrequency;
  reportType: ReportType;
  startDate: string;
  endDate: string;
  label: string;
  generatedAt: string;
  archivedReportId?: string;
  liveRevision?: number;
  sourceCutoff?: string;
  archivedSnapshot?: ArchivedReportSnapshot | null;
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

type ServerNotification = {
  id: number;
  kind: string;
  projectId: string;
  area: string;
  actorName: string;
  subjectType: string;
  subjectId: string;
  title: string;
  body: string;
  view: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string;
  openedAt: string;
  read: boolean;
};

type ServerNotificationsResponse = {
  notifications?: ServerNotification[];
  cursor?: number;
  refreshIntervalMs?: number;
  refreshedAt?: string;
  error?: string;
};

type NotificationReadPatch = {
  ids?: number[];
  openedId?: number;
  readThroughId?: number;
};

type PushConfigResponse = {
  enabled?: boolean;
  publicKey?: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type AppErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
  variant?: "view" | "overlay";
  onRecover: () => void;
};

class AppErrorBoundary extends Component<AppErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("La vista del Centro de Control no pudo renderizarse.", error, info);
  }

  componentDidUpdate(previous: AppErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  private recover = () => {
    this.setState({ failed: false });
    this.props.onRecover();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className={`app-recovery ${this.props.variant === "overlay" ? "overlay" : ""}`} role="alert">
        <span>RECUPERACIÓN SEGURA</span>
        <h2>Esta pantalla no ha podido mostrarse.</h2>
        <p>Los datos siguen guardados. Puedes volver al Centro de Control o recargar la aplicación.</p>
        <div>
          <button className="button primary" type="button" onClick={this.recover}>Volver al inicio</button>
          <button className="button secondary" type="button" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      </section>
    );
  }
}

type HistoryChange = {
  id: number;
  revision: number;
  key: string;
  area: string;
  sourceName: string;
  cutoff: string;
  actorName: string;
  createdAt: string;
  valuePreview: string;
};

type HistoryActivity = {
  id: number;
  fileId: string;
  fileName: string;
  eventType: string;
  message: string;
  actorName: string;
  createdAt: string;
};

type OperationalAlert = {
  id: string;
  area: UserArea;
  severity: "critical" | "medium" | "low";
  label: string;
  title: string;
  detail: string;
  view: View;
};

type WorkspaceSearchResult = {
  label: string;
  detail: string;
  view: View;
  building: Building | null;
  sourceId?: string;
};

type PayableInvoice = {
  id: string;
  vendorName: string;
  reference: string | null;
  invoiceDate: string;
  dueDate: string;
  amountDop: number;
  agingIndex: number;
  allocations: Array<{
    category: string;
    amountDop: number;
    sourceRow: number;
  }>;
  documentUrl: string | null;
};

type PayablesDataset = {
  cutoff: string;
  sourceName: string;
  sourceSheet: string;
  sourceUrl: string;
  updatedAt: string | null;
  sourceLineCount: number;
  invoiceCount: number;
  vendorCount: number;
  totalDop: number;
  vendors: Array<{
    name: string;
    amountDop: number;
    invoiceCount: number;
    sourceLineCount: number;
    documentCount: number;
    oldestAgingIndex: number;
  }>;
  invoices: PayableInvoice[];
};

type WorkspaceDetail = {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  status?: "live" | "partial" | "ready" | "observed";
  metrics?: Array<{ label: string; value: string }>;
  notes?: string[];
  pendingFields?: string[];
  sourceIds?: string[];
  actions?: Array<{ label: string; view: View }>;
};

type WorkspaceModule = {
  id: string;
  label: string;
  detail: string;
  status: "live" | "partial" | "ready" | "observed";
  sourceIds: string[];
  targetView?: View;
  pendingFields?: string[];
};

type WorkspaceAreaConfig = {
  kicker: string;
  title: string;
  description: string;
  sourceIds: string[];
  modules: WorkspaceModule[];
  connections: Array<{ label: string; view: View }>;
};

const WorkspaceDetailContext = createContext<{
  enabled: boolean;
  openDetail: (detail: WorkspaceDetail) => void;
}>({
  enabled: false,
  openDetail: () => undefined,
});

const workspaceAreaConfigs: Partial<Record<View, WorkspaceAreaConfig>> = {
  resumen: {
    kicker: "MAPA OPERATIVO DEL PROYECTO",
    title: "Resumen conectado con todas las áreas",
    description: "Cada bloque abre la sección responsable y conserva el documento que respalda el dato.",
    sourceIds: ["source-june-consolidated", "source-june-pdf", "source-xls", "source-mpp"],
    modules: [
      { id: "executive-kpis", label: "Indicadores ejecutivos", detail: "Avance, plazo, alcance y alertas del corte.", status: "live", sourceIds: ["source-june-consolidated", "source-xls", "source-mpp"], targetView: "planificacion" },
      { id: "spatial-control", label: "Control espacial", detail: "Edificios, apartamentos y urbanismo enlazados con el plano.", status: "live", sourceIds: ["source-dwg-implantacion", "source-mpp"], targetView: "implantacion" },
      { id: "direction-reports", label: "Informes de Dirección", detail: "Generación semanal y mensual con el último cierre validado.", status: "live", sourceIds: ["source-june-consolidated", "source-june-pdf"], targetView: "fuentes" },
      { id: "decision-log", label: "Decisiones y alertas", detail: "Brechas priorizadas y acciones de recuperación.", status: "partial", sourceIds: ["source-june-consolidated", "source-june-works"], targetView: "cronologia", pendingFields: ["Responsable", "Fecha objetivo", "Estado de la decisión"] },
    ],
    connections: [{ label: "Planificación", view: "planificacion" }, { label: "Implantación", view: "implantacion" }, { label: "Centro de datos", view: "fuentes" }],
  },
  planificacion: {
    kicker: "ESTRUCTURA DE PLANIFICACIÓN",
    title: "Cronograma, Curva S y recuperación",
    description: "Los paquetes, hitos y desviaciones quedan preparados para recibir nuevas actualizaciones del MPP y del avance físico.",
    sourceIds: ["source-mpp", "source-xls", "source-june-works", "source-june-consolidated"],
    modules: [
      { id: "s-curve", label: "Curva S", detail: "Plan operativo y ejecutado real por mes.", status: "live", sourceIds: ["source-xls", "source-june-works"] },
      { id: "master-schedule", label: "Cronograma maestro", detail: "Paquetes, línea base, fin previsto y camino crítico.", status: "live", sourceIds: ["source-mpp"], targetView: "cronologia" },
      { id: "recovery-plan", label: "Plan de recuperación", detail: "Acciones propuestas y seguimiento de su ejecución.", status: "partial", sourceIds: ["source-june-works"], pendingFields: ["Responsable", "Inicio", "Fin", "Evidencia", "Resultado"] },
      { id: "lookahead", label: "Lookahead semanal", detail: "Espacio preparado para planificación de corto plazo.", status: "ready", sourceIds: ["source-mpp"], pendingFields: ["Actividades próximas", "Restricciones", "Compromisos semanales"] },
    ],
    connections: [{ label: "Edificios", view: "edificios" }, { label: "Cronología", view: "cronologia" }, { label: "Informe de obra", view: "fuentes" }],
  },
  implantacion: {
    kicker: "MODELO ESPACIAL CONECTADO",
    title: "Plano, edificios, apartamentos y urbanismo",
    description: "Cada elemento del plano abre su ficha y queda enlazado con el inventario operativo y la documentación técnica.",
    sourceIds: ["source-dwg-implantacion", "source-mpp", "source-june-works"],
    modules: [
      { id: "masterplan", label: "Plano general", detail: "Implantación visual y plano técnico DWG.", status: "live", sourceIds: ["source-dwg-implantacion"] },
      { id: "building-layer", label: "Capa de edificios", detail: "26 edificios integrados y 51 posiciones de implantación.", status: "live", sourceIds: ["source-dwg-implantacion", "source-mpp"], targetView: "edificios" },
      { id: "apartment-layer", label: "Capa de apartamentos", detail: "156 fichas operativas enlazadas con sus edificios.", status: "live", sourceIds: ["source-mpp"], targetView: "viviendas" },
      { id: "urban-layer", label: "Capas de urbanismo", detail: "Viales, estacionamientos, paisajismo, acceso y equipamientos.", status: "partial", sourceIds: ["source-dwg-implantacion", "source-june-works"], targetView: "urbanismo" },
    ],
    connections: [{ label: "Edificios", view: "edificios" }, { label: "Apartamentos", view: "viviendas" }, { label: "Urbanismo", view: "urbanismo" }],
  },
  edificios: {
    kicker: "CONTROL DE PRODUCCIÓN",
    title: "Edificios y disciplinas de obra",
    description: "La ficha de cada edificio concentra apartamentos, avance, desviaciones, incidencias y futuras evidencias.",
    sourceIds: ["source-mpp", "source-june-works", "source-xls"],
    modules: [
      { id: "building-register", label: "Registro de 26 edificios", detail: "Avance, previsión y desviación por edificio.", status: "live", sourceIds: ["source-mpp"] },
      { id: "disciplines", label: "Disciplinas", detail: "Superestructura, albañilería, instalaciones y acabados.", status: "partial", sourceIds: ["source-june-works", "source-mpp"], pendingFields: ["Avance por disciplina y edificio", "Fecha de corte"] },
      { id: "materials", label: "Materiales y suministros", detail: "Pedidos vencidos y restricciones de producción.", status: "partial", sourceIds: ["source-june-works"], targetView: "proveedores", pendingFields: ["Pedido", "Proveedor", "Entrega comprometida", "Estado"] },
      { id: "field-evidence", label: "Evidencias de campo", detail: "Espacio preparado para fotografías, actas e incidencias.", status: "ready", sourceIds: [], pendingFields: ["Fotografías", "Responsable", "Incidencias", "Acta semanal"] },
    ],
    connections: [{ label: "Apartamentos", view: "viviendas" }, { label: "Planificación", view: "planificacion" }, { label: "Proveedores", view: "proveedores" }],
  },
  viviendas: {
    kicker: "FICHAS INDIVIDUALES",
    title: "Apartamentos preparados para el ciclo completo",
    description: "Cada apartamento admite nuevas disciplinas, responsables, incidencias, documentos y evidencias sin cambiar la interfaz.",
    sourceIds: ["source-mpp", "source-june-works"],
    modules: [
      { id: "unit-progress", label: "Avance por apartamento", detail: "Superestructura disponible en las 156 fichas.", status: "live", sourceIds: ["source-mpp"] },
      { id: "unit-disciplines", label: "Disciplinas interiores", detail: "Estructura preparada para albañilería, instalaciones y acabados.", status: "ready", sourceIds: [], pendingFields: ["Albañilería", "Electricidad", "Sanitaria", "Climatización", "Acabados"] },
      { id: "unit-issues", label: "Incidencias y responsables", detail: "Responsable, criticidad, fecha objetivo y estado.", status: "ready", sourceIds: [], pendingFields: ["Responsable", "Incidencia", "Prioridad", "Fecha objetivo", "Estado"] },
      { id: "unit-documents", label: "Documentación del apartamento", detail: "Espacio para planos, fotos, inspecciones y entrega.", status: "ready", sourceIds: [], pendingFields: ["Plano", "Fotografías", "Checklist", "Acta de entrega"] },
    ],
    connections: [{ label: "Edificios", view: "edificios" }, { label: "Implantación", view: "implantacion" }, { label: "Centro de datos", view: "fuentes" }],
  },
  urbanismo: {
    kicker: "OBRAS EXTERIORES",
    title: "Urbanismo por especialidad y zona",
    description: "Las capas del plano, avances y demoras se conectan con el informe de obra y quedan listas para nuevos desgloses.",
    sourceIds: ["source-dwg-implantacion", "source-xls", "source-june-works"],
    modules: [
      { id: "urban-progress", label: "Avance físico-financiero", detail: "Ejecutado y plan general de urbanismo.", status: "live", sourceIds: ["source-xls"] },
      { id: "urban-specialties", label: "Especialidades", detail: "Movimiento de tierra, agua, electricidad, viales y otros frentes.", status: "live", sourceIds: ["source-june-works"] },
      { id: "urban-map-layers", label: "Capas del plano", detail: "Viales, estacionamientos, paisajismo, acceso y equipamientos.", status: "partial", sourceIds: ["source-dwg-implantacion"], pendingFields: ["Cantidad", "Avance", "Responsable", "Fecha objetivo"] },
      { id: "urban-delays", label: "Demoras de inicio", detail: "Actividades con retrasos de 10 a 70 días.", status: "live", sourceIds: ["source-june-works"], targetView: "planificacion" },
    ],
    connections: [{ label: "Implantación", view: "implantacion" }, { label: "Planificación", view: "planificacion" }, { label: "Informe de obra", view: "fuentes" }],
  },
  comercial: {
    kicker: "GESTIÓN COMERCIAL",
    title: "Ventas, vinculación y cobranza",
    description: "Reservas, expedientes, contratos y morosidad quedan conectados con la presentación comercial de cada corte.",
    sourceIds: ["source-june-sales", "source-june-consolidated", "source-june-pdf"],
    modules: [
      { id: "reservations", label: "Reservas y producto", detail: "Fases, modelos y ubicación de las reservas activas.", status: "live", sourceIds: ["source-june-sales"] },
      { id: "linking", label: "Vinculación documental", detail: "Depuración, documentos, firma y vinculación.", status: "live", sourceIds: ["source-june-sales"] },
      { id: "collections", label: "Cobranza", detail: "Contratos al día, pendientes y vencidos.", status: "live", sourceIds: ["source-june-sales", "source-june-consolidated"] },
      { id: "customer-files", label: "Expedientes de clientes", detail: "Estructura preparada para abrir el expediente autorizado de cada cliente.", status: "ready", sourceIds: [], pendingFields: ["Cliente", "Apartamento", "Contrato", "Cobros", "Documentos"] },
    ],
    connections: [{ label: "Apartamentos", view: "viviendas" }, { label: "Finanzas", view: "metricas" }, { label: "Centro de datos", view: "fuentes" }],
  },
  metricas: {
    kicker: "CONTROL FINANCIERO",
    title: "Finanzas, fideicomiso y conciliaciones",
    description: "Presupuesto, costes, CxP, anticipos, balance y caja se mantienen separados por fuente y moneda.",
    sourceIds: ["source-june-finance", "source-antonely-june-finance", "source-may-cashflow", "source-june-consolidated", "source-budget-type-a", "source-june-deviation", "source-reprogrammed-flow-phase-1", "source-fiduciary-trial-balance", "source-fiduciary-balance-sheet", "source-fiduciary-income-accumulated", "source-fiduciary-income-monthly"],
    modules: [
      { id: "budget-cost", label: "Presupuesto y costes", detail: "Control acumulado, ejecución mensual, 164 partidas tipo A y desviación de junio.", status: "live", sourceIds: ["source-june-finance", "source-antonely-june-finance", "source-budget-type-a", "source-june-deviation"] },
      { id: "phase-1-work-flow", label: "Flujo de obra · Fase I", detail: "Real de diciembre a junio y proyección reprogramada hasta julio de 2027.", status: "live", sourceIds: ["source-reprogrammed-flow-phase-1"] },
      { id: "payables", label: "Cuentas por pagar", detail: "Categorías, antigüedad, proveedores y facturas.", status: "live", sourceIds: ["source-antonely-june-finance"], targetView: "proveedores" },
      { id: "advances", label: "Anticipos", detail: "26 anticipos y saldos pendientes.", status: "live", sourceIds: ["source-june-finance", "source-antonely-june-finance"] },
      { id: "trust-balance", label: "Fideicomiso", detail: "Estados oficiales, resultados y conciliación con el control interno.", status: "live", sourceIds: ["source-fiduciary-trial-balance", "source-fiduciary-balance-sheet", "source-fiduciary-income-accumulated", "source-fiduciary-income-monthly", "source-june-finance", "source-antonely-june-finance"] },
      { id: "cashflow", label: "Flujo de caja", detail: "Proyección y necesidades de financiación.", status: "live", sourceIds: ["source-june-finance", "source-may-cashflow"] },
    ],
    connections: [{ label: "Proveedores y facturas", view: "proveedores" }, { label: "Ventas y cobranza", view: "comercial" }, { label: "Centro de datos", view: "fuentes" }],
  },
  cronologia: {
    kicker: "TRAZABILIDAD DEL PROYECTO",
    title: "Cortes, hitos, entregas y decisiones",
    description: "Cada evento puede enlazarse con su documento, área responsable y revisión viva.",
    sourceIds: ["source-mpp", "source-xls", "source-june-consolidated", "source-june-works"],
    modules: [
      { id: "cutoffs", label: "Cortes documentales", detail: "Fechas y versiones de las fuentes integradas.", status: "live", sourceIds: ["source-xls", "source-mpp", "source-june-consolidated"], targetView: "fuentes" },
      { id: "milestones", label: "Hitos del cronograma", detail: "Línea base, previsión y eventos relevantes.", status: "live", sourceIds: ["source-mpp"], targetView: "planificacion" },
      { id: "deliveries", label: "Entregas y compromisos", detail: "Estructura preparada para suministros y responsables.", status: "ready", sourceIds: [], pendingFields: ["Entrega", "Proveedor", "Responsable", "Fecha", "Estado"] },
      { id: "decisions", label: "Registro de decisiones", detail: "Estructura preparada para acuerdos de Dirección.", status: "ready", sourceIds: [], pendingFields: ["Decisión", "Responsable", "Fecha", "Seguimiento"] },
    ],
    connections: [{ label: "Planificación", view: "planificacion" }, { label: "Proveedores", view: "proveedores" }, { label: "Centro de datos", view: "fuentes" }],
  },
  proveedores: {
    kicker: "CADENA DE SUMINISTRO",
    title: "Proveedores, facturas y entregas",
    description: "El maestro verificado abre cada proveedor, el listado financiero abre facturas y los comparativos conectan compras, ofertas y calendario.",
    sourceIds: ["source-supplier-contacts", "source-supplier-analysis", "source-procurement-comparison", "source-procurement-comparison-duplicate", "source-antonely-june-finance", "source-june-finance", "source-june-works"],
    modules: [
      { id: "vendor-master", label: "Maestro de proveedores", detail: "67 empresas únicas, contactos, servicios y alertas de calidad.", status: "live", sourceIds: ["source-supplier-contacts", "source-supplier-analysis"] },
      { id: "procurement-plan", label: "Plan de compras", detail: "14 paquetes, 58 ofertas y flujo mensual auditado.", status: "live", sourceIds: ["source-procurement-comparison", "source-procurement-comparison-duplicate"], targetView: "cronologia" },
      { id: "vendor-invoices", label: "Facturas", detail: "86 facturas consolidadas desde 96 líneas contables.", status: "live", sourceIds: ["source-antonely-june-finance"] },
      { id: "vendor-contracts", label: "Contratos y pedidos", detail: "Estructura preparada para documentos y condiciones.", status: "ready", sourceIds: [], pendingFields: ["Contrato", "Pedido", "Importe", "Plazo", "Documento"] },
      { id: "vendor-deliveries", label: "Entregas", detail: "Estructura preparada para fechas, albaranes y alertas.", status: "ready", sourceIds: [], pendingFields: ["Entrega prevista", "Entrega real", "Albarán", "Incidencia"] },
    ],
    connections: [{ label: "Edificios", view: "edificios" }, { label: "Finanzas", view: "metricas" }, { label: "Cronología", view: "cronologia" }],
  },
  control: {
    kicker: "CONTROL TRANSVERSAL",
    title: "Seguridad, permisos y gestiones",
    description: "Cada indicador y trámite queda preparado para abrir su evidencia, responsable, fecha y siguiente paso.",
    sourceIds: ["source-june-works", "source-june-consolidated", "source-june-pdf", "source-ifc-analysis"],
    modules: [
      { id: "safety", label: "Seguridad y salud", detail: "Indicadores, hallazgos y brechas semanales.", status: "partial", sourceIds: ["source-june-works"], pendingFields: ["Evidencia", "Responsable", "Cierre del hallazgo"] },
      { id: "permits", label: "Permisos", detail: "Matriz de entidades, referencias y estados.", status: "live", sourceIds: ["source-june-consolidated"] },
      { id: "inspections", label: "Inspecciones", detail: "Estructura preparada para actas y no conformidades.", status: "ready", sourceIds: [], pendingFields: ["Acta", "Inspector", "Resultado", "Acción correctiva"] },
      { id: "financing-control", label: "Gestiones financieras", detail: "Procesos y decisiones pendientes de financiación.", status: "partial", sourceIds: ["source-june-consolidated"], targetView: "metricas" },
      { id: "ifc-compliance", label: "Cumplimiento IFC", detail: "Compromisos, reportes, seguros y puntos de negociación.", status: "partial", sourceIds: ["source-ifc-analysis"], pendingFields: ["Responsable", "Evidencia", "Fecha objetivo", "Estado"] },
    ],
    connections: [{ label: "Planificación", view: "planificacion" }, { label: "Finanzas", view: "metricas" }, { label: "Centro de datos", view: "fuentes" }],
  },
  fuentes: {
    kicker: "GOBIERNO DEL DATO",
    title: "Documentos, versiones y actualización",
    description: "El repositorio conserva originales, responsables, cortes y cambios; cada nueva carga alimenta las vistas relacionadas.",
    sourceIds: dataSources.map((source) => source.id),
    modules: [
      { id: "repository", label: "Repositorio documental", detail: "Archivos originales y descargas autorizadas.", status: "live", sourceIds: dataSources.map((source) => source.id) },
      { id: "ingestion", label: "Carga y clasificación", detail: "Recepción, área, moneda, corte y responsable.", status: "live", sourceIds: [] },
      { id: "normalization", label: "Normalización", detail: "Modelo único para actualizar todas las pantallas.", status: "live", sourceIds: [] },
      { id: "history", label: "Historial y versiones", detail: "Cambios, archivos y procedencia de cada revisión.", status: "live", sourceIds: [] },
    ],
    connections: [{ label: "Resumen ejecutivo", view: "resumen" }, { label: "Cronología", view: "cronologia" }, { label: "Agente IA", view: "agente" }],
  },
};

const statCardLinks: Record<string, { view: View; sourceIds: string[] }> = {
  "Plan operativo": { view: "planificacion", sourceIds: ["source-xls", "source-june-works"] },
  "Cronograma MPP": { view: "planificacion", sourceIds: ["source-mpp"] },
  "Alcance residencial": { view: "edificios", sourceIds: ["source-mpp", "source-dwg-implantacion"] },
  "Previsión final": { view: "planificacion", sourceIds: ["source-mpp"] },
  "Avance físico": { view: "planificacion", sourceIds: ["source-xls", "source-june-works"] },
  "Fin previsto": { view: "planificacion", sourceIds: ["source-mpp"] },
  "Paquetes": { view: "planificacion", sourceIds: ["source-mpp"] },
  "Camino crítico": { view: "planificacion", sourceIds: ["source-mpp"] },
  "Apartamentos integrados": { view: "viviendas", sourceIds: ["source-mpp"] },
  "Edificios relacionados": { view: "edificios", sourceIds: ["source-mpp"] },
  "Dato disponible": { view: "viviendas", sourceIds: ["source-mpp"] },
  "Próxima ampliación": { view: "viviendas", sourceIds: [] },
  "Reservas activas": { view: "comercial", sourceIds: ["source-june-sales"] },
  "Fase I": { view: "comercial", sourceIds: ["source-june-sales"] },
  "Fase II": { view: "comercial", sourceIds: ["source-june-sales"] },
  "Cartera vencida": { view: "comercial", sourceIds: ["source-june-sales", "source-june-consolidated"] },
  "Medición físico-financiera": { view: "urbanismo", sourceIds: ["source-xls"] },
  "Actividades terminadas": { view: "urbanismo", sourceIds: ["source-june-works"] },
  "Mayor avance": { view: "urbanismo", sourceIds: ["source-june-works"] },
  "Arranques demorados": { view: "urbanismo", sourceIds: ["source-june-works"] },
  "Proveedores operativos": { view: "proveedores", sourceIds: [] },
  "Facturas consolidadas": { view: "proveedores", sourceIds: ["source-antonely-june-finance"] },
  "Mayor exposición": { view: "proveedores", sourceIds: ["source-antonely-june-finance"] },
  "CxP departamental": { view: "proveedores", sourceIds: ["source-antonely-june-finance"] },
  "Presupuesto de control": { view: "metricas", sourceIds: ["source-june-finance"] },
  "Coste acumulado": { view: "metricas", sourceIds: ["source-june-finance", "source-antonely-june-finance"] },
  "Cuentas por pagar": { view: "metricas", sourceIds: ["source-june-finance", "source-antonely-june-finance"] },
  "Caja proyectada · dic": { view: "metricas", sourceIds: ["source-june-finance", "source-may-cashflow"] },
  "Fuentes visibles": { view: "fuentes", sourceIds: [] },
  "Datos gobernados": { view: "fuentes", sourceIds: dataAuthorityMatrix.map((item) => item.primarySourceId) },
  "Alertas de calidad": { view: "fuentes", sourceIds: ["source-june-consolidated", "source-june-finance"] },
  "Corte declarado": { view: "fuentes", sourceIds: ["source-june-consolidated", "source-xls", "source-mpp"] },
};

let liveDataTargets: Record<string, unknown> = {};

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
    cutoff: "",
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

type NavItem = { id: View; label: string; mark: string };
type NavigationGroupId = "resumen" | "obra" | "finanzas" | "datos" | "agente";
type NavigationGroup = {
  id: NavigationGroupId;
  label: string;
  mobileLabel: string;
  mark: string;
  directView?: View;
  itemIds?: View[];
};

const navItems: NavItem[] = [
  { id: "resumen", label: "Resumen ejecutivo", mark: "01" },
  { id: "planificacion", label: "Planificación", mark: "02" },
  { id: "implantacion", label: "Implantación general", mark: "03" },
  { id: "edificios", label: "Edificios", mark: "04" },
  { id: "viviendas", label: "Apartamentos", mark: "05" },
  { id: "urbanismo", label: "Urbanismo", mark: "06" },
  { id: "comercial", label: "Ventas y cobranza", mark: "07" },
  { id: "metricas", label: "Finanzas", mark: "08" },
  { id: "cronologia", label: "Cronología", mark: "09" },
  { id: "proveedores", label: "Proveedores", mark: "10" },
  { id: "control", label: "Seguridad y permisos", mark: "11" },
  { id: "fuentes", label: "Centro de datos", mark: "12" },
  { id: "agente", label: "Agente IA", mark: "AI" },
  { id: "usuarios", label: "Usuarios y accesos", mark: "AD" },
];

const navigationGroups: NavigationGroup[] = [
  { id: "resumen", label: "Resumen ejecutivo", mobileLabel: "Resumen", mark: "01", directView: "resumen" },
  {
    id: "obra",
    label: "Obra",
    mobileLabel: "Obra",
    mark: "02",
    itemIds: ["planificacion", "implantacion", "edificios", "viviendas", "urbanismo", "proveedores", "control"],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    mobileLabel: "Finanzas",
    mark: "03",
    itemIds: ["metricas", "comercial"],
  },
  {
    id: "datos",
    label: "Datos",
    mobileLabel: "Datos",
    mark: "04",
    itemIds: ["fuentes", "cronologia", "usuarios"],
  },
  { id: "agente", label: "Agente IA", mobileLabel: "Agente IA", mark: "05", directView: "agente" },
];

function navigationGroupContainsView(group: NavigationGroup, view: View) {
  return group.directView === view || Boolean(group.itemIds?.includes(view));
}

const statusLabel = {
  terminada: "Terminada",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

function unitDisciplines(unit: Unit): UnitDiscipline[] {
  return sharedUnitDisciplines(unit, constructionDisciplines);
}

function unitOverallProgress(unit: Unit): number {
  return sharedUnitOverallProgress(unit, constructionDisciplines);
}

function visualUnitStatus(unit: Unit): Unit["status"] {
  if (unit.status === "bloqueada") return "bloqueada";
  const overall = unitOverallProgress(unit);
  if (overall >= 100) return "terminada";
  if (overall > 0) return "en_curso";
  return "pendiente";
}

function disciplineClassName(discipline: UnitDiscipline) {
  if (discipline.progress === null) return "band-pending";
  const value = Math.max(0, Math.min(100, discipline.progress));
  if (value < 20) return "band-0";
  if (value < 40) return "band-20";
  if (value < 60) return "band-40";
  if (value < 80) return "band-60";
  return "band-80";
}

function disciplineLabel(discipline: UnitDiscipline) {
  if (discipline.progress === null) return "Pendiente";
  if (discipline.status === "conjunto") return `${number.format(discipline.progress)}% · Conjunto`;
  return `${number.format(discipline.progress)}%`;
}

const profileFocus: Record<UserArea, { title: string; detail: string; view: View }> = {
  direccion: {
    title: "Decisiones, desviaciones y calidad del dato",
    detail: "Prioriza plazo, avance global, alertas críticas y conciliaciones abiertas.",
    view: "resumen",
  },
  planificacion: {
    title: "Curva S, camino crítico y previsión final",
    detail: "Revisa la brecha física, los paquetes críticos y las fechas del cronograma.",
    view: "planificacion",
  },
  obra: {
    title: "Producción por edificio y apartamento",
    detail: "Consulta disciplinas, responsables, incidencias y bloqueos desde las fichas operativas.",
    view: "edificios",
  },
  urbanismo: {
    title: "Obras exteriores y frentes urbanos",
    detail: "Sigue viales, paisajismo, redes, equipamientos y retrasos de inicio.",
    view: "urbanismo",
  },
  comercial: {
    title: "Ventas, reservas y cobranza",
    detail: "Controla actividad comercial, vinculaciones, contratos y cartera vencida.",
    view: "comercial",
  },
  finanzas: {
    title: "Presupuesto, caja y obligaciones",
    detail: "Concentra costes, cuentas por pagar, anticipos, balance y proyección de caja.",
    view: "metricas",
  },
  compras: {
    title: "Proveedores, entregas y suministros",
    detail: "Prioriza pedidos vencidos, próximas entregas y desempeño de proveedores.",
    view: "proveedores",
  },
  seguridad: {
    title: "Seguridad, hallazgos y acciones",
    detail: "Consulta indicadores preventivos, incidencias y medidas pendientes.",
    view: "control",
  },
  legal: {
    title: "Permisos, licencias y trámites",
    detail: "Revisa aprobaciones, expedientes en proceso y próximos vencimientos.",
    view: "control",
  },
  diseno: {
    title: "Planos, implantación y coordinación técnica",
    detail: "Abre el masterplan, los edificios y las capas urbanísticas interactivas.",
    view: "implantacion",
  },
};

function operationalAlerts(
  canAccessFinance: boolean,
  userArea: UserArea,
  currency: CurrencyCode,
): OperationalAlert[] {
  const mostDelayedBuilding = [...buildings].sort((a, b) => b.deviationDays - a.deviationDays)[0];
  const alerts: OperationalAlert[] = [
    {
      id: "physical-gap",
      area: "planificacion",
      severity: "critical",
      label: "PLAN",
      title: `Brecha física de ${number.format(Math.abs(projectSnapshot.deviationPoints))} puntos`,
      detail: `${number.format(projectSnapshot.overallProgress)}% real frente a ${number.format(projectSnapshot.plannedProgress)}% planificado`,
      view: "planificacion",
    },
    {
      id: "building-delay",
      area: "obra",
      severity: mostDelayedBuilding?.deviationDays > 7 ? "critical" : "medium",
      label: "OBRA",
      title: `${mostDelayedBuilding?.name ?? "Edificio"} concentra el mayor desvío`,
      detail: `${mostDelayedBuilding?.deviationDays ?? 0} días · fin previsto ${mostDelayedBuilding?.forecastFinish ?? "pendiente"}`,
      view: "edificios",
    },
    {
      id: "urbanism-delay",
      area: "urbanismo",
      severity: "medium",
      label: "URBANISMO",
      title: `${delayedUrbanismStarts.length} inicios requieren seguimiento`,
      detail: `Mayor retraso documentado: ${delayedUrbanismStarts[0]?.days ?? 0} días`,
      view: "urbanismo",
    },
    {
      id: "collections",
      area: "comercial",
      severity: "medium",
      label: "COBRANZA",
      title: `${juneReport.collections.overdue} clientes con importes vencidos`,
      detail: "Corte comercial actualizado al 06/07/2026",
      view: "comercial",
    },
    {
      id: "data-quality",
      area: "direccion",
      severity: "low",
      label: "DATOS",
      title: `${juneDataQualityIssues.length} conciliaciones abiertas`,
      detail: "Las fuentes contradictorias permanecen visibles y trazadas",
      view: "fuentes",
    },
  ];
  if (canAccessFinance) {
    alerts.push({
      id: "cash",
      area: "finanzas",
      severity: "critical",
      label: "CAJA",
      title: "Proyección de caja de diciembre negativa",
      detail: `${formatMoneyMillions(juneReport.finance.projectedCashDecemberDop, "DOP", currency)} · condicionado a financiación`,
      view: "metricas",
    });
  }
  const severityOrder = { critical: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => {
    const areaPriority = Number(b.area === userArea) - Number(a.area === userArea);
    return areaPriority || severityOrder[a.severity] - severityOrder[b.severity];
  });
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
  // Un balance de comprobación nuevo sólo publica fiduciaryBalanceSections
  // (los tres totales por sección); fiduciaryStatementSummary.balance
  // duplica esos mismos totales en un objeto de resumen aparte y se queda
  // congelado si nadie lo vuelve a sincronizar.
  fiduciaryStatementSummary = liveFiduciaryStatementSummary(fiduciaryStatementSummary, fiduciaryBalanceSections);
  fiduciaryManagementReconciliation = liveFiduciaryManagementReconciliation(fiduciaryManagementReconciliation, fiduciaryBalanceSections);
  // antonelyDetailTotals, typeABudgetSummary, juneDeviationSummary y
  // procurementAudit ya no se resincronizan aquí: se construyeron como
  // computedView en installDashboardBootstrap, así que cada lectura de uno
  // de sus campos recalcula sola sobre antonelyAdvances/typeABudgetChapters/
  // monthlyDeviationLines/procurementPackages actuales — no hay copia que
  // resincronizar. juneReport y payablesReconciliation siguen el patrón
  // anterior (reasignación explícita) porque tienen campos hermanos que no
  // se derivan de nada y no conviene envolver el objeto entero.
  juneReport = liveJuneReportFinance(juneReport, antonelyDetailTotals, antonelyBalanceLines, financialProjection);
  payablesReconciliation = livePayablesReconciliation(payablesReconciliation, antonelyDetailTotals.payablesTotalDop);
  // Espejo del cálculo del servidor (lib/spatial-live-data.ts): el avance
  // físico por apartamento se conserva como métrica de apoyo, pero ya no
  // manda sobre el avance físico global — el equipo de obra lleva su
  // control real en el Excel maestro (Curva S), así que overallProgress
  // sigue el último "Ejecutado Real" que ese Excel declare en monthlyPlan.
  const allUnits = buildings.flatMap((building) => building.units);
  if (allUnits.length) {
    projectSnapshot.apartmentAverageProgress =
      allUnits.reduce((sum, unit) => sum + unitOverallProgress(unit), 0) / allUnits.length;
  }
  // El "Plan operativo" (KPI) y el "Ejecutado Real" deben leerse siempre del
  // mismo mes de monthlyPlan: comparar el ejecutado de julio contra el plan
  // congelado de junio produce dos cifras que parecen contradecirse sin
  // serlo. Se toma el último registro con actual no nulo y se leen
  // planned/actual de esa misma fila, así avanzan siempre juntos.
  let cutoffActual: number | null = null;
  let cutoffPlanned: number | null = null;
  for (const entry of monthlyPlan) {
    if (entry.actual !== null) {
      cutoffActual = entry.actual;
      cutoffPlanned = entry.planned;
    }
  }
  if (cutoffActual !== null && cutoffPlanned !== null) {
    projectSnapshot.overallProgress = cutoffActual;
    projectSnapshot.plannedProgress = cutoffPlanned;
    projectSnapshot.deviationPoints =
      Math.round((projectSnapshot.overallProgress - projectSnapshot.plannedProgress) * 100) / 100;
  }
  reprogrammedFlowQualityIssues = liveReprogrammedFlowQualityIssues(
    reprogrammedFlowQualityIssues,
    projectSnapshot.overallProgress,
  );
  // dataAuthorityMatrix decide el texto de "decision"/"status" en vivo
  // (avance físico, plan, CxP); se sincroniza aquí (con overallProgress y
  // plannedProgress ya actualizados arriba) para que cualquier lectura del
  // arreglo, no solo el filtro local de SourcesView, vea la versión
  // vigente. dataGovernanceSummary es un computedView construido sobre este
  // mismo arreglo, así que sus conteos por status quedan al día solos.
  dataAuthorityMatrix = liveDataAuthorityMatrix(
    dataAuthorityMatrix,
    projectSnapshot.overallProgress,
    projectSnapshot.plannedProgress,
    projectSnapshot.scheduleProgress,
    juneReport.finance.cxpDop,
  );
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

const payableAgingLabels = [
  "Al corriente",
  "Menos de 1 mes",
  "1 mes",
  "2 meses",
  "3 meses",
  "Más de 3 meses",
] as const;

function formatPayableDate(value: string) {
  if (!value) return "Sin dato";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function monthReportPeriod(value: string, reportType: ReportType): DirectionReportPeriod {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1, 12));
  return {
    frequency: "monthly",
    reportType,
    startDate: `${value}-01`,
    endDate: `${value}-${String(lastDay).padStart(2, "0")}`,
    label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    generatedAt: new Date().toISOString(),
  };
}

function weeklyReportPeriod(startDate: string, endDate: string, reportType: ReportType): DirectionReportPeriod {
  return {
    frequency: "weekly",
    reportType,
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

const processingStageLabels: Record<string, string> = {
  recibido: "Original recibido",
  clasificado: "Clasificación completada",
  extraccion_pendiente: "Extracción pendiente",
  normalizando: "Extracción en curso",
  contraste: "Contraste y validación",
  sincronizado: "Datos sincronizados",
  observado: "Revisión requerida",
};

function financialQualityIssues() {
  return [...juneDataQualityIssues, ...fiduciaryStatementQualityIssues];
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
  formData.set("autoPublish", "true");
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

function userInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "BR";
}

function UserAvatar({
  user,
  editable = false,
  onUploaded,
  onStatus,
  className = "",
}: {
  user: Pick<DashboardUser, "id" | "displayName" | "avatarUrl">;
  editable?: boolean;
  onUploaded?: (avatarUrl: string) => void;
  onStatus?: (message: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const avatarUrl = uploadedAvatarUrl || user.avatarUrl;

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetUserId", String(user.id));
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json() as {
        avatarUrl?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.avatarUrl) {
        throw new Error(payload.error ?? "No se pudo actualizar la fotografía.");
      }
      setUploadedAvatarUrl(payload.avatarUrl);
      setFeedback("Foto actualizada");
      onUploaded?.(payload.avatarUrl);
      onStatus?.(payload.message ?? "Fotografía actualizada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la fotografía.";
      setFeedback(message);
      onStatus?.(message);
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  return (
    <span className={`user-avatar-control ${editable ? "editable" : ""} ${className}`.trim()}>
      <button
        className="avatar-button"
        type="button"
        disabled={!editable || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={editable ? `Cambiar fotografía de ${user.displayName}` : `Fotografía de ${user.displayName}`}
        title={editable ? "Cambiar fotografía" : user.displayName}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span className="avatar-initials">{userInitials(user.displayName)}</span>
        )}
        {editable && (
          <i className="avatar-edit-mark" aria-hidden="true">
            {uploading ? "…" : "+"}
          </i>
        )}
      </button>
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(event) => void uploadAvatar(event)}
          hidden
        />
      )}
      {feedback && <small className="avatar-feedback" role="status">{feedback}</small>}
    </span>
  );
}

function Header({
  view,
  onAsk,
  onUpload,
  onReport,
  onAvatarUpdated,
  project,
  currency,
  onCurrencyChange,
  liveSync,
  currentUser,
  canAccessFinance,
  online,
  unreadNotifications,
  onOpenDeviceCenter,
  onOpenGuide,
}: {
  view: View;
  onAsk: () => void;
  onUpload: () => void;
  onReport: () => void;
  onAvatarUpdated: (avatarUrl: string) => void;
  project: (typeof projects)[ProjectId];
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  liveSync: LiveSyncState;
  currentUser: DashboardUser;
  canAccessFinance: boolean;
  online: boolean;
  unreadNotifications: number;
  onOpenDeviceCenter: () => void;
  onOpenGuide: () => void;
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
        <button className="button secondary" type="button" onClick={onOpenGuide}>
          Guía de uso
        </button>
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
          className={`live-state live-sync ${project.demo ? "demo" : online ? liveSync.status : "offline"}`}
          title={
            project.demo
              ? `Corte documental ${project.cutoff}`
              : liveSync.latestEvent?.message ?? "Sincronización automática de todas las cifras y gráficas"
          }
        >
          <span className="live-dot" />
          {project.demo
            ? `Corte documental · ${project.cutoff}`
            : !online
              ? "Sin conexión · solo lectura"
            : liveSync.status === "connected"
              ? `Tiempo real · v${liveSync.revision || "base"} · 5 s`
              : liveSync.status === "syncing"
                ? "Sincronizando datos…"
                : "Reconectando datos…"}
        </div>
        <button className="button secondary" onClick={onAsk} disabled={project.demo || !online}>
          Preguntar al agente
        </button>
        <button className="button report-button" onClick={onReport} disabled={project.demo || !online} title={!online ? "Necesita conexión" : undefined}>
          Crear informe
        </button>
        <button className="button primary" onClick={onUpload} disabled={project.demo || !online}>
          + Cargar archivo
        </button>
        <button
          className="notification-button"
          type="button"
          onClick={onOpenDeviceCenter}
          aria-label={`Abrir avisos y seguridad${unreadNotifications ? ` · ${unreadNotifications} sin leer` : ""}`}
        >
          <span aria-hidden="true">●</span>
          {unreadNotifications > 0 && <b>{Math.min(unreadNotifications, 99)}</b>}
        </button>
        <div className="account-control">
          <div className="account-copy">
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.role === "admin" ? "Administrador" : "Usuario autorizado"} · {areaLabels[currentUser.area]}</span>
            <a href="/signout-with-chatgpt?return_to=/">Cerrar sesión</a>
          </div>
          <UserAvatar
            user={currentUser}
            editable={online}
            className="header-user-avatar"
            onUploaded={onAvatarUpdated}
          />
        </div>
      </div>
    </header>
  );
}

function sourceRequiresFinance(source: (typeof dataSources)[number]) {
  return /financ|fideicomiso|balance|resultado|flujo|cxp|antonely|presupuesto|desviaci[oó]n|pr[eé]stamo ifc|comercial|ventas?|reservas?|cobranza|morosidad|desistimiento/i.test(`${source.kind} ${source.file}`);
}

function sourceWorkspaceDetail(source: (typeof dataSources)[number]): WorkspaceDetail {
  const governance = sourceGovernance[source.id];
  return {
    id: `source-${source.id}`,
    kicker: source.kind,
    title: source.file,
    summary: `Documento con corte ${source.declaredCutoff}. ${source.records}.`,
    status: source.status === "validada" ? "live" : "observed",
    metrics: [
      { label: "Corte declarado", value: source.declaredCutoff },
      { label: "Guardado", value: source.savedAt },
      { label: "Contenido", value: source.records },
      ...(governance ? [{ label: "Jerarquía", value: governance.authority }, { label: "Alcance", value: governance.scope }] : []),
    ],
    notes: governance ? [`Alimenta: ${governance.feeds}`, ...source.notes] : source.notes,
    sourceIds: [source.id],
    actions: [{ label: "Abrir Centro de datos", view: "fuentes" }],
  };
}

function AreaWorkspaceDock({
  view,
  canAccessFinance,
  onNavigate,
  onUpload,
}: {
  view: View;
  canAccessFinance: boolean;
  onNavigate: (view: View) => void;
  onUpload: () => void;
}) {
  const config = workspaceAreaConfigs[view];
  const workspace = useContext(WorkspaceDetailContext);
  if (!config) return null;
  const sources = config.sourceIds
    .map((id) => dataSources.find((source) => source.id === id))
    .filter((source): source is (typeof dataSources)[number] => Boolean(source))
    .filter((source) => canAccessFinance || !sourceRequiresFinance(source));

  return (
    <section className="panel area-workspace-dock">
      <div className="area-workspace-heading">
        <div>
          <span className="section-kicker">{config.kicker}</span>
          <h3>{config.title}</h3>
          <p>{config.description}</p>
        </div>
        <button className="button primary" type="button" onClick={onUpload}>Añadir datos a esta área</button>
      </div>
      <div className="area-workspace-layout">
        <div className="workspace-module-grid">
          {config.modules.map((module) => (
            <button
              type="button"
              key={module.id}
              className="workspace-module-card"
              onClick={() => workspace.openDetail({
                id: `${view}-${module.id}`,
                kicker: config.kicker,
                title: module.label,
                summary: module.detail,
                status: module.status,
                sourceIds: module.sourceIds,
                pendingFields: module.pendingFields,
                actions: [
                  ...(module.targetView && module.targetView !== view
                    ? [{ label: `Abrir ${navItems.find((item) => item.id === module.targetView)?.label ?? "sección relacionada"}`, view: module.targetView }]
                    : []),
                  { label: "Abrir Centro de datos", view: "fuentes" },
                ],
              })}
            >
              <span className={`workspace-status ${module.status}`}>
                {module.status === "live" ? "Datos vivos" : module.status === "partial" ? "Parcial" : module.status === "observed" ? "Observado" : "Preparado"}
              </span>
              <strong>{module.label}</strong>
              <small>{module.detail}</small>
              <em>Abrir ficha →</em>
            </button>
          ))}
        </div>
        <aside className="workspace-document-column">
          <div>
            <span className="section-kicker">DOCUMENTACIÓN VINCULADA</span>
            <strong>{sources.length} {sources.length === 1 ? "fuente visible" : "fuentes visibles"}</strong>
          </div>
          <div className="workspace-document-list">
            {sources.slice(0, 5).map((source) => (
              <button type="button" key={source.id} onClick={() => workspace.openDetail(sourceWorkspaceDetail(source))}>
                <span>{source.kind}</span>
                <strong>{source.file}</strong>
                <small>{source.declaredCutoff}</small>
                <i aria-hidden="true">→</i>
              </button>
            ))}
            {sources.length === 0 && <p>Los próximos documentos cargados en esta área aparecerán aquí automáticamente.</p>}
          </div>
          <div className="workspace-connections">
            <span>SECCIONES CONECTADAS</span>
            {config.connections
              .filter((connection) => canAccessFinance || connection.view !== "metricas")
              .map((connection) => (
                <button type="button" key={connection.view} onClick={() => onNavigate(connection.view)}>
                  {connection.label}<i aria-hidden="true">↗</i>
                </button>
              ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function WorkspaceDetailPanel({
  detail,
  canAccessFinance,
  onClose,
  onNavigate,
  onUpload,
}: {
  detail: WorkspaceDetail;
  canAccessFinance: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onUpload: () => void;
}) {
  const sources = (detail.sourceIds ?? [])
    .map((id) => dataSources.find((source) => source.id === id))
    .filter((source): source is (typeof dataSources)[number] => Boolean(source))
    .filter((source) => canAccessFinance || !sourceRequiresFinance(source));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const statusLabel =
    detail.status === "live" ? "Datos vivos" :
    detail.status === "partial" ? "Cobertura parcial" :
    detail.status === "observed" ? "Fuente observada" :
    "Preparado para datos";

  return (
    <div className="workspace-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="workspace-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${detail.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="workspace-detail-header">
          <div>
            <span className="section-kicker">{detail.kicker}</span>
            <h2>{detail.title}</h2>
            <p>{detail.summary}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar ficha">×</button>
        </header>
        <div className={`workspace-detail-state ${detail.status ?? "ready"}`}>{statusLabel}</div>
        {detail.metrics && detail.metrics.length > 0 && (
          <section className="workspace-detail-metrics">
            {detail.metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}
          </section>
        )}
        {detail.notes && detail.notes.length > 0 && (
          <section className="workspace-detail-section">
            <div className="unit-section-heading"><span>LECTURA Y TRAZABILIDAD</span><small>{detail.notes.length} notas</small></div>
            <ul>{detail.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </section>
        )}
        {detail.pendingFields && detail.pendingFields.length > 0 && (
          <section className="workspace-detail-section">
            <div className="unit-section-heading"><span>CAMPOS PREPARADOS</span><small>Se activan con nuevas cargas</small></div>
            <div className="workspace-pending-fields">
              {detail.pendingFields.map((field) => <span key={field}>{field}</span>)}
            </div>
          </section>
        )}
        <section className="workspace-detail-section">
          <div className="unit-section-heading"><span>DOCUMENTACIÓN RELACIONADA</span><small>{sources.length} archivos</small></div>
          {sources.length > 0 ? (
            <div className="workspace-detail-sources">
              {sources.map((source) => (
                <article key={source.id}>
                  <div><span>{source.kind}</span><strong>{source.file}</strong><small>Corte {source.declaredCutoff}</small></div>
                  {source.downloadUrl
                    ? (
                      <div className="workspace-source-file-actions">
                        <a href={source.downloadUrl} data-file-title={source.file}>Abrir documento</a>
                        <a href={source.downloadUrl} download={source.file} data-file-viewer-bypass="true">Descargar</a>
                      </div>
                    )
                    : <button type="button" onClick={() => onNavigate("fuentes")}>Ver registro</button>}
                </article>
              ))}
            </div>
          ) : (
            <div className="workspace-empty-source">
              <strong>Sin documento específico vinculado todavía.</strong>
              <p>La ficha está preparada para asociar automáticamente el próximo archivo normalizado de esta área.</p>
            </div>
          )}
        </section>
        <footer className="workspace-detail-actions">
          <button className="button secondary" type="button" onClick={() => { onClose(); onUpload(); }}>Añadir actualización</button>
          {(detail.actions ?? [])
            .filter((action) => canAccessFinance || action.view !== "metricas")
            .map((action) => (
              <button className="button primary" type="button" key={`${action.view}-${action.label}`} onClick={() => { onClose(); onNavigate(action.view); }}>
                {action.label}
              </button>
            ))}
        </footer>
      </aside>
    </div>
  );
}

const imageFileExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const textFileExtensions = new Set(["txt", "csv", "json", "xml", "md"]);

function fileExtension(title: string, url: string) {
  const candidate = `${title} ${url.split("?")[0]}`;
  return candidate.match(/\.([a-z0-9]+)(?:\s|$)/i)?.[1]?.toLowerCase() ?? "";
}

function fileViewerTitle(anchor: HTMLAnchorElement, url: URL) {
  const explicitTitle = anchor.dataset.fileTitle?.trim();
  if (explicitTitle) return explicitTitle;
  const pathnameFile = url.pathname.split("/").filter(Boolean).at(-1);
  if (pathnameFile && pathnameFile !== "files") {
    try {
      return decodeURIComponent(pathnameFile);
    } catch {
      return pathnameFile;
    }
  }
  return anchor.textContent?.trim() || "Archivo del Centro de Control";
}

function fileDeliveryUrl(url: string, mode: "preview" | "download") {
  const parsed = new URL(url, window.location.origin);
  if (parsed.pathname !== "/api/files") return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  const uploadedFileId = parsed.searchParams.get("preview") ?? parsed.searchParams.get("download");
  if (!uploadedFileId) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  parsed.searchParams.delete("preview");
  parsed.searchParams.delete("download");
  parsed.searchParams.set(mode, uploadedFileId);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

type PdfViewport = { width: number; height: number };
type PdfRenderTask = { promise: Promise<void>; cancel: () => void };
type PdfPageHandle = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
};
type PdfDocumentHandle = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageHandle>;
  destroy: () => Promise<void>;
};
type PdfLoadingTask = {
  promise: Promise<PdfDocumentHandle>;
  destroy?: () => Promise<void>;
};

function PdfDocumentPreview({ url, title }: { url: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [documentHandle, setDocumentHandle] = useState<PdfDocumentHandle | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [renderWidth, setRenderWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      setRenderWidth((current) => current === width ? current : width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let loadingTask: PdfLoadingTask | null = null;
    void (async () => {
      try {
        const [pdfjs, workerModule] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        // PDF.js requests only the byte ranges it needs. Keeping the original
        // outside JavaScript memory avoids blank screens on low-memory phones.
        const task = pdfjs.getDocument({
          url: new URL(url, window.location.origin).toString(),
          withCredentials: true,
          rangeChunkSize: 64 * 1_024,
          disableRange: false,
          // disableStream is required for disableAutoFetch to avoid a
          // progressive full-file download after the first page.
          disableStream: true,
          disableAutoFetch: true,
        }) as unknown as PdfLoadingTask;
        loadingTask = task;
        const loadedDocument = await task.promise;
        if (disposed) {
          await loadedDocument.destroy();
          return;
        }
        setDocumentHandle(loadedDocument);
        setStatus("ready");
      } catch (loadError) {
        if (disposed) return;
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "El PDF no se pudo mostrar.");
      }
    })();
    return () => {
      disposed = true;
      void loadingTask?.destroy?.();
    };
  }, [url]);

  useEffect(() => {
    if (!documentHandle || !canvasRef.current || !containerRef.current || status !== "ready") return;
    let cancelled = false;
    let renderTask: PdfRenderTask | null = null;
    void (async () => {
      try {
        const page = await documentHandle.getPage(pageNumber);
        if (cancelled || !canvasRef.current || !containerRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, (renderWidth || containerRef.current.clientWidth) - 32);
        const cssScale = Math.max(0.45, Math.min(1.8, availableWidth / baseViewport.width)) * zoom;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("El dispositivo no permite dibujar el PDF.");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (renderError) {
        if (cancelled || (renderError instanceof Error && renderError.name === "RenderingCancelledException")) return;
        setStatus("error");
        setError(renderError instanceof Error ? renderError.message : "No se pudo dibujar esta página.");
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [documentHandle, pageNumber, renderWidth, status, zoom]);

  return (
    <div className="pdf-document-viewer" ref={containerRef}>
      {status === "loading" && <div className="file-preview-state"><i /><strong>Preparando PDF…</strong><span>El documento se abrirá aquí, sin descargarlo.</span></div>}
      {status === "error" && <div className="file-preview-state error"><strong>No se pudo representar el PDF</strong><span>{error}</span><small>El visor permanece abierto; puedes cerrarlo o descargar una copia desde la barra superior.</small></div>}
      {status === "ready" && documentHandle && (
        <>
          <div className="pdf-page-stage"><canvas ref={canvasRef} aria-label={`Página ${pageNumber} de ${title}`} /></div>
          <div className="pdf-viewer-controls" role="group" aria-label="Controles del PDF">
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))}>‹</button>
            <span>Página <strong>{pageNumber}</strong> de {documentHandle.numPages}</span>
            <button type="button" disabled={pageNumber >= documentHandle.numPages} onClick={() => setPageNumber((current) => Math.min(documentHandle.numPages, current + 1))}>›</button>
            <button type="button" onClick={() => setZoom((current) => Math.max(0.75, Number((current - 0.25).toFixed(2))))} aria-label="Reducir PDF">−</button>
            <button type="button" onClick={() => setZoom((current) => Math.min(2.5, Number((current + 0.25).toFixed(2))))} aria-label="Ampliar PDF">＋</button>
          </div>
        </>
      )}
    </div>
  );
}

function TextDocumentPreview({ url }: { url: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const abortController = new AbortController();
    void fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Range: "bytes=0-524287" },
      signal: abortController.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el texto (${response.status}).`);
        return Promise.all([
          response.text(),
          Promise.resolve(response.status === 206 || Boolean(response.headers.get("content-range"))),
        ]);
      })
      .then(([content, partial]) => {
        const limited = content.length > 500_000 ? content.slice(0, 500_000) : content;
        setText(partial || content.length > 500_000
          ? `${limited}\n\n… vista previa limitada; descarga la copia para consultar el contenido completo.`
          : limited);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (abortController.signal.aborted) return;
        setText(loadError instanceof Error ? loadError.message : "No se pudo mostrar el archivo.");
        setStatus("error");
      });
    return () => abortController.abort();
  }, [url]);
  if (status === "loading") return <div className="file-preview-state"><i /><strong>Abriendo documento…</strong></div>;
  return <pre className={`text-document-preview ${status === "error" ? "error" : ""}`}>{text}</pre>;
}

function ImageDocumentPreview({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="file-preview-state error"><strong>No se pudo mostrar la imagen</strong><span>Puedes cerrar el visor o descargar una copia desde la barra superior.</span></div>;
  return <div className="image-document-preview"><img src={url} alt={title} onError={() => setFailed(true)} /></div>;
}

function FileViewer({ file, onClose }: { file: FileViewerState; onClose: () => void }) {
  const extension = fileExtension(file.title, file.url);
  const previewUrl = fileDeliveryUrl(file.url, "preview");
  const downloadUrl = fileDeliveryUrl(file.url, "download");
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (window.history.state?.bricketFileViewer === file.url) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [file.url]);

  useEffect(() => {
    if (window.history.state?.bricketFileViewer !== file.url) {
      window.history.pushState({ ...(window.history.state ?? {}), bricketFileViewer: file.url }, "");
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    const closeOnBack = () => onCloseRef.current();
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("popstate", closeOnBack);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("popstate", closeOnBack);
    };
  }, [file.url, requestClose]);

  return (
    <section className="file-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Archivo ${file.title}`}>
      <header className="file-viewer-toolbar">
        <div className="file-viewer-heading">
          <span>ARCHIVO DEL CENTRO DE CONTROL</span>
          <strong>{file.title}</strong>
        </div>
        <div className="file-viewer-actions">
          <a
            className="button secondary"
            href={downloadUrl}
            download
            data-file-viewer-bypass="true"
          >
            Descargar
          </a>
          <button className="file-viewer-close" type="button" onClick={requestClose} aria-label="Cerrar archivo">
            <i aria-hidden="true">×</i>
            <span>Cerrar</span>
          </button>
        </div>
      </header>
      <div className="file-viewer-body">
        {extension === "pdf" ? (
          <PdfDocumentPreview key={previewUrl} url={previewUrl} title={file.title} />
        ) : imageFileExtensions.has(extension) ? (
          <ImageDocumentPreview url={previewUrl} title={file.title} />
        ) : textFileExtensions.has(extension) ? (
          <TextDocumentPreview url={previewUrl} />
        ) : (
          <div className="file-viewer-unavailable">
            <span>{extension ? extension.toUpperCase() : "ARCHIVO"}</span>
            <h2>Archivo abierto en Bricket Control</h2>
            <p>El original está cargado y protegido. Este formato no dispone de representación gráfica fiable dentro del navegador, por lo que no se abrirá otra pestaña ni se iniciará una descarga automática.</p>
            <div className="file-viewer-unavailable-actions">
              <a
                className="button primary"
                href={downloadUrl}
                download
                data-file-viewer-bypass="true"
              >
                Descargar copia
              </a>
            </div>
            <small>La descarga sólo comienza si pulsas expresamente el botón. La X y el botón Atrás cierran siempre esta vista.</small>
          </div>
        )}
      </div>
    </section>
  );
}

const notificationAreaViews: Record<string, View> = {
  direccion: "resumen",
  planificacion: "planificacion",
  obra: "edificios",
  urbanismo: "urbanismo",
  comercial: "comercial",
  finanzas: "metricas",
  compras: "proveedores",
  seguridad: "control",
  legal: "control",
  diseno: "implantacion",
  fuentes: "fuentes",
};

function notificationTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const serverNotificationPrefix = "server-";

function serverNotificationDeviceId(id: number) {
  return `${serverNotificationPrefix}${id}`;
}

function serverNotificationNumericId(id: string) {
  if (!id.startsWith(serverNotificationPrefix)) return 0;
  const value = Number(id.slice(serverNotificationPrefix.length));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function serverNotificationTone(notification: ServerNotification): DeviceNotificationItem["tone"] {
  const signal = `${notification.kind} ${notification.title}`.toLowerCase();
  if (/critical|critico|crítico|blocked|bloquead|rejected|rechazad|error/.test(signal)) return "critical";
  if (/warning|advert|observ|overdue|vencid|deleted|eliminad|retirad/.test(signal)) return "warning";
  if (/restored|restaurad|approved|aprobad|published|publicad|completed|completad/.test(signal)) return "success";
  return "info";
}

function serverNotificationView(notification: ServerNotification): View {
  if (navItems.some((item) => item.id === notification.view)) return notification.view as View;
  return notificationAreaViews[notification.area] ?? "resumen";
}

function serverNotificationAsDeviceItem(notification: ServerNotification): DeviceNotificationItem {
  return {
    id: serverNotificationDeviceId(notification.id),
    title: notification.title || "Actividad del Centro de Control",
    detail: notification.body || (notification.actorName
      ? `Actividad registrada por ${notification.actorName}.`
      : "Hay una nueva actividad en el proyecto."),
    timestamp: notificationTime(notification.createdAt),
    tone: serverNotificationTone(notification),
    view: serverNotificationView(notification),
  };
}

function isServerNotification(value: unknown): value is ServerNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ServerNotification>;
  return typeof item.id === "number" && Number.isSafeInteger(item.id) && item.id > 0
    && typeof item.kind === "string"
    && typeof item.area === "string"
    && typeof item.title === "string"
    && typeof item.body === "string"
    && typeof item.view === "string"
    && typeof item.createdAt === "string"
    && typeof item.read === "boolean";
}

function mergeServerNotifications(
  current: ServerNotification[],
  incoming: ServerNotification[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()]
    .sort((left, right) => right.id - left.id)
    .slice(0, 100);
}

function notificationFingerprint(item: DeviceNotificationItem) {
  return `${item.title}\n${item.detail}\n${item.view ?? ""}`.trim().toLowerCase();
}

function mergeDeviceNotifications(
  serverItems: DeviceNotificationItem[],
  localItems: DeviceNotificationItem[],
) {
  const merged: DeviceNotificationItem[] = [];
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const item of [...serverItems, ...localItems]) {
    const fingerprint = notificationFingerprint(item);
    if (ids.has(item.id) || (fingerprint && fingerprints.has(fingerprint))) continue;
    ids.add(item.id);
    if (fingerprint) fingerprints.add(fingerprint);
    merged.push(item);
  }
  return merged.slice(0, 24);
}

function clientPlatform() {
  const navigatorWithHints = navigator as Navigator & { userAgentData?: { platform?: string } };
  return navigatorWithHints.userAgentData?.platform || navigator.platform || "";
}

function createClientIdentifier(prefix: string) {
  const suffix = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`.slice(0, 128);
}

function storedClientIdentifier(storage: Storage, key: string, prefix: string) {
  try {
    const stored = storage.getItem(key)?.trim() ?? "";
    if (stored.length >= 8 && stored.length <= 128) return stored;
    const created = createClientIdentifier(prefix);
    storage.setItem(key, created);
    return created;
  } catch {
    return createClientIdentifier(prefix);
  }
}

function applicationServerKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function buildDeviceNotifications(
  snapshot: ControlRoomSnapshot | null,
  liveSync: LiveSyncState,
): DeviceNotificationItem[] {
  const items: DeviceNotificationItem[] = [];
  if (liveSync.latestEvent) {
    items.push({
      id: `live-${liveSync.latestEvent.revision}`,
      title: `Nueva revisión viva · v${liveSync.latestEvent.revision}`,
      detail: liveSync.latestEvent.message || `Actualización recibida desde ${liveSync.latestEvent.sourceName}.`,
      timestamp: notificationTime(liveSync.latestEvent.createdAt),
      tone: "success",
      view: "resumen",
    });
  }
  if (!snapshot) return items;

  for (const activity of snapshot.actionActivity.slice(0, 4)) {
    items.push({
      id: `activity-${activity.id}`,
      title: activity.actionTitle || "Actividad operativa",
      detail: activity.message,
      timestamp: notificationTime(activity.createdAt),
      tone: "info",
      view: notificationAreaViews[activity.area ?? ""] ?? "resumen",
    });
  }

  for (const issue of snapshot.reconciliations.filter((item) => !item.restricted).slice(0, 4)) {
    items.push({
      id: `reconciliation-${issue.id}`,
      title: issue.title,
      detail: issue.detail,
      timestamp: `Corte ${snapshot.cutoff}`,
      tone: issue.severity === "critical" ? "critical" : issue.severity === "medium" ? "warning" : "info",
      view: issue.view,
    });
  }

  if (snapshot.documents.pending > 0) {
    items.push({
      id: `documents-pending-${snapshot.documents.pending}-${snapshot.documents.lastUploadAt}`,
      title: `${snapshot.documents.pending} documentos pendientes de validación`,
      detail: `${snapshot.documents.pendingProposals} propuestas esperan revisión antes de actualizar el Centro de Control.`,
      timestamp: notificationTime(snapshot.documents.lastUploadAt),
      tone: snapshot.documents.discrepancies > 0 ? "warning" : "info",
      view: "fuentes",
    });
  }

  if (snapshot.actionSummary.overdue > 0 || snapshot.actionSummary.blocked > 0) {
    items.push({
      id: `actions-alert-${snapshot.actionSummary.overdue}-${snapshot.actionSummary.blocked}`,
      title: "Acciones que requieren atención",
      detail: `${snapshot.actionSummary.overdue} vencidas · ${snapshot.actionSummary.blocked} bloqueadas.`,
      timestamp: notificationTime(snapshot.generatedAt),
      tone: snapshot.actionSummary.overdue > 0 ? "critical" : "warning",
      view: "resumen",
    });
  }

  return items.slice(0, 12);
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
  const workspace = useContext(WorkspaceDetailContext);
  const link = statCardLinks[eyebrow];
  if (workspace.enabled && link) {
    return (
      <button
        type="button"
        className={`stat-card interactive ${tone}`}
        onClick={() => workspace.openDetail({
          id: `metric-${eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          kicker: "INDICADOR INTERACTIVO",
          title: eyebrow,
          summary: detail,
          status: "live",
          metrics: [{ label: "Valor actual", value }],
          sourceIds: link.sourceIds,
          actions: [{ label: `Abrir ${navItems.find((item) => item.id === link.view)?.label ?? "sección"}`, view: link.view }],
        })}
      >
        <span>{eyebrow}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
        <em>Abrir detalle →</em>
      </button>
    );
  }
  return (
    <article className={`stat-card ${tone}`}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProgressChart({ data = monthlyPlan }: { data?: typeof monthlyPlan }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const width = 1180;
  const height = 410;
  const plotTop = 22;
  const plotBottom = 292;
  const sidePadding = 70;
  const xFor = (index: number) =>
    sidePadding + (index * (width - sidePadding * 2)) / (data.length - 1);
  const yFor = (value: number) =>
    plotBottom - (value / 100) * (plotBottom - plotTop);
  const monthLabel = (index: number) => {
    const date = new Date(2025, 5 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const plannedPoints = data
    .map((point, index) => `${xFor(index)},${yFor(point.planned)}`)
    .join(" ");
  const actualPoints = data
    .map((point, index) =>
      point.actual === null ? null : `${xFor(index)},${yFor(point.actual)}`,
    )
    .filter(Boolean)
    .join(" ");
  // El texto bajo la gráfica citaba los mismos números a mano, congelados en
  // el momento en que se escribió — una tercera copia del mismo dato que el
  // punto "Ejecutado Real" ya corrige, así que se recalcula del mismo punto
  // de corte en vez de repetir la cifra por separado.
  let cutoffIndex = -1;
  data.forEach((point, index) => {
    if (point.actual !== null) cutoffIndex = index;
  });
  const cutoffPoint = cutoffIndex >= 0 ? data[cutoffIndex] : null;
  const cutoffGap = cutoffPoint ? Math.round((cutoffPoint.actual! - cutoffPoint.planned) * 10) / 10 : 0;
  const cutoffYear = cutoffIndex >= 0 ? new Date(2025, 5 + cutoffIndex, 1).getFullYear() : null;
  const finalIndex = data.length - 1;
  const finalMonthName = finalIndex >= 0
    ? new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(2025, 5 + finalIndex, 1))
    : "";
  const finalYear = finalIndex >= 0 ? new Date(2025, 5 + finalIndex, 1).getFullYear() : null;

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  return (
    <div
      className={`s-curve ${isExpanded ? "is-fullscreen" : ""}`}
      role={isExpanded ? "dialog" : undefined}
      aria-modal={isExpanded ? true : undefined}
      aria-label={isExpanded ? "Curva S a pantalla completa" : undefined}
    >
      <div className="s-curve-heading">
        <div className="s-curve-heading-copy">
          <h3>Curva S — Plan vs. Ejecutado</h3>
          <p>Avance físico acumulado del proyecto (% del monto total) · jun-2025 a ago-2027</p>
        </div>
        <button
          className="s-curve-fullscreen-button"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-pressed={isExpanded}
          aria-label={isExpanded ? "Cerrar pantalla completa" : "Ver Curva S a pantalla completa"}
        >
          <span className="s-curve-fullscreen-icon" aria-hidden="true">
            {isExpanded ? "×" : "⛶"}
          </span>
          <span>{isExpanded ? "Cerrar" : "Pantalla completa"}</span>
        </button>
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
            {data.map((point, index) => (
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
        <strong>Al corte ({cutoffPoint ? `${cutoffPoint.month}-${cutoffYear}` : "sin dato"}):</strong>
        <span>
          {cutoffPoint
            ? `Ejecutado ${number.format(cutoffPoint.actual as number)}% vs. Plan ${number.format(cutoffPoint.planned)}% → brecha de ${number.format(Math.abs(cutoffGap))} puntos porcentuales. El plan proyecta cierre en ${finalMonthName}-${finalYear}; sin corrección, la brecha actual se traduce en un desplazamiento equivalente en el cierre.`
            : "Todavía no hay avance ejecutado publicado para calcular la brecha."}
        </span>
      </div>
      <div className="s-curve-reconciliation-note">
        <strong>Fuente del avance físico global:</strong>
        <span>
          {" "}El {number.format(projectSnapshot.overallProgress)}% que se muestra en todo el tablero es el "Ejecutado Real" declarado por el equipo de obra en el Excel maestro (Curva S), no un promedio calculado aquí.
          Como referencia de apoyo, el cálculo apartamento a apartamento (4 disciplinas por unidad) da {number.format(projectSnapshot.apartmentAverageProgress)}%.
        </span>
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
  const [planZoom, setPlanZoom] = useState(100);
  const [planExpanded, setPlanExpanded] = useState(false);
  const allUnits = buildings.flatMap((item) => item.units);
  const completed = allUnits.filter((unit) => visualUnitStatus(unit) === "terminada").length;
  const active = allUnits.filter((unit) => visualUnitStatus(unit) === "en_curso").length;
  const pending = allUnits.filter((unit) => ["pendiente", "bloqueada"].includes(visualUnitStatus(unit))).length;

  useEffect(() => {
    if (!planExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [planExpanded]);

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
      <div className="plan-touch-toolbar" aria-label="Controles táctiles del plano">
        <button
          type="button"
          onClick={() => setPlanZoom((current) => Math.max(100, current - 25))}
          disabled={planZoom === 100}
          aria-label="Alejar plano"
        >
          −
        </button>
        <button type="button" onClick={() => setPlanZoom(100)} aria-label="Restablecer zoom">
          {planZoom}%
        </button>
        <button
          type="button"
          onClick={() => setPlanZoom((current) => Math.min(225, current + 25))}
          disabled={planZoom === 225}
          aria-label="Acercar plano"
        >
          +
        </button>
        <button className="expand-plan-button" type="button" onClick={() => setPlanExpanded(true)}>
          Pantalla completa
        </button>
      </div>
      <div className={`site-plan-canvas-scroll ${planExpanded ? "expanded" : ""}`}>
        {planExpanded && (
          <div className="expanded-plan-bar">
            <div className="expanded-plan-copy">
              <strong>Implantación ARAYA</strong>
              <span>Desliza para recorrer · toca un elemento para abrir su ficha</span>
            </div>
            <div className="expanded-plan-controls">
              <button
                type="button"
                onClick={() => setPlanZoom((current) => Math.max(100, current - 25))}
                disabled={planZoom === 100}
                aria-label="Alejar plano"
              >
                −
              </button>
              <span>{planZoom}%</span>
              <button
                type="button"
                onClick={() => setPlanZoom((current) => Math.min(225, current + 25))}
                disabled={planZoom === 225}
                aria-label="Acercar plano"
              >
                +
              </button>
              <button type="button" onClick={() => setPlanExpanded(false)} aria-label="Cerrar plano a pantalla completa">×</button>
            </div>
          </div>
        )}
        <div
          className="site-plan-zoom-stage"
          style={{ width: `${planZoom}%`, maxWidth: `${Math.round(820 * planZoom / 100)}px` }}
        >
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
              decoding="async"
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
                      setPlanExpanded(false);
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
                        title={`${unit.code} · ${statusLabel[visualUnitStatus(unit)]} · ${number.format(unitOverallProgress(unit))}% conjunto`}
                        aria-label={`Abrir ${unit.code}`}
                        onClick={() => {
                          setPlanExpanded(false);
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
                    setPlanExpanded(false);
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
        </div>
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
                <small>{number.format(unitOverallProgress(unit))}% conjunto</small>
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
            <span>Conjunto<strong>{number.format(unitOverallProgress(selectedUnit.unit))}%</strong></span>
            <span>Estado<strong>{statusLabel[visualUnitStatus(selectedUnit.unit)]}</strong></span>
            <span>Índice del edificio<strong>{number.format(selectedUnit.building.progress)}%</strong></span>
            <span>Fin previsto edificio<strong>{selectedUnit.building.forecastFinish}</strong></span>
          </div>
          <div className="unit-mini-disciplines">
            {unitDisciplines(selectedUnit.unit).map((discipline) => (
              <span key={discipline.id} className={disciplineClassName(discipline)}>
                {discipline.name}<strong>{disciplineLabel(discipline)}</strong>
              </span>
            ))}
          </div>
          <div className="unit-accountability-grid compact">
            <span>Responsable<strong>{selectedUnit.unit.responsible || "Pendiente de asignar"}</strong></span>
            <span>Incidencias abiertas<strong>{(selectedUnit.unit.issues ?? []).filter((issue) => issue.status === "abierta").length}</strong></span>
          </div>
          <p>La ficha se amplía automáticamente cuando el modelo vivo recibe nuevas disciplinas, responsables o incidencias.</p>
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
  currentUser,
}: {
  onNavigate: (view: View) => void;
  onSelectBuilding: (building: Building) => void;
  currency: CurrencyCode;
  canAccessFinance: boolean;
  currentUser: DashboardUser;
}) {
  const focus = profileFocus[currentUser.area];
  const focusView = focus.view === "metricas" && !canAccessFinance ? "fuentes" : focus.view;
  const alerts = operationalAlerts(canAccessFinance, currentUser.area, currency);
  return (
    <div className="view-stack">
      <section className="panel role-focus-card">
        <div>
          <span className="section-kicker">INICIO PERSONALIZADO · {areaLabels[currentUser.area]}</span>
          <h3>{focus.title}</h3>
          <p>{focus.detail}</p>
        </div>
        {focusView === "resumen" ? (
          <a className="button secondary" href="#control-room-priority">
            Abrir prioridad del área
          </a>
        ) : (
          <button className="button secondary" onClick={() => onNavigate(focusView)}>
            Abrir prioridad del área
          </button>
        )}
      </section>
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
              <span className="section-kicker">ALERTAS AUTOMÁTICAS · PRIORIZADAS PARA TU PERFIL</span>
              <h3>{alerts.length} controles operativos</h3>
            </div>
            <span className="count-badge">{alerts.length}</span>
          </div>
          {alerts.map((alert) => (
            <button
              className={`attention-item ${alert.area === currentUser.area ? "profile-priority" : ""}`}
              key={alert.id}
              onClick={() => onNavigate(alert.view)}
            >
              <span className={`severity ${alert.severity}`}>{alert.label}</span>
              <strong>{alert.title}</strong>
              <small>{alert.detail}</small>
            </button>
          ))}
        </article>
      </section>

    </div>
  );
}

function Planning() {
  const workspace = useContext(WorkspaceDetailContext);
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
            <button
              type="button"
              className="table-row workspace-data-row"
              key={item.name}
              onClick={() => workspace.openDetail({
                id: `package-${item.name}`,
                kicker: "PAQUETE DEL CRONOGRAMA",
                title: item.name,
                summary: item.critical ? "Paquete marcado como crítico en el cronograma maestro." : "Paquete de trabajo del cronograma maestro.",
                status: "live",
                metrics: [
                  { label: "Avance", value: `${number.format(item.progress)}%` },
                  { label: "Fin previsto", value: item.finish },
                  { label: "Línea base", value: item.baselineFinish },
                  { label: "Desviación", value: `+${item.deviationDays} días` },
                ],
                sourceIds: ["source-mpp"],
                actions: [{ label: "Abrir Cronología", view: "cronologia" }],
              })}
            >
              <strong>{item.name}{item.critical ? " · crítico" : ""}</strong>
              <span>{number.format(item.progress)}%</span>
              <span>{item.finish} / {item.baselineFinish}</span>
              <span className={item.deviationDays >= 14 ? "danger-text" : "warn-text"}>
                +{item.deviationDays} días
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="section-kicker">RECOMENDACIONES DEL INFORME</span><h3>Acciones de recuperación propuestas</h3></div><span className="data-note">No son compromisos confirmados</span></div>
        <div className="action-grid">
          {managementActions.map((action, index) => (
            <button
              type="button"
              key={action}
              onClick={() => workspace.openDetail({
                id: `recovery-action-${index + 1}`,
                kicker: "ACCIÓN DE RECUPERACIÓN",
                title: `Acción ${String(index + 1).padStart(2, "0")}`,
                summary: action,
                status: "partial",
                sourceIds: ["source-june-works", "source-june-consolidated"],
                pendingFields: ["Responsable", "Fecha objetivo", "Avance", "Evidencia de cierre"],
                actions: [{ label: "Abrir Cronología", view: "cronologia" }],
              })}
            >
              <span>{String(index + 1).padStart(2, "0")}</span><p>{action}</p><em>Abrir seguimiento →</em>
            </button>
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
  const disciplines = unitDisciplines(unit);
  const openIssues = (unit.issues ?? []).filter((issue) => issue.status === "abierta");
  return (
    <aside className="data-detail-panel" role="dialog" aria-modal="true" aria-label={`Detalle de ${unit.code}`}>
      <button className="close-button" onClick={onClose} aria-label="Cerrar detalle">×</button>
      <span className="section-kicker">FICHA INDIVIDUAL DE APARTAMENTO</span>
      <h3>{unit.code}</h3>
      <div className="unit-inspector-grid">
        <span>Edificio<strong>TH-{building.shortName.padStart(2, "0")}</strong></span>
        <span>Planta<strong>{unit.floor}</strong></span>
        <span>Conjunto<strong>{number.format(unitOverallProgress(unit))}%</strong></span>
        <span>Estado<strong>{statusLabel[visualUnitStatus(unit)]}</strong></span>
        <span>Fase disponible<strong>{unit.phase}</strong></span>
        <span>Desvío<strong>{unit.deviationDays > 0 ? `+${unit.deviationDays}` : unit.deviationDays} días</strong></span>
      </div>
      <section className="unit-operational-section">
        <div className="unit-section-heading">
          <span>AVANCE POR DISCIPLINA</span>
          <small>Los campos sin fuente permanecen pendientes</small>
        </div>
        <div className="unit-discipline-list">
          {disciplines.map((discipline) => (
            <div key={discipline.id} className={disciplineClassName(discipline)}>
              <span>{discipline.name}</span>
              <i><b style={{ width: `${discipline.progress ?? 0}%` }} /></i>
              <strong>{disciplineLabel(discipline)}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="unit-accountability-grid">
        <span>Responsable<strong>{unit.responsible || "Pendiente de asignar"}</strong></span>
        <span>Última actualización<strong>{unit.lastUpdated || projectSnapshot.declaredCutoff}</strong></span>
        <span>Fuente<strong>{unit.source || "Modelo vivo ARAYA"}</strong></span>
        <span>Incidencias abiertas<strong>{openIssues.length}</strong></span>
      </div>
      <section className="unit-issues">
        <div className="unit-section-heading"><span>INCIDENCIAS</span><small>{openIssues.length} abiertas</small></div>
        {openIssues.length === 0 ? (
          <p>Sin incidencias registradas para este apartamento.</p>
        ) : (
          openIssues.map((issue) => (
            <div className={`unit-issue ${issue.severity}`} key={issue.id}>
              <strong>{issue.title}</strong><span>{issue.severity}</span>
            </div>
          ))
        )}
      </section>
      <p className="unit-live-note">Responsables, disciplinas e incidencias se actualizan desde el mismo modelo vivo que gobierna el porcentaje y el color del plano.</p>
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
  const workspace = useContext(WorkspaceDetailContext);
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
        <div className="building-apartment-summary">
          <span><strong>{selected.units.length}</strong>Apartamentos</span>
          <span><strong>{selected.units.filter((unit) => visualUnitStatus(unit) === "en_curso").length}</strong>En curso</span>
          <span><strong>{selected.units.filter((unit) => visualUnitStatus(unit) === "terminada").length}</strong>Terminados</span>
          <span><strong>{selected.units.reduce((total, unit) => total + (unit.issues ?? []).filter((issue) => issue.status === "abierta").length, 0)}</strong>Incidencias</span>
        </div>
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
              <div className="unit-mini-disciplines compact">
                {unitDisciplines(unit).map((discipline) => (
                  <span key={discipline.id} className={disciplineClassName(discipline)}>
                    {discipline.name}<strong>{disciplineLabel(discipline)}</strong>
                  </span>
                ))}
              </div>
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
              <button
                type="button"
                className="workspace-data-row rank-data-row"
                key={item.name}
                onClick={() => workspace.openDetail({
                  id: `discipline-${item.name}`,
                  kicker: "DISCIPLINA DEL CONJUNTO",
                  title: item.name,
                  summary: "Avance consolidado de la disciplina en los 26 edificios integrados.",
                  status: "live",
                  metrics: [{ label: "Avance reportado", value: `${number.format(item.progress)}%` }],
                  sourceIds: ["source-june-works", "source-mpp"],
                  pendingFields: ["Desglose por edificio", "Responsable", "Fecha de actualización"],
                  actions: [{ label: "Abrir Planificación", view: "planificacion" }],
                })}
              >
                <span><strong>{item.name}</strong></span>
                <div><i style={{ width: `${item.progress}%` }} /></div><b>{number.format(item.progress)}%</b>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="section-kicker">SUPERSTRUCTURA</span><h3>Demora proyectada por edificio</h3></div><span className="data-note">Informe de obra</span></div>
          <div className="delay-chip-grid">
            {structuralDelay.map((item) => (
              <button
                type="button"
                key={item.building}
                className={`workspace-data-row ${item.days >= 15 ? "critical" : item.days >= 8 ? "warn" : ""}`}
                onClick={() => workspace.openDetail({
                  id: `structural-delay-${item.building}`,
                  kicker: "DEMORA DE SUPERESTRUCTURA",
                  title: item.building,
                  summary: "Demora proyectada registrada en el informe de obra.",
                  status: "observed",
                  metrics: [{ label: "Demora", value: `+${item.days} días` }],
                  sourceIds: ["source-june-works", "source-mpp"],
                  pendingFields: ["Causa", "Responsable", "Acción de recuperación", "Fecha objetivo"],
                  actions: [{ label: "Abrir Planificación", view: "planificacion" }],
                })}
              >
                <strong>{item.building}</strong><b>+{item.days} d</b>
              </button>
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
              <div><i style={{ width: `${unitOverallProgress(unit)}%` }} /></div>
              <small>{statusLabel[visualUnitStatus(unit)]} · {number.format(unitOverallProgress(unit))}% conjunto</small>
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
  const workspace = useContext(WorkspaceDetailContext);
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
                <button
                  type="button"
                  className="workspace-data-row rank-data-row"
                  key={model.name}
                  onClick={() => workspace.openDetail({
                    id: `sales-model-${model.name}`,
                    kicker: "MIX DE PRODUCTO",
                    title: model.name,
                    summary: "Reservas activas del modelo en Fase II.",
                    status: "live",
                    metrics: [
                      { label: "Reservas activas", value: `${model.value}` },
                      { label: "Reservas en junio", value: `${model.june}` },
                    ],
                    sourceIds: ["source-june-sales"],
                    actions: [{ label: "Abrir Apartamentos", view: "viviendas" }],
                  })}
                >
                  <span><strong>{model.name}</strong><small>{model.june} en junio</small></span>
                  <div><i style={{ width: `${(model.value / 32) * 100}%` }} /></div>
                  <b>{model.value}</b>
                </button>
              ))}
            </div>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">UBICACIÓN</span><h3>Reservas activas por frente</h3></div></div>
            <div className="compact-table commercial-table">
              <div className="compact-row head"><span>Ubicación</span><span>Garden</span><span>Sunset</span><span>Balcony</span><span>Total</span></div>
              {salesLocations.map((row) => (
                <button
                  type="button"
                  className="compact-row workspace-data-row"
                  key={row.name}
                  onClick={() => workspace.openDetail({
                    id: `sales-location-${row.name}`,
                    kicker: "RESERVAS POR FRENTE",
                    title: row.name,
                    summary: "Distribución de reservas activas por tipología comercial.",
                    status: "live",
                    metrics: [
                      { label: "Garden", value: `${row.garden}` },
                      { label: "Sunset", value: `${row.sunset}` },
                      { label: "Balcony", value: `${row.balcony}` },
                      { label: "Total", value: `${row.total}` },
                    ],
                    sourceIds: ["source-june-sales"],
                    actions: [{ label: "Abrir Implantación", view: "implantacion" }],
                  })}
                >
                  <strong>{row.name}</strong><span>{row.garden}</span><span>{row.sunset}</span><span>{row.balcony}</span><b>{row.total}</b>
                </button>
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
                <button
                  type="button"
                  className="workspace-data-row rank-data-row"
                  key={item.name}
                  onClick={() => workspace.openDetail({
                    id: `arrears-${item.name}`,
                    kicker: "CARTERA VENCIDA",
                    title: item.name,
                    summary: "Tramo de morosidad registrado en el último corte comercial disponible.",
                    status: "observed",
                    metrics: [
                      { label: "Clientes", value: `${item.clients}` },
                      { label: "Importe", value: formatMoney(item.amountUsd, "USD", currency) },
                      { label: "Participación", value: `${number.format((item.amountUsd / juneReport.collections.overdueUsd) * 100)}%` },
                    ],
                    sourceIds: ["source-june-sales", "source-june-consolidated"],
                    actions: [{ label: "Abrir Finanzas", view: "metricas" }],
                  })}
                >
                  <span><strong>{item.name}</strong><small>{item.clients} clientes</small></span>
                  <div><i style={{ width: `${(item.amountUsd / juneReport.collections.overdueUsd) * 100}%` }} /></div>
                  <b>{formatMoney(item.amountUsd, "USD", currency)}</b>
                </button>
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
  const [section, setSection] = useState<"seguridad" | "permisos" | "financiacion" | "cumplimiento">("seguridad");
  const workspace = useContext(WorkspaceDetailContext);
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
          ...(canAccessFinance ? [
            { id: "financiacion", label: "Financiación", detail: "6 procesos" },
            { id: "cumplimiento", label: "Cumplimiento IFC", detail: "4 bloques" },
          ] : []),
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
              <button
                type="button"
                className="panel safety-card workspace-data-row"
                key={metric.label}
                onClick={() => workspace.openDetail({
                  id: `safety-${metric.label}`,
                  kicker: "SEGURIDAD Y SALUD",
                  title: metric.label,
                  summary: metric.detail,
                  status: "partial",
                  metrics: [{ label: "Valor reportado", value: metric.value }],
                  sourceIds: ["source-june-works"],
                  pendingFields: ["Evidencia", "Responsable", "Fecha", "Acción correctiva"],
                  actions: [{ label: "Abrir Centro de datos", view: "fuentes" }],
                })}
              >
                <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
                <em>Abrir ficha →</em>
              </button>
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
              <button
                type="button"
                className="compact-row workspace-data-row"
                key={`${permit.entity}-${permit.reference}`}
                onClick={() => workspace.openDetail({
                  id: `permit-${permit.entity}-${permit.reference}`,
                  kicker: "PERMISO Y NO OBJECIÓN",
                  title: permit.entity,
                  summary: `Referencia ${permit.reference}. ${permit.status}.`,
                  status: permit.status === "Aprobado" ? "live" : "partial",
                  metrics: [
                    { label: "Referencia", value: permit.reference },
                    { label: "Estado", value: permit.status },
                    { label: "Fecha / siguiente paso", value: permit.date },
                  ],
                  sourceIds: ["source-june-consolidated", "source-june-pdf"],
                  pendingFields: permit.status === "Aprobado" ? undefined : ["Responsable", "Fecha objetivo", "Documento de cierre"],
                  actions: [{ label: "Abrir Cronología", view: "cronologia" }],
                })}
              >
                <strong>{permit.entity}</strong><span>{permit.reference}</span>
                <b className={permit.status === "Aprobado" ? "good-text" : "warn-text"}>{permit.status}</b><span>{permit.date}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {canAccessFinance && section === "financiacion" && (
        <section className="report-grid">
          <article className="panel finance-processes">
            <div className="panel-heading"><div><span className="section-kicker">GESTIONES FINANCIERAS</span><h3>Procesos activos</h3></div></div>
            {financingProcesses.map((process) => (
              <button
                type="button"
                className="finance-process workspace-data-row"
                key={process.entity}
                onClick={() => workspace.openDetail({
                  id: `financing-${process.entity}`,
                  kicker: "GESTIÓN FINANCIERA",
                  title: process.entity,
                  summary: process.detail,
                  status: "partial",
                  metrics: [
                    { label: "Importe", value: formatMoneyMillions(process.amountDop, "DOP", currency) },
                    { label: "Estado", value: process.status },
                  ],
                  sourceIds: ["source-june-consolidated", "source-june-finance"],
                  pendingFields: ["Responsable", "Próximo paso", "Fecha objetivo", "Documento"],
                  actions: [{ label: "Abrir Finanzas", view: "metricas" }],
                })}
              >
                <span><strong>{process.entity}</strong><small>{process.detail}</small></span>
                <b>{formatMoneyMillions(process.amountDop, "DOP", currency)}</b><i>{process.status}</i>
              </button>
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

      {canAccessFinance && section === "cumplimiento" && (
        <section className="financial-detail-stack">
          <article className="panel ifc-compliance-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">PRÉSTAMO IFC · ANÁLISIS 29/07/2026</span><h3>Matriz operativa de obligaciones</h3></div>
              <a className="button secondary" href="/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf">Abrir informe</a>
            </div>
            <div className="ifc-compliance-grid">
              {ifcComplianceGroups.map((group) => (
                <article key={group.title}>
                  <strong>{group.title}</strong>
                  <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </article>
              ))}
            </div>
            <p className="quality-note">Esta matriz resume el informe recibido para facilitar el seguimiento. No sustituye el contrato de préstamo ni el criterio jurídico; cada obligación deberá enlazarse con responsable, evidencia y fecha de cumplimiento.</p>
          </article>
          <article className="report-grid">
            <div className="panel decision-panel">
              <span className="section-kicker">RIESGO OPERATIVO</span>
              <h3>Notificación de incidentes</h3>
              <strong>3 días</strong>
              <p>Plazo identificado para comunicar incidentes significativos. Debe integrarse con el registro de Seguridad y la cadena de escalado.</p>
            </div>
            <div className="panel decision-panel">
              <span className="section-kicker">SEGUIMIENTO DOCUMENTAL</span>
              <h3>Reportes y auditoría</h3>
              <strong>Mensual · anual</strong>
              <p>Reportes financieros y operativos mensuales, más estados financieros auditados anualmente.</p>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

function TimelineView() {
  const [filter, setFilter] = useState("todos");
  const workspace = useContext(WorkspaceDetailContext);
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
          <button
            type="button"
            className="timeline-event workspace-data-row"
            key={event.id}
            onClick={() => workspace.openDetail({
              id: event.id,
              kicker: "EVENTO DE TRAZABILIDAD",
              title: event.title,
              summary: event.detail,
              status: "live",
              metrics: [
                { label: "Fecha", value: event.date },
                { label: "Hora", value: event.time },
                { label: "Área / edificio", value: event.building },
                { label: "Responsable", value: event.author },
              ],
              sourceIds: event.type === "avance"
                ? ["source-xls", "source-june-works"]
                : event.type === "hito"
                  ? ["source-mpp"]
                  : ["source-june-consolidated"],
              actions: [
                { label: event.type === "avance" ? "Abrir Planificación" : "Abrir Centro de datos", view: event.type === "avance" ? "planificacion" : "fuentes" },
              ],
            })}
          >
            <div className={`timeline-marker ${event.type}`} />
            <div className="timeline-date"><strong>{event.date}</strong><span>{event.time}</span></div>
            <div className="timeline-copy">
              <span className="event-type">{event.type}</span>
              <h4>{event.title}</h4>
              <p>{event.detail}</p>
              <small>{event.building} · {event.author}</small>
              <em>Abrir evento →</em>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SuppliersView({ suppliers, onAdd, currency, canAccessFinance }: { suppliers: Supplier[]; onAdd: () => void; currency: CurrencyCode; canAccessFinance: boolean }) {
  const workspace = useContext(WorkspaceDetailContext);
  const [payables, setPayables] = useState<PayablesDataset | null>(null);
  const [payablesError, setPayablesError] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  useEffect(() => {
    if (!canAccessFinance) return;
    let active = true;
    const refreshPayables = async () => {
      try {
        const response = await fetch("/api/payables", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo consultar el detalle de facturas.");
        const payload = await response.json() as PayablesDataset;
        if (!active) return;
        setPayables(payload);
        setPayablesError("");
      } catch (error) {
        if (!active) return;
        setPayablesError(error instanceof Error ? error.message : "No se pudo consultar el detalle de facturas.");
      }
    };
    void refreshPayables();
    const interval = window.setInterval(() => void refreshPayables(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [canAccessFinance]);

  const visiblePayableVendors = useMemo(() => {
    const query = supplierSearch.trim().toLocaleLowerCase("es");
    if (!payables) return [];
    if (!query) return payables.vendors;
    return payables.vendors.filter((supplier) => supplier.name.toLocaleLowerCase("es").includes(query));
  }, [payables, supplierSearch]);
  const visibleDirectorySuppliers = useMemo(() => {
    const query = directorySearch.trim().toLocaleLowerCase("es");
    if (!query) return supplierDirectory;
    return supplierDirectory.filter((supplier) => [
      supplier.name,
      ...supplier.services,
      ...supplier.contacts,
      ...supplier.legalIds,
    ].some((value) => value.toLocaleLowerCase("es").includes(query)));
  }, [directorySearch]);

  const selectedVendor = payables?.vendors.find((supplier) => supplier.name === selectedVendorName) ?? null;
  const selectedVendorInvoices = useMemo(
    () => payables?.invoices.filter((invoice) => invoice.vendorName === selectedVendorName) ?? [],
    [payables, selectedVendorName],
  );
  const selectedInvoice = selectedVendorInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Directorio validado" value={`${supplierContactAudit.uniqueSuppliers}`} detail={`${supplierContactAudit.sourceRows} registros de origen`} />
        {canAccessFinance ? (
          <>
            <StatCard eyebrow="Relaciones con crédito" value={`${supplierContactAudit.creditRelationships}`} detail={formatMoneyMillions(supplierContactAudit.creditLimitDop, "DOP", currency)} />
            <StatCard eyebrow="Plan de compras auditado" value={formatMoneyMillions(procurementAudit.auditedScheduledTotalDop, "DOP", currency)} detail={`${procurementAudit.packageCount} paquetes · 26 edificios`} tone="warn" />
            <StatCard eyebrow="Facturas consolidadas" value={payables ? `${payables.invoiceCount}` : "…"} detail={`${payables?.sourceLineCount ?? 96} líneas contables`} />
          </>
        ) : (
          <>
            <StatCard eyebrow="Comparativos" value={`${procurementAudit.comparisonCount}`} detail={`${procurementAudit.offerCount} ofertas verificadas`} tone="good" />
            <StatCard eyebrow="Paquetes de compra" value={`${procurementAudit.packageCount}`} detail="Planificados para la fase de 26 edificios" tone="warn" />
            <StatCard eyebrow="Datos por completar" value={`${supplierContactAudit.missingLegalId + supplierContactAudit.missingEmail}`} detail={`${supplierContactAudit.missingLegalId} RNC · ${supplierContactAudit.missingEmail} correos`} tone="danger" />
          </>
        )}
      </section>
      <section className="panel supplier-directory-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">MAESTRO DE PROVEEDORES · 30/07/2026</span>
            <h3>Directorio operativo verificado</h3>
          </div>
          <a className="button secondary" href="/data-center/julio-2026/contactos-proveedores-araya.xls">Abrir archivo fuente</a>
        </div>
        <div className="payable-supplier-toolbar">
          <label>
            <span>Buscar empresa, servicio, contacto o RNC</span>
            <input type="search" value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Ej. hormigón, DACIA, 1-01…" />
          </label>
          <div><strong>{visibleDirectorySuppliers.length}</strong><span>resultados</span></div>
        </div>
        <div className="supplier-master-grid">
          {visibleDirectorySuppliers.map((supplier) => (
            <button
              type="button"
              className="supplier-master-card workspace-data-row"
              key={supplier.id}
              onClick={() => workspace.openDetail({
                id: `directory-${supplier.id}`,
                kicker: "MAESTRO DE PROVEEDORES",
                title: supplier.name,
                summary: supplier.services.join(" · ") || "Servicio pendiente de completar",
                status: supplier.qualityIssues.length ? "observed" : "live",
                metrics: [
                  { label: "Tamaño", value: supplier.size || "Sin dato" },
                  { label: "RNC", value: supplier.legalIds.join(" · ") || "Sin dato" },
                  { label: "Contacto", value: supplier.contacts.join(" · ") || "Sin dato" },
                  { label: "Teléfono", value: supplier.phones.join(" · ") || "Sin dato" },
                  { label: "Correo / web", value: supplier.emails.join(" · ") || "Sin dato" },
                  { label: "Relación", value: supplier.relationships.join(" · ") || "Sin negociación" },
                  ...(canAccessFinance ? [
                    { label: "Condición de crédito", value: supplier.creditTerms.join(" · ") || "Sin dato" },
                    { label: "Límite registrado", value: supplier.creditLimitDop ? formatMoney(supplier.creditLimitDop, "DOP", currency) : "Sin límite informado" },
                  ] : []),
                ],
                sourceIds: ["source-supplier-contacts", "source-supplier-analysis"],
                pendingFields: supplier.qualityIssues.length ? supplier.qualityIssues : undefined,
                actions: [{ label: "Abrir Centro de datos", view: "fuentes" }],
              })}
            >
              <span className="supplier-logo">{supplier.name.slice(0, 2).toUpperCase()}</span>
              <span className="supplier-master-copy">
                <strong>{supplier.name}</strong>
                <small>{supplier.services.join(" · ") || "Servicio sin detallar"}</small>
                <em>{supplier.contacts[0] || supplier.phones[0] || "Contacto pendiente"}</em>
              </span>
              <span className={supplier.qualityIssues.length ? "source-status observada" : "source-status validada"}>
                {supplier.qualityIssues.length ? `${supplier.qualityIssues.length} alertas` : "Completo"}
              </span>
            </button>
          ))}
        </div>
        <p className="quality-note">Las filas vacías de las plantillas no se contabilizan como proveedores. Los registros repetidos por empresa se consolidan sin perder sus filas de origen.</p>
      </section>

      <section className="report-grid procurement-overview">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="section-kicker">PLAN DE COMPRAS · 26 EDIFICIOS</span><h3>Paquetes y proveedores previstos</h3></div>
            <span className="data-note">{procurementAudit.packageCount} paquetes</span>
          </div>
          <div className="procurement-package-list">
            {procurementPackages.map((item) => (
              <button
                type="button"
                key={item.id}
                className="procurement-package-row workspace-data-row"
                onClick={() => workspace.openDetail({
                  id: item.id,
                  kicker: "PAQUETE DE COMPRA",
                  title: item.name,
                  summary: `Proveedor previsto: ${item.supplier}. Alcance: ${item.buildings} edificios.`,
                  status: item.supplier.startsWith("PROVEEDOR") ? "partial" : "live",
                  metrics: [
                    { label: "Proveedor", value: item.supplier },
                    { label: "Edificios", value: `${item.buildings}` },
                    ...(canAccessFinance ? [
                      { label: "Precio por edificio", value: formatMoney(item.unitPricePerBuildingDop, "DOP", currency) },
                      { label: "Total programado", value: formatMoney(item.scheduledTotalDop, "DOP", currency) },
                    ] : []),
                  ],
                  sourceIds: ["source-procurement-comparison"],
                  pendingFields: item.supplier.startsWith("PROVEEDOR") ? ["Proveedor adjudicado", "Contrato", "Fecha de entrega"] : ["Contrato", "Pedido", "Albaranes"],
                  actions: [{ label: "Abrir Cronología", view: "cronologia" }, { label: "Abrir Centro de datos", view: "fuentes" }],
                })}
              >
                <span><strong>{item.name}</strong><small>{item.supplier} · {item.buildings} edificios</small></span>
                {canAccessFinance && <b>{formatMoney(item.scheduledTotalDop, "DOP", currency)}</b>}
                <i aria-hidden="true">→</i>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div><span className="section-kicker">CALENDARIO DE DESEMBOLSOS</span><h3>Flujo auditado de proveedores</h3></div>
            {canAccessFinance && <strong>{formatMoneyMillions(procurementAudit.auditedScheduledTotalDop, "DOP", currency)}</strong>}
          </div>
          <div className="procurement-month-chart">
            {procurementMonthlySchedule.map((item) => (
              <div key={item.month}>
                <span className="procurement-month-bar"><i style={{ height: `${Math.max(7, (item.amountDop / 42000000) * 100)}%` }} /></span>
                <strong>{item.month}</strong>
                {canAccessFinance && <small>{formatMoneyMillions(item.amountDop, "DOP", currency)}</small>}
              </div>
            ))}
          </div>
          <div className="callout warn">
            <strong>Corrección auditada del dashboard</strong>
            <p>El total del archivo omite {canAccessFinance ? formatMoney(procurementAudit.omittedFromSourceFormulaDop, "DOP", currency) : "una partida"} en su fórmula, aunque el calendario mensual sí la incluye. El documento original no se modifica.</p>
          </div>
        </article>
      </section>

      <section className="panel supplier-comparisons-panel">
        <div className="panel-heading">
          <div><span className="section-kicker">11 CUADROS COMPARATIVOS</span><h3>Ofertas por especialidad</h3></div>
          <span className="data-note">{procurementAudit.offerCount} ofertas · pulsa para abrir</span>
        </div>
        <div className="supplier-comparison-grid">
          {supplierComparisons.map((comparison) => {
            const scoredOffers = comparison.offers.filter((offer) => offer.score !== null);
            const maxScore = Math.max(...scoredOffers.map((offer) => offer.score ?? 0));
            const bestScore = scoredOffers.filter((offer) => offer.score === maxScore);
            return (
              <button
                type="button"
                key={comparison.id}
                className="supplier-comparison-card workspace-data-row"
                onClick={() => workspace.openDetail({
                  id: comparison.id,
                  kicker: `COMPARATIVO · ${comparison.sheet}`,
                  title: comparison.title,
                  summary: `${comparison.offers.length} ofertas verificadas${comparison.date ? ` · ${comparison.date}` : ""}. La mayor puntuación no implica adjudicación automática.`,
                  status: comparison.observations.length ? "observed" : "live",
                  metrics: [
                    { label: "Ofertas", value: `${comparison.offers.length}` },
                    { label: "Mayor puntuación", value: bestScore.map((offer) => `${offer.supplier} (${offer.score})`).join(" · ") },
                    ...(canAccessFinance ? [
                      { label: "Presupuesto de referencia", value: formatMoney(comparison.budgetDop, "DOP", currency) },
                      ...comparison.offers.map((offer) => ({
                        label: offer.supplier,
                        value: offer.totalDop === null ? "Oferta incompleta" : `${formatMoney(offer.totalDop, "DOP", currency)} · ${offer.score ?? "s/p"} ptos.`,
                      })),
                    ] : []),
                  ],
                  sourceIds: ["source-procurement-comparison", "source-procurement-comparison-duplicate"],
                  pendingFields: comparison.observations.length ? comparison.observations : ["Adjudicación", "Contrato", "Fecha de entrega"],
                  actions: [{ label: "Abrir Centro de datos", view: "fuentes" }],
                })}
              >
                <span><small>{comparison.sheet}</small><strong>{comparison.title}</strong></span>
                <span><b>{comparison.offers.length}</b><small>ofertas</small></span>
                <em>{bestScore.map((offer) => offer.supplier).join(" / ")}</em>
              </button>
            );
          })}
        </div>
        <p className="quality-note">Los ganadores mostrados son los de mayor puntuación de la hoja. La adjudicación definitiva debe confirmarse con contrato o pedido; las observaciones cualitativas se conservan en cada ficha.</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">SEGUIMIENTO COLABORATIVO</span>
            <h3>Entregas y estado operativo editable</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Nuevo proveedor</button>
        </div>
        {suppliers.length === 0 ? (
          <div className="empty-state">
            <strong>El directorio está cargado; el seguimiento de entregas aún no tiene registros.</strong>
            <p>Este bloque queda preparado para añadir responsables, pedidos, fechas comprometidas, incidencias y estados sin inventar información.</p>
          </div>
        ) : (
          <div className="supplier-grid">
            {suppliers.map((supplier) => (
              <button
                type="button"
                className="supplier-card workspace-data-row"
                key={supplier.id}
                onClick={() => workspace.openDetail({
                  id: `supplier-${supplier.id}`,
                  kicker: "PROVEEDOR OPERATIVO",
                  title: supplier.name,
                  summary: supplier.category,
                  status: supplier.status === "al_dia" ? "live" : supplier.status === "revision" ? "partial" : "observed",
                  metrics: [
                    { label: "Contacto", value: supplier.contact || "Sin dato" },
                    { label: "Próxima entrega", value: supplier.nextDelivery || "Sin dato" },
                    ...(canAccessFinance ? [{ label: "Contratado", value: supplier.amount || "Sin dato" }] : []),
                  ],
                  pendingFields: ["Contratos", "Pedidos", "Albaranes", "Incidencias de entrega"],
                  actions: [{ label: "Abrir Cronología", view: "cronologia" }],
                })}
              >
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
                <em>Abrir ficha →</em>
              </button>
            ))}
          </div>
        )}
      </section>
      {canAccessFinance && <section className="panel payable-suppliers-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CUENTAS POR PAGAR · ANTONELY</span>
            <h3>Proveedores y facturas registradas</h3>
          </div>
          <span className="data-note">{payables?.vendorCount ?? 43} proveedores · {payables?.invoiceCount ?? 86} facturas · {currency}</span>
        </div>
        <div className="payable-supplier-toolbar">
          <label>
            <span>Buscar proveedor</span>
            <input
              type="search"
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
              placeholder="Nombre del proveedor"
            />
          </label>
          <div>
            <strong>{visiblePayableVendors.length}</strong>
            <span>resultados</span>
          </div>
        </div>
        {payablesError && !payables ? (
          <div className="empty-state compact">
            <strong>No se pudo cargar el detalle.</strong>
            <p>{payablesError} El sistema volverá a intentarlo automáticamente.</p>
          </div>
        ) : (
          <div className="payable-supplier-list">
            {visiblePayableVendors.map((supplier) => (
              <button
                type="button"
                key={supplier.name}
                className="payable-supplier-row"
                onClick={() => {
                  setSelectedVendorName(supplier.name);
                  setSelectedInvoiceId("");
                }}
              >
                <span className="supplier-logo" aria-hidden="true">{supplier.name.slice(0, 2).toUpperCase()}</span>
                <span className="payable-supplier-name">
                  <strong>{supplier.name}</strong>
                  <small>{supplier.invoiceCount} facturas · {supplier.sourceLineCount} líneas de origen</small>
                </span>
                <span className={`payable-aging age-${supplier.oldestAgingIndex}`}>
                  {payableAgingLabels[supplier.oldestAgingIndex] ?? "En revisión"}
                </span>
                <b>{formatMoney(supplier.amountDop, "DOP", currency)}</b>
                <span className="payable-open-label">Abrir proveedor <i aria-hidden="true">→</i></span>
              </button>
            ))}
          </div>
        )}
        <p className="quality-note">
          Pulsa un proveedor para consultar sus facturas. El saldo procede de {payables?.sourceLineCount ?? 96} líneas contables,
          consolidadas por proveedor, referencia y fecha sin duplicar las imputaciones a varias partidas.
        </p>
      </section>}

      {canAccessFinance && selectedVendor && payables && (
        <div
          className="supplier-ledger-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedVendorName("");
              setSelectedInvoiceId("");
            }
          }}
        >
          <aside className="supplier-ledger-panel" role="dialog" aria-modal="true" aria-label={`Facturas de ${selectedVendor.name}`}>
            <div className="supplier-ledger-header">
              <div>
                <span className="section-kicker">{selectedInvoice ? "DETALLE DE FACTURA" : "FICHA DEL PROVEEDOR"}</span>
                <h3>{selectedInvoice ? selectedInvoice.reference || "Registro sin referencia" : selectedVendor.name}</h3>
                <p>{selectedInvoice ? selectedVendor.name : `Corte ${formatPayableDate(payables.cutoff)}`}</p>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Cerrar ficha del proveedor"
                onClick={() => {
                  setSelectedVendorName("");
                  setSelectedInvoiceId("");
                }}
              >×</button>
            </div>

            {selectedInvoice ? (
              <div className="payable-invoice-detail">
                <button type="button" className="text-action" onClick={() => setSelectedInvoiceId("")}>← Volver a las facturas</button>
                <div className="payable-invoice-summary">
                  <span><small>Proveedor</small><strong>{selectedInvoice.vendorName}</strong></span>
                  <span><small>Importe</small><strong>{formatMoney(selectedInvoice.amountDop, "DOP", currency)}</strong></span>
                  <span><small>Fecha factura</small><strong>{formatPayableDate(selectedInvoice.invoiceDate)}</strong></span>
                  <span><small>Vencimiento</small><strong>{formatPayableDate(selectedInvoice.dueDate)}</strong></span>
                  <span><small>Antigüedad al corte</small><strong>{selectedInvoice.amountDop < 0 ? "Nota de crédito / ajuste" : payableAgingLabels[selectedInvoice.agingIndex]}</strong></span>
                  <span><small>Referencia</small><strong>{selectedInvoice.reference || "Sin referencia en origen"}</strong></span>
                </div>
                <div className="payable-allocation-block">
                  <div className="unit-section-heading">
                    <span>IMPUTACIÓN CONTABLE</span>
                    <small>{selectedInvoice.allocations.length} {selectedInvoice.allocations.length === 1 ? "partida" : "partidas"}</small>
                  </div>
                  <div className="payable-allocation-list">
                    {selectedInvoice.allocations.map((allocation) => (
                      <div key={`${allocation.category}-${allocation.sourceRow}`}>
                        <span><strong>{allocation.category}</strong><small>Fila {allocation.sourceRow} · {payables.sourceSheet}</small></span>
                        <b>{formatMoney(allocation.amountDop, "DOP", currency)}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="payable-document-block">
                  <div>
                    <strong>Documento de la factura</strong>
                    <p>
                      {selectedInvoice.documentUrl
                        ? "El archivo individual está vinculado a este registro."
                        : "Documento individual pendiente de cargar. La información visible está verificada contra el archivo fuente."}
                    </p>
                  </div>
                  <div className="payable-document-actions">
                    {selectedInvoice.documentUrl ? (
                      <a className="button primary" href={selectedInvoice.documentUrl}>Abrir factura</a>
                    ) : (
                      <span className="button disabled" aria-disabled="true">Factura no adjunta</span>
                    )}
                    <a className="button secondary" href={payables.sourceUrl}>Abrir archivo fuente</a>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="supplier-ledger-summary">
                  <span><small>Saldo registrado</small><strong>{formatMoney(selectedVendor.amountDop, "DOP", currency)}</strong></span>
                  <span><small>Facturas</small><strong>{selectedVendor.invoiceCount}</strong></span>
                  <span><small>Líneas de origen</small><strong>{selectedVendor.sourceLineCount}</strong></span>
                  <span><small>Documentos vinculados</small><strong>{selectedVendor.documentCount}</strong></span>
                </div>
                <div className="supplier-invoice-list">
                  {selectedVendorInvoices.map((invoice) => (
                    <button type="button" key={invoice.id} onClick={() => setSelectedInvoiceId(invoice.id)}>
                      <span>
                        <strong>{invoice.reference || "Sin referencia"}</strong>
                        <small>Factura {formatPayableDate(invoice.invoiceDate)} · vence {formatPayableDate(invoice.dueDate)}</small>
                      </span>
                      <span className={`payable-aging age-${invoice.agingIndex}`}>
                        {invoice.amountDop < 0 ? "Ajuste" : payableAgingLabels[invoice.agingIndex]}
                      </span>
                      <b>{formatMoney(invoice.amountDop, "DOP", currency)}</b>
                      <i aria-hidden="true">→</i>
                    </button>
                  ))}
                </div>
                <p className="supplier-ledger-source">
                  Fuente: <strong>{payables.sourceName}</strong> · hoja {payables.sourceSheet}.
                  Cada factura puede abrirse para revisar sus fechas, importe e imputación.
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MetricsView({ metrics, onAdd, currency, latestFinanceEvent }: { metrics: CustomMetric[]; onAdd: () => void; currency: CurrencyCode; latestFinanceEvent: LiveSyncState["latestEvent"] }) {
  const [section, setSection] = useState<"flujo" | "flujo_obra" | "presupuesto" | "cxp" | "anticipos" | "fideicomiso" | "control" | "detalle">("flujo");
  const workspace = useContext(WorkspaceDetailContext);
  const rd = (value: number) => formatMoney(value, "DOP", currency);
  const rdMillions = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const qualityIssues = financialQualityIssues();
  const cxpBalanceContableDop = payablesReconciliation.find((row) => row.source === "Balance contable")?.amount ?? juneReport.finance.cxpDop;
  const cxpVsBalanceContableDop = juneReport.finance.cxpDop - cxpBalanceContableDop;
  // El encabezado declaraba "Junio 2026" a fuego; con CxP, Anticipos y
  // Fideicomiso siguiendo el archivo más reciente en vivo, el período
  // mostrado debe seguir esa misma fuente en vez de quedarse fijo.
  const latestFinanceCutoffMatch = latestFinanceEvent?.area === "finanzas"
    ? latestFinanceEvent.cutoff.match(/^(\d{4})-(\d{2})/)
    : null;
  const financePeriodLabel = latestFinanceCutoffMatch
    ? `${uploadArchiveMonthNames[Number(latestFinanceCutoffMatch[2]) - 1]?.toUpperCase() ?? juneReport.published} ${latestFinanceCutoffMatch[1]}`
    : juneReport.published.toUpperCase();
  return (
    <div className="view-stack">
      <section className="data-view-intro">
        <div><span className="section-kicker">INFORME FINANCIERO · {financePeriodLabel}</span><h2>Presupuesto, caja y obligaciones</h2></div>
        <p>Los importes fuente se conservan en DOP y se muestran en {currency}. {exchangeRateNote(currency)}. Algunas secciones ya siguen el archivo más reciente; otras conservan el corte consolidado de {juneReport.published} hasta que llegue una fuente nueva.</p>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Presupuesto de control" value={rdMillions(juneReport.finance.budgetDop)} detail={`${number.format((juneReport.finance.executedDop / juneReport.finance.budgetDop) * 100)}% ejecutado`} />
        <StatCard eyebrow="Coste acumulado" value={rdMillions(juneReport.finance.executedDop)} detail={`${rdMillions(juneReport.finance.juneExecutedDop)} en junio`} />
        <StatCard eyebrow="Cuentas por pagar" value={rdMillions(juneReport.finance.cxpDop)} detail={`${number.format(cxpAging.find((item) => item.name === "Corriente")?.percent ?? 0)}% corriente`} tone="warn" />
        <StatCard eyebrow="Caja proyectada · dic" value={rdMillions(juneReport.finance.projectedCashDecemberDop)} detail="Requiere materializar financiación" tone="danger" />
      </section>
      <section className="report-tabs finance-tabs">
        {[
          { id: "flujo", label: "Flujo de caja", detail: "Jul–Dic 2026" },
          { id: "flujo_obra", label: "Flujo de obra", detail: "Fase I · reprogramado" },
          { id: "presupuesto", label: "Presupuesto y desviación", detail: "Tipo A · jun-26" },
          { id: "cxp", label: "Cuentas por pagar", detail: rdMillions(juneReport.finance.cxpDop) },
          { id: "anticipos", label: "Anticipos", detail: rdMillions(juneReport.finance.advancesPendingDop) },
          { id: "fideicomiso", label: "Fideicomiso", detail: rdMillions(fiduciaryStatementSummary.balance.assetsDop) },
          { id: "control", label: "Control interno", detail: rdMillions(juneReport.finance.assetsDop) },
          { id: "detalle", label: "Detalle completo", detail: `${antonelyDetailTotals.costAccountCount} · ${antonelyDetailTotals.payableCategoryCount} · ${antonelyDetailTotals.advanceCount} · ${antonelyDetailTotals.balanceLineCount}` },
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
                  <i className="income" style={{ height: `${Math.max(4, (month.income / Math.max(1, ...financialProjection.flatMap((item) => [item.income, item.costs]))) * 100)}%` }} title={`Ingresos ${rd(month.income)}`} />
                  <i className="cost" style={{ height: `${Math.max(4, (month.costs / Math.max(1, ...financialProjection.flatMap((item) => [item.income, item.costs]))) * 100)}%` }} title={`Costes ${rd(month.costs)}`} />
                </div>
                <strong>{month.month}</strong>
                <small className={month.cumulative < 0 ? "danger-text" : "good-text"}>{rdMillions(month.cumulative)}</small>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="income" />Ingresos</span><span><i className="cost" />Costes</span><span>La cifra bajo cada mes es la caja acumulada.</span></div>
        </section>
      )}

      {section === "flujo_obra" && (
        <section className="financial-detail-stack work-flow-stack">
          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">FASE I · CORTE 30/06/2026</span><h3>Flujo de obra real y reprogramado</h3></div>
              <a className="button secondary" href="/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx">Abrir Excel</a>
            </div>
            <div className="budget-summary-grid compact work-flow-summary">
              <span><small>Alcance total</small><strong>{rd(reprogrammedFlowAudit.reprogrammedTotalDop)}</strong></span>
              <span><small>Real · dic-25 a jun-26</small><strong>{rd(reprogrammedFlowAudit.actualPeriodDop)}</strong></span>
              <span><small>Real acumulado al corte</small><strong>{rd(reprogrammedFlowAudit.actualToCutoffDop)}</strong></span>
              <span><small>Por ejecutar · jul-26 a jul-27</small><strong>{rd(reprogrammedFlowAudit.remainingForecastDop)}</strong></span>
            </div>
            <div className="callout">
              <strong>Alcance separado del flujo de caja global</strong>
              <p>Esta fuente solo cubre Urbanismo y Edificios de la Fase I. No incluye terreno, diseño, gerencia, indirectos, inspección, permisos ni gastos financieros.</p>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">COMPARACIÓN MENSUAL</span><h3>Presupuesto original frente a real / reprogramado</h3></div>
              <span className="data-note">Pulsa cualquier mes para abrir su ficha · {currency}</span>
            </div>
            <div className="work-flow-chart-scroll">
              <div className="work-flow-chart" role="img" aria-label="Flujo mensual original frente a real y reprogramado">
                {reprogrammedFlowMonths.map((item) => (
                  <button
                    type="button"
                    className={`work-flow-month workspace-data-row ${item.status}`}
                    key={item.month}
                    onClick={() => workspace.openDetail({
                      id: `work-flow-${item.month}`,
                      kicker: item.status === "actual" ? "FLUJO REAL" : "FLUJO REPROGRAMADO",
                      title: item.month.toUpperCase(),
                      summary: item.status === "actual"
                        ? "Importe real de Urbanismo y Edificios frente al presupuesto original del mes."
                        : "Proyección vigente de Urbanismo y Edificios frente al presupuesto original del mes.",
                      status: item.status === "actual" ? "live" : "partial",
                      metrics: [
                        { label: "Presupuesto original", value: rd(item.originalDop) },
                        { label: item.status === "actual" ? "Ejecutado real" : "Reprogramado", value: rd(item.currentDop) },
                        { label: "Diferencia", value: rd(item.varianceDop) },
                        { label: "Urbanismo", value: rd(item.urbanismDop) },
                        { label: "Edificios", value: rd(item.buildingsDop) },
                      ],
                      sourceIds: ["source-reprogrammed-flow-phase-1"],
                      actions: [{ label: "Abrir Centro de datos", view: "fuentes" }],
                    })}
                  >
                    <span className="work-flow-bars">
                      <i className="original" style={{ height: `${Math.max(2, (item.originalDop / 110_000_000) * 100)}%` }} title={`Original ${rd(item.originalDop)}`} />
                      <i className="current" style={{ height: `${Math.max(2, (item.currentDop / 110_000_000) * 100)}%` }} title={`${item.status === "actual" ? "Real" : "Reprogramado"} ${rd(item.currentDop)}`} />
                    </span>
                    <strong>{item.month}</strong>
                    <small>{item.status === "actual" ? "Real" : "Proy."}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-legend work-flow-legend">
              <span><i className="work-flow-original" />Presupuesto original</span>
              <span><i className="work-flow-current" />Real hasta junio · reprogramado desde julio</span>
            </div>
            <div className="callout warn">
              <strong>Agosto y septiembre concentran la recuperación</strong>
              <p>La desviación acumulada de {rd(reprogrammedFlowAudit.cumulativeVarianceRedistributedDop)} se añade por mitades: {rd(reprogrammedFlowAudit.augustAdjustmentDop)} en agosto y la misma cantidad en septiembre de 2026.</p>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">REAL VS. PRESUPUESTO · DIC-25 A JUN-26</span><h3>Lectura por ámbito</h3></div>
              <span className="data-note">Variación positiva = remanente · negativa = sobregiro</span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table work-flow-scope-table">
                <div className="financial-detail-row head"><span>Ámbito</span><span>Presupuestado</span><span>Real</span><span>Variación</span><span>Variación %</span><span>Real acumulado</span><span>Por ejecutar</span></div>
                {reprogrammedFlowScopes.map((item) => (
                  <div className={`financial-detail-row ${item.id === "total" ? "total-row" : ""}`} key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{rd(item.budgetPeriodDop)}</span>
                    <span>{rd(item.actualPeriodDop)}</span>
                    <span className={item.varianceDop < 0 ? "danger-text" : "good-text"}>{rd(item.varianceDop)}</span>
                    <b className={item.varianceDop < 0 ? "danger-text" : "good-text"}>{number.format(item.varianceRatio * 100)}%</b>
                    <span>{rd(item.actualToCutoffDop)}</span>
                    <span>{rd(item.remainingForecastDop)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="quality-note">El real de junio de este flujo es {rd(reprogrammedFlowAudit.juneScopedActualDop)}. Finanzas registra {rd(reprogrammedFlowAudit.juneFullFinanceActualDop)} para el proyecto completo; la diferencia de {rd(reprogrammedFlowAudit.juneScopeDifferenceDop)} responde al alcance excluido y no se presenta como error contable.</p>
          </article>

          <article className="panel physical-progress-lock">
            <div>
              <span className="section-kicker">GOBIERNO DEL DATO FÍSICO</span>
              <h3>El avance físico no cambia con este archivo</h3>
              <p>El libro solo contiene importes presupuestados, reales y reprogramados. No aporta mediciones físicas, unidades ejecutadas ni porcentajes de producción.</p>
            </div>
            <strong>{number.format(projectSnapshot.overallProgress)}%</strong>
            <small>Último avance físico validado · corte {projectSnapshot.declaredCutoff}</small>
          </article>

          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">CALIDAD DE LA FUENTE</span><h3>Incidencias y reglas de lectura</h3></div><span className="count-badge">{reprogrammedFlowQualityIssues.length}</span></div>
            <div className="quality-grid">
              {reprogrammedFlowQualityIssues.map((issue) => <article key={issue.title}><strong>{issue.title}</strong><p>{issue.detail}</p></article>)}
            </div>
          </article>
        </section>
      )}

      {section === "presupuesto" && (
        <section className="financial-detail-stack budget-audit-stack">
          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">EDIFICIO TIPO A · {typeABudgetSummary.workbookSheetCount} HOJAS VERIFICADAS</span><h3>Presupuesto original frente a actualización</h3></div>
              <a className="button secondary" href="/data-center/julio-2026/comparativo-presupuesto-edificio-tipo-a.xls">Abrir presupuesto</a>
            </div>
            <div className="budget-summary-grid">
              <span><small>Original por edificio</small><strong>{rd(typeABudgetSummary.originalPerBuildingDop)}</strong></span>
              <span><small>Actualizado por edificio</small><strong>{rd(typeABudgetSummary.updatedPerBuildingDop)}</strong></span>
              <span><small>Diferencia por edificio</small><strong className="danger-text">+{rd(typeABudgetSummary.differencePerBuildingDop)}</strong></span>
              <span><small>Desviación</small><strong className="danger-text">+{number.format(typeABudgetSummary.deviationPerBuilding * 100)}%</strong></span>
              <span><small>Actualizado · 77 edificios</small><strong>{rd(typeABudgetSummary.updated77BuildingsDop)}</strong></span>
              <span><small>Variación · 77 edificios</small><strong className="danger-text">+{rd(typeABudgetSummary.difference77BuildingsDop)}</strong></span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table budget-chapter-table">
                <div className="financial-detail-row head"><span>Capítulo</span><span>Original</span><span>Actualizado</span><span>Diferencia</span><span>Variación</span></div>
                {typeABudgetChapters.map((item) => (
                  <div className="financial-detail-row" key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{rd(item.originalDop)}</span>
                    <span>{rd(item.updatedDop)}</span>
                    <span className={item.differenceDop > 0 ? "danger-text" : item.differenceDop < 0 ? "good-text" : ""}>{rd(item.differenceDop)}</span>
                    <b className={item.deviation > 0 ? "danger-text" : item.deviation < 0 ? "good-text" : ""}>{number.format(item.deviation * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
            <p className="quality-note">Las {typeABudgetSummary.lineItemCount} partidas y sus análisis de precio unitario permanecen en el archivo original. Las fichas con sufijos (2) y (3) no se descartan: algunas son revisiones históricas con valores diferentes.</p>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">DESVIACIÓN MENSUAL · JUNIO 2026</span><h3>Impacto por partida y alcance real</h3></div>
              <a className="button secondary" href="/data-center/julio-2026/desviacion-mensual-junio-2026.xlsx">Abrir desviaciones</a>
            </div>
            <div className="budget-summary-grid compact">
              <span><small>Actualizado por edificio</small><strong>{rd(juneDeviationSummary.updatedPerBuildingDop)}</strong></span>
              <span><small>Variación por edificio</small><strong className="danger-text">+{rd(juneDeviationSummary.differencePerBuildingDop)}</strong></span>
              <span><small>Variación porcentual</small><strong className="danger-text">+{number.format(juneDeviationSummary.deviationPerBuilding * 100)}%</strong></span>
              <span><small>Impacto ponderado proyecto</small><strong className="good-text">{rd(juneDeviationSummary.weightedProjectImpactDop)}</strong></span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table deviation-detail-table">
                <div className="financial-detail-row head"><span>Partida</span><span>Actualizado</span><span>Variación</span><span>Aplicación</span><span>Impacto proyecto</span><span>Lectura</span></div>
                {monthlyDeviationLines.map((item) => (
                  <div className="financial-detail-row" key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{rd(item.updatedDop)}</span>
                    <b className={item.deviation > 0 ? "danger-text" : item.deviation < 0 ? "good-text" : ""}>{number.format(item.deviation * 100)}%</b>
                    <span>{item.buildingCount ? `${item.buildingCount} edificios` : "Sin aplicación indicada"}</span>
                    <span className={item.projectImpactDop > 0 ? "danger-text" : item.projectImpactDop < 0 ? "good-text" : ""}>{rd(item.projectImpactDop)}</span>
                    <small>{item.observation}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="callout warn"><strong>Notas finales desactualizadas en origen</strong><p>El comentario final del Excel no coincide con sus fórmulas vigentes. El dashboard usa el valor calculado de {rd(juneDeviationSummary.differencePerBuildingDop)} y conserva el documento sin cambios.</p></div>
          </article>

          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">CONTROL DE CALIDAD</span><h3>Incidencias detectadas en las nuevas fuentes</h3></div><span className="count-badge">{procurementQualityIssues.length}</span></div>
            <div className="quality-grid">
              {procurementQualityIssues.map((issue) => <article key={issue.title}><strong>{issue.title}</strong><p>{issue.detail}</p></article>)}
            </div>
          </article>
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
            <p className="quality-note">La clasificación por categorías corresponde al archivo de Antonely, que es la fuente vigente del total consolidado de cuentas por pagar.</p>
          </article>
          <article className="panel reconciliation-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">CONCILIACIÓN DE FUENTES</span><h3>Tres totales de cuentas por pagar</h3></div>
              <span className="data-note">Consolidado y Antonely en vivo · balance contable pendiente de conciliar</span>
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
            <p className="quality-note">El KPI principal ya sigue en vivo el archivo de Antonely. El balance contable está {rd(Math.abs(cxpVsBalanceContableDop))} {cxpVsBalanceContableDop >= 0 ? "por debajo" : "por encima"} del consolidado y sigue pendiente de conciliación contable.</p>
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
            <strong>{rdMillions(antonelyDetailTotals.advanceGrantedDop)}</strong>
            <p>Total concedido. El saldo pendiente de amortización es {rdMillions(juneReport.finance.advancesPendingDop)}.</p>
            <div className="callout"><strong>Lectura correcta</strong><p>Los importes “concedido” y “pendiente” no son equivalentes; el dashboard muestra ambos por separado.</p></div>
          </article>
        </section>
      )}

      {section === "fideicomiso" && (
        <section className="financial-detail-stack fiduciary-stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">FIDUCIARIA UNIVERSAL · CORTE 30/06/2026</span>
                <h3>Estados financieros oficiales del fideicomiso</h3>
              </div>
              <span className="source-status validada">OFICIAL</span>
            </div>
            <p className="section-copy">Esta pestaña conserva la contabilidad emitida por la Fiduciaria separada del control interno de presupuesto, costes, caja y obligaciones operativas.</p>
            <div className="source-actions fiduciary-doc-actions">
              <a className="button secondary" href="/data-center/junio-2026/fideicomiso/balance-comprobacion-junio-2026.pdf">Balance de comprobación</a>
              <a className="button secondary" href="/data-center/junio-2026/fideicomiso/balance-general-junio-2026.pdf">Balance general</a>
              <a className="button secondary" href="/data-center/junio-2026/fideicomiso/estado-resultados-acumulado-junio-2026.pdf">Resultados acumulados</a>
              <a className="button secondary" href="/data-center/junio-2026/fideicomiso/estado-resultados-junio-2026.pdf">Resultados de junio</a>
            </div>
            <div className="balance-equation fiduciary-equation">
              <span>Activos<strong>{rd(fiduciaryStatementSummary.balance.assetsDop)}</strong></span>
              <i>=</i>
              <span>Pasivos<strong>{rd(fiduciaryStatementSummary.balance.liabilitiesDop)}</strong></span>
              <i>+</i>
              <span>Patrimonio neto<strong>{rd(fiduciaryStatementSummary.balance.netEquityDop)}</strong></span>
            </div>
            <p className="quality-note">Estado emitido el {fiduciaryStatementSummary.issuedAt}. El balance cuadra exactamente y el resultado del periodo se incorpora al patrimonio neto.</p>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">RESULTADOS</span><h3>Junio frente al acumulado enero-junio</h3></div>
              <span className="data-note">Moneda fuente DOP · vista {currency}</span>
            </div>
            <div className="budget-summary-grid fiduciary-results-grid">
              <span><small>Ingresos · junio</small><strong>{rd(fiduciaryStatementSummary.monthlyResult.incomeDop)}</strong></span>
              <span><small>Gastos · junio</small><strong>{rd(fiduciaryStatementSummary.monthlyResult.expensesDop)}</strong></span>
              <span><small>Resultado · junio</small><strong className="danger-text">{rd(fiduciaryStatementSummary.monthlyResult.netResultDop)}</strong></span>
              <span><small>Ingresos · acumulado</small><strong>{rd(fiduciaryStatementSummary.accumulatedResult.incomeDop)}</strong></span>
              <span><small>Gastos · acumulado</small><strong>{rd(fiduciaryStatementSummary.accumulatedResult.expensesDop)}</strong></span>
              <span><small>Resultado · acumulado</small><strong className="danger-text">{rd(fiduciaryStatementSummary.accumulatedResult.netResultDop)}</strong></span>
            </div>
            <div className="callout">
              <strong>Comprobación cruzada superada</strong>
              <p>El resultado acumulado de {rd(fiduciaryStatementSummary.accumulatedResult.netResultDop)} coincide con el beneficio del periodo mostrado en el estado de situación.</p>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">COMPOSICIÓN DEL BALANCE</span><h3>Activos, pasivos y patrimonio neto</h3></div>
              <span className="data-note">Fuente oficial</span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table fiduciary-balance-table">
                <div className="financial-detail-row head"><span>Bloque</span><span>Cuenta</span><span>Importe</span></div>
                {fiduciaryBalanceSections.flatMap((sectionItem) => [
                  ...sectionItem.lines.map((line) => (
                    <div className="financial-detail-row" key={`${sectionItem.id}-${line.name}`}>
                      <b>{sectionItem.label}</b><strong>{line.name}</strong><span>{rd(line.amountDop)}</span>
                    </div>
                  )),
                  <div className="financial-detail-row total-row" key={`${sectionItem.id}-total`}>
                    <b>Total</b><strong>{sectionItem.label}</strong><span>{rd(sectionItem.totalDop)}</span>
                  </div>,
                ])}
              </div>
            </div>
            <div className="callout">
              <strong>Balance de comprobación cuadrado</strong>
              <p>Debe {rd(fiduciaryStatementSummary.trialBalance.debitDop)} y Haber {rd(fiduciaryStatementSummary.trialBalance.creditDop)}. Diferencia: {rd(fiduciaryStatementSummary.trialBalance.differenceDop)}.</p>
            </div>
          </article>

          <article className="panel reconciliation-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">CONCILIACIÓN DE CAPAS</span><h3>Fiduciaria oficial frente a control interno</h3></div>
              <span className="data-note">No se suman ni se sobrescriben</span>
            </div>
            <div className="financial-detail-scroll">
              <div className="financial-detail-table fiduciary-reconciliation-table">
                <div className="financial-detail-row head"><span>Indicador</span><span>Fiduciaria</span><span>Gestión</span><span>Diferencia gestión - oficial</span><span>Decisión</span></div>
                {fiduciaryManagementReconciliation.map((item) => (
                  <div className="financial-detail-row" key={item.metric}>
                    <strong>{item.metric}</strong>
                    <span>{rd(item.officialDop)}</span>
                    <span>{rd(item.managementDop)}</span>
                    <b className="danger-text">{rd(item.differenceDop)}</b>
                    <small>{item.decision}</small>
                  </div>
                ))}
              </div>
            </div>
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
            <p className="quality-note">Antonely registra {rd(antonelyCostAccounts.reduce((total, item) => total + item.june, 0))} en junio y {rd(antonelyCostAccounts.reduce((total, item) => total + item.cumulative, 0))} acumulados. Frente al consolidado, las diferencias son {rd(juneReport.finance.juneExecutedDop - antonelyCostAccounts.reduce((total, item) => total + item.june, 0))} y {rd(juneReport.finance.executedDop - antonelyCostAccounts.reduce((total, item) => total + item.cumulative, 0))} respectivamente.</p>
          </article>
          <article className="panel">
            <div className="panel-heading"><div><span className="section-kicker">CONTROL INTERNO</span><h3>Posición financiera de gestión</h3></div></div>
            <div className="balance-grid">
              <div><span>Activos</span><strong>{rdMillions(juneReport.finance.assetsDop)}</strong></div>
              <div><span>Pasivos</span><strong>{rdMillions(juneReport.finance.liabilitiesDop)}</strong></div>
              <div><span>Patrimonio</span><strong>{rdMillions(juneReport.finance.equityDop)}</strong></div>
              <div><span>Disponibilidad</span><strong>{rdMillions(juneReport.finance.liquidityDop)}</strong></div>
              <div><span>Depósitos clientes</span><strong>{rdMillions(juneReport.finance.clientDepositsDop)}</strong></div>
              <div><span>Por ejecutar</span><strong>{rdMillions(juneReport.finance.remainingDop)}</strong></div>
            </div>
            <p className="quality-note">Esta vista procede del Excel de gestión. El estado contable oficial emitido por Fiduciaria Universal se consulta en la pestaña Fideicomiso.</p>
          </article>
        </section>
      )}

      {section === "detalle" && (
        <section className="financial-detail-stack">
          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">{antonelyDetailTotals.costAccountCount} CUENTAS DE COSTE</span><h3>Detalle acumulado por cuenta</h3></div>
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
              <div><span className="section-kicker">{antonelyDetailTotals.payableCategoryCount} CATEGORÍAS · {antonelyDetailTotals.payableInvoiceCount} FACTURAS</span><h3>Cuentas por pagar por antigüedad</h3></div>
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
              <div><span className="section-kicker">{antonelyDetailTotals.advanceCount} ANTICIPOS</span><h3>Concedido y pendiente por documento</h3></div>
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
                <div className="financial-detail-row total-row"><strong>Total</strong><span>{antonelyDetailTotals.advanceCount} documentos</span><span>30/06/2026</span><span>Fuente Antonely</span><span>{rd(antonelyDetailTotals.advanceGrantedDop)}</span><span>{rd(antonelyDetailTotals.advancePendingDop)}</span></div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="section-kicker">{antonelyDetailTotals.balanceLineCount} LÍNEAS DE BALANCE</span><h3>Balance de comprobación completo</h3></div>
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
            {metrics.map((metric) => {
              // metric-cubicacion ya se mostraba en vivo (referencia). Se
              // extiende el mismo mecanismo a metric-physical y
              // metric-schedule para que, igual que el resto del tablero,
              // dejen de quedarse congeladas en su valor semilla mientras el
              // resto de la app sigue el avance real.
              const displayValue = metric.id === "metric-cubicacion"
                ? rd(projectSnapshot.cubicacionesMeasured)
                : metric.id === "metric-physical"
                  ? `${number.format(projectSnapshot.overallProgress)} ${metric.unit}`
                  : metric.id === "metric-schedule"
                    ? `${number.format(projectSnapshot.scheduleProgress)} ${metric.unit}`
                    : `${metric.value} ${metric.unit}`;
              const displayTarget = metric.id === "metric-cubicacion"
                ? rd(projectSnapshot.cubicacionesAccounting)
                : metric.id === "metric-physical"
                  ? `${number.format(projectSnapshot.plannedProgress)} ${metric.unit}`
                  : `${metric.target} ${metric.unit}`;
              const displayTrend = metric.id === "metric-physical"
                ? (projectSnapshot.overallProgress >= projectSnapshot.plannedProgress ? "up" : "down")
                : metric.trend;
              return (
                <article className="metric-card" key={metric.id}>
                  <div className="metric-card-head"><span>{metric.owner}</span><i className={`trend ${displayTrend}`}>{displayTrend === "up" ? "↗" : displayTrend === "down" ? "↘" : "→"}</i></div>
                  <h4>{metric.name}</h4><strong>{displayValue}</strong>
                  <div className="metric-target"><span>Referencia {displayTarget}</span></div>
                </article>
              );
            })}
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
      <h2>Finanzas y Ventas y cobranza requieren autorización individual.</h2>
      <p>
        Tu usuario puede trabajar con obra, apartamentos, edificios, urbanismo y documentación,
        pero no tiene permiso para consultar cifras financieras ni información comercial. El administrador puede
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

function UserEditorModal({
  user,
  currentUser,
  saving,
  error,
  onClose,
  onSave,
}: {
  user: ManagedUser;
  currentUser: DashboardUser;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: ManagedUser & { pin?: string }) => Promise<boolean>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const isSelf = user.id === currentUser.id;
  const [form, setForm] = useState(user);
  const [resetPin, setResetPin] = useState("");

  useEffect(() => {
    nameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(resetPin ? { ...form, pin: resetPin } : form);
    if (saved) setResetPin("");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
      <form
        className="modal user-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-editor-title"
        aria-describedby="user-editor-description"
        aria-busy={saving}
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <span className="section-kicker">USUARIOS Y ACCESOS</span>
            <h3 id="user-editor-title">Editar usuario</h3>
          </div>
          <button className="close-button" type="button" onClick={onClose} disabled={saving} aria-label="Cerrar">×</button>
        </div>
        <p className="upload-intro" id="user-editor-description">
          Actualiza la identidad, el área y los permisos. Los cambios quedan registrados en la auditoría del Centro de Control.
        </p>
        <div className="form-grid">
          <label>
            Nombre y apellidos
            <input ref={nameRef} required value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label>
            Correo de acceso
            <input type="email" required value={form.email} disabled={isSelf} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            {isSelf && <small>Tu correo no puede cambiarse desde tu propia sesión.</small>}
          </label>
          <label>
            Perfil
            <select
              value={form.role}
              disabled={isSelf}
              onChange={(event) => setForm((current) => ({
                ...current,
                role: event.target.value as "admin" | "member",
                financeAccess: event.target.value === "admin" ? true : current.financeAccess,
              }))}
            >
              <option value="member">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label>
            Área principal
            <select value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value as UserArea }))}>
              {userAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
            </select>
          </label>
          <label>
            Restablecer PIN
            <input
              type="text"
              inputMode="numeric"
              minLength={4}
              maxLength={10}
              pattern="\d{0,10}"
              value={resetPin}
              onChange={(event) => setResetPin(event.target.value.replace(/\D/g, ""))}
              placeholder="Dejar vacío para no cambiarlo"
            />
          </label>
        </div>
        <label className="permission-check">
          <input
            type="checkbox"
            checked={form.financeAccess}
            disabled={form.role === "admin"}
            onChange={(event) => setForm((current) => ({ ...current, financeAccess: event.target.checked }))}
          />
          <span><strong>Finanzas y Ventas</strong><small>Los administradores siempre conservan este permiso combinado.</small></span>
        </label>
        <label className="permission-check">
          <input
            type="checkbox"
            checked={form.active}
            disabled={isSelf}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
          />
          <span><strong>Acceso general activo</strong><small>Al desactivarlo no podrá volver a entrar hasta que un administrador lo reactive.</small></span>
        </label>
        {error && <div className="access-message error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="button primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </div>
  );
}

function DeleteUserModal({
  user,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  user: ManagedUser;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!deleting) onClose(); }}>
      <section
        className="modal delete-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        aria-describedby="delete-user-description"
        aria-busy={deleting}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div><span className="section-kicker">CONFIRMACIÓN NECESARIA</span><h3 id="delete-user-title">Eliminar acceso</h3></div>
          <button className="close-button" type="button" onClick={onClose} disabled={deleting} aria-label="Cerrar">×</button>
        </div>
        <div className="delete-user-summary" id="delete-user-description">
          <strong>{user.displayName}</strong>
          <span>{user.email}</span>
          <p>Perderá el acceso inmediatamente. Su actividad y la auditoría se conservarán, y un administrador podrá restaurarlo más adelante.</p>
        </div>
        {error && <div className="access-message error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button ref={cancelRef} className="button secondary" type="button" onClick={onClose} disabled={deleting}>Cancelar</button>
          <button className="button danger" type="button" onClick={() => void onConfirm()} disabled={deleting}>{deleting ? "Eliminando…" : "Eliminar acceso"}</button>
        </div>
      </section>
    </div>
  );
}

function UsersAdminView({
  currentUser,
  onCurrentAvatarUpdated,
  onOpenGuide,
}: {
  currentUser: DashboardUser;
  onCurrentAvatarUpdated: (avatarUrl: string) => void;
  onOpenGuide: () => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    role: "member" as "admin" | "member",
    area: "direccion" as UserArea,
    financeAccess: false,
    pin: "",
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
    id?: number;
    email: string;
    displayName: string;
    role: "admin" | "member";
    area: UserArea;
    financeAccess: boolean;
    active: boolean;
    updatedAt?: string;
    pin?: string;
  }) {
    const operationKey = input.id ? String(input.id) : "create";
    setSaving(operationKey);
    setMessage("");
    setDialogError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.id ? { ...input, expectedUpdatedAt: input.updatedAt } : input),
      });
      const payload = await response.json() as { user?: ManagedUser; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el acceso.");
      setMessage(payload.message ?? "Acceso actualizado.");
      await refreshUsers();
      setEditingUser(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el acceso.";
      if (input.id && editingUser?.id === input.id) setDialogError(errorMessage);
      else setMessage(errorMessage);
      return false;
    } finally {
      setSaving("");
    }
  }

  async function submitNewUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await saveUser({ ...form, active: true });
    if (saved) {
      setForm({ email: "", displayName: "", role: "member", area: "direccion", financeAccess: false, pin: "" });
    }
  }

  async function deleteUser(user: ManagedUser) {
    setSaving(String(user.id));
    setMessage("");
    setDialogError("");
    try {
      const query = new URLSearchParams({ id: String(user.id), expectedUpdatedAt: user.updatedAt });
      const response = await fetch(`/api/admin/users?${query}`, { method: "DELETE" });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar el acceso.");
      setMessage(payload.message ?? "Acceso eliminado.");
      setDeletingUser(null);
      await refreshUsers();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "No se pudo eliminar el acceso.");
    } finally {
      setSaving("");
    }
  }

  async function restoreUser(user: ManagedUser) {
    setSaving(String(user.id));
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, restore: true, expectedUpdatedAt: user.updatedAt }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo restaurar el acceso.");
      setMessage(payload.message ?? "Acceso restaurado.");
      await refreshUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo restaurar el acceso.");
    } finally {
      setSaving("");
    }
  }

  const configuredUsers = users.filter((user) => !user.deletedAt);
  const archivedUsers = users.filter((user) => Boolean(user.deletedAt));

  return (
    <div className="view-stack">
      <section className="data-view-intro admin-intro">
        <div>
          <span className="section-kicker">ADMINISTRACIÓN DE ACCESO</span>
          <h2>Usuarios y permisos</h2>
        </div>
        <p>
          Cada persona inicia sesión con su correo y un PIN propio. Aquí se autoriza
          el correo, se asigna su PIN inicial, se personaliza su fotografía y se
          decide si puede abrir Finanzas.
        </p>
      </section>

      <section className="admin-access-grid">
        <form className="panel access-create-card" onSubmit={submitNewUser}>
          <div className="panel-heading">
            <div><span className="section-kicker">NUEVO ACCESO</span><h3>Autorizar una persona</h3></div>
          </div>
          <label>Nombre<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nombre y apellidos" /></label>
          <label>Correo de acceso<input type="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="persona@empresa.com" /></label>
          <label>PIN inicial<input type="text" inputMode="numeric" required minLength={4} maxLength={10} pattern="\d{4,10}" value={form.pin} onChange={(event) => setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, "") }))} placeholder="4 a 10 dígitos" /></label>
          <label>Perfil
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as "admin" | "member", financeAccess: event.target.value === "admin" ? true : current.financeAccess }))}>
              <option value="member">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label>Área principal
            <select value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value as UserArea }))}>
              {userAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
            </select>
          </label>
          <label className="permission-check">
            <input type="checkbox" checked={form.financeAccess} disabled={form.role === "admin"} onChange={(event) => setForm((current) => ({ ...current, financeAccess: event.target.checked }))} />
            <span><strong>Finanzas y Ventas</strong><small>Permite consultar cifras, documentos e informes financieros, comerciales y de cobranza.</small></span>
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

      <section className="panel access-guide-card">
        <div className="panel-heading">
          <div><span className="section-kicker">ONBOARDING</span><h3>Guía de uso para el personal</h3></div>
          <button className="button" type="button" onClick={onOpenGuide}>Abrir guía</button>
        </div>
        <p>
          Manual breve de 7 páginas: navegación, permisos, carga documental,
          instalación en móvil, tablet y ordenador, cámara, avisos y
          seguridad. Compártela con cada persona al darla de alta — el
          enlace y el código QR de dentro llevan directo a esta misma
          aplicación.
        </p>
      </section>

      <section className="panel access-directory">
        <div className="panel-heading">
          <div><span className="section-kicker">DIRECTORIO AUTORIZADO</span><h3>{configuredUsers.length} usuarios configurados</h3></div>
          <span className="data-note">{currentUser.email}</span>
        </div>
        {message && <div className="access-message" role="status">{message}</div>}
        {loading ? (
          <div className="empty-state compact"><strong>Cargando usuarios…</strong></div>
        ) : (
          <div className="access-user-list">
            {configuredUsers.map((user) => {
              const isSelf = user.email === currentUser.email;
              return (
                <article key={user.email} className={!user.active ? "disabled" : ""}>
                  <div className="user-identity">
                    <UserAvatar
                      user={user}
                      editable
                      onStatus={setMessage}
                      onUploaded={(avatarUrl) => {
                        setUsers((current) => current.map((item) =>
                          item.id === user.id ? { ...item, avatarUrl } : item
                        ));
                        if (isSelf) onCurrentAvatarUpdated(avatarUrl);
                      }}
                    />
                    <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
                  </div>
                  <label>Perfil
                    <select
                      value={user.role}
                      disabled={isSelf || saving === String(user.id)}
                      onChange={(event) => void saveUser({ ...user, role: event.target.value as "admin" | "member", financeAccess: event.target.value === "admin" ? true : user.financeAccess })}
                    >
                      <option value="member">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                  <label>Área
                    <select
                      value={user.area}
                      disabled={saving === String(user.id)}
                      onChange={(event) => void saveUser({ ...user, area: event.target.value as UserArea })}
                    >
                      {userAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
                    </select>
                  </label>
                  <button
                    className={`permission-toggle ${user.financeAccess ? "granted" : ""}`}
                    disabled={user.role === "admin" || saving === String(user.id)}
                    onClick={() => void saveUser({ ...user, financeAccess: !user.financeAccess })}
                  >
                    <span>Finanzas y Ventas</span><strong>{user.financeAccess ? "Permitido" : "Bloqueado"}</strong>
                  </button>
                  <button
                    className={`permission-toggle ${user.active ? "granted" : "revoked"}`}
                    disabled={isSelf || saving === String(user.id)}
                    onClick={() => void saveUser({ ...user, active: !user.active })}
                  >
                    <span>Acceso general</span><strong>{user.active ? "Activo" : "Desactivado"}</strong>
                  </button>
                  <div className="user-record-meta">
                    <small className="last-access">{user.lastLoginAt ? `Último acceso ${new Date(user.lastLoginAt).toLocaleString("es-DO")}` : "Aún no ha iniciado sesión"}</small>
                    <div className="user-record-actions">
                      <button className="button secondary" type="button" onClick={() => { setDialogError(""); setEditingUser(user); }}>Editar</button>
                      <button
                        className="button danger"
                        type="button"
                        disabled={isSelf || saving === String(user.id)}
                        title={isSelf ? "No puedes eliminar tu propia cuenta" : undefined}
                        onClick={() => { setDialogError(""); setDeletingUser(user); }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!loading && archivedUsers.length > 0 && (
          <details className="archived-user-directory">
            <summary>{archivedUsers.length} {archivedUsers.length === 1 ? "usuario eliminado" : "usuarios eliminados"}</summary>
            <div>
              {archivedUsers.map((user) => (
                <article key={user.id}>
                  <div className="user-identity">
                    <UserAvatar user={user} />
                    <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
                  </div>
                  <small>Eliminado {new Date(user.deletedAt).toLocaleString("es-DO")}</small>
                  <button className="button secondary" type="button" disabled={saving === String(user.id)} onClick={() => void restoreUser(user)}>
                    {saving === String(user.id) ? "Restaurando…" : "Restaurar acceso"}
                  </button>
                </article>
              ))}
            </div>
          </details>
        )}
      </section>
      {editingUser && (
        <UserEditorModal
          user={editingUser}
          currentUser={currentUser}
          saving={saving === String(editingUser.id)}
          error={dialogError}
          onClose={() => { if (!saving) setEditingUser(null); }}
          onSave={saveUser}
        />
      )}
      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          deleting={saving === String(deletingUser.id)}
          error={dialogError}
          onClose={() => { if (!saving) setDeletingUser(null); }}
          onConfirm={() => deleteUser(deletingUser)}
        />
      )}
    </div>
  );
}

function proposalPreview(value: unknown) {
  if (value === null) return "Sin valor";
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized.length > 160 ? `${serialized.slice(0, 157)}…` : serialized;
}

function parseProposalValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(",", "."));
    if (/^(si|sí|true)$/i.test(trimmed)) return true;
    if (/^(no|false)$/i.test(trimmed)) return false;
    return trimmed;
  }
}

function FileReviewPanel({
  file,
  currentUser,
  onClose,
  onUpdated,
}: {
  file: UploadedFileRecord;
  currentUser: DashboardUser;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<FileReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [note, setNote] = useState("");
  const [area, setArea] = useState(file.area);
  const [cutoff, setCutoff] = useState(file.detectedPeriod || file.declaredCutoff);
  const [documentType, setDocumentType] = useState(file.documentType);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftUpdates, setDraftUpdates] = useState<Array<{ key: string; value: unknown }>>([]);
  const onCloseRef = useRef(onClose);
  const reviewRequestKeys = useRef<Partial<Record<"prepare" | "approve" | "observe" | "reject" | "reopen", string>>>({});

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/files/review?file=${encodeURIComponent(file.id)}`, { cache: "no-store" });
      const payload = await response.json() as FileReviewDetail & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir la revisión.");
      setDetail(payload);
      setArea(payload.file.area);
      setCutoff(payload.file.detectedPeriod || payload.file.declaredCutoff);
      setDocumentType(payload.file.documentType);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "No se pudo abrir la revisión.");
    } finally {
      setLoading(false);
    }
  }, [file.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [refresh]);

  async function review(action: "prepare" | "approve" | "observe" | "reject" | "reopen") {
    if (working) return;
    setWorking(action);
    setError("");
    const requestKey = reviewRequestKeys.current[action] ?? crypto.randomUUID();
    reviewRequestKeys.current[action] = requestKey;
    try {
      const response = await fetch("/api/files/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          fileId: file.id,
          requestKey,
          note,
          area,
          cutoff,
          documentType,
          extractionSummary: note || undefined,
          updates: action === "prepare"
            ? draftUpdates.map((update) => ({
                ...update,
                area,
                cutoff,
                sourceCurrency: file.sourceCurrency,
                sourceFileId: file.id,
                sourceName: file.originalName,
              }))
            : undefined,
        }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo registrar la decisión.");
      delete reviewRequestKeys.current[action];
      setNote("");
      setDraftUpdates([]);
      setDraftKey("");
      setDraftValue("");
      await refresh();
      onUpdated();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "No se pudo registrar la decisión.");
    } finally {
      setWorking("");
    }
  }

  function addDraftUpdate() {
    const key = draftKey.trim();
    if (!key || !draftValue.trim()) {
      setError("Indica la clave viva y el valor que debe contrastarse.");
      return;
    }
    setDraftUpdates((current) => [
      ...current.filter((update) => update.key !== key),
      { key, value: parseProposalValue(draftValue) },
    ]);
    setDraftKey("");
    setDraftValue("");
    setError("");
  }

  const readyForDecision = detail?.file.reviewStatus === "listo_revision" || detail?.file.reviewStatus === "cambios_solicitados";
  const closedReview = detail?.file.reviewStatus === "aprobado" || detail?.file.reviewStatus === "rechazado";

  return (
    <div className="file-review-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="file-review-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Revisión de ${file.originalName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="file-review-header">
          <div>
            <span className="section-kicker">BANDEJA DE VALIDACIÓN · PROYECTO ARAYA</span>
            <h3>{file.originalName}</h3>
            <p>{file.areaLabel} · {documentTypeLabels[file.documentType] ?? file.documentType}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Cerrar revisión">×</button>
        </div>
        {loading ? (
          <div className="empty-state"><strong>Abriendo expediente…</strong></div>
        ) : error && !detail ? (
          <div className="callout warn"><strong>No se pudo abrir</strong><p>{error}</p></div>
        ) : detail && (
          <div className="file-review-scroll">
            <div className={`review-status-banner ${detail.file.reviewStatus}`}>
              <span>{reviewStatusLabels[detail.file.reviewStatus] ?? detail.file.reviewStatus}</span>
              <strong>{detail.file.publicationRevision ? `Revisión viva ${detail.file.publicationRevision}` : "Sin publicación"}</strong>
            </div>
            <div className="review-facts">
              <span><small>Tipo detectado</small><strong>{documentTypeLabels[detail.file.documentType] ?? detail.file.documentType}</strong></span>
              <span><small>Periodo</small><strong>{detail.file.detectedPeriod || detail.file.declaredCutoff || "Pendiente"}</strong></span>
              <span><small>Moneda origen</small><strong>{detail.file.sourceCurrency}</strong></span>
              <span><small>Confianza</small><strong>{number.format(detail.file.extractionConfidence * 100)}%</strong></span>
              <span><small>Cambios propuestos</small><strong>{detail.proposals.length}</strong></span>
              <span><small>Discrepancias</small><strong>{detail.file.discrepancyCount}</strong></span>
            </div>
            <div className="review-extraction-summary">
              <strong>Resultado de extracción</strong>
              <p>{detail.file.extractionSummary || detail.file.processingSummary}</p>
              <small>{detail.file.classificationReason}</small>
            </div>
            <div className="review-source-actions">
              <a className="button secondary" href={detail.file.downloadUrl} data-file-title={detail.file.originalName}>Abrir original</a>
              <span>El original es inmutable. Aprobar sólo publica los cambios visibles en esta ficha.</span>
            </div>

            <section className="review-proposals">
              <div className="unit-section-heading">
                <span>CAMBIOS CONTRASTADOS</span>
                <small>{detail.proposals.length} propuestas</small>
              </div>
              {detail.proposals.length ? detail.proposals.map((proposal) => (
                <article key={proposal.id} className={proposal.discrepancy ? "discrepancy" : ""}>
                  <div>
                    <strong>{proposal.label || proposal.key}</strong>
                    <small>{proposal.key} · corte {proposal.cutoff || "pendiente"} · {proposal.sourceCurrency}</small>
                  </div>
                  <span><small>Valor vigente</small><b>{proposal.previousValue === null ? "Sin publicación previa" : proposalPreview(proposal.previousValue)}</b></span>
                  <i aria-hidden="true">→</i>
                  <span><small>Valor propuesto</small><b>{proposalPreview(proposal.value)}</b></span>
                  {proposal.discrepancy && <em>Requiere decisión: cambia un dato vivo</em>}
                </article>
              )) : (
                <div className="empty-state compact">
                  <strong>Este expediente todavía no contiene cambios de datos.</strong>
                  <p>Puede validarse como documento de consulta o prepararse con claves del modelo vivo.</p>
                </div>
              )}
            </section>

            {detail.unmappedCandidates.length > 0 && (
              <section className="review-unmapped-candidates">
                <div className="unit-section-heading">
                  <span>PROPUESTAS DE SECCIÓN NUEVA</span>
                  <small>{detail.unmappedCandidates.length} sin campo todavía</small>
                </div>
                <p className="section-intro">
                  Datos relevantes que este documento trae pero que no encajan en ningún campo existente del Centro de Control. No se publican solos; hace falta construir su sección correspondiente.
                </p>
                {detail.unmappedCandidates.map((candidate) => (
                  <article key={candidate.id} className="unmapped-candidate">
                    <div>
                      <strong>{candidate.label}</strong>
                      <small>Área sugerida: {candidate.suggestedAreaLabel} · confianza {number.format(candidate.confidence * 100)}%</small>
                    </div>
                    <p>{candidate.description}</p>
                    <span><small>Valor observado</small><b>{proposalPreview(candidate.value)}</b></span>
                    <small className="unmapped-candidate-evidence">{candidate.evidence}</small>
                  </article>
                ))}
              </section>
            )}

            {detail.permissions.canReview && !closedReview && (
              <section className="review-preparation">
                <div className="unit-section-heading">
                  <span>PREPARAR VALIDACIÓN</span>
                  <small>Administrador</small>
                </div>
                <div className="form-grid">
                  <label>
                    Área confirmada
                    <select value={area} onChange={(event) => setArea(event.target.value)}>
                      {uploadAreas
                        .filter((option) => option.id !== "auto" && option.id !== "sin_clasificar")
                        .filter((option) => detail.permissions.canAccessFinance || !requiresFinanceAccessForArea(option.id))
                        .map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Corte o periodo
                    <input value={cutoff} onChange={(event) => setCutoff(event.target.value)} placeholder="Ej. 2026-07-30" />
                  </label>
                  <label className="wide-field">
                    Tipo documental
                    <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                      {Object.entries(documentTypeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="proposal-builder">
                  <label>
                    Clave del dato vivo
                    <input value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="Ej. projectSnapshot.overallProgress" />
                  </label>
                  <label>
                    Valor propuesto
                    <input value={draftValue} onChange={(event) => setDraftValue(event.target.value)} placeholder='Ej. 18.9 o {"status":"..."}' />
                  </label>
                  <button type="button" className="button secondary" onClick={addDraftUpdate}>Añadir cambio</button>
                </div>
                {draftUpdates.length > 0 && (
                  <div className="draft-update-list">
                    {draftUpdates.map((update) => (
                      <span key={update.key}>
                        <strong>{update.key}</strong>
                        <small>{proposalPreview(update.value)}</small>
                        <button type="button" onClick={() => setDraftUpdates((current) => current.filter((item) => item.key !== update.key))}>Quitar</button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="review-note-field">
                  Nota de revisión
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Criterio aplicado, discrepancia encontrada o instrucciones de corrección…" />
                </label>
                <button type="button" className="button secondary" disabled={Boolean(working)} onClick={() => void review("prepare")}>
                  {working === "prepare" ? "Preparando…" : draftUpdates.length ? `Preparar ${draftUpdates.length} cambios` : "Preparar validación documental"}
                </button>
              </section>
            )}

            {detail.permissions.canReview && readyForDecision && (
              <div className="review-decision-bar">
                <button type="button" className="button primary" disabled={Boolean(working)} onClick={() => void review("approve")}>
                  {working === "approve" ? "Publicando…" : detail.proposals.length ? "Aprobar y publicar" : "Aprobar documento"}
                </button>
                <button type="button" className="button secondary" disabled={Boolean(working) || !note.trim()} onClick={() => void review("observe")}>Solicitar cambios</button>
                <button type="button" className="button danger" disabled={Boolean(working) || !note.trim()} onClick={() => void review("reject")}>Rechazar</button>
              </div>
            )}
            {detail.permissions.canReview && closedReview && (
              <button type="button" className="button secondary" disabled={Boolean(working)} onClick={() => void review("reopen")}>Reabrir expediente</button>
            )}
            {error && <div className="callout warn"><strong>La acción no se completó</strong><p>{error}</p></div>}

            <section className="review-audit">
              <div className="unit-section-heading"><span>HISTORIAL DE DECISIONES</span><small>{detail.reviews.length} registros</small></div>
              {detail.reviews.length ? detail.reviews.map((reviewItem) => (
                <article key={reviewItem.id}>
                  <span>{reviewItem.action}</span>
                  <div><strong>{reviewItem.actorName}</strong><small>{reviewItem.note || "Sin nota"} · {new Date(reviewItem.createdAt).toLocaleString("es-DO")}</small></div>
                  <b>{reviewItem.publicationRevision ? `v${reviewItem.publicationRevision}` : `${reviewItem.proposalCount} cambios`}</b>
                </article>
              )) : <p>La primera decisión quedará registrada aquí.</p>}
            </section>
            {currentUser.role !== "admin" && (
              <p className="quality-note">Puedes consultar el expediente y el original. La aprobación corresponde al administrador autorizado.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

const uploadArchiveMonthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function uploadArchivePeriod(createdAt: string) {
  const match = createdAt.match(/^(\d{4})-(\d{2})/);
  const monthNumber = match ? Number(match[2]) : 0;
  if (!match || monthNumber < 1 || monthNumber > 12) {
    return {
      yearKey: "sin-fecha",
      yearLabel: "Sin fecha",
      monthKey: "sin-fecha",
      monthLabel: "Fecha pendiente",
      sortValue: 0,
    };
  }
  return {
    yearKey: match[1],
    yearLabel: match[1],
    monthKey: `${match[1]}-${match[2]}`,
    monthLabel: uploadArchiveMonthNames[monthNumber - 1],
    sortValue: Number(`${match[1]}${match[2]}`),
  };
}

function ArchiveDisclosure({
  children,
  className,
  initialOpen,
}: {
  children: ReactNode;
  className: string;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details className={className} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      {children}
    </details>
  );
}

function CollaborativeFileRegistry({ currentUser }: { currentUser: DashboardUser }) {
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [summary, setSummary] = useState<FileRegistrySummary>({
    total: 0,
    active: 0,
    deleted: 0,
    pendingReview: 0,
    synchronized: 0,
    observed: 0,
    averageProgress: 0,
    discrepancies: 0,
    lastUploadAt: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"pending" | "all" | "integrated" | "observed" | "deleted">("all");
  const [selectedFile, setSelectedFile] = useState<UploadedFileRecord | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const changeCursorRef = useRef("");
  const pollingRef = useRef(false);
  const filesRef = useRef<UploadedFileRecord[]>([]);
  const reconciliationOffsetRef = useRef(0);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch("/api/files?includeDeleted=1&limit=75", { cache: "no-store" });
        const payload = (await response.json()) as FileRegistryPayload;
        if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el registro.");
        if (active) {
          setFiles(payload.files ?? []);
          if (payload.summary) setSummary(payload.summary);
          setHasMore(Boolean(payload.hasMore));
          setNextCursor(payload.nextCursor ?? null);
          changeCursorRef.current = payload.changeCursor ?? "";
          setError("");
        }
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "No se pudo actualizar el registro.");
      } finally {
        if (active) setLoading(false);
      }
    }

    async function refreshChanges() {
      if (!changeCursorRef.current || pollingRef.current) return;
      pollingRef.current = true;
      try {
        let cursor = changeCursorRef.current;
        const knownFiles = filesRef.current;
        const knownStart = knownFiles.length
          ? reconciliationOffsetRef.current % knownFiles.length
          : 0;
        const knownIds = knownFiles
          .slice(knownStart, knownStart + 75)
          .map((file) => file.id);
        reconciliationOffsetRef.current = knownFiles.length && knownStart + knownIds.length < knownFiles.length
          ? knownStart + knownIds.length
          : 0;
        for (let page = 0; page < 10 && active; page += 1) {
          const knownQuery = page === 0 && knownIds.length
            ? `&known=${encodeURIComponent(knownIds.join(","))}`
            : "";
          const response = await fetch(
            `/api/files?includeDeleted=1&mode=changes&limit=100&after=${encodeURIComponent(cursor)}${knownQuery}`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as FileRegistryPayload;
          if (!response.ok) throw new Error(payload.error ?? "No se pudieron sincronizar los cambios documentales.");
          if (!active) return;
          setFiles((current) => mergeFileRegistryRecords(
            current,
            payload.files ?? [],
            payload.removedIds ?? [],
          ));
          if (payload.summary) setSummary(payload.summary);
          cursor = payload.nextChangeCursor ?? cursor;
          changeCursorRef.current = cursor;
          setError("");
          if (!payload.hasMore) break;
        }
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "No se pudieron sincronizar los cambios documentales.");
      } finally {
        pollingRef.current = false;
      }
    }

    const onFilesUpdated = () => {
      if (changeCursorRef.current) void refreshChanges();
      else void initialize();
    };
    void initialize();
    const interval = window.setInterval(() => void refreshChanges(), 5_000);
    window.addEventListener("araya-files-updated", onFilesUpdated);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("araya-files-updated", onFilesUpdated);
    };
  }, [currentUser.email, currentUser.financeAccess, currentUser.role]);

  async function loadOlderFiles() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        `/api/files?includeDeleted=1&limit=75&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as FileRegistryPayload;
      if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir el archivo documental anterior.");
      setFiles((current) => mergeFileRegistryRecords(current, payload.files ?? []));
      if (payload.summary) setSummary(payload.summary);
      setHasMore(Boolean(payload.hasMore));
      setNextCursor(payload.nextCursor ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo abrir el archivo documental anterior.");
    } finally {
      setLoadingMore(false);
    }
  }

  const pendingReview = summary.pendingReview;
  const synchronized = summary.synchronized;
  const observed = summary.observed;
  const averageProgress = summary.averageProgress;
  const visibleFiles = useMemo(() => files.filter((file) => {
    if (filter === "deleted") return Boolean(file.deletedAt);
    if (file.deletedAt) return false;
    if (filter === "pending") return file.requiresReview;
    if (filter === "integrated") return file.status === "integrado";
    if (filter === "observed") return file.status === "observado" || file.status === "rechazado";
    return true;
  }), [files, filter]);
  const archivedFiles = useMemo(() => {
    const years = new Map<string, {
      key: string;
      label: string;
      sortValue: number;
      months: Map<string, { key: string; label: string; sortValue: number; files: UploadedFileRecord[] }>;
    }>();
    for (const file of visibleFiles) {
      const period = uploadArchivePeriod(file.createdAt);
      let year = years.get(period.yearKey);
      if (!year) {
        year = {
          key: period.yearKey,
          label: period.yearLabel,
          sortValue: period.sortValue,
          months: new Map(),
        };
        years.set(period.yearKey, year);
      }
      let month = year.months.get(period.monthKey);
      if (!month) {
        month = {
          key: period.monthKey,
          label: period.monthLabel,
          sortValue: period.sortValue,
          files: [],
        };
        year.months.set(period.monthKey, month);
      }
      month.files.push(file);
    }
    return [...years.values()]
      .sort((left, right) => right.sortValue - left.sortValue)
      .map((year) => ({
        ...year,
        months: [...year.months.values()].sort((left, right) => right.sortValue - left.sortValue),
      }));
  }, [visibleFiles]);

  async function manageLifecycle(file: UploadedFileRecord, action: "delete" | "restore") {
    if (
      action === "delete" &&
      !window.confirm(`¿Eliminar ${file.originalName}? El tablero se recalculará sin sus datos y podrás restaurarlo después.`)
    ) return;
    setLifecycleBusy(file.id);
    setError("");
    try {
      const response = await fetch("/api/files/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el archivo.");
      setSelectedFile(null);
      window.dispatchEvent(new CustomEvent("araya-files-updated"));
      window.dispatchEvent(new CustomEvent("araya-live-refresh"));
    } catch (lifecycleError) {
      setError(lifecycleError instanceof Error ? lifecycleError.message : "No se pudo actualizar el archivo.");
    } finally {
      setLifecycleBusy("");
    }
  }

  return (
    <>
    <section className="panel live-file-registry" aria-live="polite">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">BANDEJA DOCUMENTAL · ACTUALIZACIÓN CADA 5 S</span>
          <h3>Clasificación, contraste y publicación</h3>
        </div>
        <span className="live-state"><span className="live-dot" /> {currentUser.role === "admin" ? "Validación habilitada" : "Consulta autorizada"}</span>
      </div>
      {summary.total > 0 && (
        <div className="processing-overview">
          <span><strong>{pendingReview}</strong>Pendientes de revisión</span>
          <span><strong>{synchronized}</strong>Sincronizados</span>
          <span><strong>{observed}</strong>Observados / rechazados</span>
          <span><strong>{averageProgress}%</strong>Progreso medio</span>
        </div>
      )}
      <div className="review-filter-tabs" role="tablist" aria-label="Filtrar expedientes">
        <button type="button" className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Por validar · {pendingReview}</button>
        <button type="button" className={filter === "integrated" ? "active" : ""} onClick={() => setFilter("integrated")}>Integrados · {synchronized}</button>
        <button type="button" className={filter === "observed" ? "active" : ""} onClick={() => setFilter("observed")}>Observados · {observed}</button>
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos · {summary.active}</button>
        {summary.deleted > 0 && (
          <button type="button" className={filter === "deleted" ? "active" : ""} onClick={() => setFilter("deleted")}>Eliminados · {summary.deleted}</button>
        )}
      </div>
      {error && (
        <div className="callout warn"><strong>Sincronización documental pendiente</strong><p>{error}</p></div>
      )}
      {loading ? (
        <div className="empty-state compact"><strong>Actualizando registro…</strong></div>
      ) : summary.total === 0 ? (
        <div className="empty-state compact">
          <strong>Aún no hay cargas colaborativas.</strong>
          <p>Los archivos integrados históricamente aparecen debajo. Las nuevas cargas quedarán aquí con usuario, área, versión y estado.</p>
        </div>
      ) : visibleFiles.length === 0 ? (
        <div className="empty-state compact">
          <strong>No hay expedientes cargados en este estado.</strong>
          <p>{hasMore ? "Carga meses anteriores o cambia el filtro para consultar el resto del registro." : "Cambia el filtro para consultar el resto del registro."}</p>
        </div>
      ) : (
        <div className="document-archive">
          {archivedFiles.map((year, yearIndex) => {
            const yearCount = year.months.reduce((total, month) => total + month.files.length, 0);
            return (
              <ArchiveDisclosure className="archive-year" key={year.key} initialOpen={yearIndex === 0}>
                <summary>
                  <span><strong>{year.label}</strong><small>Archivos subidos</small></span>
                  <em>{yearCount}</em>
                </summary>
                <div className="archive-months">
                  {year.months.map((month, monthIndex) => (
                    <ArchiveDisclosure className="archive-month" key={month.key} initialOpen={yearIndex === 0 && monthIndex === 0}>
                      <summary>
                        <span><strong>{month.label}</strong><small>{month.files.length === 1 ? "1 archivo" : `${month.files.length} archivos`}</small></span>
                        <em>{month.files.length}</em>
                      </summary>
                      <div className="uploaded-file-list">
                        {month.files.map((file) => (
                          <article key={file.id}>
                            <div className="uploaded-file-icon">{file.extension.toUpperCase()}</div>
                            <div className="uploaded-file-main">
                              <strong>{file.originalName}</strong>
                              <span>{file.areaLabel} · {fileSize(file.sizeBytes)} · v{file.version}</span>
                              <small>{documentTypeLabels[file.documentType] ?? file.documentType} · periodo {file.detectedPeriod || file.declaredCutoff || "pendiente"} · moneda {file.sourceCurrency}</small>
                              <small>{file.classificationReason}</small>
                              <div className="file-processing-track">
                                <span>
                                  {processingStageLabels[file.processingStage] ?? file.processingStage}
                                  <strong>{file.processingProgress}%</strong>
                                </span>
                                <i><b style={{ width: `${file.processingProgress}%` }} /></i>
                                <small>{file.processingSummary}</small>
                              </div>
                            </div>
                            <div className="uploaded-file-owner">
                              <strong>{file.uploaderName}</strong>
                              <span>{new Date(file.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</span>
                            </div>
                            <div className="uploaded-file-state">
                              {file.deletedAt && <span className="upload-status rechazado">Eliminado</span>}
                              <span className={`upload-status ${file.status}`}>{uploadStatusLabels[file.status] ?? file.status}</span>
                              <small>{reviewStatusLabels[file.reviewStatus] ?? file.reviewStatus}</small>
                              {file.discrepancyCount > 0 && <em>{file.discrepancyCount} discrepancias</em>}
                            </div>
                            <div className="uploaded-file-actions">
                              {!file.deletedAt && <button type="button" className="button primary" onClick={() => setSelectedFile(file)}>
                                {currentUser.role === "admin" && file.requiresReview ? "Revisar" : "Abrir expediente"}
                              </button>}
                              {!file.deletedAt && <a className="button secondary" href={file.downloadUrl} data-file-title={file.originalName}>Abrir original</a>}
                              {file.canManage && (
                                <button
                                  type="button"
                                  className={`button ${file.deletedAt ? "secondary" : "danger"}`}
                                  disabled={lifecycleBusy === file.id}
                                  onClick={() => void manageLifecycle(file, file.deletedAt ? "restore" : "delete")}
                                >
                                  {lifecycleBusy === file.id ? "Actualizando…" : file.deletedAt ? "Restaurar" : "Eliminar"}
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </ArchiveDisclosure>
                  ))}
                </div>
              </ArchiveDisclosure>
            );
          })}
        </div>
      )}
      {!loading && hasMore && (
        <div className="archive-pagination">
          <button
            type="button"
            className="button secondary"
            disabled={loadingMore}
            onClick={() => void loadOlderFiles()}
          >
            {loadingMore ? "Cargando…" : "Cargar archivos anteriores"}
          </button>
          <small>{files.length} cargados de {summary.total} expedientes visibles</small>
        </div>
      )}
    </section>
    {selectedFile && (
      <FileReviewPanel
        file={selectedFile}
        currentUser={currentUser}
        onClose={() => setSelectedFile(null)}
        onUpdated={() => window.dispatchEvent(new CustomEvent("araya-files-updated"))}
      />
    )}
    </>
  );
}

async function fetchDataHistory() {
  const response = await fetch("/api/history", { cache: "no-store" });
  const payload = await response.json() as {
    changes?: HistoryChange[];
    activity?: HistoryActivity[];
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "No se pudo consultar el historial.");
  return {
    changes: payload.changes ?? [],
    activity: payload.activity ?? [],
  };
}

function DataHistoryPanel() {
  const [tab, setTab] = useState<"changes" | "activity">("changes");
  const [changes, setChanges] = useState<HistoryChange[]>([]);
  const [activity, setActivity] = useState<HistoryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void fetchDataHistory()
        .then((payload) => {
          if (!active) return;
          setChanges(payload.changes);
          setActivity(payload.activity);
          setError("");
        })
        .catch((refreshError: unknown) => {
          if (active) setError(refreshError instanceof Error ? refreshError.message : "No se pudo consultar el historial.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    const interval = window.setInterval(refresh, 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const rows = tab === "changes" ? changes : activity;
  return (
    <section className="panel data-history-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">TRAZABILIDAD PERSISTENTE</span>
          <h3>Historial de cambios y documentos</h3>
        </div>
        <span className="live-state"><span className="live-dot" /> Auditoría viva</span>
      </div>
      <div className="history-tabs" role="tablist" aria-label="Tipo de historial">
        <button className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>Datos actualizados · {changes.length}</button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Actividad documental · {activity.length}</button>
      </div>
      {loading ? (
        <div className="empty-state compact"><strong>Cargando historial…</strong></div>
      ) : error ? (
        <div className="callout warn"><strong>Historial no disponible</strong><p>{error}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state compact">
          <strong>Aún no hay revisiones vivas registradas.</strong>
          <p>Las próximas normalizaciones conservarán valor, fuente, responsable, fecha y revisión.</p>
        </div>
      ) : tab === "changes" ? (
        <div className="history-list">
          {changes.slice(0, 12).map((change) => (
            <article key={change.id}>
              <span className="history-revision">v{change.revision}</span>
              <div>
                <strong>{change.key}</strong>
                <span>{change.sourceName || "Actualización manual"} · {change.valuePreview}</span>
              </div>
              <small>{change.actorName}<br />{new Date(change.createdAt).toLocaleString("es-DO")}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="history-list">
          {activity.slice(0, 12).map((event) => (
            <article key={event.id}>
              <span className="history-revision file">DOC</span>
              <div>
                <strong>{event.fileName}</strong>
                <span>{event.message}</span>
              </div>
              <small>{event.actorName}<br />{new Date(event.createdAt).toLocaleString("es-DO")}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SourcesView({
  onUpload,
  canAccessFinance,
  currency,
  currentUser,
}: {
  onUpload: () => void;
  canAccessFinance: boolean;
  currency: CurrencyCode;
  currentUser: DashboardUser;
}) {
  const workspace = useContext(WorkspaceDetailContext);
  const visibleSources = canAccessFinance
    ? dataSources
    : dataSources.filter((source) => !sourceRequiresFinance(source));
  const visibleIssues = canAccessFinance
    ? [...juneDataQualityIssues, ...procurementQualityIssues, ...reprogrammedFlowQualityIssues, ...fiduciaryStatementQualityIssues]
    : juneDataQualityIssues.filter((issue) => !/presupuesto|pagar|coste|anticipo|inter[eé]s/i.test(issue.title));
  // dataAuthorityMatrix ya llega con el texto de decisión/status en vivo:
  // synchronizeSpatialSummary() lo sincroniza centralmente para que
  // cualquier otra pantalla que lo lea también lo vea al día, no solo esta.
  const visibleAuthorityMatrix = dataAuthorityMatrix.filter((item) => {
    const source = dataSources.find((candidate) => candidate.id === item.primarySourceId);
    return canAccessFinance || !source || !sourceRequiresFinance(source);
  });
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
      <section className="panel staff-guide-card">
        <div className="staff-guide-mark" aria-hidden="true">PDF</div>
        <div>
          <span className="section-kicker">GUÍA CORPORATIVA · PERSONAL DE OBRA</span>
          <h3>Funciones, uso diario e instalación de Bricket Control</h3>
          <p>Manual breve de 7 páginas para móvil, tablet y ordenador, con acceso, navegación, permisos, carga documental y seguridad.</p>
        </div>
        <div className="staff-guide-actions">
          <a
            className="button primary"
            href="/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf"
            data-file-title="Guía corporativa Bricket Control · personal de obra.pdf"
          >
            Abrir guía
          </a>
          <a
            className="button secondary"
            href="/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf"
            download="guia-corporativa-bricket-control-personal-obra.pdf"
            data-file-viewer-bypass="true"
          >
            Descargar PDF
          </a>
        </div>
      </section>
      <section className="stat-grid wide">
        <StatCard eyebrow="Fuentes visibles" value={`${visibleSources.length}`} detail={canAccessFinance ? "Repositorio completo autorizado" : "Documentación operativa autorizada"} />
        <StatCard eyebrow="Datos gobernados" value={`${visibleAuthorityMatrix.length}`} detail="Indicadores con fuente principal y regla de prevalencia" />
        <StatCard eyebrow="Alertas de calidad" value={`${visibleIssues.length}`} detail="Visibles según permisos y sin corrección silenciosa" tone="warn" />
        <StatCard eyebrow="Corte declarado" value="30/06/2026" detail="Fecha tomada de los archivos" />
      </section>
      <section className="panel ingestion-workflow">
        <div className="panel-heading">
          <div><span className="section-kicker">CARGA COLABORATIVA</span><h3>Cómo entra un archivo al Centro de Control</h3></div>
          <span className="live-state"><span className="live-dot" /> Actualización cada 5 s</span>
        </div>
        <div className="ingestion-steps definitive">
          <div><b>01</b><strong>Subida</strong><span>Un archivo y un botón; el original se conserva.</span></div>
          <div><b>02</b><strong>Detección</strong><span>Área, tipo, periodo y moneda se identifican automáticamente.</span></div>
          <div><b>03</b><strong>Lectura</strong><span>Los formatos estructurados compatibles generan cambios fiables.</span></div>
          <div><b>04</b><strong>Actualización</strong><span>Los datos válidos se publican; lo ambiguo queda pendiente de revisión.</span></div>
          <div><b>05</b><strong>Sincronización</strong><span>Cifras, barras y gráficas reciben la revisión en menos de 5 s.</span></div>
        </div>
        <p className="governance-note">La carga, clasificación y sincronización son procesos del Centro de Control y no consumen tokens. Cualquier persona registrada puede lograr publicación automática: las plantillas CSV y JSON coherentes se validan por una vía directa, y Excel, PDF y otros formatos pasan por lectura asistida con IA. Si el resultado tiene alta confianza y encaja en un campo conocido de tu área, se publica solo; si no, queda guardado y catalogado de inmediato como propuesta pendiente de revisión, para no inventar cifras.</p>
      </section>
      <section className="panel data-authority-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">MATRIZ MAESTRA DEL DATO</span>
            <h3>Qué fuente manda en cada indicador</h3>
          </div>
          <span className="data-note">{dataGovernanceSummary.reconciledMetrics} conciliados · {dataGovernanceSummary.separatedMetrics} separados · {dataGovernanceSummary.observedMetrics} observados</span>
        </div>
        <p className="section-copy">Una fuente especializada prevalece únicamente dentro de su alcance. Los datos oficiales, de control, de soporte, históricos y duplicados permanecen identificados para evitar dobles conteos.</p>
        <div className="financial-detail-scroll">
          <div className="financial-detail-table data-authority-table">
            <div className="financial-detail-row head"><span>Indicador</span><span>Fuente principal</span><span>Clase</span><span>Estado</span><span>Regla aplicada</span></div>
            {visibleAuthorityMatrix.map((item) => {
              const source = dataSources.find((candidate) => candidate.id === item.primarySourceId);
              const governance = sourceGovernance[item.primarySourceId];
              return (
                <button
                  type="button"
                  className="financial-detail-row workspace-data-row"
                  key={item.id}
                  onClick={() => source && workspace.openDetail(sourceWorkspaceDetail(source))}
                >
                  <strong>{item.metric}</strong>
                  <span>{source?.file ?? item.primarySourceId}</span>
                  <span className={`authority-badge ${governance?.authority ?? "soporte"}`}>{governance?.authority ?? "soporte"}</span>
                  <span className={`governance-status ${item.status}`}>{item.status}</span>
                  <small>{item.decision}</small>
                </button>
              );
            })}
          </div>
        </div>
        {canAccessFinance && <p className="quality-note">Las cifras monetarias se conservan en su moneda fuente y se presentan en {currency}. Los estados del fideicomiso no sustituyen el presupuesto ni el flujo de gestión.</p>}
      </section>
      <CollaborativeFileRegistry currentUser={currentUser} />
      <DataHistoryPanel />
      <details className="panel integrated-source-archive">
        <summary>
          <span><strong>Archivo histórico integrado</strong><small>Fuentes anteriores conservadas con su ficha y conexiones</small></span>
          <em>{visibleSources.length}</em>
        </summary>
        <section className="source-grid">
        {visibleSources.map((source) => {
          const governance = sourceGovernance[source.id];
          return (
            <article className="panel source-card" key={source.id}>
              <div className="panel-heading">
                <div><span className="section-kicker">{source.kind}</span><h3>{source.file}</h3></div>
                <div className="source-badge-stack">
                  {governance && <span className={`authority-badge ${governance.authority}`}>{governance.authority}</span>}
                  <span className={`source-status ${source.status}`}>{source.status}</span>
                </div>
              </div>
              <div className="source-meta">
                <span>Corte declarado<strong>{source.declaredCutoff}</strong></span>
                <span>Guardado<strong>{source.savedAt}</strong></span>
                <span>Contenido<strong>{source.records}</strong></span>
                {governance && <span>Alcance<strong>{governance.scope}</strong></span>}
              </div>
              {governance && <p className="source-feeds"><strong>Alimenta:</strong> {governance.feeds}</p>}
              <ul className="quality-list">
                {source.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
              <div className="source-actions">
                <button className="button primary" type="button" onClick={() => workspace.openDetail(sourceWorkspaceDetail(source))}>
                  Abrir ficha y conexiones
                </button>
                {source.downloadUrl && (
                  <>
                    <a className="button secondary" href={source.downloadUrl} data-file-title={source.file}>
                      Abrir documento
                    </a>
                    <a className="button secondary compact-download" href={source.downloadUrl} download={source.file} data-file-viewer-bypass="true">
                      Descargar
                    </a>
                  </>
                )}
              </div>
            </article>
          );
        })}
        </section>
      </details>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">CRITERIOS DE GOBIERNO DEL DATO</span><h3>Cómo se interpreta este corte</h3></div>
        </div>
        <div className="governance-grid">
          <div><strong>Avance físico</strong><p>El informe y los Excel son la fuente del {number.format(projectSnapshot.overallProgress)}% ejecutado y del KPI planificado de {number.format(projectSnapshot.plannedProgress)}%.</p></div>
          <div><strong>Avance de cronograma</strong><p>MPP es la fuente del {number.format(projectSnapshot.scheduleProgress)}%, fechas, actividades y camino crítico.</p></div>
          {canAccessFinance && <div><strong>Control de gestión</strong><p>El Excel de junio prevalece para presupuesto, costes, CxP operativa, anticipos y caja.</p></div>}
          {canAccessFinance && <div><strong>Fideicomiso</strong><p>Los PDF emitidos por Fiduciaria Universal prevalecen para balance contable y resultados oficiales.</p></div>}
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
      text: "Buenos días. Puedo consultar la versión viva y recibir archivos. Sólo tienes que adjuntar uno: el sistema identifica área, tipo, periodo y moneda. Si los datos extraídos tienen alta confianza y encajan en un campo conocido de tu área, actualizan el dashboard solos; el resto queda guardado para interpretación segura. Los importes se responden en USD por defecto y, si la fuente no indica moneda, se registra DOP.",
      mode: "source-data-engine",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
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
        area: "auto",
        description: "Archivo cargado mediante ARAYA Asistente.",
        section: "Agente IA",
        source: "agent",
        sourceCurrency: "auto",
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
        <div><strong>ARAYA Asistente</strong><span><i /> Consulta y carga documental</span></div>
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
        <div className="agent-attachment-options">
          <label>
            <span>Adjuntar archivo</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json,.pptx,.ppt,.pdf,.docx,.doc,.mpp,.dwg,.png,.jpg,.jpeg,.zip"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            <span>Tomar foto</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {attachment && (
          <div className="agent-attachment-ready">
            <strong>{attachment.name}</strong>
            <small>{fileSize(attachment.size)}</small>
            <span>Área, periodo y moneda se detectan automáticamente.</span>
            <button type="button" onClick={() => void sendAttachment()} disabled={uploading}>{uploading ? "Procesando…" : "Subir y procesar"}</button>
          </div>
        )}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregunta por cualquier dato del corte…" rows={2} />
        <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar pregunta">↑</button>
      </form>
      <div className="agent-foot">Cada respuesta consulta la versión viva. Los datos estructurados fiables se sincronizan; cualquier lectura ambigua queda visible para revisión.</div>
    </aside>
  );
}

function ReportBuilder({
  canAccessFinance,
  onClose,
  onGenerate,
}: {
  canAccessFinance: boolean;
  onClose: () => void;
  onGenerate: (period: DirectionReportPeriod) => Promise<void>;
}) {
  const [reportType, setReportType] = useState<ReportType>(canAccessFinance ? "global" : "obra_seguridad");
  const [frequency, setFrequency] = useState<ReportFrequency>("monthly");
  const [month, setMonth] = useState("2026-06");
  const [startDate, setStartDate] = useState("2026-06-24");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedType = reportTypeOptions.find((option) => option.id === reportType) ?? reportTypeOptions[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (frequency === "monthly") {
      if (!month) {
        setError("Selecciona el mes que debe figurar en el informe.");
        return;
      }
      setSaving(true);
      try {
        await onGenerate(monthReportPeriod(month, reportType));
      } catch (reportError) {
        setError(reportError instanceof Error ? reportError.message : "No se pudo archivar el informe.");
      } finally {
        setSaving(false);
      }
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
    setSaving(true);
    try {
      await onGenerate(weeklyReportPeriod(startDate, endDate, reportType));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "No se pudo archivar el informe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal report-builder-modal" role="dialog" aria-modal="true" aria-labelledby="report-builder-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DIRECCIÓN · {selectedType.label.toUpperCase()}</span>
            <h3 id="report-builder-title">Crear informe semanal o mensual</h3>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="report-type-select" role="group" aria-label="Tipo de informe">
          {reportTypeOptions.map((option) => {
            const locked = option.requiresFinance && !canAccessFinance;
            return (
              <button
                key={option.id}
                type="button"
                className={reportType === option.id ? "active" : ""}
                aria-pressed={reportType === option.id}
                disabled={locked}
                title={locked ? "Requiere acceso financiero" : undefined}
                onClick={() => setReportType(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{locked ? "Requiere acceso financiero" : option.detail}</span>
              </button>
            );
          })}
        </div>
        <p className="upload-intro">{selectedType.detail} Los datos proceden del último cierre documental validado.</p>
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
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "Archivando…" : "Generar vista previa"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ReportFinanceExtras = {
  cxpAging?: typeof cxpAging;
  payablesReconciliation?: typeof payablesReconciliation;
  fiduciaryBalance?: { assetsDop: number; liabilitiesDop: number; netEquityDop: number };
  advancesGrantedDop?: number;
  advancesCount?: number;
};

function DirectionReport({
  period,
  currency,
  onClose,
}: {
  period: DirectionReportPeriod;
  currency: CurrencyCode;
  onClose: () => void;
}) {
  const reportType = period.reportType ?? "global";
  const showObra = reportType === "global" || reportType === "obra_seguridad";
  const showFinance = reportType === "global" || reportType === "finanzas";
  const showVentas = reportType === "global" || reportType === "ventas";
  const archived = period.archivedSnapshot;
  const archivedProduction = archived?.production as {
    constructionDisciplines?: typeof constructionDisciplines;
    structuralDelay?: typeof structuralDelay;
    urbanismReportAreas?: typeof urbanismReportAreas;
    delayedUrbanismStarts?: typeof delayedUrbanismStarts;
    workPackages?: typeof workPackages;
  } | undefined;
  const archivedCommercial = archived?.commercial as {
    sales?: typeof juneReport.sales;
    collections?: typeof juneReport.collections;
    salesModels?: typeof salesModels;
    salesLocations?: typeof salesLocations;
  } | undefined;
  const archivedSafety = archived?.safety as {
    metrics?: typeof safetyMetrics;
    permits?: typeof permits;
  } | undefined;
  const reportExecutive = archived?.executive;
  const reportPlan = Array.isArray(archived?.monthlyPlan) ? archived.monthlyPlan : monthlyPlan;
  const reportDisciplines = Array.isArray(archivedProduction?.constructionDisciplines)
    ? archivedProduction.constructionDisciplines
    : constructionDisciplines;
  const reportStructuralDelay = Array.isArray(archivedProduction?.structuralDelay)
    ? archivedProduction.structuralDelay
    : structuralDelay;
  const reportUrbanismAreas = Array.isArray(archivedProduction?.urbanismReportAreas)
    ? archivedProduction.urbanismReportAreas
    : urbanismReportAreas;
  const reportDelayedUrbanism = Array.isArray(archivedProduction?.delayedUrbanismStarts)
    ? archivedProduction.delayedUrbanismStarts
    : delayedUrbanismStarts;
  const reportWorkPackages = Array.isArray(archivedProduction?.workPackages)
    ? archivedProduction.workPackages
    : workPackages;
  const reportSales = archivedCommercial?.sales && typeof archivedCommercial.sales === "object"
    ? { ...juneReport.sales, ...archivedCommercial.sales }
    : juneReport.sales;
  const reportCollections = archivedCommercial?.collections && typeof archivedCommercial.collections === "object"
    ? { ...juneReport.collections, ...archivedCommercial.collections }
    : juneReport.collections;
  const reportSalesModels = Array.isArray(archivedCommercial?.salesModels) ? archivedCommercial.salesModels : salesModels;
  const reportSalesLocations = Array.isArray(archivedCommercial?.salesLocations) ? archivedCommercial.salesLocations : salesLocations;
  const reportFinance = archived
    ? (archived.finance as (typeof juneReport.finance & ReportFinanceExtras) | null)
    : {
      ...juneReport.finance,
      cxpAging,
      payablesReconciliation,
      fiduciaryBalance: fiduciaryStatementSummary.balance,
      advancesGrantedDop: antonelyDetailTotals.advanceGrantedDop,
      advancesCount: antonelyDetailTotals.advanceCount,
    };
  const reportCxpAging = Array.isArray(reportFinance?.cxpAging) ? reportFinance.cxpAging : cxpAging;
  const reportPayablesReconciliation = Array.isArray(reportFinance?.payablesReconciliation)
    ? reportFinance.payablesReconciliation
    : payablesReconciliation;
  const reportFiduciaryBalance = reportFinance?.fiduciaryBalance ?? fiduciaryStatementSummary.balance;
  const reportSafetyMetrics = Array.isArray(archivedSafety?.metrics) ? archivedSafety.metrics : safetyMetrics;
  const reportPermits = Array.isArray(archivedSafety?.permits) ? archivedSafety.permits : permits;
  const reportManagementActions = Array.isArray(archived?.managementActions)
    ? archived.managementActions
    : managementActions;
  const reportSourceCutoff = period.sourceCutoff || archived?.cutoff || juneReport.cutoff;
  const includesSourceCutoff =
    period.startDate <= REPORT_SOURCE_CUTOFF && period.endDate >= REPORT_SOURCE_CUTOFF;
  const approvedPermits = reportPermits.filter((permit) => permit.status === "Aprobado").length;
  const criticalPackages = reportWorkPackages.filter((item) => item.critical);
  const generatedDate = new Date(period.generatedAt);
  const generatedAt = Number.isNaN(generatedDate.getTime())
    ? "Fecha de generación no disponible"
    : new Intl.DateTimeFormat("es-ES", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(generatedDate);
  const reportKind = period.frequency === "weekly" ? "Informe semanal" : "Informe mensual";
  const reportTypeLabel = reportTypeOptions.find((option) => option.id === reportType)?.label ?? "Informe general";
  const reportTitle = showObra ? `${reportKind} de obra` : `${reportKind} · ${reportTypeLabel}`;
  const dop = (value: number) => formatMoneyMillions(value, "DOP", currency);
  const overdue = formatMoney(reportCollections.overdueUsd, "USD", currency);
  let sectionCounter = 0;
  const nextSection = () => String(++sectionCounter).padStart(2, "0");

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
            <span>DIRECCIÓN DE PROYECTO · {reportTypeLabel.toUpperCase()}</span>
            <h1 id="direction-report-title">{reportTitle}</h1>
            <p>{period.label}</p>
          </div>
          <div className="report-meta">
            <span><b>Corte documental</b>{reportSourceCutoff}</span>
            <span><b>Generado</b>{generatedAt}</span>
            <span><b>Moneda visual</b>{currency}</span>
            {period.liveRevision !== undefined && <span><b>Revisión viva</b>{period.liveRevision || "base"}</span>}
          </div>
        </header>

        <section className={`report-coverage ${includesSourceCutoff ? "verified" : "limited"}`}>
          <strong>{includesSourceCutoff ? "Periodo cubierto por el cierre validado" : "Periodo sin cierre documental exacto"}</strong>
          <p>
            {includesSourceCutoff
              ? `Las cifras corresponden al cierre documental de ${reportSourceCutoff}; las cobranzas tienen corte específico al ${reportCollections.cutoff}.`
              : `El periodo seleccionado es ${period.label}, pero el último cierre validado disponible es ${reportSourceCutoff}. Se muestran esos datos como última evidencia disponible, sin interpolaciones.`}
          </p>
        </section>

        {showObra && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · RESUMEN EJECUTIVO</span><h2>Situación general del proyecto</h2></div>
              <small>Fuente: consolidado de junio 2026</small>
            </div>
            <div className="report-kpi-grid">
              <article><span>Avance real</span><strong>{number.format(reportExecutive?.physicalActual ?? juneReport.physical.actual)}%</strong><small>Ejecución física</small></article>
              <article><span>Plan KPI</span><strong>{number.format(reportExecutive?.kpiPlan ?? juneReport.physical.planned)}%</strong><small>Objetivo documentado</small></article>
              <article className="danger"><span>Desviación</span><strong>{number.format(reportExecutive?.deviationPoints ?? juneReport.physical.gap)} pp</strong><small>Brecha documentada al corte</small></article>
              <article className="warn"><span>Previsión de plazo</span><strong>+{reportExecutive?.forecastDeviationDays ?? juneReport.physical.mppDelayDays} días</strong><small>Fin previsto {reportExecutive?.forecastFinish ?? projectSnapshot.forecastFinish}</small></article>
              <article><span>Alcance integrado</span><strong>{reportExecutive?.integratedBuildings ?? projectSnapshot.buildingCount} / {projectSnapshot.masterPlanBuildingCount}</strong><small>Edificios en datos / plano</small></article>
              <article><span>Apartamentos</span><strong>{reportExecutive?.apartments ?? projectSnapshot.unitCount}</strong><small>Vinculados a edificios integrados</small></article>
            </div>
          </section>
        )}

        {showObra && (
          <section className="report-section report-chart-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · PLANIFICACIÓN</span><h2>Curva S · plan operativo y ejecución</h2></div>
              <small>Proyección verde · ejecución real roja</small>
            </div>
            <ProgressChart data={reportPlan} />
            <p className="report-footnote">El KPI principal de plan declara 21,24%; la serie mensual de junio marca 23,29%. Ambas referencias se conservan pendientes de conciliación.</p>
          </section>
        )}

        {showObra && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · PRODUCCIÓN</span><h2>Avance por disciplina y alertas de estructura</h2></div>
              <small>Informe de obra · {juneReport.cutoff}</small>
            </div>
            <div className="report-two-columns">
              <div>
                <h3>Disciplinas</h3>
                <div className="report-progress-list">
                  {reportDisciplines.map((item) => (
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
                  {reportStructuralDelay.slice(0, 8).map((item) => (
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
        )}

        {showObra && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · URBANISMO</span><h2>Situación de las obras exteriores</h2></div>
              <small>Real {number.format(reportExecutive?.urbanismActual ?? projectSnapshot.urbanismProgress)}% · plan {number.format(reportExecutive?.urbanismPlan ?? projectSnapshot.urbanismPlanned)}%</small>
            </div>
            <div className="report-urban-grid">
              {reportUrbanismAreas.map((item) => (
                <article key={item.name}>
                  <span>{item.name}</span>
                  <strong>{number.format(item.progress)}%</strong>
                </article>
              ))}
            </div>
            <p className="report-footnote">{reportDelayedUrbanism.length} inicios de urbanismo figuran retrasados en la fuente; el mayor retraso documentado es de {reportDelayedUrbanism[0]?.days ?? 0} días.</p>
          </section>
        )}

        {showVentas && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · VENTAS Y COBRANZA</span><h2>Reservas, contratos y cartera</h2></div>
              <small>Moneda de visualización: {currency}</small>
            </div>
            <div className="report-kpi-grid compact">
              <article><span>Ventas activas</span><strong>{reportSales.active}</strong><small>{reportSales.juneReservations} reservas en junio</small></article>
              <article><span>Reservas históricas</span><strong>{reportSales.reservations}</strong><small>{reportSales.withdrawn} desistidas</small></article>
              <article><span>Fase I activas</span><strong>{reportSales.phaseOneActive}</strong><small>{reportSales.phaseOneSales} vendidas</small></article>
              <article><span>Fase II activas</span><strong>{reportSales.phaseTwoActive}</strong><small>{reportSales.phaseTwoSales} vendidas</small></article>
              <article className="warn"><span>Cartera vencida</span><strong>{overdue}</strong><small>{reportCollections.overdue} clientes</small></article>
              <article><span>Contratos</span><strong>{reportCollections.contracts}</strong><small>{reportCollections.current} al día</small></article>
            </div>
            <div className="report-two-columns">
              <div>
                <h3>Modelos</h3>
                <div className="report-progress-list">
                  {reportSalesModels.map((item) => (
                    <div key={item.name}>
                      <span>{item.name}</span>
                      <i><b style={{ width: `${item.value ? (item.june / item.value) * 100 : 0}%` }} /></i>
                      <strong>{item.june} / {item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Ubicaciones</h3>
                <ul className="report-compact-list">
                  {reportSalesLocations.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.total}</strong></li>)}
                </ul>
              </div>
            </div>
            <p className="report-footnote">Morosidad actualizada al {reportCollections.cutoff}. {exchangeRateNote(currency)}.</p>
          </section>
        )}

        {showFinance && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · FINANZAS</span><h2>Presupuesto, cuentas por pagar, anticipos y fideicomiso</h2></div>
              <small>Moneda de visualización: {currency}</small>
            </div>
            <div className="report-kpi-grid compact">
              {reportFinance ? (
                <>
                  <article><span>Presupuesto</span><strong>{dop(reportFinance.budgetDop)}</strong><small>Fuente original DOP</small></article>
                  <article><span>Ejecutado acumulado</span><strong>{dop(reportFinance.executedDop)}</strong><small>{number.format((reportFinance.executedDop / reportFinance.budgetDop) * 100)}% del presupuesto</small></article>
                  <article className="warn"><span>Cuentas por pagar</span><strong>{dop(reportFinance.cxpDop)}</strong><small>Sigue en vivo el archivo de Antonely</small></article>
                  <article><span>Anticipos pendientes</span><strong>{dop(reportFinance.advancesPendingDop)}</strong><small>{reportFinance.advancesGrantedDop !== undefined ? `${dop(reportFinance.advancesGrantedDop)} concedidos` : ""}</small></article>
                  <article><span>Fideicomiso · activos</span><strong>{dop(reportFiduciaryBalance.assetsDop)}</strong><small>Patrimonio neto {dop(reportFiduciaryBalance.netEquityDop)}</small></article>
                  <article className="danger"><span>Caja proyectada a diciembre</span><strong>{dop(reportFinance.projectedCashDecemberDop)}</strong><small>Escenario de flujo</small></article>
                </>
              ) : (
                <article><span>Finanzas</span><strong>Restringido</strong><small>La instantánea no incluye datos financieros.</small></article>
              )}
            </div>
            {reportFinance && (
              <div className="report-two-columns">
                <div>
                  <h3>Cuentas por pagar por antigüedad</h3>
                  <div className="report-progress-list">
                    {reportCxpAging.map((item) => (
                      <div key={item.name}>
                        <span>{item.name}</span>
                        <i><b style={{ width: `${item.percent}%` }} /></i>
                        <strong>{number.format(item.percent)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Conciliación de fuentes de CxP</h3>
                  <ul className="report-compact-list">
                    {reportPayablesReconciliation.map((item) => <li key={item.source}><span>{item.source}</span><strong>{dop(item.amount)}</strong></li>)}
                  </ul>
                </div>
              </div>
            )}
            <p className="report-footnote">{exchangeRateNote(currency)}. Los importes conservan su moneda de origen y solo cambia la presentación.</p>
          </section>
        )}

        {showObra && (
          <section className="report-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · SEGURIDAD Y PERMISOS</span><h2>Control transversal</h2></div>
              <small>{approvedPermits} aprobados · {reportPermits.length - approvedPermits} en proceso</small>
            </div>
            <div className="report-safety-grid">
              {reportSafetyMetrics.map((item) => (
                <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>
              ))}
            </div>
          </section>
        )}

        {showObra && (
          <section className="report-section report-actions-section">
            <div className="report-section-heading">
              <div><span>{nextSection()} · DECISIONES DE DIRECCIÓN</span><h2>Acciones prioritarias y calidad de datos</h2></div>
              <small>{archived?.reconciliationSummary.total ?? juneDataQualityIssues.length} conciliaciones abiertas</small>
            </div>
            <ol className="report-actions-list">
              {reportManagementActions.map((action, index) => <li key={action}><b>{String(index + 1).padStart(2, "0")}</b><span>{action}</span></li>)}
            </ol>
            <div className="report-quality-alert">
              <strong>Control de calidad documental</strong>
              <p>El informe toma la versión viva al generarse y mantiene visibles las diferencias entre fuentes; no rellena periodos sin datos normalizados.</p>
            </div>
          </section>
        )}

        <footer className="direction-report-footer">
          <span>ARAYA Punta Cana · Centro de Control Grupo Bricket</span>
          <span>{reportKind} · {period.label} · corte fuente {reportSourceCutoff}</span>
        </footer>
      </article>
    </div>
  );
}

function UploadModal({
  initialArea,
  initialFile,
  canAccessFinance,
  online,
  onClose,
  onComplete,
}: {
  initialArea: UploadArea;
  initialFile: File | null;
  canAccessFinance: boolean;
  online: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile);
  const [previewUrl, setPreviewUrl] = useState(() =>
    initialFile?.type.startsWith("image/") ? URL.createObjectURL(initialFile) : "",
  );
  const [area, setArea] = useState<UploadArea>(initialArea);
  const [description, setDescription] = useState("");
  const [declaredCutoff, setDeclaredCutoff] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode | "auto">("auto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(file: File | null) {
    setSelectedFile(file);
    setPreviewUrl(file?.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || saving) return;
    if (!online) {
      setError("La carga queda desactivada en modo sin conexión. Conserva la foto y vuelve a intentarlo cuando recuperes internet.");
      return;
    }
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
          <div><span className="section-kicker">CENTRO DE DATOS · CARGA AUTOMÁTICA</span><h3>Subir archivo al proyecto ARAYA</h3></div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="upload-intro">Selecciona el archivo y pulsa <strong>Subir y procesar</strong>. El sistema conserva el original, registra tu identidad y detecta automáticamente el área, el periodo y la moneda. Si los datos extraídos tienen alta confianza y encajan en un campo conocido de tu área, actualizan cifras y gráficas solos; el resto queda claramente señalado para revisión.</p>
        <div className={`upload-dropzone ${previewUrl ? "with-preview" : ""}`}>
          <input
            type="file"
            required
            accept=".xlsx,.xls,.csv,.json,.pptx,.ppt,.pdf,.docx,.doc,.mpp,.dwg,.png,.jpg,.jpeg,.zip"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          {previewUrl && (
            <div
              className="upload-image-preview"
              role="img"
              aria-label={`Vista previa de ${selectedFile?.name ?? "la fotografía"}`}
              style={{ backgroundImage: `url("${previewUrl}")` }}
            />
          )}
          <strong>{selectedFile ? selectedFile.name : "Selecciona o arrastra un archivo"}</strong>
          <span>{selectedFile ? fileSize(selectedFile.size) : "Excel, CSV/JSON, PowerPoint, PDF, Word, MPP, DWG, imagen o ZIP · máximo 50 MB"}</span>
        </div>
        <div className="upload-source-actions" aria-label="Opciones de carga en móvil">
          <label>
            <span>Tomar foto con la cámara</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <small>Ideal para avance de obra, incidencias, albaranes y evidencias de campo.</small>
        </div>
        {!online && <div className="callout warn"><strong>Modo sin conexión</strong><p>Puedes consultar datos, pero las nuevas cargas se reactivarán cuando vuelva internet.</p></div>}
        <details className="upload-advanced-options">
          <summary>
            <span><strong>Opciones avanzadas</strong><small>Normalmente no necesitas rellenarlas</small></span>
            <em>Opcional</em>
          </summary>
          <div className="form-grid">
            <label>
              Área de destino
              <select value={area} onChange={(event) => setArea(event.target.value as UploadArea)}>
                {uploadAreas
                  .filter((option) => canAccessFinance || !requiresFinanceAccessForArea(option.id))
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
        </details>
        {error && <div className="callout warn"><strong>No se completó la carga</strong><p>{error}</p></div>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="button primary" type="submit" disabled={!selectedFile || saving || !online}>{saving ? "Subiendo y procesando…" : online ? "Subir y procesar" : "Esperando conexión"}</button>
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

export function DashboardClient({
  currentUser,
  bootstrap,
}: {
  currentUser: DashboardUser;
  bootstrap: DashboardBootstrapData;
}) {
  installDashboardBootstrap(bootstrap);
  const [profileUser, setProfileUser] = useState(currentUser);
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>("araya");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [view, setView] = useState<View>("resumen");
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]);
  const [metrics, setMetrics] = useState<CustomMetric[]>(currentUser.financeAccess ? initialMetrics : []);
  const [supplierRows, setSupplierRows] = useState<Supplier[]>(initialSuppliers);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modal, setModal] = useState<"metric" | "supplier" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false);
  const [directionReport, setDirectionReport] = useState<DirectionReportPeriod | null>(null);
  const [workspaceDetail, setWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [fileViewer, setFileViewer] = useState<FileViewerState | null>(null);
  const [expandedNavGroup, setExpandedNavGroup] = useState<NavigationGroupId | null>(null);
  const [mobileNavigationGroup, setMobileNavigationGroup] = useState<NavigationGroupId>("obra");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_DISPLAY_CURRENCY);
  const [liveSync, setLiveSync] = useState<LiveSyncState>({
    status: "syncing",
    revision: 0,
    refreshedAt: "",
    latestEvent: null,
  });
  const [controlRoom, setControlRoom] = useState<ControlRoomSnapshot | null>(null);
  const [controlRoomLoading, setControlRoomLoading] = useState(true);
  const [controlRoomError, setControlRoomError] = useState("");
  const [deviceCenterOpen, setDeviceCenterOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [online, setOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<DeviceNotificationPermission>("unsupported");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [pushSubscriptionReady, setPushSubscriptionReady] = useState(false);
  const [deviceSecurityReady, setDeviceSecurityReady] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricRecord, setBiometricRecord] = useState<LocalBiometricRecord | null>(null);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState("");
  const hiddenAtRef = useRef(0);
  const lastNotifiedRevisionRef = useRef<number | null>(null);
  const pushRegistrationRef = useRef<Promise<boolean> | null>(null);
  const activeProject = projects[activeProjectId];
  const availableNavItems = navItems.filter((item) => item.id !== "usuarios" || currentUser.role === "admin");
  const availableNavigationGroups = navigationGroups.map((group) => ({
    ...group,
    items: (group.itemIds ?? [])
      .map((itemId) => availableNavItems.find((item) => item.id === itemId))
      .filter((item): item is NavItem => Boolean(item)),
  }));
  const activeNavigationGroup = navigationGroups.find((group) => navigationGroupContainsView(group, view));
  const selectedMobileNavigationGroup = availableNavigationGroups.find((group) => group.id === mobileNavigationGroup)
    ?? availableNavigationGroups.find((group) => group.items.length > 0)
    ?? availableNavigationGroups[0];
  const arayaLiveSummary = `${buildings.length} edificios · ${buildings.reduce((total, building) => total + building.units.length, 0)} apartamentos`;
  const localDeviceNotifications = useMemo(
    () => buildDeviceNotifications(controlRoom, liveSync),
    [controlRoom, liveSync],
  );
  const deviceNotifications = useMemo(
    () => mergeDeviceNotifications(
      serverNotifications.map(serverNotificationAsDeviceItem),
      localDeviceNotifications,
    ),
    [localDeviceNotifications, serverNotifications],
  );
  const effectiveReadNotificationIds = useMemo(
    () => Array.from(new Set([
      ...readNotificationIds,
      ...serverNotifications
        .filter((item) => item.read)
        .map((item) => serverNotificationDeviceId(item.id)),
    ])),
    [readNotificationIds, serverNotifications],
  );
  const unreadNotifications = deviceNotifications.filter(
    (item) => !effectiveReadNotificationIds.includes(item.id),
  ).length;

  const refreshControlRoom = useCallback(async () => {
    try {
      const response = await fetch("/api/control-room", { cache: "no-store" });
      const payload = (await response.json()) as ControlRoomSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Sala operativa no disponible.");
      setControlRoom(payload);
      setControlRoomError("");
    } catch (refreshError) {
      setControlRoomError(
        refreshError instanceof Error ? refreshError.message : "Sala operativa no disponible.",
      );
    } finally {
      setControlRoomLoading(false);
    }
  }, []);

  const patchNotificationReads = useCallback(async (payload: NotificationReadPatch) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const registerPushSubscription = useCallback(async () => {
    if (pushRegistrationRef.current) return pushRegistrationRef.current;
    const operation = (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !window.isSecureContext
      ) {
        setPushSubscriptionReady(false);
        return false;
      }
      try {
        const configResponse = await fetch("/api/push/config", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!configResponse.ok) throw new Error("Configuración push no disponible.");
        const config = await configResponse.json() as PushConfigResponse;
        if (!config.enabled || !config.publicKey) {
          setPushSubscriptionReady(false);
          return false;
        }
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(config.publicKey),
          });
        }
        const subscriptionResponse = await fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            platform: clientPlatform(),
          }),
        });
        if (!subscriptionResponse.ok) throw new Error("No se pudo registrar la suscripción push.");
        setPushSubscriptionReady(true);
        return true;
      } catch {
        setPushSubscriptionReady(false);
        return false;
      }
    })();
    pushRegistrationRef.current = operation;
    const registered = await operation;
    if (pushRegistrationRef.current === operation) pushRegistrationRef.current = null;
    return registered;
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("bricket-agent-open-v1");
    if (stored === "true") setAgentOpen(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("bricket-agent-open-v1", agentOpen ? "true" : "false");
  }, [agentOpen]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      const readKey = `bricket-notifications-read-v1:${currentUser.id}`;
      let storedReadIds: string[] = [];
      try {
        const stored = JSON.parse(window.localStorage.getItem(readKey) ?? "[]") as unknown;
        if (Array.isArray(stored)) {
          storedReadIds = stored
            .filter((item): item is string => typeof item === "string")
            .slice(0, 100);
        }
      } catch {
        storedReadIds = [];
      }
      const record = readBiometricRecord(currentUser.id);
      let supported = false;
      try {
        supported = await platformBiometricAvailable();
      } catch {
        supported = false;
      }
      if (!active) return;
      setReadNotificationIds(storedReadIds);
      setOnline(navigator.onLine);
      setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
      setBiometricRecord(record);
      setBiometricLocked(Boolean(record));
      setBiometricSupported(supported);
      setDeviceSecurityReady(true);
    })();

    return () => {
      active = false;
    };
  }, [currentUser.id]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setNotice("Conexión recuperada · sincronización en tiempo real reactivada.");
    };
    const handleOffline = () => {
      setOnline(false);
      setNotice("Modo sin conexión · consulta local en solo lectura.");
    };
    const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "OFFLINE_READY") setOfflineReady(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!biometricRecord) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= 30_000) {
        setBiometricLocked(true);
        setDeviceCenterOpen(false);
        setFileViewer(null);
      }
      hiddenAtRef.current = 0;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [biometricRecord]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const timer = window.setTimeout(() => setAgentOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active) return;
      await refreshControlRoom();
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    const handleUpdate = () => void refresh();
    window.addEventListener("araya-control-room-updated", handleUpdate);
    window.addEventListener("araya-files-updated", handleUpdate);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("araya-control-room-updated", handleUpdate);
      window.removeEventListener("araya-files-updated", handleUpdate);
    };
  }, [refreshControlRoom]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refreshNotifications = async () => {
      if (refreshing || !navigator.onLine) return;
      refreshing = true;
      try {
        const response = await fetch("/api/notifications?limit=100", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Notificaciones no disponibles.");
        const payload = await response.json() as ServerNotificationsResponse;
        const incoming = Array.isArray(payload.notifications)
          ? payload.notifications.filter(isServerNotification)
          : [];
        if (active) {
          setServerNotifications((current) => mergeServerNotifications(current, incoming));
        }
      } catch {
        // La bandeja local continúa funcionando cuando el servidor no responde.
      } finally {
        refreshing = false;
      }
    };
    const handleNotificationUpdate = () => void refreshNotifications();
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 5_000);
    window.addEventListener("araya-control-room-updated", handleNotificationUpdate);
    window.addEventListener("araya-files-updated", handleNotificationUpdate);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("araya-control-room-updated", handleNotificationUpdate);
      window.removeEventListener("araya-files-updated", handleNotificationUpdate);
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;
    let sending = false;
    const sessionId = storedClientIdentifier(
      window.sessionStorage,
      `bricket-presence-session-v1:${currentUser.id}`,
      "session",
    );
    const deviceId = storedClientIdentifier(
      window.localStorage,
      "bricket-device-id-v1",
      "device",
    );
    const sendPresence = async () => {
      if (sending || !active || !navigator.onLine || document.visibilityState === "hidden") return;
      sending = true;
      try {
        await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
          body: JSON.stringify({
            sessionId,
            deviceId,
            platform: clientPlatform(),
          }),
        });
      } catch {
        // La presencia se renueva en el siguiente latido al recuperar la red.
      } finally {
        sending = false;
      }
    };
    const handleVisibleOrOnline = () => {
      if (document.visibilityState === "visible") void sendPresence();
    };
    void sendPresence();
    const interval = window.setInterval(() => void sendPresence(), 45_000);
    window.addEventListener("online", handleVisibleOrOnline);
    document.addEventListener("visibilitychange", handleVisibleOrOnline);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", handleVisibleOrOnline);
      document.removeEventListener("visibilitychange", handleVisibleOrOnline);
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (!deviceSecurityReady || !online || notificationPermission !== "granted") return;
    void registerPushSubscription();
  }, [deviceSecurityReady, notificationPermission, online, registerPushSubscription]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedView = url.searchParams.get("view") as View | null;
    const notificationId = Number(url.searchParams.get("notification") ?? 0);
    const viewAllowed = requestedView &&
      navItems.some((item) => item.id === requestedView) &&
      (requestedView !== "usuarios" || currentUser.role === "admin") &&
      (!(["finanzas", "comercial"] as View[]).includes(requestedView) || currentUser.financeAccess);
    let navigationTimer = 0;
    if (viewAllowed && requestedView) {
      const targetGroup = navigationGroups.find((group) => navigationGroupContainsView(group, requestedView));
      navigationTimer = window.setTimeout(() => {
        if (targetGroup?.itemIds?.length) {
          setExpandedNavGroup(targetGroup.id);
          setMobileNavigationGroup(targetGroup.id);
        }
        setView(requestedView);
      }, 0);
    }
    if (Number.isSafeInteger(notificationId) && notificationId > 0) {
      void patchNotificationReads({ ids: [notificationId], openedId: notificationId });
    }
    if (requestedView || notificationId) {
      url.searchParams.delete("view");
      url.searchParams.delete("notification");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => {
      if (navigationTimer) window.clearTimeout(navigationTimer);
    };
  }, [currentUser.financeAccess, currentUser.role, patchNotificationReads]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(async (registration) => {
          await registration.update();
          const ready = await navigator.serviceWorker.ready;
          const resourceUrls = Array.from(
            document.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement>(
              'link[rel="stylesheet"][href], script[src], img[src]',
            ),
          )
            .map((element) => {
              const source = element instanceof HTMLLinkElement ? element.href : element.src;
              const url = new URL(source, window.location.href);
              return url.origin === window.location.origin && !url.pathname.startsWith("/api/")
                ? `${url.pathname}${url.search}`
                : "";
            })
            .filter(Boolean);
          (ready.active ?? registration.active)?.postMessage({
            type: "CACHE_APP_SHELL",
            resourceUrls,
          });
        })
        .catch(() => undefined);
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const hasBlockingLayer = Boolean(
      mobileMenuOpen ||
      modal ||
      uploadOpen ||
      reportBuilderOpen ||
      directionReport ||
      workspaceDetail ||
      fileViewer ||
      deviceCenterOpen,
    );
    if (!hasBlockingLayer) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [deviceCenterOpen, directionReport, fileViewer, mobileMenuOpen, modal, reportBuilderOpen, uploadOpen, workspaceDetail]);

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
        if ([liveResponse.status, dashboardResponse.status].some((status) => status === 401 || status === 403)) {
          removeBiometricRecord(currentUser.id);
          navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
          window.location.assign("/signout-with-chatgpt?return_to=/");
          return;
        }
        if (!liveResponse.ok || !dashboardResponse.ok) throw new Error("Sincronización no disponible");
        const [liveData, dashboardData] = await Promise.all([
          liveResponse.json() as Promise<{
            healthy?: boolean;
            values?: LiveDataMap;
            revision?: number;
            refreshedAt?: string;
            latestEvent?: LiveSyncState["latestEvent"];
            currentUser?: DashboardUser;
          }>,
          dashboardResponse.json() as Promise<{
            metrics?: CustomMetric[];
            suppliers?: Supplier[];
          }>,
        ]);
        if (!active) return;
        const refreshedUser = liveData.currentUser;
        if (
          refreshedUser &&
          (
            refreshedUser.active !== currentUser.active ||
            refreshedUser.financeAccess !== currentUser.financeAccess ||
            refreshedUser.role !== currentUser.role ||
            refreshedUser.area !== currentUser.area
          )
        ) {
          navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
          window.location.reload();
          return;
        }
        if (liveData.healthy === false) throw new Error("Sincronización no disponible");
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
  }, [currentUser.active, currentUser.area, currentUser.financeAccess, currentUser.id, currentUser.role]);

  useEffect(() => {
    if (!deviceSecurityReady || liveSync.revision <= 0) return;
    const storageKey = `bricket-last-notified-revision-v1:${currentUser.id}`;
    const storedRevision = Number(window.localStorage.getItem(storageKey) ?? 0);
    if (lastNotifiedRevisionRef.current === null) {
      lastNotifiedRevisionRef.current = storedRevision || liveSync.revision;
      if (!storedRevision) window.localStorage.setItem(storageKey, String(liveSync.revision));
      return;
    }
    if (liveSync.revision <= lastNotifiedRevisionRef.current) return;

    lastNotifiedRevisionRef.current = liveSync.revision;
    window.localStorage.setItem(storageKey, String(liveSync.revision));
    if (notificationPermission === "granted" && !pushSubscriptionReady) {
      void showDeviceNotification(
        `Bricket Control · revisión v${liveSync.revision}`,
        liveSync.latestEvent?.message ?? "El Centro de Control ha recibido nuevos datos.",
      );
    }
  }, [
    currentUser.id,
    deviceSecurityReady,
    liveSync.latestEvent?.message,
    liveSync.revision,
    notificationPermission,
    pushSubscriptionReady,
  ]);

  const searchResults = useMemo<WorkspaceSearchResult[]>(() => {
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
          .map((unit) => ({ label: unit.code, detail: `${building.name} · ${number.format(unitOverallProgress(unit))}% conjunto`, view: "viviendas" as View, building })),
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
      ...dataSources
        .filter((source) => currentUser.financeAccess || !sourceRequiresFinance(source))
        .filter((source) => `${source.file} ${source.kind}`.toLowerCase().includes(term))
        .map((source) => ({
          label: source.file,
          detail: `${source.kind} · corte ${source.declaredCutoff}`,
          view: "fuentes" as View,
          building: null,
          sourceId: source.id,
        })),
    ].slice(0, 8);
  }, [activeProjectId, search, supplierRows, metrics, currentUser.financeAccess]);

  function persistReadNotificationIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids)).slice(-100);
    setReadNotificationIds(uniqueIds);
    window.localStorage.setItem(
      `bricket-notifications-read-v1:${currentUser.id}`,
      JSON.stringify(uniqueIds),
    );
  }

  function readNotification(id: string) {
    persistReadNotificationIds([...readNotificationIds, id]);
    const serverId = serverNotificationNumericId(id);
    if (!serverId) return;
    const now = new Date().toISOString();
    setServerNotifications((current) => current.map((item) => item.id === serverId
      ? { ...item, read: true, readAt: item.readAt || now, openedAt: now }
      : item));
    void patchNotificationReads({ ids: [serverId], openedId: serverId });
  }

  function readAllNotifications() {
    persistReadNotificationIds([
      ...readNotificationIds,
      ...deviceNotifications.map((item) => item.id),
    ]);
    const readThroughId = serverNotifications.reduce((latest, item) => Math.max(latest, item.id), 0);
    if (!readThroughId) return;
    const now = new Date().toISOString();
    setServerNotifications((current) => current.map((item) => item.id <= readThroughId
      ? { ...item, read: true, readAt: item.readAt || now }
      : item));
    void patchNotificationReads({ readThroughId });
  }

  async function showDeviceNotification(title: string, body: string) {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/bricket-mark.png",
      badge: "/bricket-mark.png",
      tag: "bricket-control-live",
      data: { url: "/" },
    });
  }

  async function releasePushSubscription() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager?.getSubscription();
      if (!subscription) return;
      await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
      await subscription.unsubscribe().catch(() => false);
      setPushSubscriptionReady(false);
    } catch {
      // El cierre de sesión continúa aunque el navegador no exponga PushManager.
    }
  }

  async function enableDeviceNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      const pushRegistered = await registerPushSubscription();
      setNotice(pushRegistered
        ? "Notificaciones push activadas en este dispositivo."
        : "Notificaciones activadas; los avisos locales seguirán disponibles en la aplicación.");
      await showDeviceNotification(
        "Bricket Control listo",
        "Recibirás avisos de nuevas revisiones y alertas operativas.",
      );
    } else {
      setPushSubscriptionReady(false);
      setNotice("El dispositivo no ha autorizado las notificaciones.");
    }
  }

  async function testDeviceNotification() {
    await showDeviceNotification(
      "Aviso de prueba · Bricket Control",
      "Las notificaciones del Centro de Control funcionan correctamente.",
    );
  }

  async function enableBiometricUnlock() {
    setBiometricBusy(true);
    setBiometricError("");
    try {
      const record = await enrollPlatformBiometric(currentUser.id, profileUser.displayName);
      setBiometricRecord(record);
      setBiometricLocked(false);
      setNotice("Desbloqueo biométrico activado en este dispositivo.");
    } catch (error) {
      setBiometricError(
        error instanceof Error
          ? error.message
          : "No se ha podido configurar la protección biométrica.",
      );
    } finally {
      setBiometricBusy(false);
    }
  }

  async function unlockWithBiometrics() {
    if (!biometricRecord) return;
    setBiometricBusy(true);
    setBiometricError("");
    try {
      await verifyPlatformBiometric(biometricRecord);
      setBiometricLocked(false);
    } catch {
      setBiometricError("No se ha podido verificar la identidad. Vuelve a intentarlo.");
    } finally {
      setBiometricBusy(false);
    }
  }

  function disableBiometricUnlock() {
    if (!online) {
      setBiometricError("Conéctate a internet antes de retirar la protección de este dispositivo.");
      return;
    }
    removeBiometricRecord(currentUser.id);
    setBiometricRecord(null);
    setBiometricLocked(false);
    setBiometricError("");
    setNotice("Protección biométrica desactivada en este dispositivo.");
  }

  function recoverBiometricAccess() {
    if (!online) return;
    removeBiometricRecord(currentUser.id);
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
    window.location.assign("/signout-with-chatgpt?return_to=/");
  }

  function lockDeviceNow() {
    if (!biometricRecord) return;
    setDeviceCenterOpen(false);
    setFileViewer(null);
    setBiometricLocked(true);
  }

  function requestUpload(file: File | null = null) {
    if (!online) {
      setNotice("La carga de archivos necesita conexión. La consulta local sigue disponible.");
      return;
    }
    setPendingUploadFile(file);
    setUploadOpen(true);
  }

  function handleDirectCameraFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setMobileMenuOpen(false);
    requestUpload(file);
  }

  function openDeviceNotification(item: DeviceNotificationItem) {
    setDeviceCenterOpen(false);
    if (item.view && navItems.some((navItem) => navItem.id === item.view)) {
      navigate(item.view as View);
    }
  }

  function navigate(viewId: View) {
    const targetGroup = navigationGroups.find((group) => navigationGroupContainsView(group, viewId));
    if (targetGroup?.itemIds?.length) setExpandedNavGroup(targetGroup.id);
    setView(viewId);
    setWorkspaceDetail(null);
    setFileViewer(null);
    setMobileMenuOpen(false);
    setDeviceCenterOpen(false);
    if (viewId === "agente") setAgentOpen(false);
  }

  function selectProject(projectId: ProjectId) {
    setActiveProjectId(projectId);
    setProjectMenuOpen(false);
    setExpandedNavGroup(null);
    setMobileNavigationGroup("obra");
    setMobileMenuOpen(false);
    setView("resumen");
    setSearch("");
    setModal(null);
    setUploadOpen(false);
    setReportBuilderOpen(false);
    setDirectionReport(null);
    setWorkspaceDetail(null);
    setFileViewer(null);
    setDeviceCenterOpen(false);
    setPendingUploadFile(null);
    setAgentOpen(projectId === "araya" && !window.matchMedia("(max-width: 1100px)").matches);
  }

  function openFileInViewer(event: ReactMouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    ) return;

    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.href);
    if (
      url.origin === window.location.origin &&
      url.pathname.startsWith("/signout-with-chatgpt")
    ) {
      event.preventDefault();
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
      void releasePushSubscription().finally(() => {
        window.location.assign(`${url.pathname}${url.search}${url.hash}`);
      });
      return;
    }
    if (anchor.hasAttribute("download") || anchor.dataset.fileViewerBypass === "true") return;
    const isStaticProjectFile = url.origin === window.location.origin && url.pathname.startsWith("/data-center/");
    const isUploadedProjectFile = url.origin === window.location.origin &&
      url.pathname === "/api/files" &&
      (url.searchParams.has("download") || url.searchParams.has("preview"));
    if (!isStaticProjectFile && !isUploadedProjectFile) return;

    event.preventDefault();
    setFileViewer({
      url: `${url.pathname}${url.search}${url.hash}`,
      title: fileViewerTitle(anchor, url),
    });
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function generateDirectionReport(period: DirectionReportPeriod) {
    const response = await fetch("/api/control-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "create_report",
        requestKey: crypto.randomUUID(),
        frequency: period.frequency,
        reportType: period.reportType,
        startDate: period.startDate,
        endDate: period.endDate,
        label: period.label,
        currency,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      report?: ControlRoomSnapshot["reports"][number];
    };
    if (!response.ok || !payload.report) {
      throw new Error(payload.error || "No se pudo archivar el informe.");
    }
    setReportBuilderOpen(false);
    setDirectionReport({
      ...period,
      archivedReportId: payload.report.id,
      liveRevision: payload.report.liveRevision,
      sourceCutoff: payload.report.cutoff,
      archivedSnapshot: payload.report.snapshot,
    });
    window.dispatchEvent(new CustomEvent("araya-control-room-updated"));
  }

  function content() {
    if (view === "usuarios" && currentUser.role === "admin") {
      return (
        <UsersAdminView
          currentUser={profileUser}
          onCurrentAvatarUpdated={(avatarUrl) =>
            setProfileUser((current) => ({ ...current, avatarUrl }))
          }
          onOpenGuide={() =>
            setFileViewer({
              url: "/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf",
              title: "Guía corporativa Bricket Control · personal de obra.pdf",
            })
          }
        />
      );
    }
    if (activeProjectId === "mirador") return <DemoProjectContent view={view} onNavigate={navigate} />;
    if (view === "resumen") {
      return (
        <div className="view-stack">
          <Overview onNavigate={navigate} onSelectBuilding={setSelectedBuilding} currency={currency} canAccessFinance={currentUser.financeAccess} currentUser={profileUser} />
          <ControlRoomPanel
            snapshot={controlRoom}
            loading={controlRoomLoading}
            error={controlRoomError}
            currentView={view}
            onNavigate={(nextView) => navigate(nextView as View)}
            onCreateReport={() => setReportBuilderOpen(true)}
            onOpenReport={(report) => setDirectionReport({
              frequency: report.frequency === "weekly" ? "weekly" : "monthly",
              reportType: reportTypeOptions.some((option) => option.id === report.reportType)
                ? report.reportType as ReportType
                : "global",
              startDate: report.startDate,
              endDate: report.endDate,
              label: report.label,
              generatedAt: report.createdAt,
              archivedReportId: report.id,
              liveRevision: report.liveRevision,
              sourceCutoff: report.cutoff,
              archivedSnapshot: report.snapshot,
            })}
            onRefresh={() => void refreshControlRoom()}
            readOnly={!online}
          />
        </div>
      );
    }
    if (view === "planificacion") return <Planning />;
    if (view === "implantacion") return <div className="view-stack"><SitePlan onNavigate={navigate} onSelectBuilding={setSelectedBuilding} /></div>;
    if (view === "edificios") return <BuildingsView selected={selectedBuilding} setSelected={setSelectedBuilding} />;
    if (view === "viviendas") return <HousingView />;
    if (view === "comercial") return currentUser.financeAccess
      ? <CommercialView currency={currency} />
      : <FinanceLockedView />;
    if (view === "urbanismo") return <UrbanismView />;
    if (view === "control") return <ControlView currency={currency} canAccessFinance={currentUser.financeAccess} />;
    if (view === "cronologia") return <TimelineView />;
    if (view === "proveedores") return <SuppliersView suppliers={supplierRows} onAdd={() => online ? setModal("supplier") : setNotice("Modo sin conexión · no se pueden crear registros.")} currency={currency} canAccessFinance={currentUser.financeAccess} />;
    if (view === "metricas") return currentUser.financeAccess ? <MetricsView metrics={metrics} onAdd={() => online ? setModal("metric") : setNotice("Modo sin conexión · no se pueden crear registros.")} currency={currency} latestFinanceEvent={liveSync.latestEvent} /> : <FinanceLockedView />;
    if (view === "fuentes") return <SourcesView onUpload={() => requestUpload()} canAccessFinance={currentUser.financeAccess} currency={currency} currentUser={profileUser} />;
    return <AgentPanel expanded onClose={() => navigate("resumen")} currency={currency} />;
  }

  if (!deviceSecurityReady) return <DeviceBootScreen />;
  if (!online && !biometricRecord) {
    return (
      <OfflineAccessGate
        onRetry={() => {
          const connectionAvailable = navigator.onLine;
          setOnline(connectionAvailable);
          if (connectionAvailable) window.location.reload();
        }}
      />
    );
  }
  if (biometricRecord && biometricLocked) {
    return (
      <BiometricGate
        displayName={profileUser.displayName}
        busy={biometricBusy}
        error={biometricError}
        online={online}
        onUnlock={() => void unlockWithBiometrics()}
        onRecover={recoverBiometricAccess}
      />
    );
  }

  return (
    <WorkspaceDetailContext.Provider value={{
      enabled: activeProjectId === "araya",
      openDetail: setWorkspaceDetail,
    }}>
    <div className="app-shell" onClickCapture={openFileInViewer}>
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
                  onClick={() => selectProject(project.id)}
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
          {availableNavigationGroups.map((group) => {
            const groupIsActive = navigationGroupContainsView(group, view);
            const expandable = group.items.length > 0;
            const expanded = expandable && expandedNavGroup === group.id;
            if (!expandable && group.directView) {
              return (
                <div className="sidebar-nav-group" key={group.id}>
                  <button
                    type="button"
                    className={`nav-group-trigger ${groupIsActive ? "active" : ""}`}
                    onClick={() => navigate(group.directView as View)}
                  >
                    <i>{group.mark}</i><span>{group.label}</span>
                  </button>
                </div>
              );
            }
            return (
              <div className={`sidebar-nav-group ${groupIsActive ? "current" : ""}`} key={group.id}>
                <button
                  type="button"
                  className={`nav-group-trigger ${expanded ? "expanded" : ""}`}
                  aria-expanded={expanded}
                  aria-controls={`desktop-nav-${group.id}`}
                  onClick={() => setExpandedNavGroup((current) => current === group.id ? null : group.id)}
                >
                  <i>{group.mark}</i><span>{group.label}</span>
                  <b className="nav-group-chevron" aria-hidden="true">⌄</b>
                </button>
                {expanded && (
                  <div className="nav-group-children" id={`desktop-nav-${group.id}`}>
                    {group.items.map((item, itemIndex) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`nav-child ${view === item.id ? "active" : ""}`}
                        onClick={() => navigate(item.id)}
                      >
                        <i>{String(itemIndex + 1).padStart(2, "0")}</i><span>{item.label}</span>
                        {item.id === "fuentes" && <em>{activeProjectId === "araya"
                          ? (currentUser.financeAccess
                              ? dataSources.length
                              : dataSources.filter((source) => !sourceRequiresFinance(source)).length)
                            + (controlRoom?.documents.total ?? 0)
                          : 3}</em>}
                        {["metricas", "comercial"].includes(item.id) && !currentUser.financeAccess && <em className="restricted">BLOQUEADO</em>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

      <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">
        {availableNavigationGroups.map((group) => {
          const groupIsActive = activeNavigationGroup?.id === group.id;
          const expandable = group.items.length > 0;
          const submenuOpen = expandable && mobileMenuOpen && mobileNavigationGroup === group.id;
          return (
            <button
              key={group.id}
              type="button"
              className={groupIsActive || submenuOpen ? "active" : ""}
              aria-current={groupIsActive ? "page" : undefined}
              aria-expanded={expandable ? submenuOpen : undefined}
              onClick={() => {
                if (group.directView) {
                  navigate(group.directView);
                  return;
                }
                setMobileNavigationGroup(group.id);
                setMobileMenuOpen(true);
              }}
            >
              <i>{group.mark}</i>
              <span>{group.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      <main className="main-area">
        <Header
          view={view}
          project={activeProject}
          onAsk={() => setAgentOpen(true)}
          onUpload={() => requestUpload()}
          onReport={() => setReportBuilderOpen(true)}
          onAvatarUpdated={(avatarUrl) =>
            setProfileUser((current) => ({ ...current, avatarUrl }))
          }
          currency={currency}
          onCurrencyChange={setCurrency}
          liveSync={liveSync}
          currentUser={profileUser}
          canAccessFinance={currentUser.financeAccess}
          online={online}
          unreadNotifications={unreadNotifications}
          onOpenDeviceCenter={() => setDeviceCenterOpen(true)}
          onOpenGuide={() =>
            setFileViewer({
              url: "/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf",
              title: "Guía corporativa Bricket Control · personal de obra.pdf",
            })
          }
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
                    const source = result.sourceId
                      ? dataSources.find((item) => item.id === result.sourceId)
                      : undefined;
                    navigate(result.view);
                    if (source) setWorkspaceDetail(sourceWorkspaceDetail(source));
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
          <div className={`live-data-ribbon ${online ? liveSync.status : "offline"}`} role="status" aria-live="polite">
            <span className="live-dot" />
            <strong>{online ? "Centro de Control sincronizado" : "Modo sin conexión · solo lectura"}</strong>
            <span>{online ? "Gráficas, cifras, porcentajes, cronograma y avance se actualizan automáticamente cada 5 segundos." : "Puedes consultar la última copia protegida. Cargas, informes y cambios se reactivarán al recuperar internet."}</span>
            <em>
              {!online
                ? offlineReady ? "Copia local preparada en este dispositivo" : "Conexión no disponible"
                : liveSync.latestEvent?.sourceName
                ? `Última fuente: ${liveSync.latestEvent.sourceName}${liveSync.latestEvent.cutoff ? ` · corte ${liveSync.latestEvent.cutoff}` : ""}`
                : "Base consolidada con trazabilidad por fuente, fecha y versión"}
            </em>
          </div>
        )}
        <div className="content">
          <AppErrorBoundary
            resetKey={`${activeProjectId}-${view}`}
            onRecover={() => navigate("resumen")}
          >
            {content()}
            {activeProjectId === "araya" && (currentUser.financeAccess || !(["metricas", "comercial"] as View[]).includes(view)) && (
              <AreaWorkspaceDock
                view={view}
                canAccessFinance={currentUser.financeAccess}
                onNavigate={navigate}
                onUpload={() => requestUpload()}
              />
            )}
          </AppErrorBoundary>
        </div>
      </main>

      {mobileMenuOpen && (
        <>
          <button className="mobile-menu-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Menú del Centro de Control">
            <div className="mobile-menu-head">
              <div className="mobile-menu-brand">
                <img src="/bricket-mark.png" alt="" />
                <div><strong>BRICKET</strong><span>Centro de Control</span></div>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú">×</button>
            </div>
            <div className="mobile-group-heading">
              <i>{selectedMobileNavigationGroup.mark}</i>
              <div><span>SECCIÓN</span><strong>{selectedMobileNavigationGroup.label}</strong></div>
            </div>
            <nav className="mobile-menu-links" aria-label={`Subsecciones de ${selectedMobileNavigationGroup.label}`}>
              {selectedMobileNavigationGroup.items.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  className={view === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  <i>{String(itemIndex + 1).padStart(2, "0")}</i>
                  <span>{item.label}</span>
                  {["metricas", "comercial"].includes(item.id) && !currentUser.financeAccess && <em>Bloqueado</em>}
                  {item.id === "fuentes" && <em className="mobile-data-count">{activeProjectId === "araya"
                    ? (currentUser.financeAccess
                        ? dataSources.length
                        : dataSources.filter((source) => !sourceRequiresFinance(source)).length)
                      + (controlRoom?.documents.total ?? 0)
                    : 3}</em>}
                  <b>›</b>
                </button>
              ))}
            </nav>
            <div className="mobile-project-switch">
              <span>Proyecto activo</span>
              <div>
                {(Object.values(projects) as Array<(typeof projects)[ProjectId]>).map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={activeProjectId === project.id ? "active" : ""}
                    onClick={() => selectProject(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <small>{project.id === "araya" ? arayaLiveSummary : "Proyecto demo"}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-quick-actions">
              <label className={`mobile-camera-action ${activeProject.demo || !online ? "disabled" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={activeProject.demo || !online}
                  onChange={handleDirectCameraFile}
                />
                <i aria-hidden="true">◉</i>
                <span><strong>Hacer foto</strong><small>Subir evidencia desde la cámara</small></span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  requestUpload();
                }}
                disabled={activeProject.demo || !online}
              >
                <i>＋</i><span><strong>Cargar archivo</strong><small>Documento, plano o foto</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setDeviceCenterOpen(true);
                }}
              >
                <i>●</i><span><strong>Avisos y seguridad</strong><small>{unreadNotifications ? `${unreadNotifications} avisos sin leer` : "Biometría y modo sin conexión"}</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setFileViewer({
                    url: "/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf",
                    title: "Guía corporativa Bricket Control · personal de obra.pdf",
                  });
                }}
              >
                <i>PDF</i><span><strong>Guía de uso</strong><small>Funciones e instalación</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAgentOpen(true);
                }}
                disabled={activeProject.demo || !online}
              >
                <i>AI</i><span><strong>Preguntar al agente</strong><small>Consulta los datos vivos</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setReportBuilderOpen(true);
                }}
                disabled={activeProject.demo || !online}
              >
                <i>↗</i><span><strong>Crear informe</strong><small>Semanal o mensual</small></span>
              </button>
              {installPrompt && (
                <button type="button" onClick={() => void installApp()}>
                  <i>↓</i><span><strong>Instalar aplicación</strong><small>Abrir desde la pantalla de inicio</small></span>
                </button>
              )}
            </div>
            <div className="mobile-account">
              <UserAvatar
                user={profileUser}
                editable={online}
                className="mobile-user-avatar"
                onUploaded={(avatarUrl) =>
                  setProfileUser((current) => ({ ...current, avatarUrl }))
                }
              />
              <div>
                <strong>{profileUser.displayName}</strong>
                <span>{areaLabels[profileUser.area]} · {profileUser.role === "admin" ? "Administrador" : "Usuario autorizado"}</span>
              </div>
              <a href="/signout-with-chatgpt?return_to=/">Salir</a>
            </div>
          </aside>
        </>
      )}

      {deviceCenterOpen && (
        <AppErrorBoundary
          resetKey={`device-center-${deviceCenterOpen}`}
          variant="overlay"
          onRecover={() => setDeviceCenterOpen(false)}
        >
          <DeviceCenter
            notifications={deviceNotifications}
            readIds={effectiveReadNotificationIds}
            notificationPermission={notificationPermission}
            biometricSupported={biometricSupported}
            biometricConfigured={Boolean(biometricRecord)}
            biometricBusy={biometricBusy}
            biometricError={biometricError}
            online={online}
            offlineReady={offlineReady}
            onClose={() => setDeviceCenterOpen(false)}
            onRead={readNotification}
            onReadAll={readAllNotifications}
            onOpenNotification={openDeviceNotification}
            onEnableNotifications={() => void enableDeviceNotifications()}
            onTestNotification={() => void testDeviceNotification()}
            onEnableBiometric={() => void enableBiometricUnlock()}
            onDisableBiometric={disableBiometricUnlock}
            onLockNow={lockDeviceNow}
          />
        </AppErrorBoundary>
      )}

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
          initialArea={!currentUser.financeAccess && requiresFinanceAccessForArea(defaultUploadArea[view]) ? "auto" : defaultUploadArea[view]}
          initialFile={pendingUploadFile}
          canAccessFinance={currentUser.financeAccess}
          online={online}
          onClose={() => {
            setUploadOpen(false);
            setPendingUploadFile(null);
          }}
          onComplete={(message) => {
            setUploadOpen(false);
            setPendingUploadFile(null);
            setNotice(message);
          }}
        />
      )}

      <AppErrorBoundary
        resetKey={`report-builder-${reportBuilderOpen}`}
        variant="overlay"
        onRecover={() => {
          setReportBuilderOpen(false);
          navigate("resumen");
        }}
      >
        {activeProjectId === "araya" && reportBuilderOpen && (
          <ReportBuilder
            canAccessFinance={currentUser.financeAccess}
            onClose={() => setReportBuilderOpen(false)}
            onGenerate={generateDirectionReport}
          />
        )}
      </AppErrorBoundary>

      <AppErrorBoundary
        resetKey={`direction-report-${directionReport?.archivedReportId ?? directionReport?.generatedAt ?? "closed"}`}
        variant="overlay"
        onRecover={() => {
          setDirectionReport(null);
          navigate("resumen");
        }}
      >
        {activeProjectId === "araya" && directionReport && (
          <DirectionReport
            period={directionReport}
            currency={currency}
            onClose={() => setDirectionReport(null)}
          />
        )}
      </AppErrorBoundary>

      <AppErrorBoundary
        resetKey={`workspace-detail-${workspaceDetail?.id ?? "closed"}`}
        variant="overlay"
        onRecover={() => {
          setWorkspaceDetail(null);
          navigate("resumen");
        }}
      >
        {activeProjectId === "araya" && workspaceDetail && (
          <WorkspaceDetailPanel
            detail={workspaceDetail}
            canAccessFinance={currentUser.financeAccess}
            onClose={() => setWorkspaceDetail(null)}
            onNavigate={navigate}
            onUpload={() => requestUpload()}
          />
        )}
      </AppErrorBoundary>

      <AppErrorBoundary
        resetKey={`file-viewer-${fileViewer?.url ?? "closed"}`}
        variant="overlay"
        onRecover={() => setFileViewer(null)}
      >
        {activeProjectId === "araya" && fileViewer && (
          <FileViewer file={fileViewer} onClose={() => setFileViewer(null)} />
        )}
      </AppErrorBoundary>

      {notice && <div className="upload-toast" role="status"><strong>Bricket Control</strong><span>{notice}</span></div>}
    </div>
    </WorkspaceDetailContext.Provider>
  );
}
