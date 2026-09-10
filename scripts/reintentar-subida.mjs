#!/usr/bin/env node
// Reintenta la extracción de expedientes que quedaron "recibidos" sin
// completarse: descarga el original ya archivado en R2 y lo vuelve a subir
// tal cual, lo que reclama el mismo expediente (mismo sha256) por la vía de
// reanudación idempotente (ver app/api/files/route.ts, "canResume") -la misma
// que ya usa cualquier persona cuando arrastra el archivo dos veces.
//
// FILE_ID: reintenta sólo ese expediente (disparo instantáneo al diferir una
// subida, ver lib/deferred-upload-retry-trigger.ts). Sin FILE_ID: barre todos
// los expedientes activos que sigan "recibidos" pasado un margen de gracia,
// o con un lease de extracción caducado -red de seguridad del cron.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const FILE_ID = process.env.FILE_ID ?? "";
// Igual al margen de gracia entre intentos del propio Worker (BACKGROUND_PROCESSING_ATTEMPTS
// en app/api/files/route.ts): evita competir con un intento que todavía está en curso.
const GRACIA_MS = 90 * 1000;
const LEASE_MS = 5 * 60 * 1000;

if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`✖ El login falló (${login.status}).`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const { files = [] } = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } })
  .then((r) => r.json());
const activos = files.filter((f) => !f.deletedAt);

const ahora = Date.now();
const objetivo = FILE_ID
  ? activos.filter((f) => f.id === FILE_ID)
  : activos.filter((f) => {
    if (f.processingStage === "recibido") {
      return ahora - Date.parse(f.createdAt) > GRACIA_MS;
    }
    if (f.processingStage === "extraccion_en_curso") {
      return ahora - Date.parse(f.updatedAt) > LEASE_MS;
    }
    return false;
  });

console.log(`=== ${objetivo.length} expediente(s) a reintentar (de ${activos.length} activos) ===`);
for (const f of objetivo) console.log(`  · ${f.originalName} · ${f.processingStage} · subido ${f.createdAt}`);
if (!objetivo.length) {
  console.log("Nada que reintentar.");
  process.exit(0);
}

let fallos = 0;
for (const f of objetivo) {
  const descarga = await fetch(`${PRODUCTION_URL}${f.downloadUrl}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ ${f.originalName}: no se pudo descargar el original (HTTP ${descarga.status}).`);
    fallos += 1;
    continue;
  }
  const bytes = await descarga.arrayBuffer();
  const form = new FormData();
  form.set("file", new File([bytes], f.originalName, { type: f.mimeType || "application/octet-stream" }));
  form.set("area", "auto");
  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`✖ ${f.originalName}: la reanudación devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    fallos += 1;
    continue;
  }
  console.log(`✔ ${f.originalName}: ${cuerpo.message ?? cuerpo.receipt?.outcome ?? "reanudado"}`);
}

console.log(`\n=== Fin: ${objetivo.length - fallos}/${objetivo.length} reintentados sin error de red ===`);
if (fallos) process.exit(1);
