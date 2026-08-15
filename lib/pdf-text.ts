/**
 * Extractor de texto de PDF, sin dependencias.
 *
 * Un PDF no guarda tablas ni párrafos: guarda **instrucciones de dibujo**
 * («escribe este texto en esta coordenada»). Por eso no se puede reconstruir su
 * estructura con garantías, y por eso este módulo no lo intenta: recupera el
 * texto y nada más. Es una diferencia importante frente a los lectores de Excel
 * o de Project, que sí devuelven datos con su forma intacta.
 *
 * Aun así compensa: con el texto en la mano se pueden buscar los avances por
 * edificio —«TH-14 … 62,5%»— de forma determinista, sin pedirle a un modelo que
 * interprete. Lo que salga de aquí es lo que estaba escrito en el documento.
 *
 * Dos límites que conviene tener presentes:
 *
 * - **Un PDF escaneado es una fotografía.** No contiene texto, sino la imagen
 *   de un papel, así que aquí no se saca nada y sigue haciendo falta la lectura
 *   con IA. Se detecta y se dice, en vez de devolver vacío sin explicación.
 * - **Sólo se leen los flujos comprimidos con Flate**, que es lo que usa
 *   prácticamente todo generador moderno. Un PDF con codificaciones raras o
 *   cifrado devolverá poco o nada, y también se avisa.
 */

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Índices de todas las apariciones de una secuencia de bytes. */
function findAll(haystack: Uint8Array, needle: number[]) {
  const posiciones: number[] = [];
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    let coincide = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        coincide = false;
        break;
      }
    }
    if (coincide) posiciones.push(index);
  }
  return posiciones;
}

