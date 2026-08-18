import "server-only";

import { buildDashboardBootstrap } from "./dashboard-bootstrap";
import {
  LIVE_DATA_ROOTS,
  LiveDataMap,
  LiveDataValue,
  materializeLiveRoot,
} from "./live-data";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_ARRAY_ITEMS = 1_000;
const PERCENT_FIELD = /(?:percent|percentage|progress|porcentaje|avance[_ -]?f[ií]sico|completion|occupancy)/i;
const DATE_FIELD = /^(?:date|fecha|start|finish|baselineFinish|forecastFinish|startDate|endDate|dueDate|paymentDate|deliveryDate|createdAt|updatedAt|reviewedAt|publishedAt|cutoff|declaredCutoff|lastUpdated|savedAt|issuedAt)$/i;
const ENUM_FIELD = /^(?:status|state|phase|stage|currency|priority|severity|risk|condition)$/i;
const IDENTITY_FIELD = /^(?:id|code|unitId|apartmentId|buildingId|supplierId|invoiceId)$/i;
const SAFE_IDENTITY = /^[\p{L}\p{N}][\p{L}\p{N}._:/ -]{0,79}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const APPENDABLE_ARRAY_PATHS = new Set([
  "buildings",
  "buildings.*.units",
  "discoveredSections",
  "urbanismAreas",
]);
const OPTIONAL_OBJECT_FIELDS: Record<string, Record<string, unknown>> = {
  "buildings.*": {
    mapCoordinates: {
      visual: { x: 0, y: 0 },
      technical: { x: 0, y: 0 },
    },
  },
  "urbanismAreas.*": {
    mapCoordinates: {
      visual: { x: 0, y: 0, short: "" },
      technical: { x: 0, y: 0, short: "" },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildContractRoots() {
  const bootstrap = buildDashboardBootstrap(true) as unknown as Record<string, unknown>;
  const sections = Object.values(bootstrap).filter(isRecord);
  const roots: Record<string, unknown> = {};
  for (const root of LIVE_DATA_ROOTS) {
    const section = sections.find((candidate) => Object.hasOwn(candidate, root));
    if (section) roots[root] = section[root];
  }
  return roots;
}

const contractRoots = buildContractRoots();

// Expuesto para que la extracción por IA pueda mostrarle al modelo los
// nombres de campo reales que el contrato va a exigir, en vez de dejarlo
// adivinar sinónimos que luego se rechazan en silencio.
export function getContractRootsSnapshot(): Record<string, unknown> {
  return contractRoots;
}

function fallbackArrayItem(path: string) {
  // Los bloques descubiertos empiezan sin ningún elemento, así que no hay de
  // dónde deducir su forma cuando llega el primero. Esta plantilla es la que
  // permite que el contenedor crezca solo desde vacío: sin ella, el primer
  // bloque que la lectura descubriera se rechazaría por "ruta que no existe".
  // Ojo con la clave: se consulta por la ruta de la LISTA, no la del elemento
  // (para las unidades es "buildings.*.units", no "buildings.*.units.*"). Con
  // "discoveredSections.*" nunca coincidía y el primer bloque se rechazaba por
  // "la ruta no existe en el modelo autorizado".
  if (path === "discoveredSections") {
    return {
      id: "",
      title: "",
      description: "",
      area: "",
      evidence: "",
      confidence: 0,
      sourceName: "",
      detectedAt: "",
      values: [{ label: "", value: "" }],
    };
  }
  if (path === "buildings.*.units") {
    const baselineBuildings = contractRoots.buildings;
    if (Array.isArray(baselineBuildings)) {
      const baselineBuilding = baselineBuildings.find(isRecord);
      const units = baselineBuilding?.units;
      if (Array.isArray(units)) return units.find((item) => item != null);
    }
  }
  return undefined;
}

function normalizedPath(path: string[]) {
  return path.map((segment) => /^\d+$/.test(segment) ? "*" : segment).join(".");
}

function collectKnownEnums(
  value: unknown,
  path: string[],
  output: Map<string, Set<string>>,
) {
  if (Array.isArray(value)) {
    for (const item of value) collectKnownEnums(item, [...path, "*"], output);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (typeof nested === "string" && ENUM_FIELD.test(key) && nested) {
      const pathKey = normalizedPath(nextPath);
      const values = output.get(pathKey) ?? new Set<string>();
      values.add(nested);
      output.set(pathKey, values);
    }
    collectKnownEnums(nested, nextPath, output);
  }
}

const knownEnums = new Map<string, Set<string>>();
for (const [root, value] of Object.entries(contractRoots)) {
  collectKnownEnums(value, [root], knownEnums);
}

function expectedAtPath(rootName: string, root: unknown, segments: string[]) {
  let current = root;
  const fullNormalizedPath = [rootName];
  const normalizedSegments: string[] = [];
  let arrayElement: { items: unknown[]; index: number; append: boolean } | null = null;
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    if (FORBIDDEN_SEGMENTS.has(segment)) return null;
    if (Array.isArray(current)) {
      const currentArray = current;
      if (!/^\d+$/.test(segment)) return null;
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index < 0 || index > currentArray.length) return null;
      const missingSlot = index < currentArray.length && currentArray[index] == null;
      if (missingSlot) return null;
      const append = index === currentArray.length;
      const earlierGap = Array.from({ length: index }, (_, itemIndex) => currentArray[itemIndex])
        .some((item) => item == null);
      if (append && (
        !APPENDABLE_ARRAY_PATHS.has(fullNormalizedPath.join(".")) ||
        segmentIndex !== segments.length - 1 ||
        earlierGap
      )) return null;
      arrayElement = { items: currentArray, index, append };
      current = append
        ? currentArray.find((item) => item != null) ?? fallbackArrayItem(fullNormalizedPath.join("."))
        : currentArray[index];
      if (current === undefined) return null;
      normalizedSegments.push("*");
      fullNormalizedPath.push("*");
      continue;
    }
    if (!isRecord(current)) return null;
    if (Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      const optional = OPTIONAL_OBJECT_FIELDS[fullNormalizedPath.join(".")]?.[segment];
      if (optional === undefined) return null;
      current = optional;
    }
    arrayElement = null;
    normalizedSegments.push(segment);
    fullNormalizedPath.push(segment);
  }
  return { expected: current, normalizedSegments, arrayElement };
}

// Marks a field that is null in some rows of an expected array-of-records
// and a concrete value in others (e.g. monthlyPlan.actual: reported months
// carry a number, unreported ones are null). Positional matching against a
// single row would otherwise permanently lock that field to whichever state
// the row at that exact index happened to have — a nullable progress field
// like "the actual for jul-26" could never move from null to a real number
// through a whole-array publish, which is exactly the case a monthly Curva S
// update needs. Only ever constructed by mergedArrayTemplate below and only
// ever consumed by matchesContract's own recursion, so it can never collide
// with real extracted data.
class NullableTemplate {
  constructor(public readonly example: unknown) {}
}

function mergedArrayTemplate(expected: unknown[]): unknown {
  if (!expected.length) return undefined;
  if (!expected.every(isRecord)) return expected[0];
  const keys = new Set<string>();
  for (const item of expected) {
    for (const key of Object.keys(item as Record<string, unknown>)) keys.add(key);
  }
  const merged: Record<string, unknown> = {};
  for (const key of keys) {
    let nonNullExample: unknown;
    let sawNull = false;
    for (const item of expected) {
      const value = (item as Record<string, unknown>)[key];
      if (value === null) sawNull = true;
      else if (nonNullExample === undefined) nonNullExample = value;
    }
    merged[key] = nonNullExample === undefined
      ? null
      : sawNull ? new NullableTemplate(nonNullExample) : nonNullExample;
  }
  return merged;
}

function matchesContract(
  expected: unknown,
  actual: unknown,
  path: string[],
  depth = 0,
): boolean {
  if (depth > 16) return false;
  if (expected instanceof NullableTemplate) {
    return actual === null || matchesContract(expected.example, actual, path, depth + 1);
  }
  if (expected === null) return actual === null;
  if (typeof expected === "number") return typeof actual === "number" && Number.isFinite(actual);
  if (typeof expected === "string" || typeof expected === "boolean") {
    return typeof actual === typeof expected;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length > MAX_ARRAY_ITEMS) return false;
    if (expected.length === 0) return actual.length === 0;
    const template = mergedArrayTemplate(expected) ?? expected[0];
    return actual.every((item) => matchesContract(
      template,
      item,
      [...path, "*"],
      depth + 1,
    ));
  }
  if (!isRecord(expected) || !isRecord(actual)) return false;
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  const optionalFields = OPTIONAL_OBJECT_FIELDS[path.join(".")] ?? {};
  if (!expectedKeys.every((key) => Object.hasOwn(actual, key))) return false;
  return actualKeys.every((key) => {
    if (FORBIDDEN_SEGMENTS.has(key)) return false;
    const expectedValue = Object.hasOwn(expected, key) ? expected[key] : optionalFields[key];
    return expectedValue !== undefined && matchesContract(
      expectedValue,
      actual[key],
      [...path, key],
      depth + 1,
    );
  });
}

function validIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  if (value.length === 10) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;
  }
  return Number.isFinite(Date.parse(value));
}

function isPercentagePath(path: string[]) {
  const field = path.at(-1) ?? "";
  return PERCENT_FIELD.test(field) ||
    (path[0] === "monthlyPlan" && (field === "planned" || field === "actual"));
}

function identityKeyForArray(expected: unknown, actual: unknown[]) {
  const expectedRecord = Array.isArray(expected) && isRecord(expected[0]) ? expected[0] : null;
  const actualRecord = actual.find(isRecord);
  const candidates = new Set([
    ...Object.keys(expectedRecord ?? {}),
    ...Object.keys(actualRecord ?? {}),
  ]);
  return [...candidates].find((key) => IDENTITY_FIELD.test(key)) ?? null;
}

function validateDomain(
  expected: unknown,
  actual: unknown,
  path: string[],
  depth = 0,
  allowUnchangedLegacyDate = true,
): string | null {
  if (depth > 16) return "la estructura supera la profundidad permitida";
  const field = path.at(-1) ?? "";
  if (typeof actual === "number" && isPercentagePath(path) && (actual < 0 || actual > 100)) {
    return "un porcentaje debe estar entre 0 y 100";
  }
  if (
    typeof actual === "number" &&
    path.includes("mapCoordinates") &&
    (field === "x" || field === "y") &&
    (actual < 0 || actual > 100)
  ) return "una coordenada del plano debe estar entre 0 y 100";
  if (typeof actual === "string") {
    const unchangedLegacyDate = allowUnchangedLegacyDate &&
      typeof expected === "string" && actual === expected;
    if (DATE_FIELD.test(field) && actual && !unchangedLegacyDate && !validIsoDate(actual)) {
      return "una fecha debe usar formato ISO (AAAA-MM-DD)";
    }
    if (IDENTITY_FIELD.test(field) && (!actual || !SAFE_IDENTITY.test(actual))) {
      return "un identificador no tiene un formato autorizado";
    }
    if (ENUM_FIELD.test(field)) {
      const allowed = knownEnums.get(normalizedPath(path));
      if (allowed?.size && !allowed.has(actual)) {
        return `el estado o categoría '${actual}' no pertenece al catálogo autorizado`;
      }
    }
    return null;
  }
  if (Array.isArray(actual)) {
    if (actual.length > MAX_ARRAY_ITEMS) return "una colección supera 1.000 elementos";
    const identityKey = identityKeyForArray(expected, actual);
    if (identityKey) {
      const identities = new Set<string>();
      for (const item of actual) {
        if (!isRecord(item)) return "una colección identificada contiene un elemento inválido";
        const identity = item[identityKey];
        if (typeof identity !== "string" || !SAFE_IDENTITY.test(identity) || identities.has(identity)) {
          return `la colección contiene un ${identityKey} vacío, duplicado o inválido`;
        }
        identities.add(identity);
      }
    }
    const representative = Array.isArray(expected) ? expected[0] : undefined;
    for (let index = 0; index < actual.length; index += 1) {
      const expectedItem = Array.isArray(expected)
        ? expected[index] ?? representative
        : representative;
      const error = validateDomain(
        expectedItem,
        actual[index],
        [...path, "*"],
        depth + 1,
        allowUnchangedLegacyDate && Array.isArray(expected) && index < expected.length,
      );
      if (error) return error;
    }
    return null;
  }
  if (isRecord(actual)) {
    for (const [key, value] of Object.entries(actual)) {
      const expectedValue = isRecord(expected) ? expected[key] : undefined;
      const optionalValue = OPTIONAL_OBJECT_FIELDS[path.join(".")]?.[key];
      const error = validateDomain(
        expectedValue === undefined ? optionalValue : expectedValue,
        value,
        [...path, key],
        depth + 1,
        allowUnchangedLegacyDate,
      );
      if (error) return error;
    }
  }
  return null;
}

