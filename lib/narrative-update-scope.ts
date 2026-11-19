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
