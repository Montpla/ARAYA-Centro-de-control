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
  "juneDataQualityIssues",
  "juneReport",
  "managementActions",
  "monthlyPlan",
  "payablesReconciliation",
  "permits",
  "projectSnapshot",
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
const financialRootSet = new Set([
  "advances",
  "antonelyAdvances",
  "antonelyBalanceLines",
  "antonelyCostAccounts",
  "antonelyDetailTotals",
  "antonelyFinanceSource",
  "antonelyPayableCategories",
  "antonelyPayableVendorsAll",
  "costBreakdown",
  "cubicaciones",
  "cxpAging",
  "cxpCategories",
  "financialProjection",
  "financingProcesses",
  "payablesReconciliation",
]);
const keyPattern = /^[A-Za-z][A-Za-z0-9]*(?:\.(?:[A-Za-z][A-Za-z0-9]*|\d+))*$/;

export function isLiveDataKey(key: string) {
  if (!keyPattern.test(key)) return false;
  return liveRootSet.has(key.split(".")[0]);
}

export function isFinancialLiveKey(key: string) {
  const root = key.split(".")[0];
  if (financialRootSet.has(root)) return true;
  if (key === "juneReport.finance" || key.startsWith("juneReport.finance.")) return true;
  return /^projectSnapshot\.cubicaciones/.test(key);
}

export function redactFinancialFields(key: string, value: LiveDataValue) {
  if (isFinancialLiveKey(key)) return undefined;
  if (key === "juneReport" && value && typeof value === "object" && !Array.isArray(value)) {
    const next = cloneValue(value);
    delete (next as Record<string, LiveDataValue>).finance;
    return next;
  }
  if (key === "projectSnapshot" && value && typeof value === "object" && !Array.isArray(value)) {
    const next = cloneValue(value) as Record<string, LiveDataValue>;
    Object.keys(next).forEach((field) => {
      if (field.startsWith("cubicaciones")) delete next[field];
    });
    return next;
  }
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
    next.forEach((value, index) => {
      const current = target[index];
      if (
        current !== null &&
        value !== null &&
        typeof current === "object" &&
        typeof value === "object" &&
        Array.isArray(current) === Array.isArray(value)
      ) {
        replaceMutable(current, value);
      } else {
        target[index] = cloneValue(value);
      }
    });
    target.length = next.length;
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
    const next = materializeLiveRoot(root, target, values);
    replaceMutable(target, next);
  });
}
