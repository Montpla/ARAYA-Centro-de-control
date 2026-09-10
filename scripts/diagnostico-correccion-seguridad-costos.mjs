#!/usr/bin/env node
// Diagnóstico puntual, previo a dos correcciones:
// 1) safetyMetrics quedó con la semana del 10-15 de agosto en vez de la más
//    reciente (31 ago-5 sep). Vuelca lo que la IA propuso para el archivo de
//    esa semana, para publicar la cifra real en vez de adivinarla.
// 2) "Costo Ago-26.xlsx" trae ~25+ categorías de costo sin agrupar. Vuelca la
//    lista COMPLETA de categorías (solo las etiquetas, nunca los importes)
//    para diseñar el agrupador con el catálogo real, no con una muestra.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 16 * 1024 * 1024 });
  console.log(stdout);
}

console.log("=== Propuestas de la IA para la semana más reciente de seguridad (31 ago-5 sep) ===");
await query(`
  SELECT key, value_json, cutoff, status
  FROM document_data_proposals
  WHERE file_id = '68514691-2e29-4e98-97cc-78c055a67b15'
  ORDER BY created_at DESC;
`);

console.log("=== safetyWeeklySeries vigente ahora mismo (para no perder semanas ya guardadas) ===");
await query(`
  SELECT value_json FROM live_data_points WHERE key = 'safetyWeeklySeries';
`);

console.log("=== safetyMetrics vigente ahora mismo ===");
await query(`
  SELECT value_json, cutoff, revision FROM live_data_points WHERE key = 'safetyMetrics';
`);

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
const Cookie = `araya_session=${session}`;

const target = { id: "152808d6-daa3-404b-bcd7-69c298d66b31", downloadUrl: "/api/files?download=152808d6-daa3-404b-bcd7-69c298d66b31" };
const fileResponse = await fetch(`${PRODUCTION_URL}${target.downloadUrl}`, { headers: { Cookie } });
const bytes = await fileResponse.arrayBuffer();

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function readUint16(view, offset) { return view.getUint16(offset, true); }
function readUint32(view, offset) { return view.getUint32(offset, true); }
const view = new DataView(bytes);
const all = new Uint8Array(bytes);
let endOffset = -1;
for (let offset = all.length - 22; offset >= 0 && offset > all.length - 66000; offset -= 1) {
  if (readUint32(view, offset) === 0x06054b50) { endOffset = offset; break; }
}
const entryCount = readUint16(view, endOffset + 10);
let pointer = readUint32(view, endOffset + 16);
const entries = [];
for (let i = 0; i < entryCount; i += 1) {
  if (readUint32(view, pointer) !== 0x02014b50) break;
  const method = readUint16(view, pointer + 10);
  const compressedSize = readUint32(view, pointer + 20);
  const nameLength = readUint16(view, pointer + 28);
  const extraLength = readUint16(view, pointer + 30);
  const commentLength = readUint16(view, pointer + 32);
  const localOffset = readUint32(view, pointer + 42);
  const name = new TextDecoder().decode(all.subarray(pointer + 46, pointer + 46 + nameLength));
  pointer += 46 + nameLength + extraLength + commentLength;
  if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name) || name === "xl/sharedStrings.xml") {
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = all.subarray(start, start + compressedSize);
    const data = method === 0 ? raw : await inflateRaw(raw);
    entries.push({ name, text: new TextDecoder().decode(data) });
  }
}
const shared = [];
const sharedEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
if (sharedEntry) {
  for (const m of sharedEntry.text.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
  }
}
console.log(`\n=== Todas las categorías de Costo Ago-26.xlsx (columna A, solo etiquetas) ===`);
for (const entry of entries.filter((e) => /sheet\d+\.xml$/.test(e.name))) {
  const filas = new Map();
  for (const m of entry.text.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>|<c\s([^>]*)\/>/g)) {
    const attrs = m[1] ?? m[3] ?? "";
    const cuerpo = m[2] ?? "";
    const ref = attrs.match(/r="([A-Z]+)(\d+)"/);
    if (!ref || ref[1] !== "A") continue;
    const fila = Number(ref[2]);
    const tipo = attrs.match(/t="([^"]+)"/)?.[1] ?? "";
    let valor = "";
    if (tipo === "s") valor = shared[Number(cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "")] ?? "";
    else if (tipo === "inlineStr") valor = [...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
    if (valor) filas.set(fila, valor);
  }
  for (const [numero, valor] of [...filas.entries()].sort(([a], [b]) => a - b)) {
    console.log(numero, valor);
  }
}
