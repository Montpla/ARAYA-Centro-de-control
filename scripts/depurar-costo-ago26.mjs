#!/usr/bin/env node
// Depuración puntual: el diagnóstico anterior muestra que "Costo Ago-26.xlsx"
// (id 152808d6, reprocesado el 2026-09-09) quedó con "No se reconoció
// ninguna tabla de datos en la hoja" y sin ninguna propuesta -aunque
// extractCostByCategoryProgress se verificó contra este mismo archivo real
// más temprano en esta sesión y coincidía al centavo con la fila "Total" del
// propio archivo-. Vuelca la estructura real de cada hoja para ver qué
// cambió. Se retira tras depurarlo.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const FILE_ID = "152808d6-daa3-404b-bcd7-69c298d66b31";

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST", body: new URLSearchParams({ email, pin }), redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const download = await fetch(`${PRODUCTION_URL}/api/files?download=${FILE_ID}`, { headers: { Cookie } });
if (!download.ok) { console.error(`Descarga falló (${download.status})`); process.exit(1); }
const bytes = await download.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

const { readXlsxSheets } = await import("../lib/xlsx-reader.ts");
const hojas = await readXlsxSheets(bytes);
console.log(`Hojas: ${hojas.length}`);
hojas.forEach((filas, indice) => {
  console.log(`\n--- Hoja #${indice + 1}: ${filas.length} filas ---`);
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    console.log(`Fila ${i}:`, JSON.stringify(filas[i]).slice(0, 500));
  }
});
