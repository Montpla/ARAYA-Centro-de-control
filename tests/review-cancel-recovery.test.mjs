import assert from "node:assert/strict";
import test from "node:test";
import { reviewReservationMayBeDeleted } from "../lib/review-cancel-recovery.ts";

test("a failed file rollback preserves the reservation that owns the processing lease", () => {
  const file = { reviewStatus: "procesando_prepare" };
  const reservations = new Map([[7, { id: 7, action: "procesando_prepare" }]]);

  // Fault model: the file rollback failed, while reservation deletion itself
  // would have succeeded. Policy must retain the recovery handle.
  const mayDelete = reviewReservationMayBeDeleted({
    claimWasTaken: true,
    rollbackConfirmed: false,
  });
  if (mayDelete) reservations.delete(7);

  assert.equal(file.reviewStatus, "procesando_prepare");
  assert.equal(mayDelete, false);
  assert.equal(reservations.get(7)?.action, file.reviewStatus);
});

test("an unclaimed reservation can be removed after the file CAS loses the race", () => {
  assert.equal(reviewReservationMayBeDeleted({
    claimWasTaken: false,
    rollbackConfirmed: false,
  }), true);
});

test("a claimed reservation can be removed once rollback is authoritatively confirmed", () => {
  assert.equal(reviewReservationMayBeDeleted({
    claimWasTaken: true,
    rollbackConfirmed: true,
  }), true);
});
