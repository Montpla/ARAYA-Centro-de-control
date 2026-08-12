import {
  Building,
  UrbanismArea,
  buildings,
  monthlyPlan,
  projectSnapshot,
  urbanismAreas,
  workPackages,
} from "../app/demo-data";
import {
  constructionDisciplines,
  cxpAging,
  delayedUrbanismStarts,
  juneDataQualityIssues,
  juneReport,
  managementActions,
  payablesReconciliation,
  permits,
  safetyMetrics,
  salesLocations,
  salesModels,
  structuralDelay,
  urbanismReportAreas,
} from "../app/june-report-data";
import { antonelyDetailTotals } from "../app/antonely-finance-data";
import { procurementQualityIssues } from "../app/procurement-data";
import { reprogrammedFlowQualityIssues } from "../app/reprogrammed-flow-data";
import { fiduciaryStatementQualityIssues, fiduciaryStatementSummary } from "../app/fiduciary-statements-data";

export const CONTROL_ROOM_VERSION = "araya-control-room-v1";

type ProjectControlSnapshot = typeof projectSnapshot;
type MonthlyPlan = typeof monthlyPlan;
type JuneReport = typeof juneReport;

export type ControlFinding = {
  id: string;
  area: string;
  severity: "critical" | "medium" | "low";
  title: string;
  detail: string;
  view: string;
  source: string;
  restricted: boolean;
};

