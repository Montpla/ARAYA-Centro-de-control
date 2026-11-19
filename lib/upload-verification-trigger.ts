import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getDb } from "../db";
import { fileActivity } from "../db/schema";

const REPO_OWNER = "Montpla";
const REPO_NAME = "ARAYA-Centro-de-control";
const WORKFLOW_FILE = "verificar-carga.yml";

/**
 * Pide a GitHub Actions que compruebe esta carga en cuanto termine de
 * procesarse (.github/workflows/verificar-carga.yml, que espera a que acabe y
 * llama a /api/files/verification). Así un archivo subido desde la obra queda
 * revisado en minutos sin que nadie tenga que estar mirando el panel. Sin
 * GITHUB_ACTIONS_TOKEN no hace nada.
 */
export function triggerUploadVerification(fileId: string) {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return;
  const task = (async () => {
    let mensaje = "";
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
          body: JSON.stringify({ ref: "main", inputs: { file_id: fileId } }),
        },
      );
      if (!response.ok) {
        const detalle = (await response.text().catch(() => "")).slice(0, 300);
        mensaje = `No se pudo pedir la verificación automática de la carga (HTTP ${response.status}). ${detalle}`;
      }
    } catch (error) {
      mensaje = `No se pudo pedir la verificación automática de la carga (${error instanceof Error ? error.message : "error de red"}).`;
    }
    // Sólo se deja rastro si falla: la verificación misma registra su veredicto.
    if (!mensaje) return;
    await getDb().insert(fileActivity).values({
      fileId,
      eventType: "verificacion_no_disparada",
      message: mensaje,
      actorEmail: "sistema@araya",
      actorName: "Disparo automático",
    }).catch(() => undefined);
  })();
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  return task;
}
