/**
 * Versión del pipeline documental.
 *
 * Se cambia únicamente cuando un lector, el contrato o la adaptación de datos
 * mejora de forma que un archivo histórico podría producir un resultado nuevo.
 * El reproceso programado compara esta marca con la que conserva cada
 * expediente y vuelve a leer sólo los que quedaron atrás.
 */
export const CURRENT_INGESTION_VERSION = "2026-08-20.3";
