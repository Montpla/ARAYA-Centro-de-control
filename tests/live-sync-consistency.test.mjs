import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { buildings, monthlyPlan, overallProgressNow, projectSnapshot } from "../app/demo-data.ts";

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
  const syncFunction = dashboard.match(/function synchronizeSpatialSummary\(\) \{[\s\S]*?\r?\n}\r?\n/)?.[0] ?? "";
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
    /cutoffActual = cutoffIndex >= 0 \? monthlyPlan\[cutoffIndex\]\.actual[\s\S]{0,80}cutoffPlanned = cutoffIndex >= 0 \? monthlyPlan\[cutoffIndex\]\.planned/,
    "overallProgress y plannedProgress deben leerse de la misma entrada de monthlyPlan en el espejo cliente",
  );
  assert.match(
    dashboard,
    /projectSnapshot\.overallProgress = cutoffActual;\s*\n\s*projectSnapshot\.plannedProgress = cutoffPlanned;/,
    "la reasignación cliente debe fijar overallProgress y plannedProgress juntos, en el mismo bloque",
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
  // El % de urbanismo se deriva de sus áreas (servidor y cliente), no a mano.
  assert.match(
    spatialLiveData,
    /averageNumeric\(urbanismAreas\.map\(\(area\) => area\.progress\)\)/,
    "el urbanismo del servidor sale de la media de sus áreas",
  );
  assert.match(
    dashboard,
    /averageNumeric\(urbanismAreas\.map\(\(area\) => area\.progress\)\)/,
    "el urbanismo del cliente sale de la media de sus áreas",
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