export function validateLiveDataContract(
  key: string,
  valueJson: string,
  currentValues?: LiveDataMap,
) {
  const segments = key.split(".");
  if (!segments.length || segments.some((segment) => !segment || FORBIDDEN_SEGMENTS.has(segment))) {
    return { valid: false as const, reason: "la ruta no es segura" };
  }
  const baselineRoot = contractRoots[segments[0]];
  const root = currentValues && baselineRoot !== undefined
    ? materializeLiveRoot(segments[0], baselineRoot, currentValues)
    : baselineRoot;
  if (root === undefined) return { valid: false as const, reason: "la raíz no está autorizada" };
  const resolved = expectedAtPath(segments[0], root, segments.slice(1));
  if (!resolved) return { valid: false as const, reason: "la ruta no existe en el modelo autorizado" };

  let actual: unknown;
  try {
    actual = JSON.parse(valueJson) as unknown;
  } catch {
    return { valid: false as const, reason: "el valor no es JSON válido" };
  }
  if (!matchesContract(resolved.expected, actual, [segments[0], ...resolved.normalizedSegments])) {
    return { valid: false as const, reason: "el tipo o la estructura no coincide con el modelo autorizado" };
  }
  if (resolved.arrayElement && isRecord(actual)) {
    const identityKey = identityKeyForArray(resolved.arrayElement.items, [actual]);
    if (identityKey) {
      const identity = actual[identityKey];
      const existingIdentities = resolved.arrayElement.items
        .filter(isRecord)
        .map((item) => item[identityKey]);
      if (
        typeof identity !== "string" ||
        !SAFE_IDENTITY.test(identity) ||
        (resolved.arrayElement.append
          ? existingIdentities.includes(identity)
          : identity !== existingIdentities[resolved.arrayElement.index])
      ) {
        return {
          valid: false as const,
          reason: resolved.arrayElement.append
            ? "el nuevo identificador ya existe o no es vÃ¡lido"
            : "un elemento existente no puede cambiar de identificador",
        };
      }
    }
  }
  const domainError = validateDomain(
    resolved.expected,
    actual,
    [segments[0], ...resolved.normalizedSegments],
    0,
    !resolved.arrayElement?.append,
  );
  return domainError
    ? { valid: false as const, reason: domainError }
    : { valid: true as const, reason: "" };
}

