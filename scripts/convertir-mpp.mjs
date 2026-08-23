#!/usr/bin/env node
// Lee los .mpp binarios convirtiéndolos a XML de Project (MSPDI) con MPXJ.
//
// El .mpp es un formato binario cerrado que no se puede abrir dentro del Worker
// (MPXJ es Java; no hay versión JS ni WASM viable). Pero un runner de GitHub sí
// tiene Java: aquí se descarga el .mpp de producción, se convierte a XML con
// MPXJ y —si se aplica— se vuelve a subir como .xml, que el lector de Project ya
// existente (isProjectXml / extractProjectXmlUpdates) lee entero: avance por
// edificio, avance de cronograma y fechas.
//
// Requiere en el entorno: MPXJ_CP (classpath de MPXJ) y Java en el PATH.
// Simula por defecto (sólo convierte y reporta); APLICAR=1 sube el XML.

import { writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";
const FILTRO = (process.env.FILTRO ?? "").toLowerCase();
const MPXJ_CP = process.env.MPXJ_CP ?? "";
const MAX_POR_EJECUCION = Math.max(1, Math.min(10, Number(process.env.MAX_POR_EJECUCION ?? 5) || 5));
const HTTP_MAX_INTENTOS = 4;
const HTTP_TIMEOUT_MS = 20_000;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const estadoTransitorio = (status) => status === 408 || status === 425 || status === 429 || status >= 500;

function errorHttp(etiqueta, status, detalle = "") {
  const sufijo = detalle.trim() ? ` · ${detalle.trim().slice(0, 240)}` : "";
  const error = new Error(`${etiqueta}: HTTP ${status}${sufijo}`);
  error.retryable = estadoTransitorio(status);
  return error;
}

async function conReintentos(etiqueta, operacion) {
  let ultimoError;
  let intentosRealizados = 0;
  for (let intento = 1; intento <= HTTP_MAX_INTENTOS; intento += 1) {
    intentosRealizados = intento;
    try {
      return await operacion();
    } catch (error) {
      ultimoError = error;
      if (error?.retryable === false || intento === HTTP_MAX_INTENTOS) break;
      const demora = 750 * (2 ** (intento - 1));
      console.warn(`⚠ ${etiqueta}: ${error?.message ?? error}. Reintento ${intento + 1}/${HTTP_MAX_INTENTOS} en ${demora} ms.`);
      await esperar(demora);
    }
  }
  throw new Error(`${etiqueta}: fallo tras ${intentosRealizados} intento(s). ${ultimoError?.message ?? ultimoError}`, { cause: ultimoError });
}

async function solicitar(etiqueta, url, init = {}, aceptar = (response) => response.ok) {
  return conReintentos(etiqueta, async () => {
    const opciones = typeof init === "function" ? init() : init;
    const response = await fetch(url, {
      ...opciones,
      signal: opciones.signal ?? AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (aceptar(response)) return response;
    const detalle = await response.text().catch(() => "");
    throw errorHttp(etiqueta, response.status, detalle);
  });
}

async function solicitarJson(etiqueta, url, init = {}) {
  return conReintentos(etiqueta, async () => {
    const opciones = typeof init === "function" ? init() : init;
    const response = await fetch(url, {
      ...opciones,
      signal: opciones.signal ?? AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const texto = await response.text();
    if (!response.ok) throw errorHttp(etiqueta, response.status, texto);
    if (!texto.trim()) throw new Error(`${etiqueta}: el servidor devolvió una respuesta vacía`);
    try {
      return JSON.parse(texto);
    } catch (cause) {
      throw new Error(`${etiqueta}: el servidor devolvió JSON incompleto o inválido`, { cause });
    }
  });
}

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}
if (!MPXJ_CP) {
  console.error("✖ Falta MPXJ_CP (classpath de MPXJ). Lo prepara el workflow.");
  process.exit(1);
}

const login = await solicitar("Inicio de sesión", `${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
}, (response) => response.status >= 200 && response.status < 400);
const cookieMatch = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!cookieMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${cookieMatch[1]}`;

const { files = [] } = await solicitarJson(
  "Consulta de archivos",
  `${PRODUCTION_URL}/api/files?limit=200`,
  { headers: { Cookie } },
);
const activos = files.filter((f) => !f.deletedAt);
const candidatos = activos.filter((f) =>
  !f.deletedAt &&
  String(f.extension).toLowerCase() === "mpp" &&
  f.originalName.toLowerCase().includes(FILTRO));

// Un reintento o un cron no puede crear otra conversión del mismo original.
// La relación durable es la primera opción; el nombre/fecha conserva
// idempotencia para los XML creados antes de que existiera esa columna.
const objetivo = candidatos.filter((mpp) => !activos.some((file) => {
  const relacionExplicita = file.derivedFromFileId === mpp.id && file.automationKind === "mpp_to_xml";
  const conversionLegada = file.originalName === nombreXml(mpp.originalName) &&
    Date.parse(file.createdAt) >= Date.parse(mpp.createdAt);
  return relacionExplicita || conversionLegada;
})).slice(0, MAX_POR_EJECUCION);

console.log(`=== ${objetivo.length} MPP pendiente(s) de ${candidatos.length} candidato(s) ===`);
for (const f of objetivo) {
  console.log(`  · ${f.originalName} · área ${f.areaLabel} · subido ${f.createdAt}`);
}
if (!objetivo.length) {
  console.log("Nada que convertir.");
  process.exit(0);
}

// El nombre del .xml sale del .mpp cambiando la extensión; se conserva el resto
// para que la trazabilidad quede clara.
function nombreXml(original) {
  return original.replace(/\.mpp$/i, "") + " (convertido de MPP).xml";
}

for (const f of objetivo) {
  let descarga;
  try {
    descarga = await solicitar(
      `Descarga de ${f.originalName}`,
      `${PRODUCTION_URL}/api/files?download=${encodeURIComponent(f.id)}`,
      { headers: { Cookie } },
    );
  } catch (error) {
    console.error(`✖ ${f.originalName}: no se pudo descargar. ${error.message}`);
    continue;
  }
  const bytes = Buffer.from(await descarga.arrayBuffer());
  const rutaMpp = `/tmp/${f.id}.mpp`;
  const rutaXml = `/tmp/${f.id}.xml`;
  await writeFile(rutaMpp, bytes);

  // MpxjConvert lee el .mpp (UniversalProjectReader) y escribe MSPDI por la
  // extensión .xml del destino. MPXJ migró el paquete de `net.sf.mpxj` a
  // `org.mpxj` en la v13 y la clase de ejemplo ha vivido tanto en la raíz como
  // en el subpaquete `.sample`; se prueban los nombres conocidos en orden y se
  // usa el primero que exista, para no depender de la versión exacta resuelta.
  const candidatasMpxj = [
    "org.mpxj.MpxjConvert",
    "org.mpxj.sample.MpxjConvert",
    "net.sf.mpxj.MpxjConvert",
    "net.sf.mpxj.sample.MpxjConvert",
  ];
  let convertido = false;
  let ultimoDetalle = "";
  for (const clase of candidatasMpxj) {
    try {
      await run("java", ["-cp", MPXJ_CP, clase, rutaMpp, rutaXml], { maxBuffer: 64 * 1024 * 1024 });
      convertido = true;
      console.log(`   (clase MPXJ: ${clase})`);
      break;
    } catch (error) {
      const detalle = (error.stderr || error.message || "").toString();
      // Si la clase no existe, se prueba la siguiente; cualquier otro error (un
      // .mpp corrupto, por ejemplo) se reporta tal cual sin seguir probando.
      const claseNoExiste = /ClassNotFoundException|Could not find or load main class/i.test(detalle);
      ultimoDetalle = detalle.slice(0, 800);
      if (!claseNoExiste) break;
    }
  }
  if (!convertido) {
    console.error(`✖ ${f.originalName}: MPXJ no pudo convertir el .mpp.\n   ${ultimoDetalle}`);
    continue;
  }

  let xml;
  try {
    xml = await readFile(rutaXml, "utf8");
  } catch {
    console.error(`✖ ${f.originalName}: la conversión no dejó XML.`);
    continue;
  }
  const esMspdi = /<Project[\s>][\s\S]{0,400}schemas\.microsoft\.com\/project/i.test(xml) ||
    /xmlns\s*=\s*["']http:\/\/schemas\.microsoft\.com\/project["']/i.test(xml);
  const tareas = (xml.match(/<Task>/g) || []).length;
  const fechasFin = (xml.match(/<Finish>/g) || []).length;
  console.log(`\n✔ ${f.originalName}: convertido · ${(xml.length / 1024).toFixed(0)} KB · ${tareas} tareas · ${fechasFin} fechas de fin · ${esMspdi ? "MSPDI OK" : "⚠ no parece MSPDI"}`);

  if (!esMspdi) {
    console.error("   El XML convertido no es MSPDI reconocible; no se sube.");
    continue;
  }
  if (!fechasFin) {
    console.error("   El XML no contiene fechas Finish; se conserva el MPP y no se publica una previsión incompleta.");
    continue;
  }
  if (!APLICAR) {
    console.log("   Simulación (APLICAR=0): no se sube; sólo se valida la conversión.");
    continue;
  }

  const form = new FormData();
  form.set("file", new File([xml], nombreXml(f.originalName), { type: "application/xml" }));
  form.set("autoPublish", "true");
  // El plan de obra manda sobre edificios y cronograma; se dirige a Obra para
  // que la publicación automática no se frene por «sin clasificar».
  form.set("area", "obra");
  form.set("derivedFromFileId", f.id);
  form.set("automationKind", "mpp_to_xml");
  if (f.declaredCutoff) form.set("declaredCutoff", f.declaredCutoff);
  form.set("description", `Convertido de ${f.originalName} con MPXJ (${new Date().toISOString().slice(0, 10)}).`);

  const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
  const cuerpo = await subida.json().catch(() => ({}));
  if (!subida.ok) {
    console.error(`   ✖ La subida del XML devolvió ${subida.status} · ${cuerpo.error ?? ""}`);
    continue;
  }
  console.log(`   ✔ XML subido: ${cuerpo.message ?? cuerpo.processingSummary ?? "ingerido"}`);
}
