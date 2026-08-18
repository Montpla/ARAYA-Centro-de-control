import "server-only";

import * as demo from "../app/demo-data";
import * as june from "../app/june-report-data";
import * as antonely from "../app/antonely-finance-data";
import * as procurement from "../app/procurement-data";
import * as reprogrammedFlow from "../app/reprogrammed-flow-data";
import * as fiduciary from "../app/fiduciary-statements-data";
import * as governance from "../app/data-governance";
import type { DashboardBootstrapData } from "./dashboard-bootstrap-types";

const financeSourcePattern =
  /financ|fideicomiso|balance|resultado|flujo|cxp|antonely|presupuesto|desviaci[oó]n|pr[eé]stamo|ifc|comercial|ventas?|reservas?|cobranza|morosidad|desistimiento|cubicaci[oó]n|comparativ|ofertas?|compras?/i;

const mixedFinanceSourceIds = new Set([
  "source-xls",
  "source-june-consolidated",
  "source-june-pdf",
]);

function emptyShape<T>(value: T): T {
  if (Array.isArray(value)) return [] as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, emptyShape(nested)]),
    ) as T;
  }
  if (typeof value === "number") return 0 as T;
  if (typeof value === "boolean") return false as T;
  return "" as T;
}

function demoData(financeAccess: boolean) {
  const visibleSources = financeAccess
    ? demo.dataSources
    : demo.dataSources.filter((source) =>
        !mixedFinanceSourceIds.has(source.id) &&
        !financeSourcePattern.test(`${source.kind} ${source.file}`),
      );

  return {
    buildings: demo.buildings,
    cubicacionCaratula: financeAccess ? demo.cubicacionCaratula : [],
    cubicaciones: financeAccess ? demo.cubicaciones : [],
    projectCertifications: demo.projectCertifications,
    customMetrics: financeAccess ? demo.customMetrics : [],
    dataSources: visibleSources,
    monthlyPlan: demo.monthlyPlan,
    projectSnapshot: financeAccess
      ? demo.projectSnapshot
      : {
          ...demo.projectSnapshot,
          cubicacionesMeasured: 0,
          cubicacionesAccounting: 0,
          cubicacionesDifference: 0,
          currency: "",
          suppliers: [],
          metrics: [],
          dataSources: visibleSources,
        },
    suppliers: financeAccess ? demo.suppliers : [],
    timeline: demo.timeline,
    urbanismAreas: demo.urbanismAreas,
    workPackages: demo.workPackages,
  };
}

function juneData(financeAccess: boolean) {
  return {
    advances: financeAccess ? june.advances : [],
    antonelyFinanceSource: financeAccess
      ? june.antonelyFinanceSource
      : emptyShape(june.antonelyFinanceSource),
    arrearsBreakdown: financeAccess ? june.arrearsBreakdown : [],
    constructionDisciplines: june.constructionDisciplines,
    costBreakdown: financeAccess ? june.costBreakdown : [],
    cxpAging: financeAccess ? june.cxpAging : [],
    cxpCategories: financeAccess ? june.cxpCategories : [],
    delayedUrbanismStarts: june.delayedUrbanismStarts,
    discoveredSections: financeAccess ? june.discoveredSections : [],
    financialProjection: financeAccess ? june.financialProjection : [],
    financingProcesses: financeAccess ? june.financingProcesses : [],
    juneDataQualityIssues: financeAccess ? june.juneDataQualityIssues : [],
    juneReport: financeAccess
      ? june.juneReport
      : {
          ...june.juneReport,
          sales: emptyShape(june.juneReport.sales),
          contracts: emptyShape(june.juneReport.contracts),
          collections: emptyShape(june.juneReport.collections),
          finance: emptyShape(june.juneReport.finance),
        },
    managementActions: june.managementActions,
    payablesReconciliation: financeAccess ? june.payablesReconciliation : [],
    permits: june.permits,
    safetyFindingTracking: june.safetyFindingTracking,
    safetyFindings: june.safetyFindings,
    safetyMetrics: june.safetyMetrics,
    collectionTargets: financeAccess ? june.collectionTargets : [],
    commercialPartners: financeAccess ? june.commercialPartners : [],
    salesLocations: financeAccess ? june.salesLocations : [],
    salesModels: financeAccess ? june.salesModels : [],
    structuralDelay: june.structuralDelay,
    urbanismReportAreas: june.urbanismReportAreas,
  };
}

