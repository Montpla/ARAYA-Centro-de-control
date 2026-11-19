import assert from "node:assert/strict";
import test from "node:test";
import { prepareNarrativeUpdate, complementaryNarrativeUpdateAllowed } from "../lib/narrative-update-scope.ts";

test("el informe mixto conserva Seguridad y traduce sólo el alias conocido del corte", () => {
  assert.deepEqual(prepareNarrativeUpdate({key:"safetyMetrics",value:[],area:"sin_clasificar"}), {key:"safetyMetrics",value:[],area:"seguridad"});
  assert.equal(prepareNarrativeUpdate({key:"projectSnapshot.declaredCutoff",value:"2026-10-31"}).key,"projectSnapshot.cutoff");
  const financial={key:"reprogrammedFlowAudit.cutoff",value:"2026-10-31",area:"finanzas"};
  assert.deepEqual(prepareNarrativeUpdate(financial),financial);
});

test("el resumen mensual no reemplaza semanas, pero los reportes semanales conservan su circuito", () => {
  assert.equal(complementaryNarrativeUpdateAllowed("safetyWeeklySeries","Informe_Ejecutivo_Octubre.pptx",["safetyMetrics"]),false);
  assert.equal(complementaryNarrativeUpdateAllowed("safetyWeeklySeries.3","Informe_Ejecutivo_Octubre.pptx",["safetyMetrics"]),false);
  assert.equal(complementaryNarrativeUpdateAllowed("safetyWeeklySeries","Reporte semanal S4.pdf",[]),true);
  assert.equal(complementaryNarrativeUpdateAllowed("safetyFindings","Informe_Ejecutivo_Octubre.pptx",["safetyMetrics"]),true);
});
