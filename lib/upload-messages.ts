// Formatos binarios cuya lectura se completa fuera del Worker. El original se
// confirma primero y un workflow idempotente genera después un derivado legible.
const DEFERRED_CONVERSION_EXTENSIONS = new Set(["mpp", "dwg"]);

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
    return `${base}. La conversión automática a XML de Project queda programada y, normalmente, completa el cronograma, los edificios y la fecha prevista en un máximo de 15 minutos. El derivado quedará enlazado a este original.`;
  }
  if (DEFERRED_CONVERSION_EXTENSIONS.has(extension)) {
    return `${base}. La vista automática del .${extension} queda programada y se enlazará a este original cuando termine. En un DWG, la conversión genera una imagen navegable para móvil/tableta y lectura visual, normalmente en menos de una hora.`;
  }
  const detalle = warnings
    .map((warning) => warning.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return `${base}, pero no se ha extraído ningún dato que encaje en el modelo, así que las cifras y gráficas siguen como estaban.${detalle ? ` ${detalle}` : ""} Si el archivo traía avances, revisa el formato o usa una plantilla CSV.`;
}
