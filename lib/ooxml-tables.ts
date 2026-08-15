import { decodeXml, readZipEntries } from "./xlsx-reader";

/**
 * Lector de tablas de documentos de Word (.docx) y PowerPoint (.pptx).
 *
 * Los tres formatos modernos de Office comparten envoltorio: un ZIP con XML
 * dentro. Una vez resuelto el ZIP para las hojas de cálculo, leer también las
 * tablas de un informe en Word o de una presentación de obra sale casi gratis,
 * y evita que esos documentos dependan de la interpretación por IA cuando lo
 * que traen es una tabla perfectamente estructurada.
 *
 * Ojo con lo que esto NO hace: sólo lee **tablas**. El texto corrido de un
 * informe sigue necesitando interpretación, porque una frase como "el edificio
 * 14 va por el 60%" no es un dato estructurado por mucho que se lea bien. Aquí
 * se extrae lo que ya viene en forma de filas y columnas, que es donde la
 * lectura directa aporta una garantía que la IA no puede dar.
 */

/** Quita las etiquetas y deja el texto de una celda, con sus entidades resueltas. */
function textoPlano(xml: string) {
  return decodeXml(xml.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tablas de un .docx.
 *
 * En WordprocessingML una tabla es `<w:tbl>`, cada fila `<w:tr>` y cada celda
 * `<w:tc>`. El texto de una celda puede venir repartido en varios `<w:t>`
 * cuando Word trocea el párrafo por cambios de formato o por corrección
 * ortográfica, así que se recoge el contenido entero de la celda y se limpia.
 */
export function extractDocxTables(documentXml: string) {
  const tablas: string[][][] = [];
  for (const tabla of documentXml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)) {
    const filas: string[][] = [];
    for (const fila of tabla[1].matchAll(/<w:tr[\s>]([\s\S]*?)<\/w:tr>/g)) {
      const celdas: string[] = [];
      for (const celda of fila[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)) {
        celdas.push(textoPlano(celda[1]));
      }
      if (celdas.some((valor) => valor)) filas.push(celdas);
    }
    if (filas.length > 1) tablas.push(filas);
  }
  return tablas;
}

/**
 * Tablas de un .pptx.
 *
 * En DrawingML —el lenguaje de las formas de PowerPoint— la tabla es `<a:tbl>`,
 * con `<a:tr>` y `<a:tc>`. Es el mismo esquema que en Word con otro prefijo,
 * pero conviene tratarlos por separado: comparten forma hoy y podrían no
 * hacerlo mañana, y confundirlos daría lecturas silenciosamente vacías.
 */
export function extractPptxTables(slideXml: string) {
  const tablas: string[][][] = [];
  for (const tabla of slideXml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)) {
    const filas: string[][] = [];
    for (const fila of tabla[1].matchAll(/<a:tr[\s>]([\s\S]*?)<\/a:tr>/g)) {
      const celdas: string[] = [];
      for (const celda of fila[1].matchAll(/<a:tc[\s>]([\s\S]*?)<\/a:tc>/g)) {
        celdas.push(textoPlano(celda[1]));
      }
      if (celdas.some((valor) => valor)) filas.push(celdas);
    }
    if (filas.length > 1) tablas.push(filas);
  }
  return tablas;
}

/**
 * Devuelve las tablas de un .docx o .pptx en el mismo formato de filas que
 * usan las hojas de cálculo (columna → texto), para que la lógica que ya
 * interpreta una tabla de avance sirva igual venga de donde venga.
 */
export async function readOfficeTables(bytes: ArrayBuffer, extension: string) {
  const esWord = extension === "docx";
  const entradas = await readZipEntries(bytes, (name) => esWord
    ? name === "word/document.xml"
    : /^ppt\/slides\/slide\d+\.xml$/.test(name));
  if (!entradas.length) return [];

  // Las diapositivas se ordenan por su número y no alfabéticamente: con diez o
  // más, "slide10" iría antes que "slide2" y las tablas saldrían desordenadas.
  const ordenadas = [...entradas].sort((izquierda, derecha) => {
    const numero = (nombre: string) => Number(nombre.match(/(\d+)\.xml$/)?.[1] ?? 0);
    return numero(izquierda.name) - numero(derecha.name);
  });

  const tablas: string[][][] = [];
  for (const entrada of ordenadas) {
    const xml = new TextDecoder().decode(entrada.data);
    tablas.push(...(esWord ? extractDocxTables(xml) : extractPptxTables(xml)));
  }

  return tablas.map((tabla) => tabla.map((fila) => {
    const registro: Record<string, string> = {};
    fila.forEach((valor, indice) => {
      // Se nombran las columnas como en una hoja (A, B, C…) para que las filas
      // encajen con rowsToRecords sin que ésta sepa de dónde vienen.
      registro[String.fromCharCode(65 + indice)] = valor;
    });
    return registro;
  }));
}
