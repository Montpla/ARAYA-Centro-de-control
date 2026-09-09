#!/usr/bin/env node
// Diagnóstico de solo lectura: lista los .mpp subidos y su XML convertido (si
// existe), con el recibo de publicación de cada uno. Para averiguar por qué
// un .mpp concreto no ha actualizado edificios ni cronograma.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
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
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`✖ El login falló (${login.status}).`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const { files = [] } = await fetch(`${PRODUCTION_URL}/api/files?limit=300`, { headers: { Cookie } }).then((r) => r.json());
const activos = files.filter((f) => !f.deletedAt);
const mpps = activos.filter((f) => String(f.extension).toLowerCase() === "mpp");
const xmls = activos.filter((f) => String(f.extension).toLowerCase() === "xml");

console.log(`=== ${mpps.length} .mpp activo(s) ===\n`);
for (const f of mpps) {
  console.log(`· ${f.originalName}`);
  console.log(`  id: ${f.id} · área: ${f.area} · subido: ${f.createdAt} · estado: ${f.status}`);
  console.log(`  etapa: ${f.processingStage} (${f.processingProgress}%) · revisión: ${f.reviewStatus ?? "-"}`);
  if (f.processingSummary) console.log(`  resumen: ${f.processingSummary}`);

  const derivado = xmls.find((x) => x.derivedFromFileId === f.id) ??
    xmls.find((x) => x.originalName === f.originalName.replace(/\.mpp$/i, "") + " (convertido de MPP).xml");
  if (derivado) {
    console.log(`  → XML derivado: ${derivado.originalName} (id ${derivado.id})`);
    console.log(`    subido: ${derivado.createdAt} · estado: ${derivado.status} · revisión: ${derivado.reviewStatus ?? "-"}`);
    if (derivado.processingSummary) console.log(`    resumen: ${derivado.processingSummary}`);
  } else {
    console.log(`  → sin XML derivado todavía`);
  }
  console.log("");
}

console.log(`=== ${xmls.length} .xml activo(s) (incluye derivados y subidos a mano) ===\n`);
for (const x of xmls) {
  console.log(`· ${x.originalName} · id ${x.id} · derivedFromFileId: ${x.derivedFromFileId ?? "-"} · automationKind: ${x.automationKind ?? "-"}`);
  console.log(`  área: ${x.area} · estado: ${x.status} · revisión: ${x.reviewStatus ?? "-"} · subido: ${x.createdAt}`);
  if (x.processingSummary) console.log(`  resumen: ${x.processingSummary}`);
}
