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

// REEMPLAZAR retira primero el expediente ya publicado y vuelve a subir el
// original como una carga nueva. Es la vía para los informes que hay que
// re-ingerir de cero: la subida nueva entra por el camino de publicación de
// siempre (sin revisión previa que reconciliar), en vez de re-publicar encima
// del expediente anterior. Deja el archivo antiguo marcado como retirado
// (recuperable), y la nueva copia trae las cifras del pipeline actual.
const REEMPLAZAR = process.env.REEMPLAZAR === "1";

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
  const modo = REEMPLAZAR ? "se retirarían y re-ingerirían" : "se volverían a subir";
  console.log(`\nSimulación (APLICAR=0): ${modo} ${objetivo.length} archivo(s) por la ingesta real.`);
  process.exit(0);
}

for (const f of objetivo) {
  const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(f.id)}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ No se pudo descargar ${f.originalName} (${descarga.status}).`);
    continue;
  }
  const bytes = await descarga.arrayBuffer();

  // En modo reemplazo se retira primero el expediente ya publicado. Así la
  // deduplicación por hash no lo encuentra y la nueva carga entra como un alta
  // limpia, por el camino de publicación de siempre.
  if (REEMPLAZAR) {
    const retiro = await fetch(`${PRODUCTION_URL}/api/files/lifecycle`, {
      method: "POST",
      headers: { Cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: f.id,
        action: "delete",
        reason: `Sustituido por una re-ingesta con el pipeline actualizado (${new Date().toISOString().slice(0, 10)}).`,
      }),
    });
    if (!retiro.ok) {
      const detalle = await retiro.json().catch(() => ({}));
      console.error(`✖ ${f.originalName}: no se pudo retirar el expediente previo (${retiro.status} · ${detalle.error ?? ""}).`);
      continue;
    }
    console.log(`  · ${f.originalName}: expediente previo retirado; se re-ingiere como alta nueva.`);
  }

  const form = new FormData();
  form.set("file", new File([bytes], f.originalName, { type: f.mimeType || "application/octet-stream" }));
  form.set("autoPublish", "true");
  // Sin reemplazo se pide reproceso: un expediente ya publicado se vuelve a
  // pasar por la ingesta actual (misma fila, revisión nueva). Con reemplazo NO
  // se pide, porque el anterior ya está retirado y ésta es un alta limpia.
  if (!REEMPLAZAR) form.set("reprocess", "true");
  // Se conserva la clasificación original para que entre por la misma área.
  if (f.area) form.set("area", f.area);
  if (f.declaredCutoff) form.set("declaredCutoff", f.declaredCutoff);
  if (f.sourceCurrency) form.set("sourceCurrency", f.sourceCurrency);
  form.set("description", `${REEMPLAZAR ? "Re-ingesta" : "Reproceso"} con el pipeline actualizado (${new Date().toISOString().slice(0, 10)}).`);
  // Pide el detalle del error si la publicación no se confirma (solo el texto).
  if (process.env.DEBUG === "1") form.set("debug", "1");

  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`✖ ${f.originalName}: la subida devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`✔ ${f.originalName}: ${cuerpo.message ?? cuerpo.processingSummary ?? "reprocesado"}`);
  if (cuerpo.debug) console.log(`   ↳ detalle del error: ${cuerpo.debug}`);
}
