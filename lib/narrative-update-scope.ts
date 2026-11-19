import type { LiveDataUpdate } from "./live-data";

/** El área del dato sigue su esquema aunque el informe agrupe varios ámbitos. */
export function prepareNarrativeUpdate(update: LiveDataUpdate): LiveDataUpdate {
  return {
    ...update,
    key: update.key === "projectSnapshot.declaredCutoff" ? "projectSnapshot.cutoff" : update.key,
    ...(/^safety(?:Metrics|Findings|FindingTracking|WeeklySeries)(?:\.|$)/.test(update.key) ? { area: "seguridad" } : {}),
  };
}

/** Un resumen ejecutivo mensual no sustituye la serie de reportes semanales. */
export function complementaryNarrativeUpdateAllowed(key: string, sourceName: string, deterministicKeys: string[]) {
  return !(/^safetyWeeklySeries(?:\.|$)/.test(key) && /informe[ _-]*ejecutivo.*\.pptx$/i.test(sourceName) && deterministicKeys.includes("safetyMetrics"));
}

/** Los totales mensuales se conservan aparte de la fotografía semanal vigente. */
export function executiveSafetySummary(updates: LiveDataUpdate[], sourceName: string) {
  if (!/informe[ _-]*ejecutivo.*\.pptx$/i.test(sourceName)) return null;
  const update = updates.find((item) => item.key === "safetyMetrics");
  return update && Array.isArray(update.value) ? { metrics: update.value, cutoff: update.cutoff ?? "" } : null;
}
