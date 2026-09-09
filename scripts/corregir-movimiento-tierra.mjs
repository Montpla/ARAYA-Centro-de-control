#!/usr/bin/env node
// Segundo intento de la corrección puntual pedida por el usuario. El primero
// (revisión 102) NO incluyó "cutoff", así que la comprobación posterior lo
// detectó y lo marcó "failed": el reemplazo completo del array vivo
// (revisión 50) tiene un cutoff real, y sin cutoff propio la revisión 102
// ordenaba por debajo de él en deriveEffectiveLiveDataSnapshot -el ancestro
// "más nuevo" descartaba al hijo más específico aunque tuviera un eventId
// mayor. Con el mismo cutoff que ya usaron con éxito las revisiones 100/101
// (posteriores al de la revisión 50), este parche sí gana.
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

const response = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates: [
      { key: "urbanismReportAreas.0.progress", value: 72.76 },
    ],
    area: "planificacion",
    cutoff: "2026-08-30",
    message: "Corrección pedida por el usuario (segundo intento, con cutoff): Movimiento de tierra vuelve a 72,76%. La revisión 102 no incluyó cutoff y la comprobación posterior la marcó failed porque el reemplazo completo del array (revisión 50) ordenaba por delante al no tener cutoff con el que compararse.",
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
