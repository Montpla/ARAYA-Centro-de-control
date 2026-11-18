export type MonthlyActualPoint = {
  actual: number | null;
};

export type MonthlyCurvePoint = MonthlyActualPoint & {
  planned: number;
};

export type DeclaredPhysicalCutoff = {
  declaredCutoff?: string | null;
  overallProgress?: number | null;
  plannedProgress?: number | null;
};

function finitePercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Índice del calendario de la Curva S (junio 2025 = 0) para una fecha ISO. */
export function curveMonthIndex(date: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!match) return null;
  const index = (Number(match[1]) - 2025) * 12 + (Number(match[2]) - 6);
  return index >= 0 ? index : null;
}

/**
 * Ancla en la Curva S el avance físico que declara un informe cuyo corte es
 * posterior al último "Ejecutado Real" de la curva.
 *
 * El Excel maestro no llega todos los meses, pero el Informe Ejecutivo sí. Sin
 * esto, el resumen seguía mostrando el último mes del Excel (p. ej. agosto)
 * bajo la etiqueta del corte nuevo (octubre), aunque el informe ya estuviera
 * publicado. Como en el punto de julio de la línea base, sólo el mes del corte
 * se ancla al informe, con su ejecutado y su plan operativo juntos, para que
 * resumen y Curva S comparen siempre la misma entrada.
 *
 * No se ancla nada si el corte no es posterior al último ejecutado (el Excel
 * del mes manda) ni si el valor declarado retrocede respecto al acumulado ya
 * medido. Muta la lista, como clearTrailingMonthlyActualPlaceholders.
 */
export function anchorDeclaredCutoff<T extends MonthlyCurvePoint>(
  points: T[],
  declared: DeclaredPhysicalCutoff,
): boolean {
  let lastActualIndex = -1;
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].actual !== null) lastActualIndex = index;
  }
  const index = curveMonthIndex(declared.declaredCutoff);
  const actual = declared.overallProgress;
  if (index === null || index <= lastActualIndex || index >= points.length) return false;
  if (!finitePercent(actual) || actual <= 0) return false;
  const lastActual = lastActualIndex >= 0 ? points[lastActualIndex].actual : null;
  if (finitePercent(lastActual) && actual < lastActual) return false;
  const planned = finitePercent(declared.plannedProgress) ? declared.plannedProgress : points[index].planned;
  points[index] = { ...points[index], actual, planned };
  return true;
}

/**
 * Convierte en "sin dato" los ceros de fórmula que quedan al final de una
 * Curva S después del último avance real positivo.
 *
 * En los Excel de obra las celdas de meses futuros contienen fórmulas y Excel
 * las entrega como 0. Esos ceros no son mediciones: si se conservan, el último
 * mes del programa pasa a ser el corte real y el panel termina mostrando
 * 0 % ejecutado frente a 100 % planificado. Los ceros iniciales se respetan
 * porque sí representan el arranque del proyecto.
 *
 * La función muta la lista para que el cliente conserve la misma referencia
 * que usa su sincronizador en vivo.
 */
export function clearTrailingMonthlyActualPlaceholders<T extends MonthlyActualPoint>(
  points: T[],
) {
  let lastPositiveIndex = -1;
  for (let index = 0; index < points.length; index += 1) {
    const actual = points[index].actual;
    if (typeof actual === "number" && Number.isFinite(actual) && actual > 0) {
      lastPositiveIndex = index;
    }
  }

  if (lastPositiveIndex < 0) return 0;

  let cleared = 0;
  for (let index = lastPositiveIndex + 1; index < points.length; index += 1) {
    if (points[index].actual !== 0) continue;
    points[index] = { ...points[index], actual: null };
    cleared += 1;
  }
  return cleared;
}
