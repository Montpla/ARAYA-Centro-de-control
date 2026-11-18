#!/usr/bin/env node
// Comprime los PDF demasiado pesados para leerse dentro del Worker y sube la
// versión ligera como archivo derivado.
//
// Un reporte hecho de fotos escaneadas puede pesar 25-30 MB; el Worker de
// Cloudflare se queda sin memoria al leerlo y la carga devuelve un 503 vacío
// (reportes de Seguridad de las semanas 2 y 3 de octubre de 2026). Aquí, en un
// runner de GitHub, Ghostscript lo reduce y el resultado entra por la misma
// ingesta que cualquier PDF. Cuando el derivado queda publicado, el original
// se cierra como histórico sustituido por él.
//
// Simula por defecto; APLICAR=1 sube el PDF comprimido. FILE_ID limita el
// lote a un expediente. Requiere Ghostscript (gs) en el PATH.

import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILE_ID = String(process.env.FILE_ID ?? "").trim();
// Mismo umbral que LARGE_PDF_BYTES en lib/pdf-compression-trigger.ts.
const UMBRAL_BYTES = 15 * 1024 * 1024;
const MAX_POR_EJECUCION = 5;
const AUTOMATIZACION = "pdf_compress";

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
const yaComprimido = (original) => activos.some((file) =>
  file.derivedFromFileId === original.id && file.automationKind === AUTOMATIZACION);
const objetivo = activos
  .filter((file) =>
    String(file.extension).toLowerCase() === "pdf" &&
    Number(file.sizeBytes) > UMBRAL_BYTES &&
    !file.derivedFromFileId &&
    file.publicationRevision === null &&
    (!FILE_ID || file.id === FILE_ID) &&
    !yaComprimido(file))
  .slice(0, MAX_POR_EJECUCION);

console.log(`=== ${objetivo.length} PDF pesado(s) pendiente(s) de comprimir ===`);
for (const file of objetivo) {
  console.log(`  · ${file.originalName} · ${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB · subido ${file.createdAt}`);
}

function nombreComprimido(original) {
  return original.replace(/\.pdf$/i, "") + " (comprimido).pdf";
}

// De más calidad a menos: se usa el primer ajuste que deja el archivo por
// debajo del umbral. /ebook (150 ppp) conserva legibles las tablas de un
// reporte; /screen (72 ppp) sólo si hace falta.
const AJUSTES = ["/ebook", "/screen"];

for (const file of objetivo) {
  const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ ${file.originalName}: la descarga devolvió ${descarga.status}.`);
    continue;
  }
  const entrada = `/tmp/${file.id}.pdf`;
  await writeFile(entrada, Buffer.from(await descarga.arrayBuffer()));

  let salida = "";
  for (const ajuste of AJUSTES) {
    const destino = `/tmp/${file.id}-${ajuste.slice(1)}.pdf`;
    try {
      await run("gs", [
        "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", `-dPDFSETTINGS=${ajuste}`,
        "-dNOPAUSE", "-dBATCH", "-dQUIET", `-sOutputFile=${destino}`, entrada,
      ], { maxBuffer: 16 * 1024 * 1024 });
    } catch (error) {
      console.error(`✖ ${file.originalName}: Ghostscript falló con ${ajuste}. ${String(error.stderr || error.message).slice(0, 300)}`);
      continue;
    }
    const { size } = await stat(destino);
    console.log(`   ${ajuste}: ${(size / 1024 / 1024).toFixed(1)} MB`);
    if (size <= UMBRAL_BYTES) {
      salida = destino;
      break;
    }
  }
  if (!salida) {
    console.error(`✖ ${file.originalName}: ni comprimido baja de ${UMBRAL_BYTES / 1024 / 1024} MB; queda archivado sin leer.`);
    continue;
  }
  if (!APLICAR) {
    console.log("   Simulación (APLICAR=0): no se sube.");
    continue;
  }

  const form = new FormData();
  form.set("file", new File([await readFile(salida)], nombreComprimido(file.originalName), { type: "application/pdf" }));
  form.set("autoPublish", "true");
  form.set("area", file.area);
  form.set("derivedFromFileId", file.id);
  form.set("automationKind", AUTOMATIZACION);
  if (file.declaredCutoff) form.set("declaredCutoff", file.declaredCutoff);
  // Sin fechas en la descripción: detectPeriod las leería como periodo.
  form.set("description", `Versión comprimida de ${file.originalName} para poder leerla.`);
  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`   ✖ La subida devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`   ✔ Comprimido subido: ${cuerpo.message ?? "ingerido"}`);

  // El original no publicó nada y ya tiene sustituto publicado: se cierra como
  // histórico para que no siga apareciendo como pendiente.
  const derivado = cuerpo.file;
  const leido = derivado?.processingStage === "sincronizado";
  if (derivado?.id && (leido || (derivado.publicationRevision !== null && derivado.publicationRevision !== undefined))) {
    const cierre = await fetch(`${PRODUCTION_URL}/api/files/supersede`, {
      method: "POST",
      headers: { Cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: file.id,
        replacementFileId: derivado.id,
        reason: "PDF demasiado pesado para el lector: sustituido por su versión comprimida, que ya se ha leído.",
      }),
    });
    const respuesta = await cierre.json().catch(() => ({}));
    console.log(cierre.ok
      ? "   ✔ Original cerrado como histórico."
      : `   ⚠ No se pudo cerrar el original (${cierre.status}): ${respuesta.error ?? ""}`);
  } else {
    console.log("   ⚠ El comprimido no terminó de leerse; el original se deja como está para revisarlo.");
  }
}
