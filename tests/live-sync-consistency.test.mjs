import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { buildings, monthlyPlan, overallProgressNow, projectSnapshot } from "../app/demo-data.ts";
import { safetyWeeklySeries } from "../app/june-report-data.ts";
import { liveJuneReportFinance } from "../lib/live-derivations.ts";
import { LIVE_DATA_ROOTS } from "../lib/live-data.ts";
import { clearTrailingMonthlyActualPlaceholders } from "../lib/monthly-plan.ts";

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

test("every accepted live-data root has a declared client or endpoint consumer", async () => {
  const [dashboard, payablesRoute] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/payables/route.ts", "utf8"),
  ]);
  const targetsBlock = dashboard.match(/liveDataTargets = \{([\s\S]*?)\n {2}\};/)?.[1] ?? "";
  assert.ok(targetsBlock.length > 0, "no se pudo extraer liveDataTargets");
  const clientRoots = new Set(
    [...targetsBlock.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*)(?::[^,]+)?,\s*$/gm)]
      .map((match) => match[1]),
  );
  const endpointRoots = new Set(["antonelyPayableInvoiceLines"]);
  assert.match(
    payablesRoute,
    /materializeLiveRoot\(\s*["']antonelyPayableInvoiceLines["']/,
    "la excepción de facturas debe seguir materializándose en /api/payables",
  );

  const uncovered = LIVE_DATA_ROOTS.filter((root) =>
    !clientRoots.has(root) && !endpointRoots.has(root));
  assert.deepEqual(
    uncovered,
    [],
    `raíces aceptadas sin consumidor sincronizado: ${uncovered.join(", ")}`,
  );
});

test("el avance físico oficial de julio es 22,71% y no la media simple de edificios", () => {
  const buildingAverage = Math.round(
    (buildings.reduce((sum, building) => sum + building.progress, 0) / buildings.length) * 100,
  ) / 100;
  assert.notEqual(buildingAverage, 22.71);
  assert.equal(overallProgressNow, 22.71);
  assert.equal(projectSnapshot.overallProgress, 22.71);
  assert.equal(monthlyPlan.at(-1)?.actual, null);
  assert.equal(monthlyPlan.findLast((entry) => entry.actual !== null)?.actual, 22.71);
});

test("los ceros de fórmula de meses futuros no desplazan el corte de la Curva S", () => {
  const planContaminado = monthlyPlan.map((point) => ({
    ...point,
    actual: point.actual ?? 0,
  }));

  const limpiados = clearTrailingMonthlyActualPlaceholders(planContaminado);
  assert.equal(limpiados, monthlyPlan.length - 14);
  assert.equal(planContaminado[13].actual, 22.71);
  assert.ok(planContaminado.slice(14).every((point) => point.actual === null));

  const corte = planContaminado.findLast((point) => point.actual !== null);
  assert.equal(corte.actual, 22.71);
  assert.equal(corte.planned, 26.61);
});

test("una Curva S que todavía está realmente a cero conserva sus ceros iniciales", () => {
  const sinArrancar = [
    { month: "jun 25", planned: 0, actual: 0 },
    { month: "jul", planned: 0.52, actual: 0 },
  ];
  assert.equal(clearTrailingMonthlyActualPlaceholders(sinArrancar), 0);
  assert.deepEqual(sinArrancar.map((point) => point.actual), [0, 0]);
});

test("el resumen financiero sigue las cuentas del último periodo", () => {
  const report = {
    finance: {
      cxpDop: 0,
      advancesPendingDop: 0,
      projectedCashDecemberDop: 0,
      assetsDop: 0,
      liabilitiesDop: 0,
      equityDop: 0,
      liquidityDop: 0,
      clientDepositsDop: 0,
      budgetDop: 1_000,
      executedDop: 100,
      juneExecutedDop: 10,
      remainingDop: 900,
    },
  };
  const derived = liveJuneReportFinance(
    report,
    { payablesTotalDop: 20, advancePendingDop: 30 },
    [],
    [],
    [
      { june: 40, cumulative: 300 },
      { june: 60, cumulative: 200 },
    ],
  );
  assert.equal(derived.finance.juneExecutedDop, 100);
  assert.equal(derived.finance.executedDop, 500);
  assert.equal(derived.finance.remainingDop, 500);
});

