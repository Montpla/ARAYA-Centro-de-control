import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { blockedByHigherPrioritySource, physicalProgressRank } from "../lib/source-precedence.ts";

const informe = "Informe_Ejecutivo_ARAYA_Octubre_Definitivo_v5.pptx";
const cubicacion = "Cubicacion_11_Araya_Oct.xlsx";

test("el informe conserva la línea base del maestro y la precisión del Excel reprogramado", () => {
  assert.equal(blockedByHigherPrioritySource({ key: "monthlyPlan.16.planned", incomingSource: informe, incomingCutoff: "2026-10-31", liveSource: "01 GRAFICOS ARAYA FASE II.xlsx", liveCutoff: "2026-08-31" }), true);
  assert.equal(blockedByHigherPrioritySource({ key: "monthlyPlan.16.reprogrammed", incomingSource: informe, incomingCutoff: "2026-10-31", liveSource: "Curva repogramada Araya.xlsx", liveCutoff: "2026-10-31" }), true);
  assert.equal(blockedByHigherPrioritySource({ key: "monthlyPlan.17.reprogrammed", incomingSource: "Informe Noviembre.pptx", incomingCutoff: "2026-11-30", liveSource: "Curva repogramada Araya.xlsx", liveCutoff: "2026-10-31" }), false);
});

test("el avance físico lo mandan la cubicación y los edificios", () => {
  assert.ok(physicalProgressRank(cubicacion) > physicalProgressRank("Avance edificio.xlsx"));
  assert.ok(physicalProgressRank("Avance edificio.xlsx") > physicalProgressRank("Araya 26 edificios CORTE 30-10-2026 (convertido de MPP).xml"));
  assert.ok(physicalProgressRank("Araya 26 edificios CORTE 30-10-2026 (convertido de MPP).xml") > physicalProgressRank(informe));
  assert.equal(physicalProgressRank("Datos varios.xlsx"), 0);
});

test("el Informe Ejecutivo no pisa lo que la cubicación fijó para el mismo mes", () => {
  // Caso real de octubre: el informe dejó Carpintería al 96,2 %.
  assert.equal(blockedByHigherPrioritySource({
    key: "constructionDisciplines.Carpintería.progress",
    incomingSource: informe, incomingCutoff: "2026-10-31",
    liveSource: cubicacion, liveCutoff: "2026-10-31",
  }), true);
});

test("un periodo nuevo sí entra aunque venga de una fuente de menos prioridad", () => {
  assert.equal(blockedByHigherPrioritySource({
    key: "buildings.3.progress",
    incomingSource: "Informe_Ejecutivo_ARAYA_Noviembre.pptx", incomingCutoff: "2026-11-30",
    liveSource: cubicacion, liveCutoff: "2026-10-31",
  }), false);
});

test("una fuente de más prioridad o igual siempre puede corregir", () => {
  assert.equal(blockedByHigherPrioritySource({
    key: "buildings.3.progress", incomingSource: cubicacion, incomingCutoff: "2026-10-31",
    liveSource: informe, liveCutoff: "2026-10-31",
  }), false);
  assert.equal(blockedByHigherPrioritySource({
    key: "buildings.3.progress", incomingSource: "Cubicacion_12_Araya_Oct_v2.xlsx", incomingCutoff: "2026-10-31",
    liveSource: cubicacion, liveCutoff: "2026-10-31",
  }), false);
});

test("las reglas sólo afectan al avance físico", () => {
  assert.equal(blockedByHigherPrioritySource({
    key: "safetyMetrics", incomingSource: informe, incomingCutoff: "2026-10-31",
    liveSource: cubicacion, liveCutoff: "2026-10-31",
  }), false);
  assert.equal(blockedByHigherPrioritySource({
    key: "monthlyPlan.16.reprogrammed", incomingSource: informe, incomingCutoff: "2026-10-31",
    liveSource: cubicacion, liveCutoff: "2026-10-31",
  }), false);
});

test("la publicación aparta el dato con un motivo que la verificación da por bueno", async () => {
  const route = await readFile("app/api/files/route.ts", "utf8");
  assert.match(route, /!lowerPriorityKeySet\.has\(update\.key\)/);
  assert.match(route, /una fuente con más prioridad ya fijó este dato/);
  const verification = await readFile("lib/upload-verification.ts", "utf8");
  assert.match(verification, /"una fuente con más prioridad ya fijó este dato"/);
});
