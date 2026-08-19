#!/usr/bin/env node
// Recupera el expediente de ventas tras un reemplazo que no llegó a publicar.
//
// Estado a arreglar: el original quedó retirado (tenía su revisión publicada) y
// la re-ingesta creó una copia activa que no publicó. Por el hash único no se
// puede restaurar el original mientras la copia fallida siga activa. Este script
// retira la copia fallida (sin revisión) y restaura el original (con revisión),
// que al recomputar devuelve sus cifras al panel.
//
// Simula por defecto; APLICAR=1 para actuar.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "ventas araya jul").toLowerCase();

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

async function lifecycle(fileId, action, reason) {
  const r = await fetch(`${PRODUCTION_URL}/api/files/lifecycle`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, action, reason }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, cuerpo };
}

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200&includeDeleted=1`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();
const candidatos = files.filter((f) => f.originalName.toLowerCase().includes(FILTRO));

const fallida = candidatos.find((f) => !f.deletedAt && !f.publicationRevision);
const original = candidatos.find((f) => f.deletedAt && f.publicationRevision);

console.log(`=== Recuperación de "${FILTRO}" ===`);
console.log(`  copia fallida activa (a retirar): ${fallida ? `${fallida.originalName} · rev ${fallida.publicationRevision || "—"}` : "no encontrada"}`);
console.log(`  original retirado (a restaurar):  ${original ? `${original.originalName} · rev ${original.publicationRevision || "—"}` : "no encontrado"}`);

if (!original) {
  console.log("No hay un original con revisión que restaurar. Nada que hacer.");
  process.exit(0);
}
if (!APLICAR) {
  console.log("\nSimulación (APLICAR=0): se retiraría la copia fallida y se restauraría el original.");
  process.exit(0);
}

if (fallida) {
  const retiro = await lifecycle(fallida.id, "delete", "Copia de re-ingesta que no llegó a publicar; se retira para restaurar el original.");
  if (!retiro.ok) {
    console.error(`✖ No se pudo retirar la copia fallida (${retiro.status} · ${retiro.cuerpo.error ?? ""}).`);
    process.exit(1);
  }
  console.log(`✔ Copia fallida retirada: ${retiro.cuerpo.message ?? "ok"}`);
}

const restauro = await lifecycle(original.id, "restore", "Se restaura el original tras deshacer un reemplazo que no publicó.");
if (!restauro.ok) {
  console.error(`✖ No se pudo restaurar el original (${restauro.status} · ${restauro.cuerpo.error ?? ""}).`);
  process.exit(1);
}
console.log(`✔ Original restaurado: ${restauro.cuerpo.message ?? "ok"} · claves afectadas: ${restauro.cuerpo.affectedKeys ?? "—"}`);
console.log("\nLas cifras de ventas de julio vuelven a contar en el panel.");
