import assert from "node:assert/strict";
import test from "node:test";
import { urbanismAreas } from "../app/demo-data.ts";
import { urbanismReportAreas } from "../app/june-report-data.ts";
import { deriveUrbanismMapAreas } from "../lib/urbanism-map-progress.ts";

test("el plano enlaza Vialidad y Paisajismo con sus porcentajes reales", () => {
  const mapped = deriveUrbanismMapAreas(urbanismAreas, urbanismReportAreas);
  const roads = mapped.find((area) => area.id === "urban-roads");
  const landscape = mapped.find((area) => area.id === "urban-landscape");

  assert.equal(roads?.progress, 6.33);
  assert.equal(landscape?.progress, 12.24);
  assert.equal(roads?.status, "integrado");
  assert.equal(landscape?.status, "integrado");
  assert.match(roads?.source ?? "", /Vialidad/);
  assert.match(landscape?.source ?? "", /Paisajismo/);
});

test("un avance específico del área espacial tiene prioridad sobre el informe", () => {
  const mapped = deriveUrbanismMapAreas(
    urbanismAreas.map((area) =>
      area.id === "urban-roads" ? { ...area, progress: 9.75 } : area),
    urbanismReportAreas,
  );

  assert.equal(mapped.find((area) => area.id === "urban-roads")?.progress, 9.75);
});

test("un cero espacial de plantilla no oculta un avance acumulado positivo", () => {
  const mapped = deriveUrbanismMapAreas(
    urbanismAreas.map((area) =>
      area.id === "urban-roads" || area.id === "urban-landscape"
        ? { ...area, progress: 0 }
        : area),
    urbanismReportAreas,
  );

  assert.equal(mapped.find((area) => area.id === "urban-roads")?.progress, 6.33);
  assert.equal(mapped.find((area) => area.id === "urban-landscape")?.progress, 12.24);
});

test("el enlace no altera el indicador consolidado de urbanismo", () => {
  const mapped = deriveUrbanismMapAreas(urbanismAreas, urbanismReportAreas);
  assert.equal(mapped.find((area) => area.id === "urban-general")?.progress, 18.28);
  assert.equal(urbanismAreas.find((area) => area.id === "urban-roads")?.progress, null);
});
