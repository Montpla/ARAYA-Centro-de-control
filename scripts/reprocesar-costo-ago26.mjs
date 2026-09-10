#!/usr/bin/env node
// Corrección: "Costo Ago-26.xlsx" nunca se reprocesó desde que
// extractCostByCategoryProgress existe (PR de leer-y-agrupar-costos-por-
// categoria, más temprano en esta sesión) ni desde que se corrigió el bug de
// la celda vacía-con-estilo en lib/xlsx-reader.ts que rompía justo esta
// hoja. El expediente seguía con el resultado de su primera lectura ("No se
// reconoció ninguna tabla de datos en la hoja"), de antes de que ese lector
// existiera: no es un bug de área ni de lectura, es que nadie volvió a
// pedirle a la app que lo repasara. Reprocesa el archivo para que publique
// costBreakdown de verdad. Se retira tras confirmarlo.
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

const form = new FormData();
form.set("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Costo Ago-26.xlsx");
form.set("reprocess", "true");
form.set("reprocessFileId", FILE_ID);
form.set("processNow", "true");

const reproceso = await fetch(`${PRODUCTION_URL}/api/files`, {
  method: "POST",
  headers: { Cookie },
  body: form,
});
const reprocesoBody = await reproceso.json().catch(() => ({}));
console.log(`\n=== Reproceso (${reproceso.status}) ===`);
console.log(JSON.stringify(reprocesoBody, null, 2).slice(0, 3000));
if (!reproceso.ok) process.exit(1);

const after = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const afterBody = await after.json();
console.log("\n=== costBreakdown.* DESPUÉS (claves publicadas por separado) ===");
const claves = Object.keys(afterBody.values ?? {}).filter((k) => k.startsWith("costBreakdown"));
for (const clave of claves) {
  console.log(`${clave}:`, JSON.stringify(afterBody.values[clave]), "·", JSON.stringify(afterBody.provenance?.[clave]));
}
if (!claves.length) console.log("(ninguna clave costBreakdown.* publicada)");
