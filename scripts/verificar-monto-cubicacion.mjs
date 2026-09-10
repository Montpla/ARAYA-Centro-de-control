#!/usr/bin/env node
// Verificación puntual: reprocesa "Avance edificio.xlsx" (Cubicación 9, ya
// integrado) para confirmar que extractCubicacionMontoResumen (PR de
// leer-monto-certificado-cubicacion) publica de verdad el monto certificado
// en cubicacionCaratula contra la app real desplegada. Se retira tras
// confirmarlo.
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

const before = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const beforeBody = await before.json();
console.log("=== cubicacionCaratula ANTES ===");
console.log(JSON.stringify(beforeBody.values?.cubicacionCaratula ?? "(sin publicar, usa el valor de referencia)"));

const download = await fetch(`${PRODUCTION_URL}/api/files?download=${FILE_ID}`, { headers: { Cookie } });
if (!download.ok) { console.error(`Descarga falló (${download.status})`); process.exit(1); }
const bytes = await download.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

const form = new FormData();
form.set("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Avance edificio.xlsx");
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
console.log("\n=== cubicacionCaratula DESPUÉS ===");
console.log(JSON.stringify(afterBody.values?.cubicacionCaratula));
