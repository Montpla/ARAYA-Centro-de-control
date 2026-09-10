#!/usr/bin/env node
// La oficina dice que el Excel de cubicación de edificios ("Avance_edificio.xlsx",
// el mismo de la Cubicación 9) también trae números de finanzas a nivel de
// edificio/apartamento, no sólo avance físico. Diagnóstico de solo lectura:
// lista los últimos archivos de esa área/tipo y, del más reciente, vuelca
// todas las hojas con sus cabeceras para ver qué columnas monetarias hay
// que aún no se están leyendo. Se retira tras el diagnóstico.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const { stdout: recientes } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, original_name, area, document_type, status, created_at
   FROM uploaded_files
   WHERE (area IN ('obra','planificacion') OR original_name LIKE '%vance%' OR original_name LIKE '%ubicaci%')
     AND deleted_at = ''
   ORDER BY created_at DESC
   LIMIT 15;`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log("=== Archivos recientes de obra/cubicación ===");
console.log(recientes);

const filas = JSON.parse(recientes);
const archivos = filas?.[0]?.results ?? [];
const objetivo = archivos.find((f) => /vance.*edificio/i.test(f.original_name)) ?? archivos[0];
if (!objetivo) {
  console.error("No se encontró ningún archivo candidato");
  process.exit(0);
}
console.log(`\n=== Analizando: ${objetivo.original_name} (${objetivo.id}) ===`);

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST", body: new URLSearchParams({ email, pin }), redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error("Login falló"); process.exit(1); }
const Cookie = `araya_session=${session}`;

const res = await fetch(`${PRODUCTION_URL}/api/files?download=${objetivo.id}`, { headers: { Cookie } });
if (!res.ok) { console.error(`Descarga falló (${res.status})`); process.exit(1); }
const bytes = await res.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

const { readXlsxWorkbook } = await import("../lib/xlsx-reader.ts");
const libro = await readXlsxWorkbook(bytes);
for (const hoja of libro.sheets) {
  console.log(`\n--- Hoja: "${hoja.name}" (${hoja.rows.length} filas) ---`);
  for (let i = 0; i < Math.min(hoja.rows.length, 6); i++) {
    const fila = hoja.rows[i];
    console.log(`Fila ${i}:`, JSON.stringify(fila.map((c) => c?.value ?? c)).slice(0, 500));
  }
  const textoHoja = JSON.stringify(hoja.rows.slice(0, 30)).toLowerCase();
  const pistas = ["monto", "costo", "presupuesto", "valorizacion", "valorización", "pagado", "facturado", "financ", "$", "usd", "precio", "venta"];
  const encontradas = pistas.filter((p) => textoHoja.includes(p));
  if (encontradas.length) console.log(`  Posibles columnas financieras: ${encontradas.join(", ")}`);
}
