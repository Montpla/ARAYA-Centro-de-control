#!/usr/bin/env node
// Verificación puntual: llama a GET /api/automation-center (que ejecuta
// reconcileReportingPeriods en cada carga) y vuelca el estado de los
// requisitos de agosto y septiembre, para confirmar que el cronograma ya
// cuenta en septiembre tras ajustar su fecha de corte.
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
for (const mesId of ["month-2026-08", "month-2026-09"]) {
  const mes = body.periods?.find((p) => p.id === mesId);
  if (!mes) { console.log(`No se encontró el periodo ${mesId}.`); continue; }
  console.log(`=== ${mes.label} · ${mes.received}/${mes.requirements.length} recibidos (${mes.completion}%) ===`);
  for (const r of mes.requirements) {
    console.log(`  · ${r.label} → ${r.status} · fuente: ${r.sourceFileId || "(ninguna)"}`);
  }
}
