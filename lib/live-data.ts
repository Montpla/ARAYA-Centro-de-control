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
  "collectionTargets",
  "commercialPartners",
  "constructionDisciplines",
  "costBreakdown",
  "cubicaciones",
  "cxpAging",
  "cxpCategories",
  "dataSources",
  "delayedUrbanismStarts",
  "discoveredSections",
  "financialProjection",
  "financingProcesses",
  "fiduciaryBalanceSections",
  "fiduciaryManagementReconciliation",
  "fiduciaryStatementQualityIssues",
  "fiduciaryStatementSummary",
  "ifcComplianceGroups",
  "ifcComplianceTracking",
  "juneDataQualityIssues",
  "juneReport",
  "managementActions",
  "monthlyPlan",
  "monthlyDeviationLines",
  "payablesReconciliation",
  "permits",
  "procurementMonthlySchedule",
  "procurementPackages",
  "procurementQualityIssues",
  "projectSnapshot",
  "reprogrammedFlowAudit",
  "reprogrammedFlowMonths",
  "reprogrammedFlowQualityIssues",
  "reprogrammedFlowScopes",
  "safetyFindingTracking",
  "safetyFindings",
  "safetyMetrics",
  "salesLocations",
  "salesModels",
  "structuralDelay",
  "supplierComparisons",
  "supplierDirectory",
  "timeline",
  "typeABudgetChapters",
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
  "discoveredSections",
  "cxpAging",
  "cxpCategories",
  "financialProjection",
  "financingProcesses",
  "fiduciaryBalanceSections",
  "fiduciaryManagementReconciliation",
  "fiduciaryStatementQualityIssues",
  "fiduciaryStatementSummary",
  "ifcComplianceGroups",
  "ifcComplianceTracking",
  "monthlyDeviationLines",
  "payablesReconciliation",
  "procurementQualityIssues",
  "reprogrammedFlowAudit",
  "reprogrammedFlowMonths",
  "reprogrammedFlowQualityIssues",
  "reprogrammedFlowScopes",
  "typeABudgetChapters",
]);
const commercialRootSet = new Set([
  "arrearsBreakdown",
  "collectionTargets",
  "commercialPartners",
  "salesLocations",
  "salesModels",
]);
const mixedProtectedSourceIds = new Set([
  "source-xls",
  "source-june-consolidated",
  "source-june-pdf",
]);
// La raíz sigue siendo un identificador alfanumérico (son los nombres fijos de
// LIVE_DATA_ROOTS). Los segmentos hijos son mucho más abiertos porque nombran
// entidades reales, y esas se llaman como se llaman: "TH-14", "edificio-14" o
// "14-101", pero también "Albañilería", "Vidrio y aluminio" y "Zócalo y
// masilla". Admitiendo sólo ASCII sin espacios, la mitad de las partidas de
// obra y de las cuentas no podían nombrarse en una clave y se rechazaban por
// "no pertenecer al modelo vivo" — la misma razón de fondo por la que las
// actualizaciones de implantación nunca cuajaban.
//
// Lo que sigue prohibido es lo que importa: el punto, que es el separador de
// segmentos; la barra; y empezar por un carácter que no sea letra o dígito,
// que corta `__proto__` y compañía incluso antes que forbiddenPathSegments.
const keyPattern = /^[A-Za-z][A-Za-z0-9]*(?:\.[\p{L}\p{N}][\p{L}\p{N} _-]*)*$/u;
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

// Campos por los que una entidad de una colección viva puede nombrarse dentro
// de una clave. `shortName` está aquí y no en stableArrayIdentity porque no
// identifica a la entidad de forma única en todo el modelo (sirve para
// nombrarla en una clave, no para reconciliar dos listas completas).
//
// La segunda mitad de la lista existe porque sólo 5 de las 26 colecciones del
// modelo traen id: las demás —las de cuentas, CxP, ventas, presupuesto y plan
// mensual— se distinguen por su nombre de negocio ("Edificaciones",
// "Construcción", "Grupo Alugav"), por su mes ("jun 25") o por su entidad
// emisora. Sin ellos, la única forma de dirigir un importe era su posición en
// la lista, y basta con que el orden cambie o con que la extracción se
// equivoque de número para que el dinero entre en otra partida sin que nada lo
// señale — el mismo fallo que tenían los edificios, pero sobre cifras
// económicas.
const ENTITY_NAMING_KEYS = [
  "id",
  "code",
  "shortName",
  "unitId",
  "apartmentId",
  "buildingId",
  "name",
  "month",
  "period",
  "entity",
  "category",
  "concept",
  "label",
];

