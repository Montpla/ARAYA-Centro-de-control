#!/usr/bin/env node
// Verificación puntual: llama a GET /api/automation-center (que ejecuta
// reconcileReportingPeriods en cada carga) y vuelca el estado de los
// requisitos de septiembre, para confirmar que las correcciones (PR #169 y
// #170) ya se reflejan en el checklist.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const response = await fetch(`${PRODUCTION_URL}/api/automation-center`, { headers: { Cookie } });
const body = await response.json();
const mes = body.periods?.find((p) => p.id.startsWith("month-2026-09"));
if (!mes) { console.log("No se encontró el periodo de septiembre."); process.exit(0); }
console.log(`=== ${mes.label} · ${mes.received}/${mes.requirements.length} recibidos (${mes.completion}%) ===`);
for (const r of mes.requirements) {
  console.log(`  · ${r.label} → ${r.status} · fuente: ${r.sourceFileId || "(ninguna)"}`);
}
