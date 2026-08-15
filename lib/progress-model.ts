/**
 * Cómo se calcula el avance de un edificio y de un apartamento.
 *
 * Hasta ahora había tres cifras que no se hablaban entre sí: el porcentaje del
 * edificio venía escrito a mano, el del apartamento era la media simple de sus
 * cuatro disciplinas, y las disciplinas se rellenaban sólo con la
 * superestructura. El resultado era que un edificio al 40,6% mostraba sus seis
 * apartamentos al 100%, y nadie podía decir cuál de los dos números era el
 * bueno.
 *
 * Aquí se fija una sola regla y todo lo demás se deriva de ella.
 *
 * **El porcentaje del edificio manda.** Es el que sale de la cubicación de la
 * oficina y el que se ha venido publicando; el detalle por apartamento del
 * modelo era un relleno —sólo llevaba estructura, y ni siquiera de forma
 * coherente: TH-03 y TH-04 tenían los dos la estructura al 100% y el edificio
 * al 40,6% y al 25,0%, lo que sólo se explica por disciplinas que el modelo no
 * guardaba. Así que se deriva hacia abajo, no hacia arriba: del edificio salen
 * sus fases, y de las fases sale cada apartamento. Cuando llegue medición real
 * por apartamento se invierte el sentido y esta misma tabla de pesos sirve.
 *
 * **Las fases van en el orden en que se construye** y pesan distinto: una
 * estructura terminada no es media obra, y unos acabados pendientes no son un
 * detalle. Repartir a partes iguales —que es lo que se hacía— daba a los
 * acabados el mismo valor que a la platea.
 */

/**
 * Reparto del valor de un edificio entre sus fases, en orden de ejecución.
 *
 * **Éste es el único sitio donde se tocan estos números.** Son un reparto de
 * obra residencial al uso; cuando la oficina fije los suyos por cubicación, se
 * cambian aquí y todo el panel se recalcula solo. Deben sumar 100.
 */
export const PHASE_WEIGHTS = [
  // Platea, escaleras, cubierta y fachada: obra del edificio que no pertenece
  // a ningún apartamento. Sin esta fase, un edificio con la cimentación en
  // marcha marcaría 0% — que es justo lo que el 5,9% de TH-11 representa.
  { id: "comun", name: "Obra común", weight: 16, shared: true },
  { id: "superestructura", name: "Superestructura", weight: 26, shared: false },
  { id: "albanileria", name: "Albañilería", weight: 15, shared: false },
  { id: "instalaciones", name: "Instalaciones", weight: 21, shared: false },
  { id: "acabados", name: "Acabados", weight: 22, shared: false },
] as const;

export type PhaseId = (typeof PHASE_WEIGHTS)[number]["id"];

const TOTAL = PHASE_WEIGHTS.reduce((suma, fase) => suma + fase.weight, 0);
if (TOTAL !== 100) {
  // Un reparto que no suma 100 no es un error de estilo: haría que el avance
  // del edificio dejara de coincidir con el de sus apartamentos, que es
  // exactamente la contradicción que este módulo existe para quitar.
  throw new Error(`Los pesos de PHASE_WEIGHTS suman ${TOTAL} y deben sumar 100.`);
}

/** Peso de las fases que sí pertenecen al apartamento. */
export const UNIT_PHASE_WEIGHT = PHASE_WEIGHTS
  .filter((fase) => !fase.shared)
  .reduce((suma, fase) => suma + fase.weight, 0);

export type PhaseProgress = { id: PhaseId; name: string; progress: number };

/**
 * Reparte el avance de un edificio entre sus fases.
 *
 * Se llenan en orden de ejecución porque así se construye: no hay acabados
 * antes de que exista la estructura. Un edificio al 40,6% tiene la obra común
 * terminada y la estructura empezada, no un 40,6% repartido por igual entre
 * cinco fases que aún no han empezado.
 */
export function phasesFromBuildingProgress(overall: number): PhaseProgress[] {
  let restante = Math.max(0, Math.min(100, overall));
  return PHASE_WEIGHTS.map((fase) => {
    const consumido = Math.min(restante, fase.weight);
    restante -= consumido;
    return {
      id: fase.id,
      name: fase.name,
      // Redondeo a una décima: más precisión que ésa sería inventada, porque
      // el número de partida viene con una sola.
      progress: Math.round((consumido / fase.weight) * 1000) / 10,
    };
  });
}

/**
 * Avance de un apartamento a partir del de su edificio.
 *
 * Es la parte del edificio que corresponde a los apartamentos, sin la obra
 * común. Los seis apartamentos de un edificio pesan igual entre sí —son el
 * mismo plano repetido en tres plantas— así que todos comparten valor.
 */
export function unitProgressFromBuildingProgress(overall: number): number {
  const fases = phasesFromBuildingProgress(overall).filter((fase) => fase.id !== "comun");
  const aportado = fases.reduce((suma, fase) => {
    const peso = PHASE_WEIGHTS.find((item) => item.id === fase.id)?.weight ?? 0;
    return suma + (fase.progress / 100) * peso;
  }, 0);
  return Math.round((aportado / UNIT_PHASE_WEIGHT) * 1000) / 10;
}

/**
 * Media ponderada de las disciplinas de un apartamento.
 *
 * Sustituye a la media simple anterior, que daba a los acabados el mismo peso
 * que a la superestructura y hacía que un apartamento con sólo la estructura
 * hecha figurara mucho más avanzado de lo que estaba.
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

/** Fase en la que está trabajando ahora mismo un apartamento. */
export function currentPhaseName(overall: number): string {
  const fases = phasesFromBuildingProgress(overall);
  const enCurso = fases.find((fase) => fase.progress > 0 && fase.progress < 100);
  if (enCurso) return enCurso.name;
  const ultima = [...fases].reverse().find((fase) => fase.progress >= 100);
  return ultima ? ultima.name : PHASE_WEIGHTS[0].name;
}
