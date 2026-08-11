import assert from "node:assert/strict";
import test from "node:test";
import {
  proposalPointerWasCommitted,
  stagedGenerationMayBeDeleted,
  uploadInsertWasCommitted,
} from "../lib/upload-commit-recovery.ts";

test("a D1 insert that commits before its response is lost keeps the only R2 original", () => {
  const id = "file-1";
  const sha256 = "abc123";
  const storageKey = `araya/obra/2026/08/${id}-informe.pdf`;
  const r2Objects = new Set([storageKey]);
  const rows = [{ id, deletedAt: "", sha256, storageKey }];

  // Fault model: INSERT committed in D1, then the driver threw locally.
  const committed = uploadInsertWasCommitted({ row: rows[0], id, sha256, storageKey });
  if (!committed) r2Objects.delete(storageKey);

  assert.equal(rows.length, 1);
  assert.equal(committed, true);
  assert.equal(r2Objects.has(storageKey), true, "the referenced R2 object must remain retrievable");
});

test("a generation pointer that commits before its response is lost is never rolled back", () => {
  const generation = "ingest:g-1";
  const committedAt = "2026-08-11T00:00:00.000Z";
  const file = { proposalGeneration: generation, updatedAt: committedAt };
  const proposals = new Map([[generation, [{ key: "progress.actual", value: 20 }]]]);

  // Fault model: pointer UPDATE committed, then its promise rejected locally.
  const committed = proposalPointerWasCommitted({ row: file, generation, committedAt });
  if (!committed) proposals.delete(generation);

  assert.equal(committed, true);
  assert.equal(proposals.get(generation)?.length, 1, "the active proposal generation must remain complete");
});

test("recovery evidence rejects mismatched storage identities and proposal generations", () => {
  assert.equal(uploadInsertWasCommitted({
    row: { id: "file-1", deletedAt: "", sha256: "other", storageKey: "object-a" },
    id: "file-1",
    sha256: "expected",
    storageKey: "object-a",
  }), false);
  assert.equal(proposalPointerWasCommitted({
    row: { proposalGeneration: "old", updatedAt: "t1" },
    generation: "new",
  }), false);
});

test("verification outages preserve staged upload and review generations after an ambiguous commit", () => {
  const staged = new Map([
    ["ingest:g-2", [{ key: "progress.actual" }]],
    ["review:req-2", [{ key: "schedule.current" }]],
  ]);

  // Fault model for both paths: atomic commit returned an error and every
  // authoritative verification read also failed. Unknown is never evidence
  // that a staged generation is unreferenced.
  const mayDeleteUpload = stagedGenerationMayBeDeleted({
    authoritativeReadSucceeded: false,
    pointerCommitted: false,
  });
  const mayDeleteReview = stagedGenerationMayBeDeleted({
    authoritativeReadSucceeded: false,
    pointerCommitted: false,
  });
  if (mayDeleteUpload) staged.delete("ingest:g-2");
  if (mayDeleteReview) staged.delete("review:req-2");

  assert.equal(mayDeleteUpload, false);
  assert.equal(mayDeleteReview, false);
  assert.equal(staged.size, 2, "unknown commit outcomes must preserve both staged generations");
});
