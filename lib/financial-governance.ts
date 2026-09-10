import { FX_RATE_CUTOFF, USD_TO_DOP } from "./currency";
import {
  isCommercialLiveKey,
  isFinancialLiveKey,
  materializeLiveRoot,
  type LiveDataMap,
  type LiveDataValue,
} from "./live-data";

export type FinancialUpdateLike = {
  key: string;
  valueJson: string;
  valueType: string;
  area: string;
  cutoff: string;
  sourceCurrency: "DOP" | "USD";
  sourceFileId: string;
  sourceName: string;
};

export type FinancialCurrentPoint = {
  key: string;
  valueJson: string;
  sourceName: string;
  sourceCurrency: string;
  cutoff: string;
};

export type FinancialCheckStatus = "passed" | "warning" | "blocked";

export type FinancialCheck = {
  id: string;
  label: string;
  status: FinancialCheckStatus;
  actual: number | null;
  expected: number | null;
  difference: number | null;
  tolerance: number | null;
  keys: string[];
  message: string;
};

export type FinancialAuthorityDecision = {
  key: string;
  status: "accepted" | "newer_period" | "same_authority" | "stale" | "lower_authority";
  incomingSource: string;
  currentSource: string;
  incomingRank: number;
  currentRank: number;
  incomingCutoff: string;
  currentCutoff: string;
  message: string;
};

export type MonetaryAuditEntry = {
  key: string;
  sourceCurrency: "DOP" | "USD";
  canonicalCurrencies: Array<"DOP" | "USD">;
  sourceValueJson: string;
  canonicalValueJson: string;
  convertedFieldCount: number;
  usdToDop: number;
  rateCutoff: string;
};

export type FinancialValidationResult = {
  status: "not_applicable" | "passed" | "passed_with_warnings" | "blocked";
  checks: FinancialCheck[];
  authority: FinancialAuthorityDecision[];
  blockingKeys: string[];
  warnings: string[];
  affectedViews: string[];
  monetaryAudit: MonetaryAuditEntry[];
};

const DOP_FIELD_NAMES = new Set([
  "accounting",
  "actualperiod",
  "actualtocutoff",
  "advancegranted",
  "advancepending",
  "amount",
  "budget",
  "buildings",
  "costs",
  "creditlimit",
  "cumulative",
  "current",
  "debit",
  "difference",
  "executed",
  "expenses",
  "granted",
  "grossEquity".toLowerCase(),
  "income",
  "june",
  "liquidity",
  "management",
  "may",
  "measured",
  "month1",
  "month2",
  "month3",
  "net",
  "official",
  "older",
  "original",
  "payables",
  "pending",
  "prioractual",
  "projectbudget",
  "remaining",
  "remainingforecast",
  "total",
  "under1",
  "urbanism",
  "variance",
]);

const DOP_GENERIC_ROOTS = new Set([
  "antonelyAdvances",
  "antonelyBalanceLines",
  "antonelyCostAccounts",
  "antonelyDetailTotals",
  "antonelyPayableCategories",
  "antonelyPayableInvoiceLines",
  "antonelyPayableVendorsAll",
  "costBreakdown",
  "cubicaciones",
  "cxpAging",
  "cxpCategories",
  "financialProjection",
  "fiduciaryBalanceSections",
  "fiduciaryManagementReconciliation",
  "fiduciaryStatementSummary",
  "financingProcesses",
  "monthlyDeviationLines",
  "payablesReconciliation",
  "procurementMonthlySchedule",
  "procurementPackages",
  "reprogrammedFlowAudit",
  "reprogrammedFlowMonths",
  "reprogrammedFlowScopes",
  "typeABudgetChapters",
]);

