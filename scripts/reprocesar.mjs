#!/usr/bin/env node
// Reprocesa archivos ya subidos, haciéndolos pasar de nuevo por la ingesta real.
//
// Cuando se mejora un lector, los archivos que se subieron antes no se
// re-analizan solos: siguen con lo que se extrajo el día que entraron. Esto los
// descarga de producción y los vuelve a subir por el mismo endpoint de ingesta,
// de modo que pasan por el pipeline actual (lectores propios + IA de relleno) y
// el panel se actualiza con lo que antes se quedó a medias. Usa el pipeline de
// verdad, no una reproducción: la IA de relleno corre con las claves del
// servidor, igual que en una subida normal.
//
// Simula por defecto; hay que pedir APLICAR=1 porque publica en el panel.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "jul").toLowerCase();
// FORMATOS restringe por extensión (p. ej. "pptx" o "pptx,docx"). Sirve para
// reprocesar sólo los informes narrativos que leyó la IA y dejó a medias, sin
// tocar los Excel que ya leyeron bien los lectores propios.
const FORMATOS = (process.env.FORMATOS ?? "")
  .toLowerCase()
  .split(",")
  .map((f) => f.trim())
  .filter(Boolean);

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const sessionMatch = loginResponse.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!sessionMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${sessionMatch[1]}`;

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();

// Se eligen los archivos cuyo nombre contiene el filtro (por defecto "jul") y
// que no están eliminados; sólo los formatos que la ingesta procesa.
const procesables = new Set(["pptx", "docx", "pdf", "xlsx", "xls", "csv", "xml", "zip", "json"]);
const permitidos = FORMATOS.length ? new Set(FORMATOS) : procesables;
const objetivo = files.filter((f) => {
  const ext = String(f.extension).toLowerCase();
  return !f.deletedAt &&
    f.originalName.toLowerCase().includes(FILTRO) &&
    procesables.has(ext) &&
    permitidos.has(ext);
});

const sufijoFormato = FORMATOS.length ? ` y formato ${FORMATOS.join("/")}` : "";
console.log(`=== ${objetivo.length} archivo(s) que contienen "${FILTRO}"${sufijoFormato} ===`);
for (const f of objetivo) {
  console.log(`  · ${f.originalName} · área ${f.areaLabel} · subido ${f.createdAt} · rev publicada ${f.publicationRevision || "—"}`);
}
if (!objetivo.length) {
  console.log("Nada que reprocesar.");
  process.exit(0);
}
if (!APLICAR) {
  console.log(`\nSimulación (APLICAR=0): se volverían a subir ${objetivo.length} archivo(s) por la ingesta real.`);
  process.exit(0);
}

for (const f of objetivo) {
  const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(f.id)}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ No se pudo descargar ${f.originalName} (${descarga.status}).`);
    continue;
  }
  const bytes = await descarga.arrayBuffer();
  const form = new FormData();
  form.set("file", new File([bytes], f.originalName, { type: f.mimeType || "application/octet-stream" }));
  form.set("autoPublish", "true");
  // Señal explícita para que un expediente ya publicado se vuelva a pasar por la
  // ingesta actual en vez de quedarse como estaba (misma fila, revisión nueva).
  form.set("reprocess", "true");
  // Se conserva la clasificación original para que entre por la misma área.
  if (f.area) form.set("area", f.area);
  if (f.declaredCutoff) form.set("declaredCutoff", f.declaredCutoff);
  if (f.sourceCurrency) form.set("sourceCurrency", f.sourceCurrency);
  form.set("description", `Reproceso con el pipeline actualizado (${new Date().toISOString().slice(0, 10)}).`);

  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`✖ ${f.originalName}: la subida devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`✔ ${f.originalName}: ${cuerpo.message ?? cuerpo.processingSummary ?? "reprocesado"}`);
}
