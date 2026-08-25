#!/usr/bin/env node
// Da de alta a Francisco Celis directamente contra /api/admin/users, con los
// mismos datos rellenados en el formulario "Autorizar una persona" (el
// rechazo "correo ya existe" visto en el navegador era un falso positivo:
// la base no tenía ninguna fila para ese correo). Autorizado explícitamente
// por el usuario.

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
const cookieMatch = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!cookieMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${cookieMatch[1]}`;

const nuevo = {
  email: "f.celis@grupobak.com",
  displayName: "Francisco Celis",
  role: "member",
  area: "obra",
  financeAccess: true,
  financeUploadAccess: true,
  financeApproveAccess: true,
  pin: "0000",
};

const respuesta = await fetch(`${PRODUCTION_URL}/api/admin/users`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify(nuevo),
});
const cuerpo = await respuesta.json().catch(() => ({}));
console.log(`estado HTTP: ${respuesta.status}`);
console.log(JSON.stringify(cuerpo, null, 2));