const VIEW_GROUPS: Array<{ roots: Set<string>; views: string[] }> = [
  {
    roots: new Set([
      "fiduciaryBalanceSections",
      "fiduciaryManagementReconciliation",
      "fiduciaryStatementQualityIssues",
      "fiduciaryStatementSummary",
    ]),
    views: ["Resumen ejecutivo", "Finanzas", "Fideicomiso", "Informes"],
  },
  {
    roots: new Set([
      "antonelyBalanceLines",
      "antonelyDetailTotals",
      "antonelyPayableCategories",
      "antonelyPayableInvoiceLines",
      "antonelyPayableVendorsAll",
      "cxpAging",
      "cxpCategories",
      "payablesReconciliation",
    ]),
    views: ["Resumen ejecutivo", "Finanzas", "Proveedores", "Informes"],
  },
  {
    roots: new Set([
      "cubicaciones",
      "cubicacionCaratula",
      "costBreakdown",
      "monthlyDeviationLines",
      "reprogrammedFlowAudit",
      "reprogrammedFlowMonths",
      "reprogrammedFlowQualityIssues",
      "reprogrammedFlowScopes",
      "typeABudgetChapters",
    ]),
    views: ["Resumen ejecutivo", "Obra", "Planificación", "Finanzas", "Informes"],
  },
  {
    roots: new Set([
      "arrearsBreakdown",
      "collectionTargets",
      "commercialPartners",
      "salesLocations",
      "salesModels",
    ]),
    views: ["Resumen ejecutivo", "Ventas y cobranza", "Finanzas", "Informes"],
  },
];

function rootOf(key: string) {
  return key.split(".")[0] ?? key;
}

function parseJson(valueJson: string): LiveDataValue | undefined {
  try {
    return JSON.parse(valueJson) as LiveDataValue;
  } catch {
    return undefined;
  }
}

function normalizedToken(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function canonicalCurrencyForPath(root: string, path: string[]): "DOP" | "USD" | null {
  const field = normalizedToken(path.at(-1) ?? root).replace(/[^a-z0-9]/g, "");
  if (field.endsWith("usd")) return "USD";
  if (field.endsWith("dop")) return "DOP";
  if (DOP_GENERIC_ROOTS.has(root) && DOP_FIELD_NAMES.has(field)) return "DOP";
  return null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function convertMonetaryValue(
  value: LiveDataValue,
  root: string,
  path: string[],
  sourceCurrency: "DOP" | "USD",
  audit: { converted: number; currencies: Set<"DOP" | "USD"> },
): LiveDataValue {
  if (typeof value === "number") {
    const canonical = canonicalCurrencyForPath(root, path);
    if (!canonical) return value;
    audit.currencies.add(canonical);
    if (canonical === sourceCurrency) return value;
    audit.converted += 1;
    return canonical === "DOP"
      ? roundMoney(value * USD_TO_DOP)
      : roundMoney(value / USD_TO_DOP);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => convertMonetaryValue(
      item,
      root,
      [...path, String(index)],
      sourceCurrency,
      audit,
    ));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      convertMonetaryValue(item, root, [...path, key], sourceCurrency, audit),
    ]));
  }
  return value;
}

/**
 * El modelo vivo conserva las unidades declaradas por sus claves (`...Dop` y
 * `...Usd`). Esta función normaliza un archivo extranjero antes de compararlo o
 * publicarlo y guarda el valor original para auditoría; no cambia porcentajes,
 * cantidades ni identificadores.
 */
export function canonicalizeFinancialUpdates<T extends FinancialUpdateLike>(updates: T[]) {
  const audit: MonetaryAuditEntry[] = [];
  const normalized = updates.map((update) => {
    if (!isFinancialLiveKey(update.key)) return update;
    const parsed = parseJson(update.valueJson);
    if (parsed === undefined) return update;
    const conversion = { converted: 0, currencies: new Set<"DOP" | "USD">() };
    const canonical = convertMonetaryValue(
      parsed,
      rootOf(update.key),
      update.key.split(".").slice(1),
      update.sourceCurrency,
      conversion,
    );
    const canonicalValueJson = JSON.stringify(canonical);
    audit.push({
      key: update.key,
      sourceCurrency: update.sourceCurrency,
      canonicalCurrencies: [...conversion.currencies],
      sourceValueJson: update.valueJson,
      canonicalValueJson,
      convertedFieldCount: conversion.converted,
      usdToDop: USD_TO_DOP,
      rateCutoff: FX_RATE_CUTOFF,
    });
    return canonicalValueJson === update.valueJson
      ? update
      : { ...update, valueJson: canonicalValueJson };
  });
  return { updates: normalized, audit };
}

function numberAt(value: unknown, path: string[]): number | null {
  let cursor = value;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "number" && Number.isFinite(cursor) ? cursor : null;
}

function toleranceFor(expected: number) {
  return Math.max(1, Math.abs(expected) * 1e-8);
}