test("seguridad conserva una serie semanal viva y ordenada", () => {
  assert.ok(LIVE_DATA_ROOTS.includes("safetyWeeklySeries"));
  assert.deepEqual(safetyWeeklySeries.map((week) => week.week), ["S1", "S2", "S3", "S4"]);
  assert.equal(safetyWeeklySeries.at(-1)?.hoursCumulative, 192);
  assert.equal(safetyWeeklySeries.at(-1)?.observationsCumulative, 24);
});

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
  const syncFunction = dashboard.match(/function synchronizeDerivedDashboardState\(\) \{[\s\S]*?\r?\n}\r?\n/)?.[0] ?? "";
  assert.match(
    syncFunction,
    /dataAuthorityMatrix = liveDataAuthorityMatrix\(/,
    "dataAuthorityMatrix debe reasignarse dentro de synchronizeDerivedDashboardState, para que cualquier pantalla que lo lea (no solo SourcesView) reciba el texto de decisión/status en vivo",
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
  assert.match(
    spatialLiveData,
    /clearTrailingMonthlyActualPlaceholders\(monthlyPlan\)/,
    "el servidor debe retirar los ceros de fórmula futuros antes de calcular el corte",
  );

  // Cliente: app/dashboard-client.tsx (synchronizeDerivedDashboardState)
  assert.match(
    dashboard,
    /cutoffActual = cutoffIndex >= 0 \? monthlyPlan\[cutoffIndex\]\.actual[\s\S]{0,80}cutoffPlanned = cutoffIndex >= 0 \? monthlyPlan\[cutoffIndex\]\.planned/,
    "overallProgress y plannedProgress deben leerse de la misma entrada de monthlyPlan en el espejo cliente",
  );
  assert.match(
    dashboard,
    /projectSnapshot\.overallProgress = cutoffActual;\s*\n\s*projectSnapshot\.plannedProgress = cutoffPlanned;/,
    "la reasignación cliente debe fijar overallProgress y plannedProgress juntos, en el mismo bloque",
  );
  assert.match(
    dashboard,
    /clearTrailingMonthlyActualPlaceholders\(monthlyPlan\)/,
    "el cliente debe retirar los ceros de fórmula futuros antes de pintar resumen y Curva S",
  );
  // El avance físico oficial no se puede sustituir por la media simple de los
  // 26 edificios: no pondera el monto total de obra y produjo el 19,39% falso.
  assert.doesNotMatch(
    spatialLiveData,
    /projectProgressFromBuildings\(buildings\)/,
    "el servidor no debe reemplazar la Curva S con el promedio de edificios",
  );
  assert.doesNotMatch(
    dashboard,
    /projectProgressFromBuildings\(buildings\)/,
    "el cliente no debe reemplazar la Curva S con el promedio de edificios",
  );
  // El avance de "edificios en marcha" también se deriva en vivo (servidor y
  // cliente), no es un número aparte que se congele.
  assert.match(
    spatialLiveData,
    /activeBuildingsProgress\(buildings\)/,
    "el avance de edificios en marcha del servidor sale de los edificios",
  );
  assert.match(
    dashboard,
    /activeBuildingsProgress\(buildings\)/,
    "el avance de edificios en marcha del cliente sale de los edificios",
  );
  // El % consolidado de urbanismo procede de urban-general; las subáreas no se
  // promedian con el total porque son un desglose de ese mismo KPI.
  assert.match(
    spatialLiveData,
    /urbanismAreas\.find\(\(area\) => area\.id === "urban-general"\)/,
    "el urbanismo del servidor sale del indicador consolidado urban-general",
  );
  assert.match(
    dashboard,
    /urbanismAreas\.find\(\(area\) => area\.id === "urban-general"\)/,
    "el urbanismo del cliente sale del indicador consolidado urban-general",
  );
  assert.match(
    spatialLiveData,
    /deriveUrbanismMapAreas\(spatialUrbanismAreas, urbanismReportAreas\)/,
    "servidor, agente y sala operativa deben reconciliar el plano con el informe de urbanismo",
  );
  assert.match(
    dashboard,
    /deriveUrbanismMapAreas\(urbanismAreas, urbanismReportAreas\)/,
    "el cliente debe reconciliar el plano con el informe en la derivación central",
  );
  assert.match(
    dashboard,
    /const mapUrbanismAreas = urbanismAreas;/,
    "el plano debe consumir el estado reconciliado, no ejecutar una derivación privada",
  );
  assert.match(
    dashboard,
    /applyLiveValuesToTargets\([\s\S]{0,180}synchronizeDerivedDashboardState[\s\S]{0,20}\);/,
    "cada revisión debe aplicar raíces y derivados en una sola transacción cliente",
  );
});

