#!/usr/bin/env node
// Lista los usuarios exactamente como los ve la propia aplicación
// (GET /api/admin/users), para comparar con lo que ve wrangler d1 execute
// --remote y descartar una discrepancia entre ambas vías de lectura.

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

const respuesta = await fetch(`${PRODUCTION_URL}/api/admin/users`, { headers: { Cookie }, cache: "no-store" });
const cuerpo = await respuesta.json().catch(() => ({}));
console.log(`estado HTTP: ${respuesta.status}`);
const usuarios = cuerpo.users ?? [];
console.log(`=== ${usuarios.length} usuario(s) según la API ===`);
for (const u of usuarios) {
  console.log(`  · id ${u.id} · ${u.email} · ${u.displayName} · activo:${u.active} · eliminado:${u.deletedAt || "no"}`);
}
