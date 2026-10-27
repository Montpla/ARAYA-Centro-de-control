/**
 * `NODE_ENV` llega inlineado por vinext en el bundle de producción (ver
 * `vinext build`), así que esta condición queda resuelta en build time: en
 * producción el bypass de LOCAL_DEMO_MODE es código muerto, aunque alguien
 * active esa variable por error en el panel de Cloudflare.
 */
export function isLocalDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LOCAL_DEMO_MODE === "true";
}
