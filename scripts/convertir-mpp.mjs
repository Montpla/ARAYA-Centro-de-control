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
const { files = [] } = await filesResponse.json();
const objetivo = files.filter((f) =>
  !f.deletedAt &&
  String(f.extension).toLowerCase() === "mpp" &&
  f.originalName.toLowerCase().includes(FILTRO));

console.log(`=== ${objetivo.length} archivo(s) .mpp que contienen "${FILTRO}" ===`);
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
  const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(f.id)}`, { headers: { Cookie } });
  if (!descarga.ok) {
    console.error(`✖ ${f.originalName}: no se pudo descargar (${descarga.status}).`);
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
  console.log(`\n✔ ${f.originalName}: convertido · ${(xml.length / 1024).toFixed(0)} KB · ${tareas} tareas · ${esMspdi ? "MSPDI OK" : "⚠ no parece MSPDI"}`);

  if (!esMspdi) {
    console.error("   El XML convertido no es MSPDI reconocible; no se sube.");
    continue;
  }
  if (!APLICAR) {
    // Vista previa sin publicar: se pasa el XML por el mismo lector de Project
    // que usa el panel y se muestra el avance de cronograma, cuántos edificios
    // traen avance y la fecha de fin. Son indicadores de PROGRESO (porcentaje y
    // fecha), no cifras de dinero, así que su valor sí se imprime; sirve para
    // decidir si conviene publicar este plan antes de tocar el panel.
    try {
      const { extractProjectXmlUpdates } = await import("../lib/project-xml.ts");
      const previo = extractProjectXmlUpdates(xml);
      const crono = previo.updates.find((u) => u.key === "projectSnapshot.scheduleProgress");
      const fin = previo.updates.find((u) => u.key === "projectSnapshot.forecastFinish");
      const edificios = previo.updates.filter((u) => /^buildings\..+\.progress$/.test(u.key));
      console.log(`   Vista previa (sin publicar): avance de cronograma ${crono ? `${crono.value}%` : "(sin dato)"} · ${edificios.length} edificio(s) con avance · fin ${fin ? fin.value : "(sin dato)"}`);
    } catch (error) {
      console.log(`   (No se pudo previsualizar el avance: ${String(error?.message ?? error).slice(0, 160)})`);
    }
    console.log("   Simulación (APLICAR=0): no se sube; sólo se valida la conversión.");
    continue;
  }

  const form = new FormData();
  form.set("file", new File([xml], nombreXml(f.originalName), { type: "application/xml" }));
  form.set("autoPublish", "true");
  // El plan de obra manda sobre edificios y cronograma; se dirige a Obra para
  // que la publicación automática no se frene por «sin clasificar».
  form.set("area", "obra");
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
