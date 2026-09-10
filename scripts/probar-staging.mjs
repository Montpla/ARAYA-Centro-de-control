#!/usr/bin/env node
// Frente 4 del plan de fiabilidad: prueba de extremo a extremo contra el
// Worker de staging (nunca producción). Sube cada archivo real de
// tests/fixtures/ por la API real (/api/files), tal como lo haría alguien
// desde el panel, y comprueba que el camino completo -clasificación,
// extracción, publicación, verificación posterior- termina sin que el
// expediente quede marcado "requiere revisión".
//
// No sustituye a la batería de pruebas unitarias (tests/*.test.mjs, que
// corren en cada PR vía ci.yml): esas prueban las funciones puras de
// clasificación/extracción de forma aislada y rápida. Esto prueba el camino
// HTTP completo -autenticación, escritura en D1, publicación de datos
// vivos, disparo de notificaciones- contra un Worker real, que es donde
// aparecieron algunos de los incidentes de esta sesión (el aviso silencioso,
// el reproceso diferido). Pensado para correr antes de fusionar un cambio
// de lógica de ingesta que dé motivos para desconfiar del camino completo,
// no en cada PR.
import { readdirSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const STAGING_URL = process.env.STAGING_URL || "https://araya-centro-control-staging.grupobricket.workers.dev";
const email = process.env.STAGING_VERIFY_EMAIL;
const pin = process.env.STAGING_VERIFY_PIN;
if (!email || !pin) {
  console.error("Faltan STAGING_VERIFY_EMAIL / STAGING_VERIFY_PIN en el entorno.");
  process.exit(1);
}

const login = await fetch(`${STAGING_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`Login en staging falló (${login.status}). ¿Se configuraron BOOTSTRAP_ADMIN_EMAIL/PIN en el Worker de staging (staging-configurar-secretos.yml)?`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const FIXTURES_DIR = "tests/fixtures";
const skipExtensions = new Set([".json"]);
const fixtureFiles = readdirSync(FIXTURES_DIR).filter((name) => !skipExtensions.has(extname(name)));

console.log(`=== Subiendo ${fixtureFiles.length} archivo(s) de ${FIXTURES_DIR} a staging (${STAGING_URL}) ===\n`);

const resultados = [];
for (const name of fixtureFiles) {
  const bytes = readFileSync(`${FIXTURES_DIR}/${name}`);
  const form = new FormData();
  form.set("file", new Blob([bytes]), basename(name));
  form.set("area", "auto");
  form.set("source", "dashboard");
  form.set("processNow", "true");

  const response = await fetch(`${STAGING_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.log(`[ERROR ${response.status}] ${name}: ${body.error || "sin detalle"}`);
    resultados.push({ name, ok: false });
    continue;
  }
  const file = body.file || {};
  const problema = file.requiresReview || file.processingStage === "error";
  console.log(`[${problema ? "REVISAR" : "OK"}] ${name}`);
  console.log(`   área: ${file.areaLabel || file.area} · tipo: ${file.documentType} · corte: ${file.declaredCutoff || "sin declarar"}`);
  console.log(`   procesado: ${file.processingStage} ${file.processingProgress ?? ""}% · publicado: ${file.publicationRevision ? `revisión ${file.publicationRevision}` : "NO"}`);
  if (file.processingSummary) console.log(`   resumen: ${file.processingSummary}`);
  resultados.push({ name, ok: !problema });
}

const fallidos = resultados.filter((r) => !r.ok);
console.log(`\n=== Conclusión: ${resultados.length - fallidos.length}/${resultados.length} sin incidencias ===`);
if (fallidos.length) {
  console.log(`Requieren revisión: ${fallidos.map((r) => r.name).join(", ")}`);
  process.exit(1);
}
