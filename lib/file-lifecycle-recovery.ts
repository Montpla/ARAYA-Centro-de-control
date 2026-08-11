export const FILE_LIFECYCLE_LEASE_MS = 5 * 60 * 1_000;

export type FileLifecycleRetryDecision = "apply" | "idempotent" | "wait" | "reconcile";

export function decideFileLifecycleRetry(input: {
  desiredStateApplied: boolean;
  stateMarker: string;
  latestPublishedAt?: string | null;
  latestPreparingAt?: string | null;
  nowMs?: number;
  leaseMs?: number;
}): FileLifecycleRetryDecision {
  if (!input.desiredStateApplied) return "apply";
  if (input.stateMarker && input.latestPublishedAt && input.latestPublishedAt >= input.stateMarker) {
    return "idempotent";
  }

  const preparingAtMs = Date.parse(input.latestPreparingAt ?? "");
  const nowMs = input.nowMs ?? Date.now();
  const leaseMs = input.leaseMs ?? FILE_LIFECYCLE_LEASE_MS;
  if (Number.isFinite(preparingAtMs) && nowMs - preparingAtMs < leaseMs) return "wait";
  return "reconcile";
}