export function buildDashboardBootstrap(financeAccess: boolean): DashboardBootstrapData {
  const demoPayload = demoData(financeAccess);
  const visibleSourceIds = new Set(demoPayload.dataSources.map((source) => source.id));
  const visibleGovernance = Object.fromEntries(
    Object.entries(governance.sourceGovernance).filter(([sourceId]) =>
      financeAccess || visibleSourceIds.has(sourceId),
    ),
  );
  const visibleAuthorityMatrix = financeAccess
    ? governance.dataAuthorityMatrix
    : governance.dataAuthorityMatrix
        .filter((item) => visibleSourceIds.has(item.primarySourceId))
        .map((item) => ({
          ...item,
          supportSourceIds: item.supportSourceIds.filter((sourceId) => visibleSourceIds.has(sourceId)),
        }));

  const payload = {
    demo: demoPayload,
    june: juneData(financeAccess),
    antonely: financeAccess
      ? {
          antonelyAdvances: antonely.antonelyAdvances,
          antonelyBalanceLines: antonely.antonelyBalanceLines,
          antonelyCostAccounts: antonely.antonelyCostAccounts,
          antonelyDetailTotals: antonely.antonelyDetailTotals,
          antonelyPayableCategories: antonely.antonelyPayableCategories,
          antonelyPayableVendorsAll: antonely.antonelyPayableVendorsAll,
        }
      : {
          antonelyAdvances: [],
          antonelyBalanceLines: [],
          antonelyCostAccounts: [],
          antonelyDetailTotals: emptyShape(antonely.antonelyDetailTotals),
          antonelyPayableCategories: [],
          antonelyPayableVendorsAll: [],
        },
    procurement: financeAccess
      ? {
          ifcComplianceGroups: procurement.ifcComplianceGroups,
          ifcComplianceTracking: procurement.ifcComplianceTracking,
          juneDeviationSummary: procurement.juneDeviationSummary,
          monthlyDeviationLines: procurement.monthlyDeviationLines,
          procurementAudit: procurement.procurementAudit,
          procurementMonthlySchedule: procurement.procurementMonthlySchedule,
          procurementPackages: procurement.procurementPackages,
          procurementQualityIssues: procurement.procurementQualityIssues,
          supplierComparisons: procurement.supplierComparisons,
          supplierContactAudit: procurement.supplierContactAudit,
          supplierDirectory: procurement.supplierDirectory,
          typeABudgetChapters: procurement.typeABudgetChapters,
          typeABudgetSummary: procurement.typeABudgetSummary,
        }
      : {
          ifcComplianceGroups: [],
          juneDeviationSummary: emptyShape(procurement.juneDeviationSummary),
          monthlyDeviationLines: [],
          procurementAudit: emptyShape(procurement.procurementAudit),
          procurementMonthlySchedule: [],
          procurementPackages: [],
          procurementQualityIssues: [],
          supplierComparisons: [],
          supplierContactAudit: {
            ...procurement.supplierContactAudit,
            creditRelationships: 0,
            cashRelationships: 0,
            pendingNegotiation: 0,
            creditLimitDop: 0,
          },
          supplierDirectory: procurement.supplierDirectory.map((supplier) => ({
            ...supplier,
            relationships: [],
            creditTerms: [],
            creditLimitDop: 0,
          })),
          typeABudgetChapters: [],
          typeABudgetSummary: emptyShape(procurement.typeABudgetSummary),
        },
    reprogrammedFlow: financeAccess
      ? {
          reprogrammedFlowAudit: reprogrammedFlow.reprogrammedFlowAudit,
          reprogrammedFlowMonths: reprogrammedFlow.reprogrammedFlowMonths,
          reprogrammedFlowQualityIssues: reprogrammedFlow.reprogrammedFlowQualityIssues,
          reprogrammedFlowScopes: reprogrammedFlow.reprogrammedFlowScopes,
        }
      : {
          reprogrammedFlowAudit: emptyShape(reprogrammedFlow.reprogrammedFlowAudit),
          reprogrammedFlowMonths: [],
          reprogrammedFlowQualityIssues: [],
          reprogrammedFlowScopes: [],
        },
    fiduciary: financeAccess
      ? {
          fiduciaryBalanceSections: fiduciary.fiduciaryBalanceSections,
          fiduciaryManagementReconciliation: fiduciary.fiduciaryManagementReconciliation,
          fiduciaryStatementQualityIssues: fiduciary.fiduciaryStatementQualityIssues,
          fiduciaryStatementSummary: fiduciary.fiduciaryStatementSummary,
        }
      : {
          fiduciaryBalanceSections: [],
          fiduciaryManagementReconciliation: [],
          fiduciaryStatementQualityIssues: [],
          fiduciaryStatementSummary: emptyShape(fiduciary.fiduciaryStatementSummary),
        },
    governance: financeAccess
      ? {
          dataAuthorityMatrix: governance.dataAuthorityMatrix,
          dataGovernanceSummary: governance.dataGovernanceSummary,
          sourceGovernance: governance.sourceGovernance,
        }
      : {
          dataAuthorityMatrix: visibleAuthorityMatrix,
          dataGovernanceSummary: {
            registeredSources: Object.keys(visibleGovernance).length,
            governedMetrics: visibleAuthorityMatrix.length,
            reconciledMetrics: visibleAuthorityMatrix.filter((item) => item.status === "conciliado").length,
            separatedMetrics: visibleAuthorityMatrix.filter((item) => item.status === "separado").length,
            observedMetrics: visibleAuthorityMatrix.filter((item) => item.status === "observado").length,
          },
          sourceGovernance: visibleGovernance,
        },
  };
  return payload as unknown as DashboardBootstrapData;
}
