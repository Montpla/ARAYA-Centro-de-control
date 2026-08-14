import type { Building, Unit, UrbanismArea } from "../app/demo-data";
import {
  LiveDataMap,
  LiveDataUpdate,
  LiveDataValue,
  materializeLiveRoot,
  namingToken,
} from "./live-data";
import { buildings, urbanismAreas } from "../app/demo-data";

function isRecord(value: unknown): value is Record<string, LiveDataValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Una sola regla de normalizaci\u00f3n para todo el sistema (lib/live-data.ts): la
// que aqu\u00ed decide en qu\u00e9 posici\u00f3n cae "TH-14" es la misma que all\u00ed resuelve un
// nombre al materializar. Cuando eran dos, la obra escrib\u00eda "TH-14", esta
// funci\u00f3n lo reduc\u00eda a "th14" y no casaba con el shortName "14" del edificio,
// as\u00ed que la identidad no se resolv\u00eda y el dato acababa descartado.
function identityToken(value: unknown) {
  return namingToken(String(value ?? ""));
}

function entityMatchesToken(value: unknown, token: string) {
  if (!isRecord(value)) return false;
  return [value.id, value.code, value.shortName, value.name]
    .some((candidate) => identityToken(candidate) === token);
}

function ownEntityIndex(values: unknown[], token: string) {
  for (let index = 0; index < values.length; index += 1) {
    if (Object.prototype.hasOwnProperty.call(values, index) && entityMatchesToken(values[index], token)) {
      return index;
    }
  }
  return -1;
}

function mergeRecords(
  baseline: Record<string, LiveDataValue>,
  patch: Record<string, LiveDataValue>,
) {
  const result: Record<string, LiveDataValue> = { ...baseline };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isRecord(result[key]) && isRecord(value)
      ? mergeRecords(result[key] as Record<string, LiveDataValue>, value)
      : value;
  }
  return result;
}

