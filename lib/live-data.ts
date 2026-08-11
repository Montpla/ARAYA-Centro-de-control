export type LiveDataValue =
  | null
  | boolean
  | number
  | string
  | LiveDataValue[]
  | { [key: string]: LiveDataValue };

export type LiveDataMap = Record<string, LiveDataValue>;

export type LiveDataUpdate = {
  key: string;
  value: LiveDataValue;
  area?: string;
  cutoff?: string;
  sourceCurrency?: "DOP" | "USD";
  sourceFileId?: string;
  sourceName?: string;
};

export const LIVE_DATA_ROOTS = [
  "advances",
  "antonelyAdvances",
  "antonelyBalanceLines",
  "antonelyCostAccounts",
  "antonelyDetailTotals",
  "antonelyFinanceSource",
  "antonelyPayableCategories",
  "antonelyPayableInvoiceLines",
  "antonelyPayableVendorsAll",
  "arrearsBreakdown",
  "buildings",
  "constructionDisciplines",
  "costBreakdown",
  "cubicaciones",
  "cxpAging",
  "cxpCategories",
  "dataSources",
  "delayedUrbanismStarts",
  "financialProjection",
  "financingProcesses",
  "fiduciaryBalanceSections",
  "fiduciaryManagementReconciliation",
  "fiduciaryStatementQualityIssues",
  "fiduciaryStatementSummary",
  "juneDataQualityIssues",
  "juneReport",
  "managementActions",
  "monthlyPlan",
  "payablesReconciliation",
  "permits",
  "projectSnapshot",
  "reprogrammedFlowAudit",
  "reprogrammedFlowMonths",
  "reprogrammedFlowQualityIssues",
  "reprogrammedFlowScopes",
  "safetyFindings",
  "safetyMetrics",
  "salesLocations",
  "salesModels",
  "structuralDelay",
  "timeline",
  "urbanismAreas",
  "urbanismReportAreas",
  "workPackages",
] as const;

const liveRootSet = new Set<string>(LIVE_DATA_ROOTS);
const financeProtectedAreas = new Set([
  "finanzas",
  "comercial",
  "ventas",
  "ventas_cobranza",
  "ventas-cobranza",
  "cobranza",
]);

/** Canonical values used when a database query must enforce area privacy. */
export function financeProtectedAreaValues() {
  return [...financeProtectedAreas];
}
const financeProtectedDocumentTypes = new Set([
  "clasificacion_pendiente",
  "estado_financiero",
  "ventas_cobranza",
]);

/** Canonical values used when a database query must enforce document privacy. */
export function financeProtectedDocumentTypeValues() {
  return [...financeProtectedDocumentTypes];
}
const financialRootSet = new Set([
  "advances",
  "antonelyAdvances",
  "antonelyBalanceLines",
  "antonelyCostAccounts",
  "antonelyDetailTotals",
  "antonelyFinanceSource",
  "antonelyPayableCategories",
  "antonelyPayableInvoiceLines",
  "antonelyPayableVendorsAll",
  "costBreakdown",
  "cubicaciones",
  "cxpAging",
  "cxpCategories",
  "financialProjection",
  "financingProcesses",
  "fiduciaryBalanceSections",
  "fiduciaryManagementReconciliation",
  "fiduciaryStatementQualityIssues",
  "fiduciaryStatementSummary",
  "payablesReconciliation",
  "reprogrammedFlowAudit",
  "reprogrammedFlowMonths",
  "reprogrammedFlowQualityIssues",
  "reprogrammedFlowScopes",
]);
const commercialRootSet = new Set([
  "arrearsBreakdown",
  "salesLocations",
  "salesModels",
]);
const mixedProtectedSourceIds = new Set([
  "source-xls",
  "source-june-consolidated",
  "source-june-pdf",
]);
const keyPattern = /^[A-Za-z][A-Za-z0-9]*(?:\.(?:[A-Za-z][A-Za-z0-9]*|\d+))*$/;
const forbiddenPathSegments = new Set(["__proto__", "constructor", "prototype"]);

export function isLiveDataKey(key: string) {
  if (!keyPattern.test(key)) return false;
  const segments = key.split(".");
  return liveRootSet.has(segments[0]) &&
    !segments.some((segment) => forbiddenPathSegments.has(segment));
}

