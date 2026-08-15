// Formatos que se archivan íntegros pero cuyo contenido no se lee, así que
// ninguna de sus cifras llega al panel.
const ARCHIVE_ONLY_EXTENSIONS = new Set(["mpp", "dwg", "zip"]);

/**
 * Explica por qué una subida no ha movido ninguna cifra.
 *
 * El mensaje anterior —"el original aparece de inmediato y queda pendiente de
 * interpretación; todavía no modifica cifras ni gráficas"— daba a entender que
 * el trabajo seguía en marcha y que las cifras llegarían solas más tarde. Pero
 * cuando el formato no se lee, o cuando las claves extraídas se descartan por
 * no encajar en el modelo, no va a ocurrir nada más: quien subía el corte del
 * mes se quedaba esperando un procesamiento que nunca existió, y el panel
 * seguía mostrando los mismos valores sin que nada señalara el problema.
 *
 * Este texto dice qué ha pasado y qué hacer, y arrastra los avisos concretos
 * que ya produjo la extracción en vez de dejarlos sólo en el registro interno.
 */
export function nothingExtractedMessage(
  areaLabel: string,
  extension: string,
  warnings: string[] = [],
) {
  const base = `Archivo registrado en ${areaLabel} y disponible para descarga`;
  if (extension === "mpp") {
    // El .mpp es el caso con salida propia: Project guarda en XML de forma
    // nativa y ese formato sí se lee entero, con el avance de cada tarea.
    return `${base}, pero los .mpp no se leen por dentro: ninguna de sus cifras ha actualizado el panel. Vuelve a guardarlo desde Microsoft Project como XML (Archivo → Guardar como → tipo «XML») y súbelo: de ese formato sí se lee el plan completo y se actualiza el avance de cada edificio.`;
  }
  if (ARCHIVE_ONLY_EXTENSIONS.has(extension)) {
    return `${base}, pero los .${extension} no se leen por dentro: ninguna de sus cifras ha actualizado el panel, y no lo hará más adelante. Para que las cifras entren, exporta el mismo corte a Excel o CSV y súbelo.`;
  }
  const detalle = warnings
    .map((warning) => warning.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return `${base}, pero no se ha extraído ningún dato que encaje en el modelo, así que las cifras y gráficas siguen como estaban.${detalle ? ` ${detalle}` : ""} Si el archivo traía avances, revisa el formato o usa una plantilla CSV.`;
}
