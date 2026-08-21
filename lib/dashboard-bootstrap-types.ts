type DemoModule = typeof import("../app/demo-data");
type JuneModule = typeof import("../app/june-report-data");
type AntonelyModule = typeof import("../app/antonely-finance-data");
type ProcurementModule = typeof import("../app/procurement-data");
type ReprogrammedFlowModule = typeof import("../app/reprogrammed-flow-data");
type FiduciaryModule = typeof import("../app/fiduciary-statements-data");
type GovernanceModule = typeof import("../app/data-governance");

type Widen<T> = T extends readonly (infer Item)[]
  ? Array<Widen<Item>>
  : T extends object
    ? { -readonly [Key in keyof T]: Widen<T[Key]> }
    : T;

export type DashboardBootstrapData = {
  demo: Widen<Pick<
    DemoModule,
    | "buildings"
    | "cubicacionCaratula"
    | "cubicaciones"
    | "projectCertifications"
    | "customMetrics"
    | "dataSources"
    | "monthlyPlan"
    | "projectSnapshot"
    | "suppliers"
    | "timeline"
    | "urbanismAreas"
    | "workPackages"
  >>;
  june: Widen<Pick<
    JuneModule,
    | "advances"
    | "antonelyFinanceSource"
    | "arrearsBreakdown"
    | "constructionDisciplines"
    | "costBreakdown"
    | "cxpAging"
    | "cxpCategories"
    | "delayedUrbanismStarts"
    | "financialProjection"
    | "discoveredSections"
    | "financingProcesses"
    | "juneDataQualityIssues"
    | "juneReport"
    | "managementActions"
    | "payablesReconciliation"
    | "permits"
    | "safetyFindingTracking"
    | "safetyFindings"
    | "safetyMetrics"
    | "safetyWeeklySeries"
    | "collectionTargets"
    | "commercialPartners"
    | "salesLocations"
    | "salesModels"
    | "structuralDelay"
    | "urbanismReportAreas"
  >>;
  antonely: Widen<Pick<
    AntonelyModule,
    | "antonelyAdvances"
    | "antonelyBalanceLines"
    | "antonelyCostAccounts"
    | "antonelyDetailTotals"
    | "antonelyPayableCategories"
    | "antonelyPayableVendorsAll"
  >>;
  procurement: Widen<Pick<
    ProcurementModule,
    | "ifcComplianceGroups"
    | "ifcComplianceTracking"
    | "juneDeviationSummary"
    | "monthlyDeviationLines"
    | "procurementAudit"
    | "procurementMonthlySchedule"
    | "procurementPackages"
    | "procurementQualityIssues"
    | "supplierComparisons"
    | "supplierContactAudit"
    | "supplierDirectory"
    | "typeABudgetChapters"
    | "typeABudgetSummary"
  >>;
  reprogrammedFlow: Widen<Pick<
    ReprogrammedFlowModule,
    | "reprogrammedFlowAudit"
    | "reprogrammedFlowMonths"
    | "reprogrammedFlowQualityIssues"
    | "reprogrammedFlowScopes"
  >>;
  fiduciary: Widen<Pick<
    FiduciaryModule,
    | "fiduciaryBalanceSections"
    | "fiduciaryManagementReconciliation"
    | "fiduciaryStatementQualityIssues"
    | "fiduciaryStatementSummary"
  >>;
  governance: Widen<Pick<
    GovernanceModule,
    | "dataAuthorityMatrix"
    | "dataGovernanceSummary"
    | "sourceGovernance"
  >>;
};