export function isFinancialLiveKey(key: string) {
  const root = key.split(".")[0];
  if (financialRootSet.has(root) || isCommercialLiveKey(key)) return true;
  if (key === "juneReport" || key === "dataSources" || key === "juneDataQualityIssues") return true;
  if (key === "juneReport.finance" || key.startsWith("juneReport.finance.")) return true;
  return key === "projectSnapshot" ||
    /^projectSnapshot\.(?:cubicaciones|dataSources|metrics|suppliers)(?:\.|$)/.test(key);
}

export function isCommercialLiveKey(key: string) {
  const root = key.split(".")[0];
  return commercialRootSet.has(root) ||
    /^juneReport\.(?:sales|contracts|collections)(?:\.|$)/.test(key);
}

/** Finanzas and Ventas y cobranza share the same explicit authorization. */
export function requiresFinanceAccessForArea(area: string | null | undefined) {
  return financeProtectedAreas.has(String(area ?? "").trim().toLowerCase());
}

/**
 * Files remain fail-closed while their contents are being classified. This is
 * deliberately shared by every server boundary so a provisional upload cannot
 * briefly appear in lists, previews, activity or agent results.
 */
export function requiresFinanceAccessForDocument(
  area: string | null | undefined,
  documentType: string | null | undefined,
) {
  return requiresFinanceAccessForArea(area) ||
    financeProtectedDocumentTypes.has(String(documentType ?? "").trim().toLowerCase());
}

function containsFinanceOrCommercialTerms(value: unknown) {
  return /financ|fideicomiso|balance|resultado|flujo|cxp|antonely|presupuesto|desviaci[oó]n|pr[eé]stamo|ifc|comercial|ventas?|reservas?|cobranza|morosidad|desistimiento|cuentas por pagar|costes?|anticipos?|cubicaci[oó]n|comparativ|ofertas?|compras?/i.test(String(value ?? ""));
}

function redactDataSourceArray(value: LiveDataValue) {
  if (!Array.isArray(value)) return value;
  return value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    const source = item as Record<string, LiveDataValue>;
    return !mixedProtectedSourceIds.has(String(source.id ?? "")) &&
      !containsFinanceOrCommercialTerms(JSON.stringify(source));
  });
}

function redactSupplierFinancialFields(value: LiveDataValue): LiveDataValue {
  if (Array.isArray(value)) {
    return value.map((item) => redactSupplierFinancialFields(item));
  }
  if (!value || typeof value !== "object") return value;
  const supplier = cloneValue(value) as Record<string, LiveDataValue>;
  delete supplier.amount;
  return supplier;
}

export function redactFinancialFields(key: string, value: LiveDataValue) {
  if (key === "juneReport" && value && typeof value === "object" && !Array.isArray(value)) {
    const next = cloneValue(value);
    const record = next as Record<string, LiveDataValue>;
    delete record.finance;
    delete record.sales;
    delete record.contracts;
    delete record.collections;
    return next;
  }
  if (key === "projectSnapshot" && value && typeof value === "object" && !Array.isArray(value)) {
    const next = cloneValue(value) as Record<string, LiveDataValue>;
    Object.keys(next).forEach((field) => {
      if (field.startsWith("cubicaciones")) delete next[field];
    });
    if (Array.isArray(next.metrics)) {
      next.metrics = next.metrics.filter((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return true;
        const metric = item as Record<string, LiveDataValue>;
        return !containsFinanceOrCommercialTerms(`${metric.name ?? ""} ${metric.owner ?? ""} ${metric.unit ?? ""}`);
      });
    }
    if (next.suppliers) next.suppliers = redactSupplierFinancialFields(next.suppliers);
    if (next.dataSources) next.dataSources = redactDataSourceArray(next.dataSources);
    return next;
  }
  if (key === "projectSnapshot.suppliers" || /^projectSnapshot\.suppliers\.\d+$/.test(key)) {
    return redactSupplierFinancialFields(value);
  }
  if (/^projectSnapshot\.suppliers(?:\.\d+)?\.amount(?:\.|$)/.test(key)) {
    return undefined;
  }
  if (key === "dataSources" && Array.isArray(value)) {
    return redactDataSourceArray(value);
  }
  if (key === "juneDataQualityIssues" && Array.isArray(value)) {
    return value.filter((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return true;
      const issue = item as Record<string, LiveDataValue>;
      return !containsFinanceOrCommercialTerms(JSON.stringify(issue));
    });
  }
  if (isFinancialLiveKey(key)) return undefined;
  return value;
}