function validCoordinate(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function buildingHasValidCoordinates(building: Building) {
  const coordinates = building.mapCoordinates;
  return Boolean(
    coordinates &&
      validCoordinate(coordinates.visual.x) &&
      validCoordinate(coordinates.visual.y) &&
      validCoordinate(coordinates.technical.x) &&
      validCoordinate(coordinates.technical.y),
  );
}

function urbanismHasValidCoordinates(area: UrbanismArea) {
  const coordinates = area.mapCoordinates;
  return Boolean(
    coordinates &&
      validCoordinate(coordinates.visual.x) &&
      validCoordinate(coordinates.visual.y) &&
      validCoordinate(coordinates.technical.x) &&
      validCoordinate(coordinates.technical.y),
  );
}

function severity(value: string | undefined): ControlFinding["severity"] {
  if (value === "critical") return "critical";
  if (value === "info") return "low";
  return "medium";
}

function potentiallyFinancial(text: string) {
  return /rd\$|dop|presupuesto|cuentas por pagar|coste|anticipo|balance|financ|fideicomiso|inter[eé]s|flujo/i.test(
    text,
  );
}

function findingsFor(
  prefix: string,
  area: string,
  view: string,
  source: string,
  rows: ReadonlyArray<{ title: string; detail: string; severity?: string }>,
  canAccessFinance: boolean,
) {
  return rows.map((row, index): ControlFinding => {
    const restricted = !canAccessFinance && potentiallyFinancial(`${row.title} ${row.detail}`);
    return {
      id: `${prefix}-${index + 1}`,
      area,
      severity: severity(row.severity),
      title: row.title,
      detail: restricted
        ? "La incidencia está registrada. El detalle económico requiere permiso de Finanzas."
        : row.detail,
      view,
      source,
      restricted,
    };
  });
}

export function buildControlRoomBaseline(
  canAccessFinance: boolean,
  currentProject: ProjectControlSnapshot = projectSnapshot,
  currentPlan: MonthlyPlan = monthlyPlan,
) {
  const currentBuildings = (currentProject.buildings ?? buildings) as Building[];
  const currentUrbanism = (currentProject.urbanismAreas ?? urbanismAreas) as UrbanismArea[];
  const currentPackages = currentProject.workPackages ?? workPackages;
  const mappedBuildings = currentBuildings.filter(buildingHasValidCoordinates);
  const mappedUrbanism = currentUrbanism.filter(urbanismHasValidCoordinates);
  const units = currentBuildings.flatMap((building) => building.units);
  const unitCodes = units.map((unit) => unit.code);
  const duplicateUnitCodes = [...new Set(unitCodes.filter((code, index) => unitCodes.indexOf(code) !== index))];
  const unitsWithAllDisciplines = units.filter(
    (unit) =>
      unit.disciplines?.length === 4 &&
      unit.disciplines.every((discipline) => discipline.progress !== null),
  ).length;
  const unitsWithResponsible = units.filter((unit) => Boolean(unit.responsible?.trim())).length;
  const unitsWithOpenIssues = units.filter((unit) =>
    unit.issues?.some((issue) => issue.status === "abierta"),
  ).length;
  const lastActual = [...currentPlan].reverse().find((point) => point.actual !== null) ?? null;
  const delayedPackages = currentPackages.filter((item) => item.deviationDays > 0);
  const criticalPackages = currentPackages.filter((item) => item.critical);
  const maxDeviationDays = delayedPackages.reduce(
    (maximum, item) => Math.max(maximum, item.deviationDays),
    0,
  );

  const reconciliations = [
    ...findingsFor(
      "june",
      "direccion",
      "fuentes",
      "Consolidado y Excel de junio de 2026",
      juneDataQualityIssues,
      canAccessFinance,
    ),
    ...findingsFor(
      "procurement",
      "compras",
      "proveedores",
      "Comparativos y control de proveedores",
      procurementQualityIssues,
      canAccessFinance,
    ),
    ...findingsFor(
      "reprogrammed-flow",
      "planificacion",
      "planificacion",
      "Flujo de obra Fase I reprogramado",
      reprogrammedFlowQualityIssues,
      canAccessFinance,
    ),
    ...(canAccessFinance
      ? findingsFor(
          "fiduciary",
          "finanzas",
          "metricas",
          "Estados oficiales de Fiduciaria Universal",
          fiduciaryStatementQualityIssues,
          true,
        )
      : []),
  ];

  return {
    version: CONTROL_ROOM_VERSION,
    cutoff: currentProject.declaredCutoff,
    spatial: {
      masterPlanBuildings: currentProject.masterPlanBuildingCount,
      integratedBuildings: currentBuildings.length,
      pendingBuildings: Math.max(0, currentProject.masterPlanBuildingCount - currentBuildings.length),
      mappedBuildings: mappedBuildings.length,
      invalidBuildingCoordinates: currentBuildings.length - mappedBuildings.length,
      apartments: units.length,
      duplicateApartmentCodes: duplicateUnitCodes,
      apartmentsWithAllDisciplines: unitsWithAllDisciplines,
      apartmentsWithResponsible: unitsWithResponsible,
      apartmentsWithOpenIssues: unitsWithOpenIssues,
      urbanismAreas: currentUrbanism.length,
      mappedUrbanismAreas: mappedUrbanism.length,
      pendingUrbanismFields: currentUrbanism.reduce(
        (total, area) => total + area.pendingFields.length,
        0,
      ),
    },
    planning: {
      physicalActual: currentProject.overallProgress,
      kpiPlan: currentProject.plannedProgress,
      kpiDeviationPoints: currentProject.deviationPoints,
      curvePlanAtCutoff: lastActual?.planned ?? null,
      curveActualAtCutoff: lastActual?.actual ?? null,
      curveCutoffLabel: lastActual?.month ?? "",
      baselineFinish: currentProject.baselineFinish,
      forecastFinish: currentProject.forecastFinish,
      forecastDeviationDays: currentProject.deviationDays,
      delayedPackages: delayedPackages.length,
      criticalPackages: criticalPackages.length,
      maxPackageDeviationDays: maxDeviationDays,
    },
    reconciliations,
    reconciliationSummary: {
      total: reconciliations.length,
      critical: reconciliations.filter((item) => item.severity === "critical").length,
      restricted: reconciliations.filter((item) => item.restricted).length,
    },
  };
}

export function buildReportSnapshot(
  canAccessFinance: boolean,
  currentProject: ProjectControlSnapshot,
  currentPlan: MonthlyPlan,
  liveRevision: number,
  currentJuneReport: JuneReport = juneReport,
  live: {
    cxpAging?: typeof cxpAging;
    payablesReconciliation?: readonly (typeof payablesReconciliation)[number][];
    fiduciaryBalance?: typeof fiduciaryStatementSummary.balance;
    antonelyDetailTotals?: typeof antonelyDetailTotals;
    salesModels?: typeof salesModels;
    salesLocations?: typeof salesLocations;
  } = {},
) {
  const baseline = buildControlRoomBaseline(canAccessFinance, currentProject, currentPlan);
  return {
    version: CONTROL_ROOM_VERSION,
    generatedAt: new Date().toISOString(),
    liveRevision,
    cutoff: currentProject.declaredCutoff,
    executive: {
      physicalActual: currentProject.overallProgress,
      kpiPlan: currentProject.plannedProgress,
      deviationPoints: currentProject.deviationPoints,
      baselineFinish: currentProject.baselineFinish,
      forecastFinish: currentProject.forecastFinish,
      forecastDeviationDays: currentProject.deviationDays,
      integratedBuildings: currentProject.buildingCount,
      apartments: currentProject.unitCount,
      urbanismActual: currentProject.urbanismProgress,
      urbanismPlan: currentProject.urbanismPlanned,
    },
    monthlyPlan: currentPlan,
    production: {
      constructionDisciplines,
      structuralDelay,
      urbanismReportAreas,
      delayedUrbanismStarts,
      workPackages: currentProject.workPackages,
    },
    commercial: canAccessFinance ? {
      sales: currentJuneReport.sales,
      collections: currentJuneReport.collections,
      salesModels: live.salesModels ?? salesModels,
      salesLocations: live.salesLocations ?? salesLocations,
    } : null,
    finance: canAccessFinance ? {
      ...currentJuneReport.finance,
      cxpAging: live.cxpAging ?? cxpAging,
      payablesReconciliation: live.payablesReconciliation ?? payablesReconciliation,
      fiduciaryBalance: live.fiduciaryBalance ?? fiduciaryStatementSummary.balance,
      advancesGrantedDop: (live.antonelyDetailTotals ?? antonelyDetailTotals).advanceGrantedDop,
      advancesCount: (live.antonelyDetailTotals ?? antonelyDetailTotals).advanceCount,
    } : null,
    safety: {
      metrics: safetyMetrics,
      permits,
    },
    managementActions,
    spatial: baseline.spatial,
    planning: baseline.planning,
    reconciliationSummary: baseline.reconciliationSummary,
    financeIncluded: canAccessFinance,
    rule:
      "Instantánea inmutable del último corte validado. No interpola avances entre fechas ni sustituye las fuentes.",
  };
}
