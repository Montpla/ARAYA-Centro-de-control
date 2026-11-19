import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateUploadVerification, parseDiscardMessage, PROGRESS_KEY, uploadNeedsVerification } from "../lib/upload-verification.ts";

const now = new Date("2026-11-19T12:00:00Z");
const baseFile = {
  originalName: "Cubicacion_11_Araya_Oct.xlsx",
  extension: "xlsx",
  processingStage: "sincronizado",
  status: "integrado",
  reviewStatus: "aprobado",
  requiresReview: false,
  lastProcessingError: "",
  detectedPeriod: "2026-10-31",
  derivedFromFileId: "",
  supersededByFileId: "",
  deletedAt: "",
  publicationRevision: 125,
  createdAt: "2026-11-18 22:17:45",
};
const baseRun = { status: "published", proposedCount: 39, publishedCount: 33, error: "" };
const evaluate = (overrides = {}) => evaluateUploadVerification({
  file: { ...baseFile, ...(overrides.file ?? {}) },
  run: overrides.run === undefined ? baseRun : overrides.run,
  discardMessages: overrides.discardMessages ?? [],
  pendingProposals: overrides.pendingProposals ?? 0,
  regressions: overrides.regressions ?? [],
  now,
});

test("una carga publicada sin incidencias queda verificada como ok", () => {
  const result = evaluate();
  assert.equal(result.verdict, "ok");
  assert.match(result.summary, /revisión 125/);
});

test("mientras se procesa, el veredicto es pendiente", () => {
  assert.equal(evaluate({ file: { processingStage: "extraccion_en_curso" } }).verdict, "pendiente");
  assert.equal(evaluate({ run: { ...baseRun, status: "running" } }).verdict, "pendiente");
});

test("descartar un dato más antiguo es correcto; otro motivo es una anomalía", () => {
  const antiguo = evaluate({ discardMessages: ["2 por su corte es anterior al ya publicado: safetyMetrics, discoveredSections.3"] });
  assert.equal(antiguo.verdict, "ok");
  const perdido = evaluate({ discardMessages: ["1 por clave no admitida para publicación automática: safetyWeeklySeries"] });
  assert.equal(perdido.verdict, "anomalia");
  assert.match(perdido.checks[0].detail, /safetyWeeklySeries/);
});

test("fallo técnico, revisión manual pendiente y corte futuro son anomalías", () => {
  assert.equal(evaluate({ run: { ...baseRun, status: "failed", error: "Respuesta 404." } }).verdict, "anomalia");
  assert.equal(evaluate({ pendingProposals: 3 }).verdict, "anomalia");
  assert.equal(evaluate({ file: { detectedPeriod: "2026-12-31" } }).verdict, "anomalia");
});

test("un error ya superado de un intento anterior no cuenta si el archivo está sincronizado", () => {
  assert.equal(evaluate({ file: { lastProcessingError: "Respuesta 404." } }).verdict, "ok");
});

test("un avance que retrocede más de un punto es un aviso; el redondeo no", () => {
  const baja = evaluate({ regressions: [{ key: "buildings.3.progress", before: 55.32, after: 40.1 }] });
  assert.equal(baja.verdict, "aviso");
  assert.match(baja.checks[0].detail, /55\.32% a 40\.1%/);
  assert.equal(evaluate({ regressions: [{ key: "buildings.3.progress", before: 55.32, after: 55 }] }).verdict, "ok");
});

test("sin datos extraídos es un aviso, no una anomalía", () => {
  const result = evaluate({ run: { status: "no_data", proposedCount: 0, publishedCount: 0, error: "" }, file: { publicationRevision: null } });
  assert.equal(result.verdict, "aviso");
});

test("archivo sustituido o eliminado no genera alarma", () => {
  assert.equal(evaluate({ file: { supersededByFileId: "otro" }, pendingProposals: 5 }).verdict, "ok");
  assert.equal(evaluate({ file: { deletedAt: "2026-11-19" } }).verdict, "ok");
});

test("lee el formato de datos_descartados", () => {
  assert.deepEqual(parseDiscardMessage("4 por su corte es anterior al ya publicado: monthlyPlan.13.actual, monthlyPlan.14.actual · 1 por no encaja en el contrato del dato vivo: safetyMetrics"), [
    { count: 4, reason: "su corte es anterior al ya publicado", keys: ["monthlyPlan.13.actual", "monthlyPlan.14.actual"] },
    { count: 1, reason: "no encaja en el contrato del dato vivo", keys: ["safetyMetrics"] },
  ]);
});

test("sólo se comparan porcentajes de avance, nunca importes", () => {
  assert.ok(PROGRESS_KEY.test("buildings.12.progress"));
  assert.ok(PROGRESS_KEY.test("monthlyPlan.16.actual"));
  assert.ok(!PROGRESS_KEY.test("cubicacionCaratula"));
  assert.ok(!PROGRESS_KEY.test("projectSnapshot.contractAmount"));
});

test("las cargas que se leen a través de un derivado se verifican por el derivado", () => {
  const base = { derivedFromFileId: "", sizeBytes: 1000, largePdfBytes: 15 * 1024 * 1024 };
  assert.equal(uploadNeedsVerification({ ...base, extension: "xlsx" }), true);
  assert.equal(uploadNeedsVerification({ ...base, extension: "mpp" }), false);
  assert.equal(uploadNeedsVerification({ ...base, extension: "xls" }), false);
  assert.equal(uploadNeedsVerification({ ...base, extension: "pdf", sizeBytes: 30 * 1024 * 1024 }), false);
  assert.equal(uploadNeedsVerification({ ...base, extension: "xml", derivedFromFileId: "mpp-1" }), true);
});

test("la subida pide la verificación sólo en la carga nueva, no en reintentos ni reprocesos", async () => {
  const route = await readFile("app/api/files/route.ts", "utf8");
  assert.match(route, /if \(!resumedRow && !backgroundProcessing && !reprocessRequested && uploadNeedsVerification\(/);
  const workflow = await readFile(".github/workflows/verificar-carga.yml", "utf8");
  assert.match(workflow, /node scripts\/verificar-carga\.mjs/);
});
