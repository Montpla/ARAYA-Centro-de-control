#!/usr/bin/env node
// Relee, en lotes pequeños e idempotentes, los expedientes procesados con una
// versión anterior del pipeline. El archivo original no se duplica: la API lo
// reconoce por SHA-256, reclama la misma fila y publica sólo cambios válidos.

import { readFile } from "node:fs/promises";

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const MAX_POR_EJECUCION = Math.max(1, Math.min(10, Number(process.env.MAX_POR_EJECUCION ?? 3) || 3));
const FILTRO = (process.env.FILTRO ?? "").toLowerCase();
const supported = new Set(["csv", "doc", "docx", "jpeg", "jpg", "json", "pdf", "png", "ppt", "pptx", "xls", "xlsx", "xml", "zip"]);
// Este libro se cierra expresamente en el punto 6: sus cifras de junio ya están
// reemplazadas por el corte oficial posterior. Releerlo antes de marcar la
// relación de sustitución podría reintroducir un 18,23 % obsoleto.
const knownSupersededNames = new Set(["avance-fisico-y-cubicaciones-junio-2026.xls"]);

const versionSource = await readFile(new URL("../lib/ingestion-version.ts", import.meta.url), "utf8");
const currentVersion = versionSource.match(/CURRENT_INGESTION_VERSION\s*=\s*["']([^"']+)/)?.[1];
if (!currentVersion) {
  console.error("✖ No se pudo leer CURRENT_INGESTION_VERSION.");
  process.exit(1);
}

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

const response = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
if (!response.ok) {
  console.error(`✖ No se pudo consultar el registro (${response.status}).`);
  process.exit(1);
}
const { files = [] } = await response.json();
const now = Date.now();
const technicalRetryCandidate = (file) => {
  if (file.publicationRevision !== null && file.publicationRevision !== undefined) return false;
  const attempts = Number(file.processingAttempts || 0);
  if (attempts >= 3) return false;
  const updatedAt = Date.parse(file.updatedAt || file.createdAt || "");
  const oldEnough = !Number.isFinite(updatedAt) || now - updatedAt >= 5 * 60 * 1000;
  if (!oldEnough) return false;
  const interrupted = ["recibido", "extraccion_en_curso"].includes(String(file.processingStage || ""));
  const failedTransiently = attempts > 0 && Boolean(file.lastProcessingError) &&
    ["observado", "pendiente_extraccion", "cambios_solicitados"].includes(
      String(file.processingStage || file.reviewStatus || ""),
    );
  return interrupted || failedTransiently;
};
const candidatos = files
  .filter((file) =>
    !file.deletedAt &&
    !file.supersededAt &&
    file.status !== "rechazado" &&
    file.processingStage !== "extraccion_en_curso" &&
    supported.has(String(file.extension).toLowerCase()) &&
    !knownSupersededNames.has(file.originalName.toLowerCase()) &&
    (String(file.ingestionVersion || "") !== currentVersion || technicalRetryCandidate(file)) &&
    file.originalName.toLowerCase().includes(FILTRO))
  .sort((a, b) => Date.parse(a.processedAt || a.createdAt) - Date.parse(b.processedAt || b.createdAt));
const objetivo = candidatos.slice(0, MAX_POR_EJECUCION);

console.log(`=== Reproceso ${currentVersion}: ${objetivo.length} de ${candidatos.length} pendiente(s) ===`);
for (const file of objetivo) {
  console.log(`  · ${file.originalName} · versión ${file.ingestionVersion || "sin marca"}`);
}
if (!objetivo.length || !APLICAR) {
  console.log(!objetivo.length ? "Nada que reprocesar." : "Simulación: no se han modificado expedientes.");
  process.exit(0);
}

for (const file of objetivo) {
  const download = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
  if (!download.ok) {
    console.error(`✖ ${file.originalName}: descarga ${download.status}.`);
    continue;
  }
  const bytes = await download.arrayBuffer();
  const form = new FormData();
  form.set("file", new File([bytes], file.originalName, {
    type: file.mimeType || download.headers.get("content-type") || "application/octet-stream",
  }));
  form.set("reprocess", "true");
  // Los registros históricos pueden contener varias filas antiguas con la
  // misma huella. Se dirige el reproceso a la fila enumerada para que el lote
  // avance realmente y no vuelva a reclamar siempre la primera coincidencia.
  form.set("reprocessFileId", file.id);
  form.set("autoPublish", "true");
  form.set("area", file.area || "auto");
  form.set("sourceCurrency", file.sourceCurrency || "auto");
  if (file.declaredCutoff) form.set("declaredCutoff", file.declaredCutoff);
  if (file.section) form.set("section", file.section);
  form.set("description", file.description || `Reproceso automático con lector ${currentVersion}.`);

  const upload = await fetch(`${PRODUCTION_URL}/api/files`, {
    method: "POST",
    headers: { Cookie },
    body: form,
  });
  const payload = await upload.json().catch(() => ({}));
  if (!upload.ok) {
    console.error(`✖ ${file.originalName}: reproceso ${upload.status} · ${payload.error ?? ""}`);
    continue;
  }
  console.log(`✔ ${file.originalName}: ${payload.message ?? payload.processingSummary ?? "reprocesado"}`);
}
