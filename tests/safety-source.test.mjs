import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { describeSafetySource } from "../lib/safety-source.ts";

test("Seguridad dice con qué reporte trabaja el panel, su corte y cuándo se publicó", () => {
  const result = describeSafetySource({
    sourceName: "ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.4  26-10-2026  al  31-10-2026.pdf",
    cutoff: "2026-10-31",
    updatedAt: "2026-11-18T14:40:00Z",
  });
  assert.equal(result.cutoffLabel, "31/10/2026");
  assert.equal(result.periodLabel, "octubre 2026");
  assert.match(result.sentence, /Semana No\.4/);
  assert.match(result.sentence, /corte 31\/10\/2026, publicado el 18\/11\/2026/);
});

test("sin reporte publicado no inventa una fuente", () => {
  const result = describeSafetySource(undefined);
  assert.equal(result.sourceName, "");
  assert.match(result.sentence, /Todavía no se ha publicado/);
});

test("la pestaña de Seguridad ya no lleva el mes ni los accidentes escritos a mano", async () => {
  const panel = await readFile("app/dashboard-client.tsx", "utf8");
  assert.doesNotMatch(panel, /CONTROL TRANSVERSAL · JUNIO 2026/);
  assert.doesNotMatch(panel, /detail: "0 accidentes"/);
  assert.match(panel, /describeSafetySource\(provenance\.safetyMetrics\)/);
});
