#!/usr/bin/env node
// Verificación automática de una carga (la lanza .github/workflows/verificar-carga.yml
// en cuanto se sube un archivo al Centro de Control).
//
// Espera a que el archivo termine de procesarse, pide el veredicto a
// /api/files/verification y, con NOTIFICAR=1, lo deja registrado y avisa a los
// administradores. Escribe en GITHUB_OUTPUT el veredicto (ok, aviso,
// anomalia, pendiente) y un resumen en VERIFICACION_MD para el issue. Nunca
// imprime importes: el endpoint sólo devuelve claves, motivos y porcentajes.

import { appendFile, writeFile } from "node:fs/promises";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
// Un identificador exacto, o un texto del nombre (para lanzarlo a mano).
let FILE_ID = (process.env.FILE_ID ?? "").trim();
const NOTIFICAR = process.env.NOTIFICAR !== "0";
const ESPERA_MAXIMA_MS = Number(process.env.ESPERA_MAXIMA_MS ?? 25 * 60 * 1000);
const INTERVALO_MS = Number(process.env.INTERVALO_MS ?? 30 * 1000);

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}
if (!FILE_ID) {
  console.error("✖ Falta FILE_ID.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!session) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${session[1]}`;

if (!/^[0-9a-f-]{36}$/i.test(FILE_ID)) {
  const { files = [] } = await (await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } })).json();
  const texto = FILE_ID.toLowerCase();
  const encontrados = files.filter((file) => !file.deletedAt && !file.supersededAt &&
    String(file.originalName ?? "").toLowerCase().includes(texto));
  if (encontrados.length !== 1) {
    console.error(`✖ «${FILE_ID}» coincide con ${encontrados.length} archivo(s) vigentes; indica el identificador exacto.`);
    for (const file of encontrados.slice(0, 10)) console.error(`   ${file.id} · ${file.originalName}`);
    process.exit(1);
  }
  FILE_ID = encontrados[0].id;
  console.log(`Archivo: ${encontrados[0].originalName} (${FILE_ID})`);
}

async function verificar(notify) {
  const response = await fetch(`${PRODUCTION_URL}/api/files/verification`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: FILE_ID, notify }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`/api/files/verification devolvió ${response.status}: ${body.error ?? ""}`);
  return body;
}

const inicio = Date.now();
let resultado = await verificar(false);
while (resultado.verdict === "pendiente" && Date.now() - inicio < ESPERA_MAXIMA_MS) {
  console.log(`… ${resultado.file?.name ?? FILE_ID}: ${resultado.summary}`);
  await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  resultado = await verificar(false);
}
if (resultado.verdict === "pendiente") {
  // Lleva más de lo normal: se trata como algo a revisar.
  resultado = {
    ...resultado,
    verdict: "anomalia",
    summary: `El archivo sigue sin terminar de procesarse tras ${Math.round(ESPERA_MAXIMA_MS / 60000)} minutos.`,
    checks: [{ id: "atascado", severity: "anomalia", detail: resultado.summary }],
  };
} else if (NOTIFICAR) {
  resultado = await verificar(true);
}

const icono = { ok: "✔", aviso: "⚠", anomalia: "✖" }[resultado.verdict] ?? "·";
console.log(`\n${icono} ${resultado.file?.name ?? FILE_ID} · veredicto: ${resultado.verdict}`);
for (const check of resultado.checks ?? []) console.log(`   [${check.severity}] ${check.id}: ${check.detail}`);

const nombre = resultado.file?.name ?? FILE_ID;
const markdown = [
  `**Archivo:** ${nombre}`,
  `**Identificador:** \`${FILE_ID}\``,
  `**Etapa:** ${resultado.file?.stage ?? "?"} · **revisión publicada:** ${resultado.file?.revision ?? "—"}`,
  `**Veredicto:** ${resultado.verdict}`,
  "",
  ...(resultado.checks ?? []).map((check) => `- **${check.id}** (${check.severity}): ${check.detail}`),
].join("\n");
if (process.env.VERIFICACION_MD) await writeFile(process.env.VERIFICACION_MD, markdown);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, [
    `veredicto=${resultado.verdict}`,
    `nombre=${String(nombre).replace(/[\r\n]+/g, " ").slice(0, 200)}`,
    "",
  ].join("\n"));
}
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
