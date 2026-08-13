import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Guarda contra la clase de bug que motivó esta suite: un resumen calculado
// a partir de otros datos en vivo (antonelyDetailTotals, plannedProgress...)
// que se queda congelado porque nadie recordó conectarlo. Cada campo nuevo
// de este tipo que se añada en el futuro debe aparecer en una de las listas
// de abajo — si no aparece en ninguna, esta prueba no lo detecta, así que al
// añadir un resumen derivado nuevo hay que añadir aquí su comprobación.

// Resúmenes envueltos en computedView(): cada lectura de un campo recalcula
// sola, así que no hay copia que se pueda quedar congelada.
const COMPUTED_VIEW_SUMMARIES = [
  "antonelyDetailTotals",
  "typeABudgetSummary",
  "juneDeviationSummary",
  "procurementAudit",
  "dataGovernanceSummary",
  "supplierContactAudit",
];

test("computed-view summaries recompute on every read and never enter the snapshot-freeze target list", async () => {
  const dashboard = await readFile("app/dashboard-client.tsx", "utf8");

  for (const name of COMPUTED_VIEW_SUMMARIES) {
    assert.match(
      dashboard,
      new RegExp(`\\b${name}\\s*=\\s*computedView\\(`),
      `${name} debe construirse con computedView(...) en installDashboardBootstrap`,
    );
  }

  // applyLiveValuesToTargets clona el target la primera vez que lo ve y
  // cachea ese clon para siempre (lib/live-data.ts, liveTargetBaselines).
  // Si un computedView entra en liveDataTargets, ese clon congela su primer
  // valor calculado y deshace por completo el propósito de computedView —
  // fue un bug real encontrado y corregido el mismo día que se escribió esta
  // prueba. liveDataTargets es el único bloque donde esto puede colarse.
  const targetsBlock = dashboard.match(/liveDataTargets = \{([\s\S]*?)\n {2}\};/)?.[1] ?? "";
  assert.ok(targetsBlock.length > 0, "no se pudo extraer el bloque liveDataTargets del archivo");
  for (const name of COMPUTED_VIEW_SUMMARIES) {
    // Coincide solo con la forma abreviada de un literal de objeto
    // (`nombre,` sola en su línea), no con menciones dentro de un
    // comentario explicativo como el que justifica esta misma exclusión.
    assert.doesNotMatch(
      targetsBlock,
      new RegExp(`^\\s*${name},\\s*$`, "m"),
      `${name} es un computedView y no debe listarse en liveDataTargets`,
    );
  }
});

test("dataAuthorityMatrix's live decision text is synced centrally, not only inside SourcesView's render", async () => {
  const dashboard = await readFile("app/dashboard-client.tsx", "utf8");
  const syncFunction = dashboard.match(/function synchronizeSpatialSummary\(\) \{[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(
    syncFunction,
    /dataAuthorityMatrix = liveDataAuthorityMatrix\(/,
    "dataAuthorityMatrix debe reasignarse dentro de synchronizeSpatialSummary, para que cualquier pantalla que lo lea (no solo SourcesView) reciba el texto de decisión/status en vivo",
  );
});

test("overallProgress and plannedProgress always come from the same monthlyPlan cutoff entry, never two separately-tracked fields", async () => {
  const [spatialLiveData, dashboard] = await Promise.all([
    readFile("lib/spatial-live-data.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
  ]);

  // Servidor: lib/spatial-live-data.ts
  assert.match(
    spatialLiveData,
    /const overallProgress = cutoffEntry\?\.actual/,
    "overallProgress debe leerse del mismo cutoffEntry que plannedProgress (servidor)",
  );
  assert.match(
    spatialLiveData,
    /const plannedProgress = cutoffEntry\?\.planned/,
    "plannedProgress debe leerse del mismo cutoffEntry que overallProgress (servidor); si esto falta, el KPI puede quedarse comparando un mes distinto al del avance físico (bug real, corregido el 13/08/2026)",
  );

  // Cliente: app/dashboard-client.tsx (synchronizeSpatialSummary)
  assert.match(
    dashboard,
    /cutoffActual = entry\.actual;\s*\n\s*cutoffPlanned = entry\.planned;/,
    "overallProgress y plannedProgress deben leerse de la misma entrada de monthlyPlan en el espejo cliente",
  );
  assert.match(
    dashboard,
    /projectSnapshot\.overallProgress = cutoffActual;\s*\n\s*projectSnapshot\.plannedProgress = cutoffPlanned;/,
    "la reasignación cliente debe fijar overallProgress y plannedProgress juntos, en el mismo bloque",
  );
});