function stringValue(value: LiveDataValue | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: LiveDataValue | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildingSeed(patch: Record<string, LiveDataValue>, logicalToken: string): Building {
  const id = stringValue(patch.id, logicalToken);
  return {
    id,
    name: stringValue(patch.name, id),
    shortName: stringValue(patch.shortName, id),
    progress: numberValue(patch.progress, 0),
    planProgress: typeof patch.planProgress === "number" ? patch.planProgress : null,
    deviationDays: numberValue(patch.deviationDays, 0),
    forecastFinish: typeof patch.forecastFinish === "string" ? patch.forecastFinish : "",
    units: Array.isArray(patch.units) ? patch.units as Unit[] : [],
    ...(isRecord(patch.mapCoordinates) ? { mapCoordinates: patch.mapCoordinates as Building["mapCoordinates"] } : {}),
  };
}

function unitSeed(patch: Record<string, LiveDataValue>, logicalToken: string): Unit {
  const id = stringValue(patch.id, stringValue(patch.code, logicalToken));
  return {
    id,
    code: stringValue(patch.code, id),
    floor: numberValue(patch.floor, 0),
    progress: numberValue(patch.progress, 0),
    status: patch.status === "terminada" || patch.status === "en_curso" || patch.status === "bloqueada"
      ? patch.status
      : "pendiente",
    phase: stringValue(patch.phase, "Superestructura"),
    deviationDays: numberValue(patch.deviationDays, 0),
    responsible: typeof patch.responsible === "string" ? patch.responsible : "",
    lastUpdated: typeof patch.lastUpdated === "string" ? patch.lastUpdated : "",
    source: typeof patch.source === "string" ? patch.source : "",
    disciplines: Array.isArray(patch.disciplines) ? patch.disciplines as Unit["disciplines"] : [],
    issues: Array.isArray(patch.issues) ? patch.issues as Unit["issues"] : [],
  };
}

function urbanismSeed(patch: Record<string, LiveDataValue>, logicalToken: string): UrbanismArea {
  const id = stringValue(patch.id, logicalToken);
  return {
    id,
    name: stringValue(patch.name, id),
    category: stringValue(patch.category, "Pendiente de clasificar"),
    progress: typeof patch.progress === "number" ? patch.progress : null,
    planned: typeof patch.planned === "number" ? patch.planned : null,
    status: patch.status === "integrado" ? "integrado" : "pendiente",
    source: typeof patch.source === "string" ? patch.source : "",
    detail: typeof patch.detail === "string" ? patch.detail : "",
    pendingFields: Array.isArray(patch.pendingFields)
      ? patch.pendingFields.filter((item): item is string => typeof item === "string")
      : [],
    ...(isRecord(patch.mapCoordinates) ? { mapCoordinates: patch.mapCoordinates as UrbanismArea["mapCoordinates"] } : {}),
  };
}

function resolvedUpdate(update: LiveDataUpdate, key: string, value: LiveDataValue): LiveDataUpdate {
  return { ...update, key, value };
}

/**
 * Traduce a posiciones los nombres de entidad de una ruta espacial profunda,
 * del tipo `buildings.TH-14.progress` o `buildings.TH-14.units.14-101.status`.
 *
 * El upsert de abajo sólo entiende rutas de entidad completa con un objeto por
 * valor (`buildings.TH-14` = {...}), que es como se dan de alta o se fusionan
 * entidades. Pero un documento de obra casi siempre aporta el dato suelto —un
 * porcentaje, un estado—, y esa forma llegaba intacta al contrato, que sólo
 * convierte en comodín los segmentos numéricos: `buildings.*.progress` casaba,
 * `buildings.TH-14.progress` no, y el dato se rechazaba por no pertenecer al
 * modelo. Traducirlo aquí deja una sola representación canónica —posiciones—
 * viajando por el contrato, la publicación y la base de datos.
 *
 * Devuelve null cuando no hay nada que traducir o cuando la entidad nombrada no
 * existe: inventar una posición escribiría el dato en otro edificio.
 */
function resolveDeepSpatialKey(segments: string[], workingValues: LiveDataMap) {
  if (segments[0] === "buildings" && segments.length > 2) {
    const current = materializeLiveRoot("buildings", buildings, workingValues) as Building[];
    const buildingIndex = /^\d+$/.test(segments[1])
      ? Number(segments[1])
      : ownEntityIndex(current, identityToken(segments[1]));
    if (buildingIndex < 0 || !current[buildingIndex]) return null;
    if (segments[2] === "units" && segments.length > 4) {
      const units = current[buildingIndex].units ?? [];
      const unitIndex = /^\d+$/.test(segments[3])
        ? Number(segments[3])
        : ownEntityIndex(units, identityToken(segments[3]));
      if (unitIndex < 0 || !units[unitIndex]) return null;
      return ["buildings", buildingIndex, "units", unitIndex, ...segments.slice(4)].join(".");
    }
    return ["buildings", buildingIndex, ...segments.slice(2)].join(".");
  }
  if (segments[0] === "urbanismAreas" && segments.length > 2) {
    const current = materializeLiveRoot("urbanismAreas", urbanismAreas, workingValues) as UrbanismArea[];
    const areaIndex = /^\d+$/.test(segments[1])
      ? Number(segments[1])
      : ownEntityIndex(current, identityToken(segments[1]));
    if (areaIndex < 0 || !current[areaIndex]) return null;
    return ["urbanismAreas", areaIndex, ...segments.slice(2)].join(".");
  }
  return null;
}

/**
 * Resolves natural identity paths emitted by document extraction to stable
 * numeric slots. Existing identities are updated in place; new identities are
 * appended after the highest reserved slot, never into a deletion hole.
 */
export function resolveSpatialIdentityUpdates(
  updates: LiveDataUpdate[],
  currentValues: LiveDataMap,
) {
  const workingValues: LiveDataMap = { ...currentValues };
  const ordered = updates.map((update, originalIndex) => ({ originalIndex, update })).sort((left, right) => {
    const leftApartment = /^buildings\.[^.]+\.units\.[^.]+$/.test(left.update.key);
    const rightApartment = /^buildings\.[^.]+\.units\.[^.]+$/.test(right.update.key);
    return Number(leftApartment) - Number(rightApartment);
  });
  const resolved: LiveDataUpdate[] = new Array(updates.length);

  for (const { originalIndex, update } of ordered) {
    const segments = update.key.split(".");
    if (!isRecord(update.value)) {
      // Un dato suelto sobre una entidad ya existente (lo habitual en un parte
      // de obra) sólo necesita que su nombre se traduzca a posición.
      const deepKey = resolveDeepSpatialKey(segments, workingValues);
      const next = deepKey && deepKey !== update.key ? { ...update, key: deepKey } : update;
      resolved[originalIndex] = next;
      workingValues[next.key] = next.value;
      continue;
    }

    let next = update;
    if (segments[0] === "buildings" && segments.length === 2 && !/^\d+$/.test(segments[1])) {
      const token = identityToken(segments[1]);
      const current = materializeLiveRoot("buildings", buildings, workingValues) as Building[];
      const foundIndex = ownEntityIndex(current, token);
      const index = foundIndex >= 0 ? foundIndex : current.length;
      const value = foundIndex >= 0 && isRecord(current[foundIndex])
        ? mergeRecords(current[foundIndex] as unknown as Record<string, LiveDataValue>, update.value)
        : buildingSeed(update.value, segments[1]);
      next = resolvedUpdate(update, `buildings.${index}`, value);
    } else if (
      segments[0] === "buildings" && segments.length === 4 &&
      segments[2] === "units" && !/^\d+$/.test(segments[1]) && !/^\d+$/.test(segments[3])
    ) {
      const buildingToken = identityToken(segments[1]);
      const unitToken = identityToken(segments[3]);
      const current = materializeLiveRoot("buildings", buildings, workingValues) as Building[];
      const buildingIndex = ownEntityIndex(current, buildingToken);
      if (buildingIndex >= 0 && current[buildingIndex]) {
        const units = current[buildingIndex].units;
        const foundIndex = ownEntityIndex(units, unitToken);
        const index = foundIndex >= 0 ? foundIndex : units.length;
        const value = foundIndex >= 0 && isRecord(units[foundIndex])
          ? mergeRecords(units[foundIndex] as unknown as Record<string, LiveDataValue>, update.value)
          : unitSeed(update.value, segments[3]);
        next = resolvedUpdate(update, `buildings.${buildingIndex}.units.${index}`, value);
      }
    } else if (
      segments[0] === "urbanismAreas" && segments.length === 2 && !/^\d+$/.test(segments[1])
    ) {
      const token = identityToken(segments[1]);
      const current = materializeLiveRoot("urbanismAreas", urbanismAreas, workingValues) as UrbanismArea[];
      const foundIndex = ownEntityIndex(current, token);
      const index = foundIndex >= 0 ? foundIndex : current.length;
      const value = foundIndex >= 0 && isRecord(current[foundIndex])
        ? mergeRecords(current[foundIndex] as unknown as Record<string, LiveDataValue>, update.value)
        : urbanismSeed(update.value, segments[1]);
      next = resolvedUpdate(update, `urbanismAreas.${index}`, value);
    }

    resolved[originalIndex] = next;
    workingValues[next.key] = next.value;
  }
  return resolved;
}
