/**
 * Once a file claim exists, its reservation is the durable recovery handle.
 * It may be removed only after rollback is authoritatively confirmed.
 */
export function reviewReservationMayBeDeleted(input: {
  claimWasTaken: boolean;
  rollbackConfirmed: boolean;
}) {
  return !input.claimWasTaken || input.rollbackConfirmed;
}
