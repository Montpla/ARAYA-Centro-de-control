#!/usr/bin/env node
// Red de seguridad de la verificación automática de cargas
// (.github/workflows/reintentar-verificaciones.yml, cada pocas horas).
//
// 1. Archivos subidos que nunca llegaron a verificarse (el aviso desde la web
//    a GitHub falló, o GitHub no lo atendió): se lanza su verificación.
// 2. Incidencias "🔎 Revisar carga" en las que la revisión de Claude no llegó
//    a terminar (límite de uso de la suscripción agotado o un error): se
//    vuelve a lanzar, como mucho MAX_REINTENTOS veces por incidencia.
// 3. PR de arreglo automático abiertos que no llegaron a fusionarse: se
//    retoma su circuito, también como mucho MAX_REINTENTOS veces.
//
// Sólo lanza workflows; no publica ni toca datos. No imprime importes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { uploadNeedsVerification } from "../lib/upload-verification.ts";

const run = promisify(execFile);
const REPO = process.env.GITHUB_REPOSITORY ?? "Montpla/ARAYA-Centro-de-control";
const TOKEN = process.env.GH_TOKEN;
const APLICAR = process.env.APLICAR !== "0";
// La verificación automática existe desde aquí: los archivos anteriores ya se
// revisaron a mano y no deben llenar el móvil de avisos.
const DESDE = process.env.DESDE ?? "2026-11-19 08:15:00";
const MAX_REINTENTOS = 3;
const ESPERA_MINIMA_MS = 2 * 60 * 60 * 1000;
const LARGE_PDF_BYTES = 15 * 1024 * 1024;
const MARCA = "Reintento automático";

if (!TOKEN) {
  console.error("✖ Falta GH_TOKEN.");
  process.exit(1);
}

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "araya-centro-de-control",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub ${path} devolvió ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function lanzarVerificacion(fileId, motivo) {
  console.log(`  → ${motivo}: verificar ${fileId}`);
  if (!APLICAR) return;
  await github("/actions/workflows/verificar-carga.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { file_id: fileId, notificar: "1", arreglar: "1" } }),
  });
}

async function d1(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json", "--command", sql,
  ], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout)?.[0]?.results ?? [];
}

// 1. Cargas sin verificar.
console.log(`=== Cargas desde ${DESDE} sin verificación registrada ===`);
const sinVerificar = await d1(`SELECT f.id, f.original_name AS name, f.extension, f.size_bytes AS size,
    f.derived_from_file_id AS derived, f.processing_stage AS stage, f.updated_at AS updatedAt
  FROM uploaded_files f
  WHERE f.deleted_at = '' AND f.superseded_by_file_id = '' AND f.created_at >= '${DESDE.replace(/'/g, "")}'
    AND f.processing_stage NOT IN ('recibido', 'extraccion_en_curso')
    AND NOT EXISTS (SELECT 1 FROM file_activity a WHERE a.file_id = f.id AND a.event_type = 'verificacion_carga')`);
let lanzadas = 0;
for (const file of sinVerificar) {
  if (!uploadNeedsVerification({
    extension: String(file.extension ?? ""),
    derivedFromFileId: String(file.derived ?? ""),
    sizeBytes: Number(file.size ?? 0),
    largePdfBytes: LARGE_PDF_BYTES,
  })) continue;
  // Recién procesado: su propia verificación puede estar aún en marcha.
  const actualizado = Date.parse(String(file.updatedAt).replace(" ", "T") + "Z");
  if (Number.isFinite(actualizado) && Date.now() - actualizado < 45 * 60 * 1000) continue;
  await lanzarVerificacion(file.id, `sin verificar (${file.name})`);
  lanzadas += 1;
}
console.log(`  ${lanzadas} verificación(es) lanzada(s).`);

// 2. Revisiones de Claude que no terminaron.
console.log("\n=== Incidencias de carga con la revisión de Claude sin terminar ===");
const incidencias = await github("/issues?state=open&per_page=50");
for (const issue of incidencias) {
  if (issue.pull_request || !String(issue.title).startsWith("🔎 Revisar carga:")) continue;
  const id = String(issue.body ?? "").match(/\*\*Identificador:\*\* `([^`]+)`/)?.[1];
  if (!id) continue;
  const comentarios = await github(`/issues/${issue.number}/comments?per_page=100`);
  const concluyo = comentarios.some((c) => /Claude (lo ha|propuso|necesita)/.test(c.body ?? ""));
  if (concluyo) continue;
  const reintentos = comentarios.filter((c) => (c.body ?? "").startsWith(MARCA)).length;
  const ultimo = Date.parse(comentarios.at(-1)?.created_at ?? issue.created_at);
  if (reintentos >= MAX_REINTENTOS) {
    console.log(`  #${issue.number}: ya se reintentó ${reintentos} veces; queda para revisión.`);
    continue;
  }
  if (Date.now() - ultimo < ESPERA_MINIMA_MS) continue;
  await lanzarVerificacion(id, `#${issue.number} sin conclusión`);
  if (APLICAR) {
    await github(`/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: `${MARCA} ${reintentos + 1} de ${MAX_REINTENTOS}: la revisión anterior no terminó; se vuelve a lanzar.` }),
    });
  }
}
// 3. Arreglos de Claude con PR abierto que no llegaron a fusionarse (el
//    circuito se cortó: CI lenta, despliegue fallido…). Se retoma su circuito
//    con fusionar_pr, sin volver a gastar una revisión de Claude.
console.log("\n=== PR de arreglo automático abiertos sin fusionar ===");
const prs = await github("/pulls?state=open&per_page=50");
for (const pr of prs) {
  const fileId = String(pr.head?.ref ?? "").match(/^claude\/arreglo-carga-([0-9a-f-]{36})-\d+$/)?.[1];
  if (!fileId) continue;
  if (Date.now() - Date.parse(pr.updated_at) < ESPERA_MINIMA_MS) continue;
  const comentarios = await github(`/issues/${pr.number}/comments?per_page=100`);
  const reintentos = comentarios.filter((c) => (c.body ?? "").startsWith(MARCA)).length;
  if (reintentos >= MAX_REINTENTOS) {
    console.log(`  #${pr.number}: ya se reintentó ${reintentos} veces; queda para revisión.`);
    continue;
  }
  console.log(`  → #${pr.number}: retomar su circuito (archivo ${fileId})`);
  if (!APLICAR) continue;
  await github("/actions/workflows/verificar-carga.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { file_id: fileId, notificar: "1", arreglar: "1", fusionar_pr: String(pr.number) } }),
  });
  await github(`/issues/${pr.number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: `${MARCA} ${reintentos + 1} de ${MAX_REINTENTOS}: el arreglo no llegó a fusionarse; se retoma su circuito.` }),
  });
}
console.log("\nHecho.");
