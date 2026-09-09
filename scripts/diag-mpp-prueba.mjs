#!/usr/bin/env node
// Diagnóstico puntual: confirma si el .mpp de prueba llegó y si el disparo
// inmediato (triggerMppConversion) se ejecutó o falló en silencio.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`✖ Login falló (${login.status}).`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const { files = [] } = await fetch(`${PRODUCTION_URL}/api/files?limit=20`, { headers: { Cookie } }).then((r) => r.json());
const mpps = files.filter((f) => String(f.extension).toLowerCase() === "mpp" && !f.deletedAt);
console.log(`=== ${mpps.length} .mpp reciente(s) ===`);
for (const f of mpps) {
  console.log(`· ${f.originalName}`);
  console.log(`  id: ${f.id} · subido: ${f.createdAt} · estado: ${f.status} · etapa: ${f.processingStage}`);
  console.log(`  resumen: ${f.processingSummary}`);
}
