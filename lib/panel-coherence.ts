// ¿Queda el panel coherente después de una carga? La verificación de cada
// archivo (lib/upload-verification.ts) mira si el archivo entró bien; esto mira
// si los números que pinta el Centro de Control cuadran entre sí: que el
// avance del resumen sea el último punto de la Curva S, que la curva llegue al
// mes del corte, que el plan del corte sea el de ese mes, que todos los
// edificios tengan un avance válido (es lo que decide su color) y que el
// urbanismo del resumen sea el del plano.
//
// Función pura: recibe lo que sirve producción (/api/control-room y
// /api/live-data) y devuelve comprobaciones con el mismo formato que la
// verificación. Sólo porcentajes y fechas, nunca importes.

export type CoherenceSeverity = "ok" | "aviso" | "anomalia";
export type CoherenceCheck = { id: string; severity: CoherenceSeverity; detail: string };

export type CoherenceInput = {
  cutoff: string;
  planning: {
    physicalActual?: number | null;
    kpiPlan?: number | null;
    curveActualAtCutoff?: number | null;
    curvePlanAtCutoff?: number | null;
    curveCutoffLabel?: string | null;
  };
  liveValues: Record<string, unknown>;
  // Los edificios tal como los pinta el panel (base + datos publicados): su
  // avance es lo que decide el color de cada uno.
  buildings: Array<{ name?: unknown; progress?: unknown }>;
};

// Medio punto: por debajo es redondeo entre fuentes.
const TOLERANCE_POINTS = 0.5;

const month = (value: unknown) => String(value ?? "").slice(0, 7);
const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const pct = (value: number) => `${Math.round(value * 100) / 100}%`;

export function evaluatePanelCoherence(input: CoherenceInput): CoherenceCheck[] {
  const checks: CoherenceCheck[] = [];
  const { planning, liveValues } = input;

  const actual = asNumber(planning.physicalActual);
  const curveActual = asNumber(planning.curveActualAtCutoff);
  if (actual !== null && curveActual !== null && Math.abs(actual - curveActual) > TOLERANCE_POINTS) {
    checks.push({
      id: "curva_vs_resumen",
      severity: "anomalia",
      detail: `El resumen marca ${pct(actual)} de avance pero el último punto de la Curva S es ${pct(curveActual)}.`,
    });
  }

  const plan = asNumber(planning.kpiPlan);
  const curvePlan = asNumber(planning.curvePlanAtCutoff);
  if (plan !== null && curvePlan !== null && Math.abs(plan - curvePlan) > TOLERANCE_POINTS) {
    checks.push({
      id: "plan_vs_curva",
      severity: "aviso",
      detail: `El plan del resumen (${pct(plan)}) no coincide con el de la Curva S en el corte (${pct(curvePlan)}).`,
    });
  }

  const cutoffMonth = month(input.cutoff);
  const curveMonth = month(planning.curveCutoffLabel);
  if (/^\d{4}-\d{2}$/.test(cutoffMonth) && /^\d{4}-\d{2}$/.test(curveMonth) && curveMonth < cutoffMonth) {
    checks.push({
      id: "curva_atrasada",
      // Falta un documento, no hay un fallo de código: el ejecutado lo fija el
      // Excel de la curva reprogramada del mes (norma del 25/11/2026).
      severity: "aviso",
      detail: `La Curva S se quedó en ${curveMonth} y el corte vigente es ${cutoffMonth}: falta subir el Excel de la curva reprogramada de ese mes, que fija el ejecutado.`,
    });
  }

  const invalid: string[] = [];
  input.buildings.forEach((building, index) => {
    const value = asNumber(building?.progress);
    if (value === null || value < 0 || value > 100) invalid.push(String(building?.name ?? `buildings.${index}`));
  });
  if (invalid.length) {
    checks.push({
      id: "edificios_sin_avance",
      severity: "anomalia",
      detail: `${invalid.length} edificio(s) sin avance válido (no se pueden colorear): ${invalid.slice(0, 6).join(", ")}${invalid.length > 6 ? " …" : ""}.`,
    });
  }

  const overall = asNumber(liveValues["projectSnapshot.overallProgress"]);
  if (overall !== null && (overall < 0 || overall > 100)) {
    checks.push({ id: "avance_fuera_de_rango", severity: "anomalia", detail: `El avance físico total (${pct(overall)}) está fuera de 0–100 %.` });
  }

  const urbanismMap = asNumber(liveValues["urbanismAreas.0.progress"]);
  const urbanismSummary = asNumber(liveValues["projectSnapshot.urbanismProgress"]);
  if (urbanismMap !== null && urbanismSummary !== null && Math.abs(urbanismMap - urbanismSummary) > TOLERANCE_POINTS) {
    checks.push({
      id: "urbanismo_vs_plano",
      severity: "aviso",
      detail: `El urbanismo del resumen (${pct(urbanismSummary)}) no coincide con el del plano (${pct(urbanismMap)}).`,
    });
  }

  return checks;
}