const BYTES_STREAM = [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "stream"
const BYTES_ENDSTREAM = [0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "endstream"

/**
 * Decodifica las cadenas de un flujo de contenido.
 *
 * En PDF el texto se dibuja con los operadores `Tj` (una cadena) y `TJ` (un
 * array de cadenas y ajustes de separación). Las cadenas van entre paréntesis,
 * con escapes propios, o en hexadecimal entre `<>`. Se recogen ambas formas.
 */
function textOfContentStream(contenido: string) {
  const partes: string[] = [];

  for (const match of contenido.matchAll(/\(((?:\\.|[^\\()])*)\)/g)) {
    const crudo = match[1]
      .replace(/\\([nrtbf])/g, (_, letra: string) =>
        ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[letra] ?? letra))
      .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
      .replace(/\\(.)/g, "$1");
    if (crudo.trim()) partes.push(crudo);
  }

  for (const match of contenido.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const hex = match[1].replace(/\s+/g, "");
    let texto = "";
    for (let index = 0; index + 1 < hex.length; index += 2) {
      const codigo = Number.parseInt(hex.slice(index, index + 2), 16);
      if (codigo >= 32) texto += String.fromCharCode(codigo);
    }
    if (texto.trim()) partes.push(texto);
  }

  return partes.join(" ").replace(/\s+/g, " ").trim();
}

export type PdfTextResult = {
  text: string;
  streams: number;
  scanned: boolean;
};

/**
 * Devuelve el texto de un PDF. `scanned` indica que no había texto que extraer,
 * que es lo que ocurre con los documentos escaneados.
 */
export async function readPdfText(bytes: ArrayBuffer, maxChars = 200_000): Promise<PdfTextResult> {
  const todo = new Uint8Array(bytes);
  const inicios = findAll(todo, BYTES_STREAM);
  const finales = findAll(todo, BYTES_ENDSTREAM);
  const trozos: string[] = [];
  let leidos = 0;

  for (const inicio of inicios) {
    // "endstream" contiene "stream" dentro, así que la búsqueda encuentra
    // también esas posiciones. Se descartan comprobando lo que hay justo antes.
    if (inicio >= 3) {
      const previos = String.fromCharCode(todo[inicio - 3], todo[inicio - 2], todo[inicio - 1]);
      if (previos === "end") continue;
    }
    const fin = finales.find((posicion) => posicion > inicio);
    if (fin === undefined) continue;

    // Tras "stream" viene un salto de línea antes de los datos.
    let desde = inicio + BYTES_STREAM.length;
    if (todo[desde] === 0x0d) desde += 1;
    if (todo[desde] === 0x0a) desde += 1;
    // Y antes de "endstream" hay otro salto que no forma parte de los datos:
    // incluirlo hace que la descompresión falle y el flujo se descarte entero.
    let hasta = fin;
    if (todo[hasta - 1] === 0x0a) hasta -= 1;
    if (todo[hasta - 1] === 0x0d) hasta -= 1;
    const crudo = todo.subarray(desde, hasta);
    if (!crudo.length) continue;

    let contenido = "";
    try {
      contenido = new TextDecoder("latin1").decode(await inflate(crudo));
    } catch {
      // Un flujo que no está comprimido con Flate —una imagen, una fuente
      // incrustada— se salta sin ruido: no es un error, simplemente no es
      // texto.
      continue;
    }

    const texto = textOfContentStream(contenido);
    if (texto) {
      trozos.push(texto);
      leidos += 1;
      if (trozos.join(" ").length > maxChars) break;
    }
  }

  const text = trozos.join("\n").slice(0, maxChars);
  return {
    text,
    streams: leidos,
    // Un PDF con flujos pero sin una sola cadena de texto es, casi siempre, un
    // escaneo: páginas que son imágenes.
    scanned: !text && inicios.length > 0,
  };
}

export type PdfProgressRow = { code: string; value: number };

/** Caracteres máximos entre el nombre del edificio y su porcentaje. */
const LIMITE_HUECO = 40;

/**
 * Busca avances por edificio dentro del texto de un PDF.
 *
 * El texto de un PDF llega sin estructura, así que se buscan parejas
 * inequívocas: un nombre de edificio y, cerca, un porcentaje. Se exige que el
 * número esté a menos de 40 caracteres del código para no emparejar cifras de
 * otra fila o de otra columna, que es el error clásico al leer una tabla que ya
 * no es una tabla.
 *
 * Deliberadamente conservador: ante la duda, no devuelve nada. Un avance
 * inventado en el edificio equivocado es peor que no tener el dato.
 */
export function findBuildingProgress(text: string, conocidos?: Set<string>): PdfProgressRow[] {
  const encontrados = new Map<string, number>();
  const patronCodigo = /\b(?:th|edificio|edif\.?|ed\.?)\s*[-–—]?\s*(\d{1,3})\b/gi;
  const patronPorcentaje = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/;

  // Primero se localizan todos los edificios y después se mira el hueco que
  // queda detrás de cada uno. Buscar código y porcentaje en una sola pasada
  // parecía equivalente, pero no lo es: si el hueco de un edificio se comía al
  // siguiente, descartar esa pareja descartaba también al segundo edificio, que
  // ya no volvía a examinarse. Así cada uno tiene su propio turno.
  const codigos = [...text.matchAll(patronCodigo)];

  for (let posicion = 0; posicion < codigos.length; posicion += 1) {
    const codigo = codigos[posicion];
    const numero = codigo[1].replace(/^0+(?=\d)/, "");
    const desde = codigo.index + codigo[0].length;
    // El hueco termina donde empieza el edificio siguiente: un porcentaje que
    // está más allá pertenece a ése, no a éste.
    const siguiente = codigos[posicion + 1]?.index ?? text.length;
    const hueco = text.slice(desde, Math.min(siguiente, desde + LIMITE_HUECO + 12));

    const encaje = patronPorcentaje.exec(hueco);
    // Se exige cercanía para no emparejar una cifra de otra fila o de otra
    // columna, que es el error clásico al leer una tabla que ya no es tabla.
    if (!encaje || encaje.index > LIMITE_HUECO) continue;

    const valor = Number(encaje[1].replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) continue;
    if (conocidos && !conocidos.has(numero)) continue;
    // Se queda el primero: en un informe, el avance del edificio suele venir en
    // la tabla principal y repetirse después en resúmenes o gráficos.
    if (!encontrados.has(numero)) encontrados.set(numero, valor);
  }

  return [...encontrados.entries()]
    .map(([numero, value]) => ({ code: `TH-${numero.padStart(2, "0")}`, value }))
    .sort((izquierda, derecha) => izquierda.code.localeCompare(derecha.code));
}