export function assertLiveDataContract(
  key: string,
  valueJson: string,
  currentValues?: LiveDataMap,
) {
  const result = validateLiveDataContract(key, valueJson, currentValues);
  if (!result.valid) throw new Error(`El dato ${key} no es válido: ${result.reason}.`);
}

function compareContractKeys(left: string, right: string) {
  const leftSegments = left.split(".");
  const rightSegments = right.split(".");
  for (let index = 0; index < Math.max(leftSegments.length, rightSegments.length); index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];
    if (leftSegment === rightSegment) continue;
    if (leftSegment === undefined) return -1;
    if (rightSegment === undefined) return 1;
    const leftNumeric = /^\d+$/.test(leftSegment);
    const rightNumeric = /^\d+$/.test(rightSegment);
    if (leftNumeric && rightNumeric) return Number(leftSegment) - Number(rightSegment);
    return leftSegment.localeCompare(rightSegment);
  }
  return 0;
}

/** Validate against the effective state and each earlier no-gap append in the batch. */
export function assertLiveDataContracts(
  updates: Array<{ key: string; valueJson: string }>,
  currentValues: LiveDataMap,
) {
  const workingValues: LiveDataMap = { ...currentValues };
  for (const update of [...updates].sort((left, right) => compareContractKeys(left.key, right.key))) {
    assertLiveDataContract(update.key, update.valueJson, workingValues);
    workingValues[update.key] = JSON.parse(update.valueJson) as LiveDataValue;
  }
  return workingValues;
}

/** Automatic extraction remains path-only, but shares the same central rule. */
export function matchesAutomaticLiveDataContract(
  key: string,
  valueJson: string,
  currentValues?: LiveDataMap,
) {
  return key.includes(".") && validateLiveDataContract(key, valueJson, currentValues).valid;
}
