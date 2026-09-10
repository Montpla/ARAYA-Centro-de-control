import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getDb } from "../db";
import { fileActivity } from "../db/schema";

const REPO_OWNER = "Montpla";
const REPO_NAME = "ARAYA-Centro-de-control";
const WORKFLOW_FILE = "reintentar-subida-diferida.yml";

/**
 * Una subida desde el panel se archiva al instante y su extracción se difiere
 * a segundo plano (deferProcessingRequested en app/api/files/route.ts), para
 * no dejar al navegador esperando al agente de contraste. Ese trabajo de
 * fondo corre dentro de la misma petición HTTP vía waitUntil, que Cloudflare
 * no garantiza que termine si el Worker se recicla antes -sin ningún error
 * visible: el expediente se queda en "recibido" hasta que algo lo reclame de
 * nuevo. El 09/09/2026 tres archivos quedaron así toda la noche y sólo se
 * publicaron porque alguien volvió a arrastrarlos por accidente.
 *
 * Este disparo pide el reintento a un runner de GitHub -fuera del Worker, no
 * sujeto a su ciclo de vida- justo al diferir la subida, en vez de depender
 * sólo de que waitUntil sobreviva. Ese mismo workflow también corre cada 5
 * minutos por cron como red de seguridad (ver reintentar-subida-diferida.yml)
 * para atrapar cualquier expediente que ambos caminos hayan dejado atrás. La
 * reanudación en sí es idempotente (el lease de EXTRACTION_LEASE_MS en
 * app/api/files/route.ts), así que da igual si el reintento de fondo del
 * propio Worker también llega a completarse: no se duplica nada.
 */
export function triggerDeferredUploadRetry(fileId: string) {
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
          body: JSON.stringify({ ref: "main", inputs: { fileId } }),
        },
      );
      if (response.ok) {
        mensaje = "Reintento inmediato solicitado a GitHub Actions; el expediente debería quedar sincronizado en menos de un minuto.";
      } else {
        const detalle = (await response.text().catch(() => "")).slice(0, 300);
        mensaje = `El disparo inmediato de reintento falló (HTTP ${response.status}); el barrido programado cada 5 minutos seguirá recogiéndolo. ${detalle}`;
      }
    } catch (error) {
      mensaje = `El disparo inmediato de reintento no se pudo enviar (${error instanceof Error ? error.message : "error de red"}); el barrido programado seguirá recogiéndolo.`;
    }
    await getDb().insert(fileActivity).values({
      fileId,
      eventType: "reintento_subida_diferida_disparado",
      message: mensaje,
      actorEmail: "sistema@araya",
      actorName: "Disparo automático",
    }).catch(() => undefined);
  })();
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  return task;
}
