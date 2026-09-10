#!/usr/bin/env node
// Lee el texto del reporte semanal de seguridad más reciente (31 ago-5 sep,
// file_id 68514691), para corregir safetyMetrics con la cifra real: no quedó
// ningún registro de lo que la IA propuso para este archivo (document_data_proposals
// está vacío para él), así que hay que releer el original.
import { readFile } from "node:fs/promises";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST", body: new URLSearchParams({ email, pin }), redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error("Login falló"); process.exit(1); }
const Cookie = `araya_session=${session}`;

const res = await fetch(`${PRODUCTION_URL}/api/files?download=68514691-2e29-4e98-97cc-78c055a67b15`, { headers: { Cookie } });
if (!res.ok) { console.error(`Descarga falló (${res.status})`); process.exit(1); }
const bytes = await res.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

const { readPdfText } = await import("../lib/pdf-text.ts");
const resultado = await readPdfText(bytes);
console.log(`escaneado: ${resultado.scanned} · streams: ${resultado.streams}`);
console.log("=== Texto extraído del PDF ===");
console.log(resultado.text);
