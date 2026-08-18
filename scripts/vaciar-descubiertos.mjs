#!/usr/bin/env node
// Vacía los bloques descubiertos que ya se han modelado en su sitio propio.
//
// Cuando una propuesta pasa de bloque genérico a sección con nombre —como las
// certificaciones o la carátula de cubicación—, su versión de bloque
// descubierto sobra: mostraría la misma información dos veces. Esto retira esos
// bloques dejando el contenedor vacío, que es su estado natural cuando no hay
// nada pendiente de encajar.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const sessionMatch = loginResponse.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!sessionMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${sessionMatch[1]}`;

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const live = liveResponse.ok ? await liveResponse.json() : { values: {} };
const actuales = Array.isArray(live.values?.discoveredSections) ? live.values.discoveredSections : [];

console.log(`Bloques descubiertos actuales: ${actuales.length}`);
for (const bloque of actuales) console.log(`  · ${bloque.title}`);

if (!actuales.length) {
  console.log("Ya está vacío, nada que hacer.");
  process.exit(0);
}
if (!APLICAR) {
  console.log("\nSimulación (APLICAR=0): se vaciaría el contenedor de bloques descubiertos.");
  process.exit(0);
}

const publicar = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates: [{ key: "discoveredSections", value: [] }],
    area: "direccion",
    cutoff: new Date().toISOString().slice(0, 10),
    sourceName: "Modelado de secciones",
    message: "Bloques descubiertos retirados tras modelarlos en su sitio propio.",
  }),
});
const cuerpo = await publicar.json();
if (!publicar.ok) {
  console.error(`✖ No se pudo vaciar: ${cuerpo.error ?? publicar.status}`);
  process.exit(1);
}
console.log("\n✔ Contenedor de bloques descubiertos vaciado.");
