export type ComparableLiveUpdate = {
  key: string;
  valueJson: string;
};

type CurrentLivePoint = {
  key: string;
  valueJson: string;
};

type ConfidenceCandidate = ComparableLiveUpdate & {
  confidence: number;
};

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalJsonValue(nested)]),
  );
}

function canonicalJson(valueJson: string) {
  try {
    return JSON.stringify(canonicalJsonValue(JSON.parse(valueJson) as unknown));
  } catch {
    return valueJson;
  }
}

export function liveValueJsonEquals(left: string, right: string) {
  return canonicalJson(left) === canonicalJson(right);
}

/**
 * Separates real changes from values that are already effective.
 *
 * An unchanged upload remains auditable as a processed file, but it must not
 * create a new live revision, rewrite provenance or notify users that a value
 * changed when it did not.
 */
export function partitionChangedLiveUpdates<T extends ComparableLiveUpdate>(
  updates: T[],
  currentPoints: CurrentLivePoint[],
) {
  const currentByKey = new Map(currentPoints.map((point) => [point.key, point.valueJson]));
  const changed: T[] = [];
  const unchanged: T[] = [];
  for (const update of updates) {
    const current = currentByKey.get(update.key);
    if (current !== undefined && liveValueJsonEquals(current, update.valueJson)) {
      unchanged.push(update);
    } else {
      changed.push(update);
    }
  }
  return { changed, unchanged };
}

function confidenceIdentity(update: ComparableLiveUpdate) {
  return `${update.key}\u0000${canonicalJson(update.valueJson)}`;
}

/**
 * Keeps confidence attached to the fact itself instead of to an array index.
 * Identity resolution, resilient normalization and conflict removal can all
 * reorder or discard updates; positional confidence therefore is unsafe.
 */
export function resolveNormalizedUpdateConfidences<T extends ComparableLiveUpdate>(
  updates: T[],
  candidates: ConfidenceCandidate[],
  fallbackConfidence = 0,
) {
  const confidenceByIdentity = new Map<string, number>();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.confidence)) continue;
    const confidence = Math.max(0, Math.min(1, candidate.confidence));
    const identity = confidenceIdentity(candidate);
    confidenceByIdentity.set(identity, Math.max(confidenceByIdentity.get(identity) ?? 0, confidence));
  }
  const fallback = Number.isFinite(fallbackConfidence)
    ? Math.max(0, Math.min(1, fallbackConfidence))
    : 0;
  return updates.map((update) => confidenceByIdentity.get(confidenceIdentity(update)) ?? fallback);
}

type DynamicSectionCandidate = {
  title: string;
  area: string;
};

type DynamicSectionSlot = {
  key: string;
  existingId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sectionIdentity(title: string, area: string) {
  return `${area}|${title}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "-")
    .replace(/-+/g, "-");
}

/** Reuses the same visual block for recurring weekly/monthly concepts. */
export function planDynamicSectionSlots(
  candidates: DynamicSectionCandidate[],
  currentValues: Record<string, unknown>,
): DynamicSectionSlot[] {
  const existingByIdentity = new Map<string, { index: number; id: string }>();
  const knownIndices = new Set<number>();
  const register = (value: unknown, index: number) => {
    if (!isRecord(value)) return;
    knownIndices.add(index);
    const title = typeof value.title === "string" ? value.title : "";
    const area = typeof value.area === "string" ? value.area : "";
    if (!title) return;
    existingByIdentity.set(sectionIdentity(title, area), {
      index,
      id: typeof value.id === "string" ? value.id : "",
    });
  };
  const root = currentValues.discoveredSections;
  if (Array.isArray(root)) root.forEach(register);
  for (const [key, value] of Object.entries(currentValues)) {
    const match = key.match(/^discoveredSections\.(\d+)$/);
    if (match) register(value, Number(match[1]));
  }
  let nextIndex = knownIndices.size ? Math.max(...knownIndices) + 1 : 0;
  const assigned = new Map<string, { index: number; id: string }>();
  return candidates.map((candidate) => {
    const identity = sectionIdentity(candidate.title, candidate.area);
    let slot = assigned.get(identity) ?? existingByIdentity.get(identity);
    if (!slot) {
      slot = { index: nextIndex, id: "" };
      nextIndex += 1;
    }
    assigned.set(identity, slot);
    return { key: `discoveredSections.${slot.index}`, existingId: slot.id };
  });
}
