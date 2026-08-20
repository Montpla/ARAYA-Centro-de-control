export const progressBandDefinitions = [
  { id: "progress-0", label: "0%", detail: "No iniciado", min: 0, max: 0 },
  { id: "progress-1-20", label: "1–20%", detail: "Inicio", min: 0.01, max: 20 },
  { id: "progress-21-40", label: "21–40%", detail: "Avance bajo", min: 20.01, max: 40 },
  { id: "progress-41-60", label: "41–60%", detail: "Avance medio", min: 40.01, max: 60 },
  { id: "progress-61-80", label: "61–80%", detail: "Avance alto", min: 60.01, max: 80 },
  { id: "progress-81-99", label: "81–99%", detail: "Próximo a finalizar", min: 80.01, max: 99.99 },
  { id: "progress-100", label: "100%", detail: "Terminado", min: 100, max: 100 },
] as const;

export type ProgressBandId = (typeof progressBandDefinitions)[number]["id"];

/**
 * Escala única para edificios y apartamentos.
 *
 * El valor se acota antes de clasificarlo para que una fuente defectuosa no
 * cree colores nuevos ni rompa la leyenda. Los valores ausentes usan una clase
 * propia: no deben confundirse con un 0% medido.
 */
export function progressBandClass(progress: number | null | undefined): ProgressBandId | "progress-none" {
  if (progress === null || progress === undefined || !Number.isFinite(progress)) return "progress-none";
  const value = Math.max(0, Math.min(100, progress));
  if (value <= 0) return "progress-0";
  if (value <= 20) return "progress-1-20";
  if (value <= 40) return "progress-21-40";
  if (value <= 60) return "progress-41-60";
  if (value <= 80) return "progress-61-80";
  if (value < 100) return "progress-81-99";
  return "progress-100";
}
