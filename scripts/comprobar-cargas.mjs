#!/usr/bin/env node
// Informe de las últimas cargas del Centro de Control.
//
// Existe porque la sesión de trabajo no siempre puede salir a producción (la
// política de red del entorno lo impide), mientras que un runner de GitHub sí,
// y además ya tiene las credenciales de verificación del despliegue. Así se
// puede responder a "¿entraron bien los archivos de esta tarde?" con datos de
// verdad en vez de con una suposición.
//
// Sólo imprime metadatos del procesamiento —nombre, área, resumen, si publicó y
// cuántos datos—, nunca las cifras extraídas: el registro de una ejecución de
// Actions no es sitio para el contenido financiero de la obra.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const HORAS = Number(process.env.HORAS ?? 24);

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN en el entorno.");
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

// includeDeleted=1 a propósito: un archivo subido y borrado después no aparece
// en el listado normal, y "lo subí y no está" es justo una de las cosas que hay
// que poder responder. El límite se sube al máximo para que la ventana no
// dependa de la paginación.
const filesResponse = await fetch(
  `${PRODUCTION_URL}/api/files?includeDeleted=1&limit=200`,
  { headers: { Cookie } },
);
if (!filesResponse.ok) {
  console.error(`✖ /api/files devolvió ${filesResponse.status}.`);
  process.exit(1);
}
const { files = [] } = await filesResponse.json();

const desde = Date.now() - HORAS * 3600 * 1000;
const recientes = files
  .filter((file) => Date.parse(file.createdAt) >= desde)
  .sort((izquierda, derecha) => Date.parse(izquierda.createdAt) - Date.parse(derecha.createdAt));

console.log(`=== Cargas de las últimas ${HORAS} h (${recientes.length} de ${files.length} archivos) ===`);
if (!recientes.length) {
  console.log("No hay cargas en ese periodo.");
}

// Referencia para distinguir "no se subió" de "se subió fuera de la ventana":
// sin esto, un archivo con la hora corrida parece no existir.
const ultimos = [...files]
  .sort((izquierda, derecha) => Date.parse(derecha.createdAt) - Date.parse(izquierda.createdAt))
  .slice(0, 6);
console.log("\nÚltimos 6 archivos del registro, sea cual sea su fecha:");
for (const file of ultimos) {
  const estado = file.deletedAt ? "ELIMINADO" : file.publicationRevision ? "publicado" : "sin publicar";
  console.log(`   ${file.createdAt} · ${file.originalName} · ${estado}`);
}

const problemas = [];
for (const file of recientes) {
  const publicado = Boolean(file.publicationRevision);
  const marca = file.deletedAt ? "BORRADO" : publicado ? "OK " : "REVISAR";
  console.log(`\n[${marca}] ${file.originalName}`);
  console.log(`   subido      : ${file.createdAt} por ${file.uploaderName}`);
  console.log(`   área        : ${file.areaLabel} · tipo ${file.documentType} · corte ${file.declaredCutoff || "sin declarar"}`);
  console.log(`   lectura     : ${file.extractionMode} (confianza ${file.extractionConfidence})`);
  console.log(`   procesado   : ${file.processingStage} ${file.processingProgress}%`);
  console.log(`   resumen     : ${file.processingSummary || "(sin resumen)"}`);
  console.log(`   extracción  : ${file.extractionSummary || "(sin resumen)"}`);
  console.log(`   publicado   : ${publicado ? `revisión ${file.publicationRevision} el ${file.publishedAt}` : "NO"}`);
  console.log(`   revisión    : ${file.reviewStatus}${file.requiresReview ? " · REQUIERE REVISIÓN" : ""}`);
  if (file.deletedAt) console.log(`   eliminado   : ${file.deletedAt} por ${file.deletedByName} · ${file.deleteReason || "sin motivo"}`);
  if (!file.deletedAt && (!publicado || file.requiresReview)) problemas.push(file.originalName);
}

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
if (liveResponse.ok) {
  const live = await liveResponse.json();
  console.log(`\n=== Estado de los datos vivos ===`);
  console.log(`revisión actual: ${live.revision}`);
  if (live.latestEvent) {
    const evento = live.latestEvent;
    console.log(`última publicación: ${evento.createdAt} · ${evento.changeCount} cambios · ${evento.sourceName} · ${evento.message}`);
  }
}

console.log(`\n=== Conclusión ===`);
if (!recientes.length) {
  console.log("Sin cargas recientes que comprobar.");
} else if (problemas.length) {
  console.log(`${problemas.length} archivo(s) no han actualizado el panel: ${problemas.join(", ")}`);
} else {
  console.log("Todas las cargas recientes publicaron sus datos.");
}
