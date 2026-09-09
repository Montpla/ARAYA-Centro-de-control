#!/usr/bin/env node
// Corrección puntual pedida por el usuario: "Movimiento de tierra" muestra
// 68% (revisión 50, reemplazo completo del array desde el PPTX del Informe
// Ejecutivo de julio) pero el valor correcto es 72,76% -el mismo que tenía
// escrito a mano la tarjeta "Mayor avance" antes de hacerse dinámica. Se
// corrige el índice 0 (confirmado por lectura directa de D1) para que ambas
// tarjetas -que ahora leen el mismo array- muestren la misma cifra correcta.
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
    message: "Corrección pedida por el usuario: Movimiento de tierra vuelve a 72,76% (el valor correcto), no el 68% que dejó el reemplazo completo del array de la revisión 50.",
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