function arithmeticCheck(input: {
  id: string;
  label: string;
  actual: number | null;
  expected: number | null;
  keys: string[];
  message: string;
}): FinancialCheck | null {
  if (input.actual === null || input.expected === null) return null;
  const difference = roundMoney(input.actual - input.expected);
  const tolerance = toleranceFor(input.expected);
  const passed = Math.abs(difference) <= tolerance;
  // Por decisión del propietario, un descuadre aritmético ya no aísla la
  // cifra: el dato se publica igual y el descuadre queda como advertencia
  // trazable ("te cuadre o no te cuadre, lo subes"). Quien lo revise decide
  // si corresponde una corrección; el Centro de Control nunca se queda
  // desactualizado esperando a que alguien concilie el número a mano.
  return {
    id: input.id,
    label: input.label,
    status: passed ? "passed" : "warning",
    actual: input.actual,
    expected: input.expected,
    difference,
    tolerance,
    keys: input.keys,
    message: passed ? `${input.label}: cuadrado.` : `${input.message} Se publica de todas formas; queda marcado para revisión.`,
  };
}

function touchedKeys(updates: FinancialUpdateLike[], prefix: string) {
  return updates.filter((update) => update.key === prefix || update.key.startsWith(`${prefix}.`)).map((update) => update.key);
}

function fiduciaryChecks(summary: unknown, updates: FinancialUpdateLike[]) {
  const checks: FinancialCheck[] = [];
  const balanceKeys = touchedKeys(updates, "fiduciaryStatementSummary.balance");
  if (balanceKeys.length) {
    const assets = numberAt(summary, ["balance", "assetsDop"]);
    const liabilities = numberAt(summary, ["balance", "liabilitiesDop"]);
    const equity = numberAt(summary, ["balance", "netEquityDop"]);
    const contributedEquity = numberAt(summary, ["balance", "contributedEquityDop"]);
    const accumulatedEquityResult = numberAt(summary, ["balance", "accumulatedEquityResultDop"]);
    const grossEquity = numberAt(summary, ["balance", "grossEquityDop"]);
    const periodResult = numberAt(summary, ["balance", "periodResultDop"]);
    const balanceCheck = arithmeticCheck({
      id: "fiduciary-balance-equation",
      label: "Ecuación del balance fiduciario",
      actual: assets,
      expected: liabilities !== null && equity !== null ? liabilities + equity : null,
      keys: balanceKeys,
      message: "El activo no coincide con pasivo más patrimonio neto.",
    });
    const equityCheck = arithmeticCheck({
      id: "fiduciary-equity-rollforward",
      label: "Composición del patrimonio fiduciario",
      actual: equity,
      expected: contributedEquity !== null && accumulatedEquityResult !== null && periodResult !== null
        ? contributedEquity + accumulatedEquityResult + periodResult
        : grossEquity !== null && periodResult !== null
          ? grossEquity + periodResult
          : null,
      keys: balanceKeys,
      message: "El patrimonio neto no coincide con patrimonio bruto más resultado del periodo.",
    });
    if (balanceCheck) checks.push(balanceCheck);
    if (equityCheck) checks.push(equityCheck);
  }
  for (const [section, label] of [
    ["monthlyResult", "Resultado mensual"],
    ["accumulatedResult", "Resultado acumulado"],
  ] as const) {
    const keys = touchedKeys(updates, `fiduciaryStatementSummary.${section}`);
    if (!keys.length) continue;
    const income = numberAt(summary, [section, "incomeDop"]);
    const expenses = numberAt(summary, [section, "expensesDop"]);
    const net = numberAt(summary, [section, "netResultDop"]);
    const check = arithmeticCheck({
      id: `fiduciary-${section}`,
      label,
      actual: net,
      expected: income !== null && expenses !== null ? income - expenses : null,
      keys,
      message: `${label}: el resultado neto no coincide con ingresos menos gastos.`,
    });
    if (check) checks.push(check);
  }
  const trialKeys = touchedKeys(updates, "fiduciaryStatementSummary.trialBalance");
  if (trialKeys.length) {
    const debit = numberAt(summary, ["trialBalance", "debitDop"]);
    const credit = numberAt(summary, ["trialBalance", "creditDop"]);
    const difference = numberAt(summary, ["trialBalance", "differenceDop"]);
    const debitCheck = arithmeticCheck({
      id: "fiduciary-trial-balance",
      label: "Balance de comprobación",
      actual: debit,
      expected: credit,
      keys: trialKeys,
      message: "El total débito no coincide con el total crédito.",
    });
    const differenceCheck = arithmeticCheck({
      id: "fiduciary-trial-difference",
      label: "Diferencia del balance de comprobación",
      actual: difference,
      expected: 0,
      keys: trialKeys,
      message: "La diferencia declarada del balance de comprobación no es cero.",
    });
    if (debitCheck) checks.push(debitCheck);
    if (differenceCheck) checks.push(differenceCheck);
  }
  return checks;
}

