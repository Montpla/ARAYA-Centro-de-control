#!/usr/bin/env node
// Restaura expedientes retirados (soft-delete) y recomputa los datos vivos, para
// devolver sus cifras al panel. Pensado para deshacer un reemplazo que no llegó
// a publicar: al restaurar el original, sus datos publicados vuelven a contar.
//
// Simula por defecto; hay que pedir APLICAR=1 porque toca el panel.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "").toLowerCase();

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}
if (!FILTRO) {
  console.error("✖ Indica FILTRO con parte del nombre del archivo a restaurar.");
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
const objetivo = files.filter((f) => f.deletedAt && f.originalName.toLowerCase().includes(FILTRO));

console.log(`=== ${objetivo.length} archivo(s) retirado(s) que contienen "${FILTRO}" ===`);
for (const f of objetivo) {
  console.log(`  · ${f.originalName} · área ${f.areaLabel} · retirado ${f.deletedAt} · rev publicada ${f.publicationRevision || "—"}`);
}
if (!objetivo.length) {
  console.log("Nada que restaurar.");
  process.exit(0);
}
if (!APLICAR) {
  console.log(`\nSimulación (APLICAR=0): se restaurarían ${objetivo.length} archivo(s).`);
  process.exit(0);
}

for (const f of objetivo) {
  const restauro = await fetch(`${PRODUCTION_URL}/api/files/lifecycle`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: f.id, action: "restore", reason: "Se deshace un reemplazo que no llegó a publicar." }),
  });
  const cuerpo = await restauro.json().catch(() => ({}));
  if (!restauro.ok) {
    console.error(`✖ ${f.originalName}: la restauración devolvió ${restauro.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`✔ ${f.originalName}: ${cuerpo.message ?? "restaurado"}`);
}
