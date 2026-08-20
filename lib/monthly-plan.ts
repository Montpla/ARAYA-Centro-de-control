export type MonthlyActualPoint = {
  actual: number | null;
};

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