function stableArrayIdentity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["id", "code", "unitId", "apartmentId", "buildingId"]) {
    if (typeof record[key] === "string" && record[key]) return `${key}:${record[key]}`;
  }
  return "";
}

// Forma canónica con la que se compara un segmento de clave contra los campos
// que nombran a una entidad. La obra escribe "TH-14", el modelo de datos
// guarda shortName "14" e id "edificio-14", y la pantalla rotula
// "TH-" + shortName.padStart(2, "0"): las tres formas designan al mismo
// edificio y aquí colapsan en el mismo token ("14"). Se descartan acentos,
// separadores, el prefijo de tipo y los ceros de relleno.
export function namingToken(value: string) {
  const compact = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (!compact) return "";
  // El prefijo de tipo se descarta únicamente cuando lo que queda detrás es un
  // número, que es la forma en que se nombra una entidad enumerada ("TH-14",
  // "edificio-14", "apartamento-101"). Recortarlo sin esa condición estropea
  // los nombres de negocio, que también empiezan por esas palabras: "Torres
  // del Este" quedaba en "sdeleste" y "Torre Norte" en "norte", con el riesgo
  // de que dos partidas distintas colapsaran en el mismo token y un importe
  // acabara en la línea equivocada.
  const withoutPrefix = compact.replace(/^(th|edificio|torre|apartamento|apto|unidad)(?=\d)/, "");
  return withoutPrefix.replace(/^0+(?=\d)/, "") || withoutPrefix;
}

// Resuelve qué posición de una colección viva nombra un segmento de clave.
//
// Hasta ahora sólo se aceptaba el índice numérico (`buildings.13.progress`),
// lo que obligaba a quien produjera la clave —la extracción IA, sobre todo— a
// adivinar la posición exacta de un edificio dentro del array. Cuando fallaba,
// `Number("TH-14")` daba NaN, la escritura acababa en una propiedad "NaN" del
// array y el dato se perdía sin error ni aviso: el archivo constaba como
// procesado y el panel no se movía. Ahora un segmento no numérico se busca
// entre los campos que nombran a la entidad, así que `buildings.TH-14.progress`
// llega a su sitio. Devuelve -1 si no corresponde a ninguna entidad viva.
function resolveArrayIndex(cursor: unknown[], segment: string) {
  if (/^\d+$/.test(segment)) return Number(segment);
  const wanted = namingToken(segment);
  if (!wanted) return -1;
  let found = -1;
  for (let index = 0; index < cursor.length; index += 1) {
    const item = cursor[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const matches = ENTITY_NAMING_KEYS.some((key) => {
      const raw = record[key];
      return typeof raw === "string" && namingToken(raw) === wanted;
    });
    if (!matches) continue;
    // Un nombre que señala a dos entidades no señala a ninguna. Escribir en la
    // primera que aparezca repartiría el dato a cara o cruz entre dos partidas
    // —y en las listas económicas eso es un importe en la línea equivocada—,
    // así que se descarta y el aviso posterior deja constancia.
    if (found >= 0) return -1;
    found = index;
  }
  return found;
}

/**
 * Posición que un nombre designa dentro de una colección viva, o -1 si no
 * designa ninguna o designa más de una. Comparte regla con la materialización
 * para que un nombre no se resuelva de una forma al traducir la clave y de
 * otra al aplicarla.
 */
export function findNamedEntityIndex(values: unknown[], name: string) {
  return resolveArrayIndex(values, name);
}

function setPath(target: unknown, path: string[], value: LiveDataValue) {
  if (!path.length || target === null || typeof target !== "object") return;
  let cursor = target as Record<string, unknown> | unknown[];
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];
    let key: string | number;
    if (Array.isArray(cursor)) {
      const resolved = resolveArrayIndex(cursor, segment);
      // Un código que no corresponde a ninguna entidad viva se descarta entero
      // en vez de inventar una posición: escribir un "TH-99" inexistente al
      // final de la lista crearía un edificio fantasma en la implantación.
      if (resolved < 0) return;
      key = resolved;
    } else {
      key = segment;
    }
    const current = (cursor as Record<string | number, unknown>)[key];
    if (current === null || typeof current !== "object") {
      (cursor as Record<string | number, unknown>)[key] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    cursor = (cursor as Record<string | number, unknown>)[key] as Record<string, unknown> | unknown[];
  }
  const finalSegment = path[path.length - 1];
  let finalKey: string | number;
  if (Array.isArray(cursor)) {
    const resolved = resolveArrayIndex(cursor, finalSegment);
    if (resolved < 0) return;
    finalKey = resolved;
  } else {
    finalKey = finalSegment;
  }
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
