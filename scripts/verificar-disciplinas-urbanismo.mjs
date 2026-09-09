#!/usr/bin/env node
// Verificación puntual (se retira tras confirmarla): descarga de producción
// el .mpp real de Fase I, lo convierte de nuevo con MPXJ y sube el XML
// exactamente como lo haría convertir-mpp.mjs (area=obra, autoPublish=true,
// derivedFromFileId, automationKind=mpp_to_xml), sin depender de su dedupe
// -que ya considera este .mpp convertido de una ejecución anterior-, para
// confirmar que la extracción automática de disciplinas de urbanismo (PR
// #152) funciona sin intervención manual.
import { writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const mppFileId = process.env.MPP_FILE_ID;
const MPXJ_CP = process.env.MPXJ_CP ?? "";

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(mppFileId)}`, { headers: { Cookie } });
if (!descarga.ok) { console.error(`Descarga falló (${descarga.status})`); process.exit(1); }
const bytes = Buffer.from(await descarga.arrayBuffer());
const rutaMpp = "/tmp/verificacion.mpp";
const rutaXml = "/tmp/verificacion.xml";
await writeFile(rutaMpp, bytes);
console.log(`Descargado: ${bytes.length} bytes`);

const candidatasMpxj = ["org.mpxj.MpxjConvert", "org.mpxj.sample.MpxjConvert", "net.sf.mpxj.MpxjConvert", "net.sf.mpxj.sample.MpxjConvert"];
let convertido = false;
for (const clase of candidatasMpxj) {
  try {
    await run("java", ["-cp", MPXJ_CP, clase, rutaMpp, rutaXml], { maxBuffer: 64 * 1024 * 1024 });
    convertido = true;
    console.log(`Convertido con ${clase}`);
    break;
  } catch (error) {
    const detalle = (error.stderr || error.message || "").toString();
    if (!/ClassNotFoundException|Could not find or load main class/i.test(detalle)) {
      console.error(detalle.slice(0, 800));
      break;
    }
  }
}
if (!convertido) { console.error("MPXJ no pudo convertir el .mpp."); process.exit(1); }

const xml = await readFile(rutaXml, "utf8");
console.log(`XML: ${(xml.length / 1024).toFixed(0)} KB`);

const form = new FormData();
form.set("file", new File([xml], "Urbanismo fase I MOD ACTUALIZADO AJUSTADO FLUJO ENERO MODIFICADO CORTE 30-08-2026 (convertido de MPP, verificación).xml", { type: "application/xml" }));
form.set("autoPublish", "true");
form.set("area", "obra");
form.set("derivedFromFileId", mppFileId);
form.set("automationKind", "mpp_to_xml");
form.set("description", "Verificación puntual del importador automático de disciplinas de urbanismo (PR #152).");

const subida = await fetch(`${PRODUCTION_URL}/api/files`, { method: "POST", headers: { Cookie }, body: form });
const cuerpo = await subida.json().catch(() => ({}));
console.log(subida.status, JSON.stringify(cuerpo, null, 2));
if (!subida.ok) process.exit(1);
