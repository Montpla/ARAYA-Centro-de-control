#!/usr/bin/env node
// Convierte a .xlsx los libros de Excel antiguos (.xls) y sube la copia como
// archivo derivado.
//
// El lector del Worker lee .xlsx celda a celda, pero un .xls (formato binario
// antiguo) no produce datos verificables: la carga quedaba archivada pidiendo
// guardarlo como .xlsx y volver a subirlo. Aquí, en un runner de GitHub,
// LibreOffice lo convierte y la copia entra por la misma ingesta que
// cualquier .xlsx. Cuando la copia se ha leído, el original se cierra como
// histórico sustituido por ella (si el original no publicó nada).
//
// Simula por defecto; APLICAR=1 sube la copia. FILE_ID limita el lote a un
// expediente. Requiere LibreOffice (soffice) en el PATH.

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILE_ID = String(process.env.FILE_ID ?? "").trim();
const MAX_POR_EJECUCION = 5;
const AUTOMATIZACION = "xls_convert";

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
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`✖ Login falló (${login.status}).`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const { files = [] } = await (await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } })).json();
const activos = files.filter((file) => !file.deletedAt && !file.supersededAt);
const derivadoDe = (original) => activos.find((file) =>
  file.derivedFromFileId === original.id && file.automationKind === AUTOMATIZACION);

async function cerrarOriginal(original, copia) {
  if (original.publicationRevision !== null && original.publicationRevision !== undefined) {
    console.log("   · El original ya publicó datos en su día: se conserva vigente junto a su copia.");
    return;
  }
  const cierre = await fetch(`${PRODUCTION_URL}/api/files/supersede`, {
    method: "POST",
    headers: { Cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId: original.id,
      replacementFileId: copia.id,
      reason: "Libro de Excel antiguo (.xls): sustituido por su copia convertida a .xlsx, que ya se ha leído.",
    }),
  });
  const respuesta = await cierre.json().catch(() => ({}));
  console.log(cierre.ok
    ? `   ✔ Original cerrado como histórico: ${original.originalName}`
    : `   ⚠ No se pudo cerrar ${original.originalName} (${cierre.status}): ${respuesta.error ?? ""}`);
}

// Originales cuya copia ya se leyó pero siguen abiertos.
for (const file of activos) {
  if (String(file.extension).toLowerCase() !== "xls" || file.derivedFromFileId) continue;
  if (FILE_ID && file.id !== FILE_ID) continue;
  const copia = derivadoDe(file);
  if (!copia || copia.processingStage !== "sincronizado") continue;
  if (file.publicationRevision !== null && file.publicationRevision !== undefined) continue;
  if (!APLICAR) {
    console.log(`  · Sin cerrar: ${file.originalName}. Simulación: no se cierra.`);
    continue;
  }
  await cerrarOriginal(file, copia);
}

const objetivo = activos
  .filter((file) =>
    String(file.extension).toLowerCase() === "xls" &&
    !file.derivedFromFileId &&
    (!FILE_ID || file.id === FILE_ID) &&
    !derivadoDe(file))
  .slice(0, MAX_POR_EJECUCION);

console.log(`=== ${objetivo.length} libro(s) .xls pendiente(s) de convertir ===`);
for (const file of objetivo) {
  console.log(`  · ${file.originalName} · subido ${file.createdAt}`);
}

await mkdir("/tmp/xls", { recursive: true });
for (const file of objetivo) {
  const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ ${file.originalName}: la descarga devolvió ${descarga.status}.`);
    continue;
  }
  const entrada = `/tmp/xls/${file.id}.xls`;
  await writeFile(entrada, Buffer.from(await descarga.arrayBuffer()));
  try {
    await run("soffice", ["--headless", "--calc", "--convert-to", "xlsx", "--outdir", "/tmp/xls", entrada], { timeout: 180_000 });
  } catch (error) {
    console.error(`✖ ${file.originalName}: LibreOffice no pudo convertirlo. ${String(error.stderr || error.message).slice(0, 300)}`);
    continue;
  }
  const salida = `/tmp/xls/${file.id}.xlsx`;
  const bytes = await readFile(salida).catch(() => null);
  if (!bytes?.length) {
    console.error(`✖ ${file.originalName}: la conversión no generó el .xlsx.`);
    continue;
  }
  console.log(`   convertido: ${(bytes.length / 1024).toFixed(0)} KB`);
  if (!APLICAR) {
    console.log("   Simulación (APLICAR=0): no se sube.");
    continue;
  }
  const nombre = file.originalName.replace(/\.xls$/i, "") + " (convertido a xlsx).xlsx";
  const form = new FormData();
  form.set("file", new File([bytes], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  form.set("autoPublish", "true");
  form.set("area", file.area);
  form.set("derivedFromFileId", file.id);
  form.set("automationKind", AUTOMATIZACION);
  if (file.declaredCutoff) form.set("declaredCutoff", file.declaredCutoff);
  // Sin fechas en la descripción: detectPeriod las leería como periodo.
  form.set("description", `Copia convertida a .xlsx de ${file.originalName} para poder leerla.`);
  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`   ✖ La subida devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`   ✔ Copia subida: ${cuerpo.message ?? "ingerida"}`);
  const copia = cuerpo.file;
  if (copia?.id && copia.processingStage === "sincronizado") await cerrarOriginal(file, copia);
}
