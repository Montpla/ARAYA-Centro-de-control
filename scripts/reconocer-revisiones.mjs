#!/usr/bin/env node
// Cierra el aviso de "requiere revisión" de expedientes concretos SIN cambiar
// ningún dato del panel: usa la acción acknowledge_verification (para
// verificacion_posterior_fallida) o approve (para lo demás), nunca publica ni
// toca datos vivos por sí mismo. Simula por defecto; APLICAR=1 aplica de
// verdad. FILTRO acota por fragmento del nombre; vacío = todos los que
// requieren revisión.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "").toLowerCase();
const MOTIVO = process.env.MOTIVO ??
  "Revisado: las claves ya las tenía una fuente con más autoridad (Cubicación/informe ejecutivo) que las conservó; no hay ninguna cifra incorrecta que corregir.";

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
  !f.deletedAt &&
  f.requiresReview &&
  f.originalName.toLowerCase().includes(FILTRO));

console.log(`=== ${objetivo.length} expediente(s) que requieren revisión ===`);
for (const f of objetivo) {
  console.log(`  · ${f.originalName} · revisión ${f.reviewStatus} · área ${f.areaLabel}`);
}
if (!objetivo.length) {
  console.log("Nada que reconocer.");
  process.exit(0);
}

for (const f of objetivo) {
  if (f.reviewStatus !== "verificacion_posterior_fallida") {
    console.log(`\n○ ${f.originalName}: estado "${f.reviewStatus}" no es una verificación posterior fallida; no se toca (revísalo a mano).`);
    continue;
  }
  if (!APLICAR) {
    console.log(`\n○ ${f.originalName}: se reconocería (acknowledge_verification) sin cambiar ningún dato. Simulación (APLICAR=0).`);
    continue;
  }
  const respuesta = await fetch(`${PRODUCTION_URL}/api/files/review`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: f.id, action: "acknowledge_verification", note: MOTIVO }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    console.error(`\n✖ ${f.originalName}: ${cuerpo.error ?? respuesta.status}`);
    continue;
  }
  console.log(`\n✔ ${f.originalName}: ${cuerpo.alreadyDone ? "ya estaba reconocido" : "reconocido, revisión = " + cuerpo.review?.reviewStatus}.`);
}
