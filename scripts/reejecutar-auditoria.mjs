#!/usr/bin/env node
// Vuelve a ejecutar SOLO la comprobación de contrato/finanzas/archivos de la
// auditoría (acción "run_audit" de /api/automation-center), sin las acciones
// de envío ("send_reminders"/"send_digests"), para confirmar de inmediato si
// la corrección del contrato vivo quita la incidencia de discoveredSections
// sin esperar a la auditoría nocturna programada ni mandar ningún aviso real.

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

const response = await fetch(`${PRODUCTION_URL}/api/automation-center`, {
  method: "POST",
  headers: { Cookie: `araya_session=${session}`, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "run_audit" }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`✖ La auditoría devolvió ${response.status}: ${result.error || "sin detalle"}`);
  process.exit(1);
}

console.log(`Resumen: ${result.result?.run?.summary || "(sin resumen)"}`);
const incidents = result.result?.incidents ?? [];
console.log(`\n=== ${incidents.length} incidencia(s) detectada(s) en esta ejecución ===`);
for (const i of incidents) {
  console.log(`\n· severidad: ${i.severity} · área: ${i.area}`);
  console.log(`  título: ${i.title}`);
  if (i.detail) console.log(`  detalle: ${i.detail}`);
}
if (!incidents.length) console.log("(ninguna)");