function antonelyBalanceChecks(lines: unknown, updates: FinancialUpdateLike[]) {
  const keys = touchedKeys(updates, "antonelyBalanceLines");
  if (!keys.length || !Array.isArray(lines)) return [];
  const find = (name: RegExp) => lines.find((row) => {
    if (!row || typeof row !== "object") return false;
    return name.test(normalizedToken(String((row as Record<string, unknown>).name ?? "")));
  }) as Record<string, unknown> | undefined;
  const amount = (name: RegExp) => {
    const value = find(name)?.amount;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const check = arithmeticCheck({
    id: "management-balance-equation",
    label: "Ecuación del balance de gestión",
    actual: amount(/^total activos$/),
    expected: (() => {
      const liabilities = amount(/^total pasivos$/);
      const equity = amount(/^total patrimonio$/);
      return liabilities !== null && equity !== null ? liabilities + equity : null;
    })(),
    keys,
    message: "El balance de gestión no cuadra: activos no coincide con pasivos más patrimonio.",
  });
  return check ? [check] : [];
}

function payableChecks(categories: unknown, updates: FinancialUpdateLike[]) {
  const keys = touchedKeys(updates, "antonelyPayableCategories");
  if (!keys.length || !Array.isArray(categories)) return [];
  const checks: FinancialCheck[] = [];
  for (const [index, item] of categories.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const total = typeof row.total === "number" ? row.total : null;
    const parts = ["current", "under1", "month1", "month2", "month3", "older"]
      .map((field) => row[field])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (total === null || parts.length !== 6) continue;
    const rowKeys = keys.filter((key) => key === "antonelyPayableCategories" || key.includes(`.${index}.`) || key.includes(String(row.name ?? "")));
    if (!rowKeys.length) continue;
    const check = arithmeticCheck({
      id: `payables-aging-${index}`,
      label: `Vencimiento CxP · ${String(row.name ?? index + 1)}`,
      actual: total,
      expected: parts.reduce((sum, value) => sum + value, 0),
      keys: rowKeys,
      message: `La CxP de ${String(row.name ?? index + 1)} no coincide con la suma de sus tramos de vencimiento.`,
    });
    if (check) checks.push(check);
  }
  return checks;
}

function flowChecks(months: unknown, updates: FinancialUpdateLike[]) {
  const keys = touchedKeys(updates, "reprogrammedFlowMonths");
  if (!keys.length || !Array.isArray(months)) return [];
  const touchedIndexes = new Set(keys.flatMap((key) => {
    const match = key.match(/^reprogrammedFlowMonths\.(\d+)/);
    return match ? [Number(match[1])] : months.map((_, index) => index);
  }));
  const checks: FinancialCheck[] = [];
  for (const index of touchedIndexes) {
    const row = months[index];
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const actual = typeof record.currentDop === "number" ? record.currentDop : null;
    const urbanism = typeof record.urbanismDop === "number" ? record.urbanismDop : null;
    const buildings = typeof record.buildingsDop === "number" ? record.buildingsDop : null;
    const rowKeys = keys.filter((key) => key === "reprogrammedFlowMonths" || key.startsWith(`reprogrammedFlowMonths.${index}.`));
    const check = arithmeticCheck({
      id: `flow-month-${index}`,
      label: `Flujo mensual · ${String(record.month ?? index + 1)}`,
      actual,
      expected: urbanism !== null && buildings !== null ? urbanism + buildings : null,
      keys: rowKeys,
      message: `El total del flujo de ${String(record.month ?? index + 1)} no coincide con Urbanismo más Edificios.`,
    });
    if (check) checks.push(check);
  }
  return checks;
}

function projectionChecks(projection: unknown, updates: FinancialUpdateLike[]) {
  const keys = touchedKeys(updates, "financialProjection");
  if (!keys.length || !Array.isArray(projection)) return [];
  const checks: FinancialCheck[] = [];
  for (const [index, item] of projection.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rowToken = String(row.month ?? index);
    const rowKeys = keys.filter((key) => key === "financialProjection" || key.includes(`.${index}.`) || key.includes(`.${rowToken}.`));
    if (!rowKeys.length) continue;
    const income = typeof row.income === "number" ? row.income : null;
    const costs = typeof row.costs === "number" ? row.costs : null;
    const net = typeof row.net === "number" ? row.net : null;
    const check = arithmeticCheck({
      id: `projection-net-${index}`,
      label: `Proyección financiera · ${rowToken}`,
      actual: net,
      expected: income !== null && costs !== null ? income - costs : null,
      keys: rowKeys,
      message: `El neto de ${rowToken} no coincide con ingresos menos costes.`,
    });
    if (check) checks.push(check);
  }
  return checks;
}

function periodOrdinal(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])(?:[-/](0?[1-9]|[12]\d|3[01]))?\b/);
  if (iso) return Number(iso[1]) * 10_000 + Number(iso[2]) * 100 + Number(iso[3] ?? 1);
  const european = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (european) return Number(european[3]) * 10_000 + Number(european[2]) * 100 + Number(european[1]);
  const monthYear = text.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (monthYear) return Number(monthYear[2]) * 10_000 + Number(monthYear[1]) * 100 + 1;
  return null;
}

