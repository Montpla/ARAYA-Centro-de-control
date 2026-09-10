#!/usr/bin/env node
// Mira en qué estado quedó la ingesta de un archivo (nacido del reproceso de
// julio, generalizado desde entonces a cualquier expediente), sin imprimir
// NUNCA valores: sólo estado de revisión, resumen de proceso, tipos de evento
// y los NOMBRES de las claves de cada propuesta (jamás su contenido).

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const FILTRO = (process.env.FILTRO ?? "jul").toLowerCase();
const EXTENSION = (process.env.EXTENSION ?? "").toLowerCase();

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const cookieMatch = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!cookieMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${cookieMatch[1]}`;

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200&includeDeleted=1`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();
const objetivo = files.filter((f) =>
  f.originalName.toLowerCase().includes(FILTRO) &&
  (!EXTENSION || String(f.extension).toLowerCase() === EXTENSION));

for (const f of objetivo) {
  console.log(`\n=== ${f.originalName} ===`);
  console.log(`  área: ${f.areaLabel} · estado: ${f.status} · etapa: ${f.processingStage}`);
  console.log(`  revisión: ${f.reviewStatus} · rev publicada: ${f.publicationRevision ?? "—"} · discrepancias: ${f.discrepancyCount}`);
  console.log(`  eliminado: ${f.deletedAt ? "sí" : "no"}`);
  if (f.processingSummary) console.log(`  resumen: ${f.processingSummary}`);

  const review = await fetch(`${PRODUCTION_URL}/api/files/review?file=${encodeURIComponent(f.id)}`, { headers: { Cookie } });
  if (!review.ok) {
    console.log(`  (no se pudo leer la revisión: ${review.status})`);
    continue;
  }
  const detalle = await review.json();
  const propuestas = detalle.proposals ?? [];
  console.log(`  propuestas (${propuestas.length}) — sólo nombres de clave:`);
  for (const p of propuestas) {
    console.log(`    · ${p.key} [${p.status}${p.discrepancy ? ", cambia valor previo" : ""}]`);
  }
  const actividad = (detalle.activity ?? []).slice(0, 6);
  console.log(`  últimos eventos:`);
  for (const a of actividad) {
    console.log(`    · ${a.eventType}: ${String(a.message ?? "").slice(0, 160)}`);
  }
}
console.log("\nListo.");
