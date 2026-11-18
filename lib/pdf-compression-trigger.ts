import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getDb } from "../db";
import { fileActivity } from "../db/schema";

const REPO_OWNER = "Montpla";
const REPO_NAME = "ARAYA-Centro-de-control";
const WORKFLOW_FILE = "comprimir-pdf.yml";

/**
 * Un PDF de muchos megas (un reporte semanal hecho de fotos escaneadas) no se
 * puede leer dentro del Worker: Cloudflare lo corta por memoria o CPU y la
 * carga devuelve un 503 vacío, una y otra vez (reportes de Seguridad de las
 * semanas 2 y 3 de octubre de 2026: 24,7 y 32 MB). Un runner de GitHub sí
 * puede: .github/workflows/comprimir-pdf.yml lo comprime con Ghostscript y
 * sube la versión ligera como archivo derivado, que se lee por el camino de
 * siempre.
 *
 * Igual que la conversión de .mpp, se pide al instante y el cron del workflow
 * queda como red de seguridad; sin GITHUB_ACTIONS_TOKEN no se dispara nada y
 * se espera al cron. El resultado queda en fileActivity.
 */
/** Por encima de este tamaño un PDF se comprime antes de leerse. */
export const LARGE_PDF_BYTES = 15 * 1024 * 1024;

export function triggerPdfCompression(fileId: string) {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return;
  const task = (async () => {
    let mensaje: string;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "araya-centro-de-control",
          },
          body: JSON.stringify({ ref: "main", inputs: { file_id: fileId, aplicar: "1" } }),
        },
      );
      if (response.ok) {
        mensaje = "Compresión inmediata solicitada a GitHub Actions; la versión ligera se leerá en unos minutos.";
      } else {
        const detalle = (await response.text().catch(() => "")).slice(0, 300);
        mensaje = `El disparo inmediato de compresión falló (HTTP ${response.status}); el cron programado seguirá recogiéndolo. ${detalle}`;
      }
    } catch (error) {
      mensaje = `El disparo inmediato de compresión no se pudo enviar (${error instanceof Error ? error.message : "error de red"}); el cron programado seguirá recogiéndolo.`;
    }
    await getDb().insert(fileActivity).values({
      fileId,
      eventType: "compresion_pdf_disparada",
      message: mensaje,
      actorEmail: "sistema@araya",
      actorName: "Disparo automático",
    }).catch(() => undefined);
  })();
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  // Devuelve la tarea sin que el llamador la espere: en producción se ignora
  // (el disparo es de fondo), y en pruebas permite comprobar que terminó.
  return task;
}
