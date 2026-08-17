/**
 * Cómo se calcula el avance de un edificio y de un apartamento.
 *
 * Durante un tiempo hubo tres cifras que no se hablaban entre sí: el porcentaje
 * del edificio venía escrito a mano, el del apartamento era la media simple de
 * sus cuatro disciplinas, y las disciplinas se rellenaban sólo con la
 * superestructura. Un edificio al 40,6% mostraba sus seis apartamentos al 100%.
 *
 * El primer arreglo fue derivar todo del porcentaje del edificio en cascada
 * —repartir ese número entre las fases por orden de ejecución—. Coherente, pero
 * las fases salían inventadas: suponían que la obra va en fila (primero toda la
 * estructura, luego toda la albañilería), cuando en realidad se solapan.
 *
 * Ahora hay **medición real por fase**, sacada del plan de obra de Project
 * (corte 30/07/2026): para cada edificio, el avance de cada una de sus cinco
 * fases. Así que se invierte el sentido, que es lo que este módulo siempre
 * anticipó: **de las fases reales sale el edificio**, no al revés. La misma
 * tabla de pesos que antes repartía ahora agrega.
 *
 * **Las fases pesan distinto**, según la parte de horas que ocupa cada oficio
 * en el plan: los acabados son la mitad de la obra y la obra común una fracción
 * pequeña. Repartir a partes iguales daba a los acabados el mismo valor que a
 * la platea.
 */

/**
 * Peso de cada fase en el avance de un edificio, en orden de ejecución.
 *
 * **Éste es el único sitio donde se tocan estos números.** Salen de la parte de
 * duración que ocupa cada oficio en el plan de obra; si la oficina fija los
 * suyos por cubicación, se cambian aquí y todo el panel se recalcula solo.
 * Deben sumar 100.
 */
export const PHASE_WEIGHTS = [
  // Platea, escaleras, cubierta y fachada: obra del edificio que no pertenece
  // a ningún apartamento. Sin esta fase, un edificio con la cimentación en
  // marcha marcaría 0% en los apartamentos aunque haya obra hecha.
  { id: "comun", name: "Obra común", weight: 8, shared: true },
  { id: "superestructura", name: "Superestructura", weight: 15, shared: false },
  { id: "albanileria", name: "Albañilería", weight: 19, shared: false },
  { id: "instalaciones", name: "Instalaciones", weight: 6, shared: false },
  { id: "acabados", name: "Acabados", weight: 52, shared: false },
] as const;

export type PhaseId = (typeof PHASE_WEIGHTS)[number]["id"];

const TOTAL = PHASE_WEIGHTS.reduce((suma, fase) => suma + fase.weight, 0);
if (TOTAL !== 100) {
  // Un reparto que no suma 100 no es un error de estilo: haría que el avance
  // del edificio dejara de coincidir con el de sus apartamentos, que es
  // exactamente la contradicción que este módulo existe para quitar.
  throw new Error(`Los pesos de PHASE_WEIGHTS suman ${TOTAL} y deben sumar 100.`);
}

/** Peso de las fases que sí pertenecen al apartamento (todas menos la común). */
export const UNIT_PHASE_WEIGHT = PHASE_WEIGHTS
  .filter((fase) => !fase.shared)
  .reduce((suma, fase) => suma + fase.weight, 0);

export type PhaseProgress = { id: PhaseId; name: string; progress: number };

/** Empareja un vector de avances con las fases por orden. */
export function phasesFromValues(values: readonly number[]): PhaseProgress[] {
  return PHASE_WEIGHTS.map((fase, indice) => ({
    id: fase.id,
    name: fase.name,
    progress: Math.max(0, Math.min(100, values[indice] ?? 0)),
  }));
}

/**
 * Avance de un edificio como media de sus fases ponderada por peso.
 *
 * Es la operación inversa del reparto anterior: en vez de trocear un número, se
 * agregan las medidas reales. Con los pesos sacados del plan, la media de todos
 * los edificios reproduce el porcentaje global que el propio Project muestra en
 * la raíz —la señal de que la agregación es fiel—.
 */
export function buildingProgressFromPhases(phases: readonly PhaseProgress[]): number {
  let suma = 0;
  let peso = 0;
  for (const fase of phases) {
    const definicion = PHASE_WEIGHTS.find((item) => item.id === fase.id);
    if (!definicion) continue;
    suma += fase.progress * definicion.weight;
    peso += definicion.weight;
  }
  return peso > 0 ? Math.round((suma / peso) * 10) / 10 : 0;
}

/**
 * Media ponderada de las disciplinas de un apartamento.
 *
 * Sólo entran las fases que pertenecen al apartamento (no la obra común), y
 * cada una con su peso: unos acabados pendientes pesan más que una estructura
 * pendiente. Sustituye a la media simple, que trataba a las cuatro igual.
 */
export function weightedUnitProgress(
  disciplines: readonly { id: string; progress: number | null }[],
): number {
  let peso = 0;
  let total = 0;
  for (const disciplina of disciplines) {
    const fase = PHASE_WEIGHTS.find((item) => item.id === disciplina.id);
    if (!fase || fase.shared) continue;
    // Una disciplina sin dato cuenta como no empezada y no como inexistente:
    // descartarla del divisor inflaba el avance justo en los apartamentos de
    // los que menos se sabe.
    total += (disciplina.progress ?? 0) * fase.weight;
    peso += fase.weight;
  }
  if (!peso) return 0;
  return Math.round((total / peso) * 100) / 100;
}

/** Fase en la que está trabajando ahora mismo un edificio. */
export function currentPhaseName(phases: readonly PhaseProgress[]): string {
  const enCurso = phases.find((fase) => fase.progress > 0 && fase.progress < 100);
  if (enCurso) return enCurso.name;
  const ultima = [...phases].reverse().find((fase) => fase.progress >= 100);
  return ultima ? ultima.name : PHASE_WEIGHTS[0].name;
}

/**
 * Avance físico global del proyecto: la media del avance real de los edificios.
 *
 * Es la cifra grande del panel y el último punto "Ejecutado Real" de la Curva S.
 * Al salir de los mismos edificios que pinta el plano, el número grande, la
 * curva y los colores cuentan siempre la misma historia y se mueven a la vez:
 * cuando una cubicación cambia un edificio, el global cambia con él, sin
 * depender de que además se toque otra cifra aparte. Devuelve null si no hay
 * edificios, para que quien llame conserve el valor que tuviera.
 */
export function projectProgressFromBuildings(buildings: readonly { progress: number }[]): number | null {
  if (!buildings.length) return null;
  const suma = buildings.reduce((total, building) => total + building.progress, 0);
  return Math.round((suma / buildings.length) * 100) / 100;
}