function sourceClass(sourceName: string) {
  const source = normalizedToken(sourceName);
  if (/fiduciaria|fideicomiso|balance general|balance de comprobacion|estado de resultados/.test(source)) return "official";
  if (/antonely|contab|auxiliar|mayor/.test(source)) return "ledger";
  if (/plantilla/.test(source)) return "template";
  if (/flujo|presupuesto|cubicacion|comparativo/.test(source)) return "project_control";
  if (/informe|presentacion/.test(source)) return "management";
  return "unknown";
}

function sourceRank(root: string, sourceName: string) {
  const kind = sourceClass(sourceName);
  if (root.startsWith("fiduciary")) return ({ official: 100, ledger: 75, template: 85, project_control: 55, management: 50, unknown: 35 } as const)[kind];
  if (root.startsWith("antonely") || root.startsWith("cxp") || root === "payablesReconciliation") {
    return ({ official: 85, ledger: 100, template: 90, project_control: 70, management: 55, unknown: 35 } as const)[kind];
  }
  if (/^(?:reprogrammedFlow|cubicacion|costBreakdown|typeABudget|monthlyDeviation)/.test(root)) {
    return ({ official: 70, ledger: 75, template: 95, project_control: 100, management: 65, unknown: 35 } as const)[kind];
  }
  return ({ official: 95, ledger: 90, template: 90, project_control: 80, management: 60, unknown: 40 } as const)[kind];
}

function authorityDecisions(updates: FinancialUpdateLike[], currentPoints: FinancialCurrentPoint[]) {
  const currentByKey = new Map(currentPoints.map((point) => [point.key, point]));
  return updates.filter((update) => isFinancialLiveKey(update.key)).map((update): FinancialAuthorityDecision => {
    const current = currentByKey.get(update.key);
    const incomingRank = sourceRank(rootOf(update.key), update.sourceName);
    const currentRank = current ? sourceRank(rootOf(update.key), current.sourceName) : 0;
    const incomingPeriod = periodOrdinal(update.cutoff);
    const currentPeriod = periodOrdinal(current?.cutoff ?? "");
    let status: FinancialAuthorityDecision["status"] = "accepted";
    let message = "Dato aceptado: no existe una fuente vigente para esta clave.";
    if (current) {
      if (incomingPeriod !== null && currentPeriod !== null && incomingPeriod < currentPeriod) {
        status = "stale";
        message = `Corte ${update.cutoff} anterior al vigente ${current.cutoff}; no sustituye la cifra actual.`;
      } else if (incomingPeriod !== null && currentPeriod !== null && incomingPeriod > currentPeriod) {
        status = "newer_period";
        message = `Corte ${update.cutoff} posterior al vigente ${current.cutoff}; puede avanzar el periodo.`;
      } else if (incomingRank < currentRank) {
        status = "lower_authority";
        message = `La fuente vigente (${current.sourceName}) tiene mayor autoridad para el mismo periodo.`;
      } else {
        status = "same_authority";
        message = "La fuente tiene autoridad igual o superior para el mismo periodo.";
      }
    }
    return {
      key: update.key,
      status,
      incomingSource: update.sourceName,
      currentSource: current?.sourceName ?? "",
      incomingRank,
      currentRank,
      incomingCutoff: update.cutoff,
      currentCutoff: current?.cutoff ?? "",
      message,
    };
  });
}

