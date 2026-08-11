export const LIVE_DATA_PUBLICATION_LEASE_MS = 5 * 60 * 1_000;

export type PublicationPointState = {
  key: string;
  revision: number;
};

export type PublicationEventState = {
  id: number;
  status: string;
  createdAt: string;
};

export type CanonicalPublicationPoint = PublicationPointState & {
  valueJson: string;
  valueType: string;
  area: string;
  sourceFileId: string;
  sourceName: string;
  sourceCurrency: string;
  cutoff: string;
  updatedByEmail: string;
  updatedByName: string;
  updatedAt: string;
};

export type PublicationPointRepair = {
  key: string;
  staleRevision: number;
  replacement: CanonicalPublicationPoint | null;
};

export type PublicationRecoveryPlan = {
  repairs: PublicationPointRepair[];
  blocked: PublicationPointState[];
  staleEventIds: number[];
};

export function publicationKeyConflict(keys: string[]) {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) return { duplicate: key, ancestor: "", descendant: "" };
    seen.add(key);
  }
  for (const descendant of seen) {
    const segments = descendant.split(".");
    for (let depth = 1; depth < segments.length; depth += 1) {
      const ancestor = segments.slice(0, depth).join(".");
      if (seen.has(ancestor)) return { duplicate: "", ancestor, descendant };
    }
  }
  return null;
}

function preparingLeaseExpired(
  event: PublicationEventState,
  nowMs: number,
  leaseMs: number,
) {
  const createdAtMs = Date.parse(event.createdAt);
  return Number.isFinite(createdAtMs) && nowMs - createdAtMs >= leaseMs;
}

/**
 * Plans repair of the mutable cache only. Canonical values always come from
 * immutable, published history, so an interrupted publication can be removed
 * without guessing which partial value was intended to win.
 */
export function planStalePublicationRecovery(input: {
  points: PublicationPointState[];
  events: PublicationEventState[];
  canonicalPoints: CanonicalPublicationPoint[];
  nowMs?: number;
  leaseMs?: number;
}): PublicationRecoveryPlan {
  const nowMs = input.nowMs ?? Date.now();
  const leaseMs = input.leaseMs ?? LIVE_DATA_PUBLICATION_LEASE_MS;
  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const canonicalByKey = new Map(input.canonicalPoints.map((point) => [point.key, point]));
  const repairs: PublicationPointRepair[] = [];
  const blocked: PublicationPointState[] = [];
  const staleEventIds = new Set<number>();

  for (const point of input.points) {
    const event = eventById.get(point.revision);
    if (event?.status === "published") continue;

    const recoverable = !event ||
      event.status !== "preparing" ||
      preparingLeaseExpired(event, nowMs, leaseMs);
    if (!recoverable) {
      blocked.push(point);
      continue;
    }

    repairs.push({
      key: point.key,
      staleRevision: point.revision,
      replacement: canonicalByKey.get(point.key) ?? null,
    });
    if (event) staleEventIds.add(event.id);
  }

  return {
    repairs,
    blocked,
    staleEventIds: [...staleEventIds],
  };
}