export function liveValueType(value: LiveDataValue) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function denseOwnArrayValues(value: unknown[]) {
  const dense: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (Object.prototype.hasOwnProperty.call(value, index)) dense.push(value[index]);
  }
  return dense;
}

export function compactLiveEntities<T extends object>(value: Array<T | null | undefined>) {
  return denseOwnArrayValues(value).filter(
    (item): item is T => Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function stableArrayIdentity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["id", "code", "unitId", "apartmentId", "buildingId"]) {
    if (typeof record[key] === "string" && record[key]) return `${key}:${record[key]}`;
  }
  return "";
}

function setPath(target: unknown, path: string[], value: LiveDataValue) {
  if (!path.length || target === null || typeof target !== "object") return;
  let cursor = target as Record<string, unknown> | unknown[];
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];
    const key = Array.isArray(cursor) ? Number(segment) : segment;
    const current = (cursor as Record<string | number, unknown>)[key];
    if (current === null || typeof current !== "object") {
      (cursor as Record<string | number, unknown>)[key] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    cursor = (cursor as Record<string | number, unknown>)[key] as Record<string, unknown> | unknown[];
  }
  const finalSegment = path[path.length - 1];
  const finalKey = Array.isArray(cursor) ? Number(finalSegment) : finalSegment;
  (cursor as Record<string | number, unknown>)[finalKey] = cloneValue(value);
}

export function materializeLiveRoot<T>(
  root: string,
  fallback: T,
  values: LiveDataMap,
): T {
  let result = cloneValue(fallback);
  if (Object.prototype.hasOwnProperty.call(values, root)) {
    result = cloneValue(values[root]) as T;
  }
  const prefix = `${root}.`;
  Object.entries(values)
    .filter(([key]) => key.startsWith(prefix))
    .sort(([a], [b]) => a.split(".").length - b.split(".").length)
    .forEach(([key, value]) => setPath(result, key.slice(prefix.length).split("."), value));
  return result;
}

function replaceMutable(target: unknown, next: unknown) {
  if (Array.isArray(target) && Array.isArray(next)) {
    const nextValues = denseOwnArrayValues(next);
    const nextIdentities = nextValues.map(stableArrayIdentity);
    const identityAware = nextIdentities.length > 0 &&
      nextIdentities.every(Boolean) &&
      new Set(nextIdentities).size === nextIdentities.length;
    const existingByIdentity = new Map<string, unknown>();
    if (identityAware) {
      for (const value of target) {
        const identity = stableArrayIdentity(value);
        if (identity) existingByIdentity.set(identity, value);
      }
    }
    const reconciled = nextValues.map((value, index) => {
      const identity = nextIdentities[index];
      const current = identityAware
        ? existingByIdentity.get(identity)
        : target[index];
      if (
        current !== null &&
        current !== undefined &&
        value !== null &&
        typeof current === "object" &&
        typeof value === "object" &&
        Array.isArray(current) === Array.isArray(value)
      ) {
        replaceMutable(current, value);
        return current;
      }
      return cloneValue(value);
    });
    target.splice(0, target.length, ...reconciled);
    return;
  }
  if (
    target !== null &&
    next !== null &&
    typeof target === "object" &&
    typeof next === "object" &&
    !Array.isArray(target) &&
    !Array.isArray(next)
  ) {
    const mutableTarget = target as Record<string, unknown>;
    const nextObject = next as Record<string, unknown>;
    Object.keys(mutableTarget).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(nextObject, key)) delete mutableTarget[key];
    });
    Object.entries(nextObject).forEach(([key, value]) => {
      const current = mutableTarget[key];
      if (
        current !== null &&
        value !== null &&
        typeof current === "object" &&
        typeof value === "object" &&
        Array.isArray(current) === Array.isArray(value)
      ) {
        replaceMutable(current, value);
      } else {
        mutableTarget[key] = cloneValue(value);
      }
    });
  }
}

export function applyLiveValuesToTargets(
  values: LiveDataMap,
  targets: Record<string, unknown>,
) {
  Object.entries(targets).forEach(([root, target]) => {
    if ((typeof target !== "object" && typeof target !== "function") || target === null) return;
    let baseline = liveTargetBaselines.get(target as object);
    if (baseline === undefined) {
      baseline = cloneValue(target);
      liveTargetBaselines.set(target as object, baseline);
    }
    const next = materializeLiveRoot(root, baseline, values);
    replaceMutable(target, next);
  });
}

const liveTargetBaselines = new WeakMap<object, unknown>();
