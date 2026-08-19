#!/usr/bin/env node
// Aprueba (publica) las propuestas preparadas de un expediente desde la bandeja
// de revisión. Es la vía para publicar a propósito datos que la ingesta deja en
// revisión (p. ej. avances de obra de un informe multi-área «sin clasificar»,
// que no se auto-publican por diseño).
//
// Simula por defecto: lista permiso y NOMBRES de clave (nunca valores). Con
// APLICAR=1 aprueba y publica.

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
  console.error("✖ Indica FILTRO con parte del nombre del archivo a aprobar.");
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

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();
const objetivo = files.filter((f) => !f.deletedAt && f.originalName.toLowerCase().includes(FILTRO));

if (!objetivo.length) {
  console.log(`No hay archivos activos que contengan "${FILTRO}".`);
  process.exit(0);
}

for (const f of objetivo) {
  const detalleRes = await fetch(`${PRODUCTION_URL}/api/files/review?file=${encodeURIComponent(f.id)}`, { headers: { Cookie } });
  if (!detalleRes.ok) {
    console.error(`✖ ${f.originalName}: no se pudo leer la revisión (${detalleRes.status}).`);
    continue;
  }
  const detalle = await detalleRes.json();
  const pendientes = (detalle.proposals ?? []).filter((p) => p.status === "pendiente");
  console.log(`\n=== ${f.originalName} ===`);
  console.log(`  revisión: ${detalle.file?.reviewStatus} · rev publicada: ${detalle.file?.publicationRevision ?? "—"}`);
  console.log(`  puedo aprobar: ${detalle.permissions?.canReview ? "sí" : "no"}`);
  console.log(`  propuestas pendientes (${pendientes.length}) — sólo nombres de clave:`);
  for (const p of pendientes) console.log(`    · ${p.key}`);

  if (!detalle.permissions?.canReview) {
    console.log("  (sin permiso de revisión: no se aprueba)");
    continue;
  }
  if (!pendientes.length) {
    console.log("  (no hay propuestas pendientes que aprobar)");
    continue;
  }
  if (!APLICAR) {
    console.log("  Simulación (APLICAR=0): se aprobarían y publicarían estas propuestas.");
    continue;
  }

  const aprobar = await fetch(`${PRODUCTION_URL}/api/files/review`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "approve",
      fileId: f.id,
      requestKey: `aprobar:${f.id}:${detalle.file?.publicationRevision ?? "na"}:${pendientes.length}`,
      note: "Publicación aprobada a petición de la dirección.",
    }),
  });
  const cuerpo = await aprobar.json().catch(() => ({}));
  if (!aprobar.ok) {
    console.error(`  ✖ La aprobación devolvió ${aprobar.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`  ✔ ${cuerpo.message ?? "aprobado"}${cuerpo.publicationRevision ? ` (revisión ${cuerpo.publicationRevision})` : ""}`);
}
