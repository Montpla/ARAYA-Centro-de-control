#!/usr/bin/env node
// Adapta al panel las propuestas de sección nueva que quedaron pendientes.
//
// Desde ahora los bloques descubiertos entran solos, pero los que se apartaron
// antes de ese cambio siguen esperando. Esto los recupera: publica cada uno
// como sección descubierta y marca el candidato como adaptado, de modo que la
// lista de pendientes refleje lo que de verdad falta y no se acumule para
// siempre.
//
// Excepción: los que ya tienen campo propio en el modelo no se republican —
// aparecerían dos veces—; sólo se cierran anotando dónde viven ahora.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";

// Propuestas a las que se les dio su propio campo en vez de dejarlas como
// bloque genérico. La clave es un fragmento del rótulo, en minúsculas.
const YA_MODELADAS = [
  { fragmento: "metas de recaudación", destino: "collectionTargets (Ventas · Metas de recaudación)" },
  { fragmento: "nuevos aliados", destino: "commercialPartners (Ventas · aliados captados)" },
];

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
const cabeceras = { Cookie, "Content-Type": "application/json" };

const pendientesResponse = await fetch(`${PRODUCTION_URL}/api/files/candidates`, { headers: { Cookie } });
if (!pendientesResponse.ok) {
  console.error(`✖ No se pudieron leer las propuestas (${pendientesResponse.status}).`);
  process.exit(1);
}
const { pending = [] } = await pendientesResponse.json();

console.log(`=== ${pending.length} propuesta(s) pendiente(s) ===`);
if (!pending.length) {
  console.log("Nada que adaptar.");
  process.exit(0);
}

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const live = liveResponse.ok ? await liveResponse.json() : { values: {} };
let indice = Array.isArray(live.values?.discoveredSections) ? live.values.discoveredSections.length : 0;

const nuevos = [];
const cierres = [];
for (const propuesta of pending) {
  const modelada = YA_MODELADAS.find((entrada) =>
    propuesta.label.toLowerCase().includes(entrada.fragmento));
  if (modelada) {
    console.log(`\n· ${propuesta.label}\n   ya tiene campo propio → ${modelada.destino}\n   acción: cerrar sin republicar`);
    cierres.push({ id: propuesta.id, note: `Adaptada a ${modelada.destino}.` });
    continue;
  }
  console.log(`\n· ${propuesta.label}\n   sin campo propio → se publica como bloque descubierto\n   acción: publicar y cerrar`);
  nuevos.push({
    key: `discoveredSections.${indice}`,
    value: {
      id: `descubierto-${propuesta.id}`,
      title: String(propuesta.label).slice(0, 160),
      description: String(propuesta.description ?? "").slice(0, 400),
      area: String(propuesta.suggestedArea ?? "direccion"),
      evidence: String(propuesta.evidence ?? "").slice(0, 600),
      confidence: Number(propuesta.confidence ?? 0),
      sourceName: "Propuesta pendiente recuperada",
      detectedAt: propuesta.createdAt ?? new Date().toISOString(),
      values: [],
    },
  });
  cierres.push({ id: propuesta.id, note: "Publicada como bloque descubierto." });
  indice += 1;
}

if (!APLICAR) {
  console.log(`\n=== Simulación (APLICAR=0) ===`);
  console.log(`Se publicarían ${nuevos.length} bloque(s) y se cerrarían ${cierres.length} propuesta(s).`);
  process.exit(0);
}

if (nuevos.length) {
  const publicar = await fetch(`${PRODUCTION_URL}/api/live-data`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({
      updates: nuevos,
      area: "direccion",
      cutoff: new Date().toISOString().slice(0, 10),
      sourceName: "Propuestas pendientes recuperadas",
      message: `${nuevos.length} bloque(s) descubierto(s) recuperados de propuestas pendientes.`,
    }),
  });
  const cuerpo = await publicar.json();
  if (!publicar.ok) {
    console.error(`✖ No se pudieron publicar los bloques: ${cuerpo.error ?? publicar.status}`);
    process.exit(1);
  }
  console.log(`\n✔ ${nuevos.length} bloque(s) publicados.`);
}

for (const { id, note } of cierres) {
  const cerrar = await fetch(`${PRODUCTION_URL}/api/files/candidates`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({ ids: [id], status: "adaptada", note }),
  });
  if (!cerrar.ok) {
    console.error(`✖ No se pudo cerrar ${id} (${cerrar.status}).`);
    process.exit(1);
  }
}
console.log(`✔ ${cierres.length} propuesta(s) marcadas como adaptadas.`);
