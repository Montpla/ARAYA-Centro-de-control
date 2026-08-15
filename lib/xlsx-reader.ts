/**
 * Lector de hojas de cálculo .xlsx sin dependencias.
 *
 * Un .xlsx es un ZIP que contiene XML, y el runtime trae `DecompressionStream`
 * con `deflate-raw`, que es exactamente el algoritmo del ZIP. Eso permite abrir
 * el archivo dentro del Worker sin arrastrar una librería de hojas de cálculo,
 * que son grandes y arrastran a su vez sus propias dependencias.
 *
 * Existe porque la oficina trabaja en Excel. Hasta ahora un .xlsx sólo se podía
 * leer pasándolo por la extracción con IA, que interpreta: acierta muchas veces,
 * pero puede confundir un campo o no saber a qué edificio se refiere una cifra.
 * Leyendo las celdas directamente, lo que está escrito es lo que se publica —la
 * misma garantía que da un CSV, pero sin pedirle a nadie que convierta nada.
 */

type ZipEntry = { name: string; data: Uint8Array };

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Extrae del ZIP sólo las entradas que interesan.
 *
 * Se recorre el directorio central en vez de las cabeceras locales porque es
 * donde el formato garantiza los tamaños: en las locales pueden venir a cero
 * cuando el archivo se escribió en streaming, que es justo como los genera
 * Excel al guardar desde algunas versiones.
 */
export async function readZipEntries(bytes: ArrayBuffer, wanted: (name: string) => boolean) {
  const view = new DataView(bytes);
  const all = new Uint8Array(bytes);
  // El fin del directorio central está al final, tras un comentario de longitud
  // variable, así que se busca su firma hacia atrás.
  let endOffset = -1;
  for (let offset = all.length - 22; offset >= 0 && offset > all.length - 66_000; offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("El archivo no tiene la estructura de un .xlsx.");

  const entryCount = readUint16(view, endOffset + 10);
  let pointer = readUint32(view, endOffset + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, pointer) !== 0x02014b50) break;
    const method = readUint16(view, pointer + 10);
    const compressedSize = readUint32(view, pointer + 20);
    const nameLength = readUint16(view, pointer + 28);
    const extraLength = readUint16(view, pointer + 30);
    const commentLength = readUint16(view, pointer + 32);
    const localOffset = readUint32(view, pointer + 42);
    const name = new TextDecoder().decode(all.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name)) continue;

    // La cabecera local repite el nombre y los extras, con longitudes propias.
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = all.subarray(start, start + compressedSize);
    entries.push({
      name,
      data: method === 0 ? raw : await inflateRaw(raw),
    });
  }
  return entries;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[entity] ?? match;
  });
}

/** El texto de una celda puede venir troceado en varios <t> por el formato. */
function textOfSharedString(block: string) {
  const partes = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
  return partes.join("");
}

function columnOf(reference: string) {
  return reference.replace(/\d+/g, "");
}

function rowOf(reference: string) {
  const match = reference.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export type SheetRow = Record<string, string>;

/**
 * Devuelve las filas de la primera hoja como columna → texto.
 *
 * No se interpreta nada aquí: los valores se entregan tal y como están en la
 * celda, y quien llama decide qué significan. Las fórmulas se leen por su
 * resultado calculado, que es lo que Excel guarda junto a ellas.
 */
export async function readXlsxRows(bytes: ArrayBuffer, maxRows = 5_000) {
  const entries = await readZipEntries(bytes, (name) =>
    name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet1\.xml$/.test(name));

  const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const sheetEntry = entries.find((entry) => entry.name.startsWith("xl/worksheets/"));
  if (!sheetEntry) throw new Error("El .xlsx no contiene ninguna hoja legible.");

  const shared: string[] = [];
  if (sharedEntry) {
    const sharedXml = new TextDecoder().decode(sharedEntry.data);
    for (const match of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(textOfSharedString(match[1]));
    }
  }

  const sheetXml = new TextDecoder().decode(sheetEntry.data);
  const filas = new Map<number, SheetRow>();
  for (const match of sheetXml.matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>|<c\s([^>]*)\/>/g)) {
    const attrs = match[1] ?? match[3] ?? "";
    const cuerpo = match[2] ?? "";
    const refMatch = attrs.match(/r="([A-Z]+\d+)"/);
    if (!refMatch) continue;
    const referencia = refMatch[1];
    const numeroFila = rowOf(referencia);
    if (numeroFila > maxRows) continue;
    const tipo = attrs.match(/t="([^"]+)"/)?.[1] ?? "";

    let valor = "";
    if (tipo === "inlineStr") {
      valor = textOfSharedString(cuerpo);
    } else {
      const bruto = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      valor = tipo === "s" ? (shared[Number(bruto)] ?? "") : decodeXml(bruto);
    }
    if (!valor.trim()) continue;
    const fila = filas.get(numeroFila) ?? {};
    fila[columnOf(referencia)] = valor.trim();
    filas.set(numeroFila, fila);
  }

  return [...filas.entries()]
    .sort(([izquierda], [derecha]) => izquierda - derecha)
    .map(([, fila]) => fila);
}

/**
 * Convierte las filas en registros con las cabeceras como nombre de campo.
 *
 * La fila de cabecera no siempre es la primera: los informes de obra suelen
 * llevar encima un título o el membrete de la empresa, así que se busca la
 * primera fila que contenga alguna de las cabeceras esperadas.
 */
export function rowsToRecords(filas: SheetRow[], expected: string[]) {
  const normalizar = (valor: string) => valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const buscadas = expected.map(normalizar);

  let indiceCabecera = -1;
  for (let index = 0; index < Math.min(filas.length, 30); index += 1) {
    const valores = Object.values(filas[index]).map(normalizar);
    if (buscadas.some((cabecera) => valores.includes(cabecera))) {
      indiceCabecera = index;
      break;
    }
  }
  if (indiceCabecera < 0) return { headerRow: -1, records: [] as Record<string, string>[] };

  const cabecera = filas[indiceCabecera];
  const registros = filas.slice(indiceCabecera + 1).map((fila) => {
    const registro: Record<string, string> = {};
    // Toda columna de la cabecera aparece en el registro, aunque su celda esté
    // vacía. Excel no emite las celdas en blanco, y sin esto una plantilla con
    // filas a medio rellenar se comportaría distinto que la misma plantilla en
    // CSV —donde la celda vacía sí llega—: allí significa "este dato no lo
    // toco" y aquí habría acabado avisando de que falta el valor.
    for (const [columna, nombre] of Object.entries(cabecera)) {
      registro[normalizar(nombre)] = fila[columna] ?? "";
    }
    return registro;
  }).filter((registro) => Object.values(registro).some((valor) => valor !== ""));

  return { headerRow: indiceCabecera, records: registros };
}
