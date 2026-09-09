import { getRequestExecutionContext } from "vinext/shims/request-context";

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
 */
export function triggerMppConversion() {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return;
  const task = fetch(
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
  ).catch(() => undefined);
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  else void task;
}
