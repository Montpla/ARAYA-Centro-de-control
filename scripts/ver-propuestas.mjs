#!/usr/bin/env node
// Propuestas de sección nueva pendientes.
//
// Cuando la lectura encuentra datos que no encajan en ningún campo del modelo,
// no los tira: los guarda como candidatos a sección nueva. Sin una forma de
// verlos, esa información se queda esperando indefinidamente y nadie sabe qué
// contiene — que es justo lo que había pasado con el informe de ventas.
//
// Imprime la ETIQUETA y la FORMA del dato (sus campos y tipos), nunca los
// valores: para decidir qué sección hay que crear hacen falta los campos, no
// los importes, y el registro de una ejecución de Actions no es sitio para el
// detalle económico de la obra.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const HORAS = Number(process.env.HORAS ?? 72);

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

/** Describe la forma de un valor sin revelar su contenido. */
function forma(valor, profundidad = 0) {
  if (valor === null) return "null";
  if (Array.isArray(valor)) {
    return valor.length ? `lista[${valor.length}] de ${forma(valor[0], profundidad + 1)}` : "lista vacía";
  }
  if (typeof valor === "object") {
    if (profundidad > 2) return "objeto";
    return `{ ${Object.entries(valor).map(([clave, dentro]) => `${clave}: ${forma(dentro, profundidad + 1)}`).join(", ")} }`;
  }
  return typeof valor;
}

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?includeDeleted=1&limit=200`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();
const desde = Date.now() - HORAS * 3600 * 1000;
const recientes = files.filter((file) =>
  Date.parse(file.createdAt) >= desde &&
  !file.deletedAt &&
  !file.supersededByFileId
);

console.log(`=== Propuestas de sección nueva · últimas ${HORAS} h ===`);
let total = 0;
for (const file of recientes) {
  const reviewResponse = await fetch(
    `${PRODUCTION_URL}/api/files/review?file=${encodeURIComponent(file.id)}`,
    { headers: { Cookie } },
  );
  if (!reviewResponse.ok) {
    console.log(`\n${file.originalName}: no se pudo leer la revisión (${reviewResponse.status}).`);
    continue;
  }
  const review = await reviewResponse.json();
  const unmappedCandidates = (review.unmappedCandidates ?? []).filter((candidate) => candidate.status === "pendiente");
  if (!unmappedCandidates.length) continue;

  console.log(`\n--- ${file.originalName} (${file.id}) ---`);
  for (const candidato of unmappedCandidates) {
    total += 1;
    let valor;
    try {
      valor = JSON.parse(candidato.valueJson);
    } catch {
      valor = null;
    }
    console.log(`\n  · etiqueta   : ${candidato.label}`);
    console.log(`    descripción: ${candidato.description || "(sin descripción)"}`);
    console.log(`    área sugerida: ${candidato.suggestedArea || "(ninguna)"} · confianza ${candidato.confidence}`);
    console.log(`    evidencia  : ${candidato.evidence || "(sin evidencia)"}`);
    console.log(`    estado     : ${candidato.status}`);
    console.log(`    forma      : ${forma(valor)}`);
    // DETALLE=1 vuelca el contenido para poder modelar la sección en su sitio.
    // Es el repositorio privado del proyecto y se pide expresamente; aun así se
    // recorta, porque un log no es un almacén de datos.
    if (process.env.DETALLE === "1") {
      console.log(`    contenido  : ${JSON.stringify(valor).slice(0, 1200)}`);
    }
  }
}

console.log(`\n=== ${total} propuesta(s) encontradas ===`);
