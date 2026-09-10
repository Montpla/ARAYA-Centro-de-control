#!/usr/bin/env node
// Depuración puntual: verificar-monto-cubicacion.mjs muestra que
// cubicacionCaratula sigue sin publicarse tras mover extractCubicacionMonto-
// Resumen al frente del despachador. Este script llama al lector directamente
// sobre los bytes reales de "Avance edificio.xlsx", sin pasar por el resto
// del pipeline de subida, para ver exactamente qué hoja(s) matchean y qué
// devuelve cada extractor.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const FILE_ID = "70707ab5-192c-430e-8452-0a96b76d17c2";

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST", body: new URLSearchParams({ email, pin }), redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const download = await fetch(`${PRODUCTION_URL}/api/files?download=${FILE_ID}`, { headers: { Cookie } });
const bytes = await download.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

const { readXlsxSheets } = await import("../lib/xlsx-reader.ts");
const hojas = await readXlsxSheets(bytes);
console.log(`Hojas: ${hojas.length}`);

function normalizarCabecera(valor) {
  return valor.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function numeroDeCelda(valor) {
  const limpio = valor.replace(/%/g, "").trim().replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

hojas.forEach((filas, indice) => {
  console.log(`\n--- Hoja #${indice + 1}: ${filas.length} filas ---`);
  for (let i = 0; i < Math.min(filas.length, 8); i++) {
    console.log(`Fila ${i}:`, JSON.stringify(filas[i]));
  }
  // Réplica exacta de extractCubicacionMontoResumen, con trazas.
  let numero = "";
  let monto = null;
  for (const row of filas.slice(0, 20)) {
    const cells = Object.entries(row);
    if (!numero) {
      for (const [, valor] of cells) {
        const match = normalizarCabecera(valor).match(/^cubicacion\s+n(?:ro\.?|[o°]\.?)?\.?\s*(\d+)/);
        if (match) { numero = match[1]; console.log(`  [numero] "${valor}" -> ${numero}`); break; }
      }
    }
    if (monto === null) {
      const labelIndex = cells.findIndex(([, valor]) => /^monto\s+cubicacion:?$/.test(normalizarCabecera(valor)));
      if (labelIndex >= 0) {
        const [labelColumn] = cells[labelIndex];
        console.log(`  [monto] etiqueta encontrada en columna ${labelColumn}: "${cells[labelIndex][1]}"`);
        for (const [columna, valor] of cells) {
          if (columna === labelColumn) continue;
          const numeroCelda = numeroDeCelda(valor);
          console.log(`    candidata ${columna}="${valor}" -> ${numeroCelda}`);
          if (numeroCelda !== null && numeroCelda > 0) { monto = numeroCelda; break; }
        }
      }
    }
  }
  console.log(`  => numero="${numero}" monto=${monto}`);
});
