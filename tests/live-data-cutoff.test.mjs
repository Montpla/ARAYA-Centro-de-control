import assert from "node:assert/strict";
import test from "node:test";
import { isCutoffOlder } from "../lib/live-data.ts";

test("isCutoffOlder: detecta un corte anterior con granularidad de día", () => {
  assert.equal(isCutoffOlder("2026-08-15", "2026-08-31"), true);
  assert.equal(isCutoffOlder("2026-08-31", "2026-08-15"), false);
});

test("isCutoffOlder: un corte igual no es una regresión", () => {
  assert.equal(isCutoffOlder("2026-08-31", "2026-08-31"), false);
});

test("isCutoffOlder: funciona también con granularidad de mes", () => {
  assert.equal(isCutoffOlder("2026-07", "2026-08"), true);
  assert.equal(isCutoffOlder("2026-08", "2026-07"), false);
});

test("isCutoffOlder: un corte vacío o no ISO nunca autoriza el bloqueo", () => {
  assert.equal(isCutoffOlder("", "2026-08-31"), false);
  assert.equal(isCutoffOlder("2026-08-15", ""), false);
  assert.equal(isCutoffOlder("", ""), false);
  assert.equal(isCutoffOlder("corte de junio", "2026-08-31"), false);
});
