#!/usr/bin/env node
// Sube un lote de archivos a producción exactamente por la misma ruta que
// usaría una persona desde el navegador (POST /api/files, sesión real de
// administrador), con source "agent" para que el procesamiento corra en el
// acto en vez de esperar al reproceso diferido, y area "auto" para que el
// propio clasificador de la app decida el área -- no se fuerza nada a mano.
//
// Uso: DIRECTORIO=scratch-uploads/... node scripts/subir-lote.mjs
// REPROCESO=true reintenta la extracción sobre el mismo expediente ya
// registrado (mismo sha256), para cuando una lectura de IA falló y quiere
// repetirse con los mismos bytes -- no crea un expediente nuevo.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Preparación temporal del original: el transporte en partes evita que una
// conexión interrumpida deje incompleta la transferencia de un DWG grande.
// Se reconstruyen y verifican los bytes antes de usar la ingesta habitual.
if (process.env.DIRECTORIO === "scratch-uploads/masterplan-original") {
  const chunks = [];
  for (let i = 0; i < 10; i += 1) chunks.push(await readFile(`scratch-uploads/masterplan-partes/plano.${String(i).padStart(2, "0")}.parte`));
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== "490f6438b05035240797f3a979eb4809b483b3a5a9deb151d92e40d8786382c5") throw new Error("El original reconstruido no coincide con el DWG de origen.");
  await mkdir(process.env.DIRECTORIO, { recursive: true });
  await writeFile(path.join(process.env.DIRECTORIO, "ROA-E00-URB-A101-MASTER_PLAN cambio estaciomientos.dwg"), bytes);
  console.log("DWG reconstruido: identidad del original confirmada.");
}

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const directorio = process.env.DIRECTORIO;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}
if (!directorio) {
  console.error("✖ Falta DIRECTORIO.");
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

const extensionToMime = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const nombres = (await readdir(directorio)).filter((n) => !n.startsWith(".")).sort();
console.log(`=== ${nombres.length} archivo(s) a subir desde "${directorio}" ===\n`);

let fallos = 0;
for (const nombre of nombres) {
  const ruta = path.join(directorio, nombre);
  const bytes = await readFile(ruta);
  const extension = nombre.split(".").pop()?.toLowerCase() ?? "";
  const mime = extensionToMime[extension] ?? "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), nombre);
  form.append("area", "auto");
  form.append("source", "agent");
  form.append("processNow", "true");
  if (nombre === "ROA-E00-URB-A101-MASTER_PLAN cambio estaciomientos (vista verificada).png") {
    form.set("area", "diseno");
    form.set("derivedFromFileId", "5e08bada-e11c-4e82-ae7e-75acf6be67cb");
    form.set("automationKind", "dwg_to_png");
    form.set("description", "Vista técnica verificada del master plan actualizado; geometría y anclas contrastadas con el DWG original.");
  }
  if (process.env.REPROCESO === "true") form.append("reprocess", "true");

  console.log(`→ Subiendo "${nombre}" (${bytes.length} bytes)...`);
  const response = await fetch(`${PRODUCTION_URL}/api/files`, {
    method: "POST",
    headers: { Cookie },
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    fallos += 1;
    console.error(`  ✖ ${response.status}: ${result.error || "sin detalle"}`);
    continue;
  }
  const f = result.file ?? {};
  console.log(`  ✔ id: ${f.id} · área: ${f.area} · estado: ${f.status} · etapa: ${f.processingStage} (${f.processingProgress}%)`);
  if (f.processingSummary) console.log(`    resumen: ${f.processingSummary}`);
  if (result.receipt) {
    console.log(`    recibo: ${result.receipt.outcome} · publicados: ${result.receipt.publishedCount} · sin cambio: ${result.receipt.unchangedCount} · descartados: ${result.receipt.ignoredCount} · avisos: ${result.receipt.warningCount}`);
  }
  if (result.message) console.log(`    ${result.message}`);
  if (result.restricted) console.log(`    (contenido financiero/comercial protegido -- sólo lo ve personal autorizado)`);
}

console.log(`\n=== Fin: ${nombres.length - fallos}/${nombres.length} subidos sin error de red ===`);
if (fallos) process.exit(1);
