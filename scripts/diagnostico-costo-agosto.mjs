#!/usr/bin/env node
// Diagnóstico puntual: "Costo Ago-26.xlsx" se subió y el lector directo
// respondió "no se reconoció ninguna tabla de datos en la hoja" (confianza
// 0.48). Descarga el original por la API real (igual que reintentar-subida.mjs)
// y vuelca solo su ESTRUCTURA -nombres de hoja, número de filas, y el texto de
// las primeras celdas de cada fila- para ver por qué ninguno de los lectores
// conocidos reconoce su forma. Nunca imprime cifras: sólo texto de cabecera y
// etiquetas, igual que comprobar-cargas.mjs.
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const filesResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
const { files = [] } = await filesResponse.json();
const target = files.find((f) => f.originalName === "Costo Ago-26.xlsx");
if (!target) { console.error("No se encontró 'Costo Ago-26.xlsx' entre los archivos activos."); process.exit(1); }
console.log(`Encontrado: ${target.id} · subido ${target.createdAt} · área ${target.area}`);

const fileResponse = await fetch(`${PRODUCTION_URL}${target.downloadUrl}`, { headers: { Cookie } });
if (!fileResponse.ok) { console.error(`Descarga falló (${fileResponse.status})`); process.exit(1); }
const bytes = await fileResponse.arrayBuffer();
console.log(`Descargado: ${bytes.byteLength} bytes`);

// Se reimplementa la lectura mínima aquí (sin importar lib/xlsx-reader.ts) para
// no arrastrar dependencias de Workers en un script de Node.
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
if (endOffset < 0) { console.error("No tiene estructura de ZIP/.xlsx reconocible."); process.exit(1); }
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
  if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name) || name === "xl/sharedStrings.xml" || name === "xl/workbook.xml") {
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = all.subarray(start, start + compressedSize);
    const data = method === 0 ? raw : await inflateRaw(raw);
    entries.push({ name, text: new TextDecoder().decode(data) });
  }
}
console.log(`Entradas del libro: ${entries.map((e) => e.name).join(", ")}`);

const workbookEntry = entries.find((e) => e.name === "xl/workbook.xml");
if (workbookEntry) {
  const nombres = [...workbookEntry.text.matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((m) => m[1]);
  console.log(`Hojas declaradas: ${nombres.join(" | ")}`);
}

const shared = [];
const sharedEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
if (sharedEntry) {
  for (const m of sharedEntry.text.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const texto = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
    shared.push(texto);
  }
}
console.log(`Cadenas compartidas: ${shared.length}`);

for (const entry of entries.filter((e) => /sheet\d+\.xml$/.test(e.name))) {
  console.log(`\n=== ${entry.name} ===`);
  const filas = new Map();
  for (const m of entry.text.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>|<c\s([^>]*)\/>/g)) {
    const attrs = m[1] ?? m[3] ?? "";
    const cuerpo = m[2] ?? "";
    const ref = attrs.match(/r="([A-Z]+)(\d+)"/);
    if (!ref) continue;
    const columna = ref[1];
    const fila = Number(ref[2]);
    if (fila > 25) continue; // sólo las primeras 25 filas: aquí suele estar la cabecera
    const tipo = attrs.match(/t="([^"]+)"/)?.[1] ?? "";
    let valor = "";
    if (tipo === "s") {
      const idx = Number(cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      // Sólo se imprime si es texto (una cadena compartida): nunca un número.
      valor = shared[idx] ?? "";
    } else if (tipo === "inlineStr") {
      valor = [...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
    } else {
      valor = "(numérico u otro tipo no textual, omitido)";
    }
    const registro = filas.get(fila) ?? {};
    registro[columna] = valor;
    filas.set(fila, registro);
  }
  for (const [numero, registro] of [...filas.entries()].sort(([a], [b]) => a - b)) {
    const textoVisible = Object.fromEntries(
      Object.entries(registro).filter(([, v]) => v && v !== "(numérico u otro tipo no textual, omitido)"),
    );
    if (Object.keys(textoVisible).length) console.log(numero, JSON.stringify(textoVisible));
  }
}
