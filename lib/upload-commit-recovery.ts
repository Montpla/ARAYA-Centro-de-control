export type UploadCommitEvidence = {
  id: string;
  deletedAt: string;
  sha256: string;
  storageKey: string;
};

export type ProposalPointerEvidence = {
  proposalGeneration: string;
  updatedAt: string;
};

/**
 * Resolves an insert whose D1 response was lost. The R2 object can only be
 * treated as unreferenced after this exact identity check has failed.
 */
export function uploadInsertWasCommitted(input: {
  row?: UploadCommitEvidence;
  id: string;
  sha256: string;
  storageKey: string;
}) {
  return input.row?.id === input.id &&
    input.row.deletedAt === "" &&
    input.row.sha256 === input.sha256 &&
    input.row.storageKey === input.storageKey;
}

/**
 * A committed generation pointer is authoritative even if the UPDATE promise
 * rejected locally. Its proposal rows must never be rolled back or deleted.
 */
export function proposalPointerWasCommitted(input: {
  row?: ProposalPointerEvidence;
  generation: string;
  committedAt?: string;
}) {
  if (!input.row || input.row.proposalGeneration !== input.generation) return false;
  return input.committedAt === undefined || input.row.updatedAt === input.committedAt;
}

/** Cleanup is allowed only after a successful authoritative read disproves the pointer. */
export function stagedGenerationMayBeDeleted(input: {
  authoritativeReadSucceeded: boolean;
  pointerCommitted: boolean;
}) {
  return input.authoritativeReadSucceeded && !input.pointerCommitted;
}
