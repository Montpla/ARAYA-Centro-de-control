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

const { readXlsxSheets } = await import("../lib/xlsx-reader.ts");
const hojas = await readXlsxSheets(bytes);
hojas.forEach((filas, indice) => {
  console.log(`\n--- Hoja #${indice + 1} (${filas.length} filas) ---`);
  for (let i = 0; i < Math.min(filas.length, 8); i++) {
    console.log(`Fila ${i}:`, JSON.stringify(filas[i]).slice(0, 600));
  }
  const textoHoja = JSON.stringify(filas.slice(0, 40)).toLowerCase();
  const pistas = ["monto", "costo", "presupuesto", "valorizacion", "valorización", "pagado", "facturado", "financ", "$", "usd", "precio", "venta"];
  const encontradas = pistas.filter((p) => textoHoja.includes(p));
  if (encontradas.length) console.log(`  Posibles columnas financieras: ${encontradas.join(", ")}`);
});
