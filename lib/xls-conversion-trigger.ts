import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getDb } from "../db";
import { fileActivity } from "../db/schema";

const REPO_OWNER = "Montpla";
const REPO_NAME = "ARAYA-Centro-de-control";
const WORKFLOW_FILE = "convertir-xls.yml";

/**
 * El lector de hojas de cálculo del Worker lee .xlsx celda a celda, pero un
 * .xls (el formato binario antiguo de Excel) no produce datos verificables:
 * la carga quedaba archivada pidiendo "guárdalo como .xlsx y vuelve a
 * subirlo" (el Excel maestro de julio de 2026). Un runner de GitHub sí puede
 * convertirlo: .github/workflows/convertir-xls.yml lo pasa a .xlsx con
 * LibreOffice y sube la copia como archivo derivado, que se lee por el camino
 * de siempre. Se pide al instante; el cron del workflow es la red de
 * seguridad.
 */
export function triggerXlsConversion(fileId: string) {
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
        mensaje = "Conversión a .xlsx solicitada a GitHub Actions; la copia moderna se leerá en unos minutos.";
      } else {
        const detalle = (await response.text().catch(() => "")).slice(0, 300);
        mensaje = `El disparo inmediato de la conversión a .xlsx falló (HTTP ${response.status}); el cron programado seguirá recogiéndolo. ${detalle}`;
      }
    } catch (error) {
      mensaje = `El disparo inmediato de la conversión a .xlsx no se pudo enviar (${error instanceof Error ? error.message : "error de red"}); el cron programado seguirá recogiéndolo.`;
    }
    await getDb().insert(fileActivity).values({
      fileId,
      eventType: "conversion_xls_disparada",
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
