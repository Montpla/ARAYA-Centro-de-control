import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getDb } from "../db";
import { fileActivity } from "../db/schema";

const REPO_OWNER = "Montpla";
const REPO_NAME = "ARAYA-Centro-de-control";
const WORKFLOW_FILE = "convertir-mpp.yml";

/**
 * Un .mpp no se puede leer dentro del Worker (MPXJ es Java), así que su
 * conversión corre en un runner de GitHub que sí tiene Java
 * (.github/workflows/convertir-mpp.yml). Ese workflow también corre cada 15
 * minutos por cron, pero GitHub retrasa los cron de baja frecuencia varias
 * horas cuando el repositorio no tiene actividad reciente -documentado por la
 * propia plataforma, no es un fallo de esta app-, así que quien subía el
 * corte del mes se quedaba esperando sin saber cuánto.
 *
 * Este disparo pide la conversión al instante, en el momento de la subida, en
 * vez de esperar al siguiente tick del cron. El cron sigue existiendo como
 * red de seguridad (por si este disparo falla o el token no está
 * configurado), así que la ausencia de GITHUB_ACTIONS_TOKEN no es un error:
 * simplemente se tarda lo que tarde el próximo cron, como antes.
 *
 * El resultado se deja en fileActivity -no solo en el log del Worker, que
 * nadie puede leer después del hecho- para que un fallo real (token
 * caducado, permisos insuficientes) se vea en el mismo sitio donde ya se
 * audita el resto del ciclo de vida del archivo, en vez de desaparecer en
 * silencio la primera vez que este disparo deje de funcionar.
 */
export function triggerMppConversion(fileId: string) {
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
          body: JSON.stringify({ ref: "main", inputs: { filtro: "", aplicar: "1" } }),
        },
      );
      if (response.ok) {
        mensaje = "Conversión inmediata solicitada a GitHub Actions; la cifra debería refrescarse en menos de un minuto.";
      } else {
        const detalle = (await response.text().catch(() => "")).slice(0, 300);
        mensaje = `El disparo inmediato de conversión falló (HTTP ${response.status}); el cron programado seguirá recogiéndolo. ${detalle}`;
      }
    } catch (error) {
      mensaje = `El disparo inmediato de conversión no se pudo enviar (${error instanceof Error ? error.message : "error de red"}); el cron programado seguirá recogiéndolo.`;
    }
    await getDb().insert(fileActivity).values({
      fileId,
      eventType: "conversion_mpp_disparada",
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
