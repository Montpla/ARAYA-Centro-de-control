#!/usr/bin/env node
// Retira los bloques descubiertos que ya se han modelado en su sitio propio.
//
// Cuando una propuesta pasa de bloque genérico a sección con nombre —como las
// certificaciones o la carátula de cubicación—, su versión de bloque
// descubierto sobra: mostraría la misma información dos veces. Se retiran SÓLO
// esos, por su título, y se conservan los que siguen sin sitio propio (la
// relación de obra ejecutada no se modeló porque sus cifras no llegaron, así
// que su bloque descubierto es lo único que la representa y debe quedarse).

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

// Títulos que ya tienen sección propia. Se comparan en minúsculas y por
// fragmento, porque el título del bloque puede traer variaciones de mayúsculas.
const YA_MODELADOS = ["certificaciones leed", "monto cubicacion", "monto cubicación"];

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const live = liveResponse.ok ? await liveResponse.json() : { values: {} };

// Los datos vivos guardan cada escritura por su clave literal, así que un
// bloque publicado como "discoveredSections.0" NO aparece bajo la clave
// "discoveredSections". Se reconstruye el array recogiendo tanto una escritura
// de la raíz entera como las claves con índice.
function leerDescubiertos(values) {
  const base = Array.isArray(values.discoveredSections) ? [...values.discoveredSections] : [];
  for (const [clave, valor] of Object.entries(values)) {
    const coincide = clave.match(/^discoveredSections\.(\d+)$/);
    if (coincide) base[Number(coincide[1])] = valor;
  }
  return base.filter((bloque) => bloque != null);
}
const actuales = leerDescubiertos(live.values ?? {});

const conservados = actuales.filter((bloque) => {
  const titulo = String(bloque.title ?? "").toLowerCase();
  return !YA_MODELADOS.some((fragmento) => titulo.includes(fragmento));
});
const retirados = actuales.length - conservados.length;

console.log(`Bloques descubiertos actuales: ${actuales.length}`);
for (const bloque of actuales) {
  const titulo = String(bloque.title ?? "").toLowerCase();
  const modelado = YA_MODELADOS.some((fragmento) => titulo.includes(fragmento));
  console.log(`  · ${bloque.title} ${modelado ? "→ retirar (ya modelado)" : "→ conservar (sin sitio propio aún)"}`);
}

if (!retirados) {
  console.log("Ninguno de los bloques está ya modelado, nada que retirar.");
  process.exit(0);
}
if (!APLICAR) {
  console.log(`\nSimulación (APLICAR=0): se retirarían ${retirados} y se conservarían ${conservados.length}.`);
  process.exit(0);
}

const publicar = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates: [{ key: "discoveredSections", value: conservados }],
    area: "direccion",
    cutoff: new Date().toISOString().slice(0, 10),
    sourceName: "Modelado de secciones",
    message: `${retirados} bloque(s) descubierto(s) retirados tras modelarlos en su sitio propio.`,
  }),
});
const cuerpo = await publicar.json();
if (!publicar.ok) {
  console.error(`✖ No se pudo actualizar: ${cuerpo.error ?? publicar.status}`);
  process.exit(1);
}
console.log(`\n✔ ${retirados} bloque(s) retirados; ${conservados.length} conservado(s).`);
