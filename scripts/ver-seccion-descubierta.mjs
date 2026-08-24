#!/usr/bin/env node
// Vuelca, sólo lectura, el contenido completo de las secciones descubiertas
// (bloques que la lectura documental encontró sin campo propio y que ya se
// publicaron solos) que coincidan con un fragmento de su título. Sirve para
// responder "¿qué contiene esa sección?" sin tener que buscarla a mano en el
// panel. No es contenido financiero, así que se imprime completo.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const FRAGMENTO = (process.env.FRAGMENTO ?? "").toLowerCase();

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
if (!liveResponse.ok) {
  console.error(`✖ /api/live-data devolvió ${liveResponse.status}.`);
  process.exit(1);
}
const live = await liveResponse.json();
const secciones = Array.isArray(live.values?.discoveredSections) ? live.values.discoveredSections : [];

console.log(`=== ${secciones.length} sección(es) descubierta(s) en total ===`);
const coincidencias = FRAGMENTO
  ? secciones.filter((seccion) => String(seccion.title ?? "").toLowerCase().includes(FRAGMENTO))
  : secciones;

if (!coincidencias.length) {
  console.log(FRAGMENTO ? `Ninguna coincide con "${FRAGMENTO}".` : "No hay ninguna.");
  process.exit(0);
}

for (const seccion of coincidencias) {
  console.log(`\n--- ${seccion.title} (${seccion.id}) ---`);
  console.log(`área: ${seccion.area} · confianza: ${seccion.confidence} · detectado: ${seccion.detectedAt}`);
  console.log(`origen: ${seccion.sourceName ?? "(desconocido)"}`);
  console.log(`descripción: ${seccion.description || "(sin descripción)"}`);
  console.log(`evidencia: ${seccion.evidence || "(sin evidencia)"}`);
  console.log(`visualización: ${seccion.visualization ?? "list"} · unidad: ${seccion.unit ?? "(ninguna)"}`);
  if (Array.isArray(seccion.values) && seccion.values.length) {
    console.log("valores:");
    for (const valor of seccion.values) {
      console.log(`  · ${valor.label}: ${valor.value}`);
    }
  }
  if (Array.isArray(seccion.series) && seccion.series.length) {
    console.log("serie:");
    for (const punto of seccion.series) {
      console.log(`  · ${punto.label}: ${punto.value}`);
    }
  }
}
