import assert from "node:assert/strict";
import test from "node:test";

import { inferUploadAreaFromContent } from "../lib/file-routing.ts";

test("un nombre neutro se dirige a Obra por los edificios encontrados", () => {
  const result = inferUploadAreaFromContent({
    initialArea: "sin_clasificar",
    initialConfidence: 0,
    documentType: "documento_general",
    updateKeys: ["buildings.TH-76.progress", "buildings.TH-77.progress"],
  });

  assert.equal(result.area, "obra");
  assert.ok(result.confidence >= 0.9);
  assert.match(result.reason, /contenido/i);
});

test("el contenido de seguridad no depende del nombre del archivo", () => {
  const result = inferUploadAreaFromContent({
    initialArea: "sin_clasificar",
    initialConfidence: 0,
    documentType: "documento_general",
    updateKeys: ["safetyMetrics", "safetyWeeklySeries"],
  });

  assert.equal(result.area, "seguridad");
});

test("la selección expresa del usuario no se mueve por una señal secundaria", () => {
  const result = inferUploadAreaFromContent({
    initialArea: "urbanismo",
    initialConfidence: 1,
    documentType: "evidencia_fotografica",
    updateKeys: ["buildings.TH-14.progress"],
  });

  assert.equal(result.area, "urbanismo");
  assert.equal(result.changed, false);
});

test("una mezcla ambigua permanece pendiente en vez de adivinar", () => {
  const result = inferUploadAreaFromContent({
    initialArea: "sin_clasificar",
    initialConfidence: 0,
    documentType: "documento_general",
    updateKeys: ["buildings.TH-14.progress", "safetyMetrics"],
  });

  assert.equal(result.area, "sin_clasificar");
  assert.match(result.reason, /mezcla/i);
});

