#!/usr/bin/env node
// Convierte los DWG archivados a una imagen PNG navegable. El Worker conserva
// siempre el original en R2; GitHub Actions aporta LibreDWG y librsvg, que no
// caben en el runtime edge. La imagen derivada vuelve a entrar por la ingesta
// normal: se clasifica, puede ser leída por visión y queda enlazada al DWG.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "").toLowerCase();
const MAX_POR_EJECUCION = Math.max(1, Math.min(5, Number(process.env.MAX_POR_EJECUCION ?? 3) || 3));

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

function nombrePng(original) {
  return original.replace(/\.dwg$/i, "") + " (vista automática).png";
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
if (!filesResponse.ok) {
  console.error(`✖ No se pudo consultar el registro (${filesResponse.status}).`);
  process.exit(1);
}
const { files = [] } = await filesResponse.json();
const activos = files.filter((file) => !file.deletedAt && !file.supersededAt);
const candidatos = activos.filter((file) =>
  String(file.extension).toLowerCase() === "dwg" &&
  file.originalName.toLowerCase().includes(FILTRO));
const objetivo = candidatos.filter((dwg) => !activos.some((file) => {
  const relacionExplicita = file.derivedFromFileId === dwg.id && file.automationKind === "dwg_to_png";
  const conversionLegada = file.originalName === nombrePng(dwg.originalName) &&
    Date.parse(file.createdAt) >= Date.parse(dwg.createdAt);
  return relacionExplicita || conversionLegada;
})).slice(0, MAX_POR_EJECUCION);

console.log(`=== ${objetivo.length} DWG pendiente(s) de ${candidatos.length} candidato(s) ===`);
if (!objetivo.length) {
  console.log("Nada que convertir.");
  process.exit(0);
}

for (const file of objetivo) {
  const carpeta = await mkdtemp(join(tmpdir(), "araya-dwg-"));
  try {
    const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
    if (!descarga.ok) {
      console.error(`✖ ${file.originalName}: no se pudo descargar (${descarga.status}).`);
      continue;
    }
    const rutaDwg = join(carpeta, "plano.dwg");
    const rutaSvg = join(carpeta, "plano.svg");
    const rutaPng = join(carpeta, "plano.png");
    await writeFile(rutaDwg, Buffer.from(await descarga.arrayBuffer()));

    // dwg2SVG escribe el SVG por stdout. rsvg-convert rasteriza con ancho alto
    // para que parcelas, edificios y rótulos sigan siendo legibles en tableta.
    const { stdout: svg } = await run("dwg2SVG", [rutaDwg], {
      encoding: "buffer",
      maxBuffer: 96 * 1024 * 1024,
    });
    if (!svg?.length || !Buffer.from(svg).includes(Buffer.from("<svg"))) {
      console.error(`✖ ${file.originalName}: LibreDWG no produjo un SVG reconocible.`);
      continue;
    }
    await writeFile(rutaSvg, svg);
    await run("rsvg-convert", ["--keep-aspect-ratio", "--width", "3200", "--output", rutaPng, rutaSvg], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const png = await readFile(rutaPng);
    if (png.length < 1_000 || png[0] !== 0x89 || png.subarray(1, 4).toString("ascii") !== "PNG") {
      console.error(`✖ ${file.originalName}: la imagen convertida no es un PNG válido.`);
      continue;
    }
    console.log(`✔ ${file.originalName}: vista PNG generada (${(png.length / 1024 / 1024).toFixed(1)} MB).`);
    if (!APLICAR) {
      console.log("  Simulación: no se ha subido la vista.");
      continue;
    }

    const form = new FormData();
    form.set("file", new File([png], nombrePng(file.originalName), { type: "image/png" }));
    form.set("autoPublish", "true");
    form.set("area", "diseno");
    form.set("derivedFromFileId", file.id);
    form.set("automationKind", "dwg_to_png");
    if (file.declaredCutoff) form.set("declaredCutoff", file.declaredCutoff);
    form.set("description", `Vista navegable generada automáticamente desde ${file.originalName}.`);
    const subida = await fetch(`${PRODUCTION_URL}/api/files`, {
      method: "POST",
      headers: { Cookie },
      body: form,
    });
    const payload = await subida.json().catch(() => ({}));
    if (!subida.ok) {
      console.error(`✖ ${file.originalName}: la subida devolvió ${subida.status} · ${payload.error ?? ""}`);
      continue;
    }
    console.log(`  ✔ Vista enlazada e ingerida: ${payload.message ?? "correcto"}`);
  } catch (error) {
    console.error(`✖ ${file.originalName}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}