// Guarda contra la misma clase de bug en un sitio distinto: app/data-center/
// [...path]/route.ts nunca sirve estos archivos desde dist/client
// (run_worker_first en wrangler.deploy.jsonc); siempre lee de R2 bajo la
// clave historical${pathname}. Un archivo listo en historical/data-center/
// pero nunca subido a R2 se ve perfecto en el repo y devuelve 404 en
// producción — así estuvieron rotos los 23 documentos fijos del Centro de
// Control (guía corporativa, fuentes de junio/julio, balances del
// fideicomiso) desde que se crearon, sin que ninguna prueba lo detectara.
test("every /data-center/ document referenced from the app exists on disk and the deploy pipeline syncs all of them to R2", async () => {
  const [dashboard, demoData, payableInvoices, syncScript, deployScript] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("app/antonely-payable-invoices.ts", "utf8"),
    readFile("scripts/sync-historical-documents.mjs", "utf8"),
    readFile("scripts/deploy.mjs", "utf8"),
  ]);

  const referencedPaths = new Set();
  for (const source of [dashboard, demoData, payableInvoices]) {
    for (const match of source.matchAll(/\/data-center\/[^"'`\s)]+/g)) {
      referencedPaths.add(match[0]);
    }
  }
  assert.ok(
    referencedPaths.size > 0,
    "no se encontró ninguna referencia /data-center/ en el código — ¿cambió el patrón de búsqueda?",
  );

  for (const referencedPath of referencedPaths) {
    await assert.doesNotReject(
      access(`historical${referencedPath}`),
      `${referencedPath} se referencia en la app pero no existe en historical/data-center/ (quedaría en 404 en producción)`,
    );
  }

  // Ningún documento debe volver a colocarse bajo public/data-center/: vinext
  // registra todo public/ como rutas de archivo estático que eclipsan a
  // app/data-center/[...path]/route.ts (orden de Next.js: archivo público
  // gana a ruta dinámica), y como public/.assetsignore excluye data-center/**
  // de los activos desplegados, la petición terminaba en env.ASSETS.fetch()
  // con un 404 de cuerpo vacío. Esa fue la causa raíz del 404 de producción
  // de los 23 documentos fijos (13/08/2026).
  await assert.rejects(
    access("public/data-center"),
    "public/data-center/ no debe existir: un archivo ahí eclipsa a route.ts y vuelve a producir el 404 vacío en producción",
  );

  // El script de sincronización debe recorrer todo historical/data-center/,
  // no depender de una lista a mano que alguien tenga que recordar actualizar
  // cada vez que se añade un documento nuevo.
  assert.match(syncScript, /collectFiles\(SOURCE_DIR\)/);
  assert.match(syncScript, /historical\/data-center\/\$\{relativePath\}/);

  // Y el pipeline de despliegue debe ejecutarlo siempre, no como paso manual
  // aparte que alguien tenga que recordar correr.
  assert.match(deployScript, /sync-historical-documents\.mjs/);

  // La verificación autenticada contra producción debe seguir pidiendo dos
  // documentos reales con la cookie de sesión: es la única comprobación que
  // detecta si la sincronización a R2 falló, si el objeto desapareció, o si
  // algo volvió a eclipsar la ruta /data-center/ (el bug del 13/08, que
  // ninguna prueba local llegó a ver). Se revirtió aquel día porque no podía
  // pasar mientras el bug siguiera abierto; restaurada el 14/08 con la causa
  // ya corregida y verificada en producción.
  assert.match(deployScript, /guia-corporativa-bricket-control-personal-obra\.pdf/);
  assert.match(deployScript, /informe-analisis-ifc-2026-07-29\.pdf/);
});
