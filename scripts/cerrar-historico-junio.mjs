#!/usr/bin/env node
// Cierra el XLS de avance/cubicaciones de junio como antecedente del libro
// oficial de julio. No borra el original: registra motivo y sustituto.

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const OLD_NAME = "avance-fisico-y-cubicaciones-junio-2026.xls";
const REPLACEMENT_NAME = "01 - GRAFICOS ARAYA FASE II COMPLETO MODIFICADO JULIO.xls";
const REASON = "El corte de junio (plan 21,24 % y ejecutado 18,23 %) queda preservado como antecedente. El libro oficial de julio incorpora el avance físico vigente y las cubicaciones posteriores, por lo que prevalece para el Centro de Control.";

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

async function readAllFiles() {
  const result = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ includeDeleted: "1", limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`${PRODUCTION_URL}/api/files?${query}`, { headers: { Cookie } });
    if (!response.ok) throw new Error(`Registro documental ${response.status}`);
    const payload = await response.json();
    result.push(...(payload.files ?? []));
    if (!payload.hasMore || !payload.nextCursor) break;
    cursor = payload.nextCursor;
  }
  return result;
}

const files = await readAllFiles();
const source = files.find((file) => !file.deletedAt && file.originalName.toLowerCase() === OLD_NAME.toLowerCase());
const replacement = files.find((file) =>
  !file.deletedAt && !file.supersededAt && file.originalName.toLowerCase() === REPLACEMENT_NAME.toLowerCase());
if (!source) {
  console.error(`✖ No se encontró el antecedente exacto: ${OLD_NAME}`);
  process.exit(1);
}
if (source.supersededByFileId) {
  console.log(`✔ ${source.originalName} ya está marcado como histórico (${source.supersededAt}).`);
  process.exit(0);
}
if (!replacement) {
  console.error(`✖ No se encontró el sustituto exacto: ${REPLACEMENT_NAME}`);
  process.exit(1);
}
console.log(`Origen: ${source.originalName} · publicado=${source.publicationRevision ?? "no"}`);
console.log(`Sustituto: ${replacement.originalName} · revisión=${replacement.publicationRevision ?? "no"}`);
console.log(`Motivo: ${REASON}`);
if (!APLICAR) {
  console.log("Simulación: no se ha modificado el registro.");
  process.exit(0);
}

const response = await fetch(`${PRODUCTION_URL}/api/files/supersede`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ fileId: source.id, replacementFileId: replacement.id, reason: REASON }),
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`✖ Cierre ${response.status}: ${payload.error ?? payload.message ?? "sin detalle"}`);
  process.exit(1);
}
console.log(`✔ ${payload.message}`);