export function affectedViewsForUpdates(updates: Array<Pick<FinancialUpdateLike, "key">>) {
  const views = new Set<string>(["Centro de datos"]);
  for (const update of updates) {
    const root = rootOf(update.key);
    let matched = false;
    for (const group of VIEW_GROUPS) {
      if (!group.roots.has(root)) continue;
      group.views.forEach((view) => views.add(view));
      matched = true;
    }
    if (!matched) {
      if (isCommercialLiveKey(update.key)) views.add("Ventas y cobranza");
      else if (isFinancialLiveKey(update.key)) views.add("Finanzas");
      else if (/^(?:buildings|urbanism|monthlyPlan|workPackages)/.test(root)) views.add("Obra");
      else views.add("Resumen ejecutivo");
    }
  }
  return [...views];
}

export function validateFinancialPublication(input: {
  updates: FinancialUpdateLike[];
  currentValues: LiveDataMap;
  currentPoints: FinancialCurrentPoint[];
  baselineValues: LiveDataMap;
  monetaryAudit?: MonetaryAuditEntry[];
}): FinancialValidationResult {
  const financialUpdates = input.updates.filter((update) => isFinancialLiveKey(update.key));
  if (!financialUpdates.length) {
    return {
      status: "not_applicable",
      checks: [],
      authority: [],
      blockingKeys: [],
      warnings: [],
      affectedViews: affectedViewsForUpdates(input.updates),
      monetaryAudit: input.monetaryAudit ?? [],
    };
  }

  const mergedValues: LiveDataMap = { ...input.currentValues };
  for (const update of financialUpdates) {
    const value = parseJson(update.valueJson);
    if (value !== undefined) mergedValues[update.key] = value;
  }
  const materialize = (root: string) => materializeLiveRoot(
    root,
    input.baselineValues[root] ?? null,
    mergedValues,
  );
  const checks = [
    ...fiduciaryChecks(materialize("fiduciaryStatementSummary"), financialUpdates),
    ...antonelyBalanceChecks(materialize("antonelyBalanceLines"), financialUpdates),
    ...payableChecks(materialize("antonelyPayableCategories"), financialUpdates),
    ...flowChecks(materialize("reprogrammedFlowMonths"), financialUpdates),
    ...projectionChecks(materialize("financialProjection"), financialUpdates),
  ];
  const authority = authorityDecisions(financialUpdates, input.currentPoints);
  // Un descuadre aritmético ya no bloquea nada (arithmeticCheck lo marca
  // "warning", no "blocked"): sólo una fuente vieja o de menor autoridad para
  // la MISMA clave sigue aislándose, porque eso no es "no cuadra", es "esto
  // no es lo último que hay que mostrar".
  const blockingKeys = new Set<string>();
  authority.filter((decision) => decision.status === "stale" || decision.status === "lower_authority")
    .forEach((decision) => blockingKeys.add(decision.key));

  const warnings = [
    ...checks.filter((check) => check.status === "warning").map((check) => check.message),
    ...authority.filter((decision) => decision.status === "stale" || decision.status === "lower_authority")
      .map((decision) => `${decision.key}: ${decision.message}`),
  ];
  return {
    status: blockingKeys.size
      ? "blocked"
      : warnings.length
        ? "passed_with_warnings"
        : "passed",
    checks,
    authority,
    blockingKeys: [...blockingKeys],
    warnings,
    affectedViews: affectedViewsForUpdates(financialUpdates),
    monetaryAudit: input.monetaryAudit ?? [],
  };
}

export function numericBeforeAfter(input: {
  updates: FinancialUpdateLike[];
  currentPoints: FinancialCurrentPoint[];
  limit?: number;
}) {
  const currentByKey = new Map(input.currentPoints.map((point) => [point.key, point]));
  return input.updates.flatMap((update) => {
    const after = parseJson(update.valueJson);
    const before = parseJson(currentByKey.get(update.key)?.valueJson ?? "");
    if (typeof after !== "number" || !Number.isFinite(after)) return [];
    return [{
      key: update.key,
      before: typeof before === "number" && Number.isFinite(before) ? before : null,
      after,
      canonicalCurrency: canonicalCurrencyForPath(rootOf(update.key), update.key.split(".").slice(1)),
    }];
  }).slice(0, input.limit ?? 8);
}
