import type { Unit, UnitDiscipline } from "../app/demo-data";
import { currentPhaseName, weightedUnitProgress, type PhaseProgress } from "./progress-model.ts";

// Shared between the client dashboard (colors, labels) and the server-side
// spatial live-data materializer (the computed project-wide overallProgress),
// so both read the exact same per-apartment logic instead of drifting apart.

export const unitDisciplineConjunctoSource: Partial<Record<UnitDiscipline["id"], string>> = {
  albanileria: "Albañilería",
  instalaciones: "Inst. eléctricas, sanitarias y gas",
};

export function unitDisciplines(
  unit: Unit,
  constructionDisciplines: readonly { name: string; progress: number }[],
): UnitDiscipline[] {
  const base: UnitDiscipline[] = unit.disciplines?.length
    ? unit.disciplines
    : [
        { id: "superestructura", name: "Superestructura", progress: unit.progress, status: "integrado" },
        { id: "albanileria", name: "Albañilería", progress: null, status: "pendiente" },
        { id: "instalaciones", name: "Instalaciones", progress: null, status: "pendiente" },
        { id: "acabados", name: "Acabados", progress: null, status: "pendiente" },
      ];
  return base.map((discipline) => {
    if (discipline.progress !== null) return discipline;
    const conjuntoName = unitDisciplineConjunctoSource[discipline.id];
    const conjuntoMatch = conjuntoName
      ? constructionDisciplines.find((item) => item.name === conjuntoName)
      : undefined;
    if (!conjuntoMatch) return discipline;
    return { ...discipline, progress: conjuntoMatch.progress, status: "conjunto" };
  });
}

export function unitOverallProgress(
  unit: Unit,
  constructionDisciplines: readonly { name: string; progress: number }[],
): number {
  // Media ponderada por fase de obra, no media simple: unos acabados pendientes
  // pesan más que una estructura pendiente. El reparto vive en progress-model.
  const weighted = weightedUnitProgress(unitDisciplines(unit, constructionDisciplines));
  const aligned = unit.alignedProgress;
  return typeof aligned === "number" && Number.isFinite(aligned) && aligned > weighted ? aligned : weighted;
}

/**
 * Lleva el avance de los apartamentos al del edificio cuando el edificio va
 * por delante.
 *
 * El avance del edificio lo manda la cubicación (decisión de dirección,
 * 18/11/2026), pero los apartamentos sólo tienen el avance por fase del plan
 * de Project, que va por detrás: un edificio al 79 % se pintaba con
 * apartamentos en torno al 50 %, con otro color de la misma leyenda. Se
 * escala cada apartamento en proporción, de modo que la media del edificio
 * coincide con su avance y se conserva qué apartamentos van por delante. Sólo
 * sube: si los apartamentos ya van por encima, no se toca nada. No inventa
 * disciplinas: sólo fija el avance global con el que se colorea y se cuenta.
 */
export function alignUnitsWithBuildingProgress(
  building: { progress?: number | null; units?: Unit[] },
  constructionDisciplines: readonly { name: string; progress: number }[],
) {
  const units = building.units?.filter(Boolean) ?? [];
  for (const unit of units) delete unit.alignedProgress;
  const target = building.progress;
  if (!units.length || typeof target !== "number" || !Number.isFinite(target) || target <= 0) return 0;
  const weighted = units.map((unit) => weightedUnitProgress(unitDisciplines(unit, constructionDisciplines)));
  const average = weighted.reduce((sum, value) => sum + value, 0) / units.length;
  if (average >= target) return 0;
  const factor = average > 0 ? target / average : 0;
  let ajustados = 0;
  units.forEach((unit, index) => {
    const value = Math.min(100, factor ? weighted[index] * factor : target);
    if (value <= weighted[index]) return;
    unit.alignedProgress = Math.round(value * 100) / 100;
    ajustados += 1;
  });
  return ajustados;
}

/**
 * Lleva a los apartamentos el avance por fase de su edificio.
 *
 * Los apartamentos guardan sus cuatro disciplinas y el plan de obra sólo mide
 * el edificio por fases, así que sin esto cada plan nuevo movía el edificio y
 * dejaba sus apartamentos (avance, color y estado) en el corte anterior. Son
 * acumulados: una disciplina sólo sube, de modo que un avance anotado a mano en
 * un apartamento y mayor que el del edificio se conserva. Muta las unidades
 * para que el cliente conserve las referencias que usa su sincronizador.
 */
export function syncUnitsWithBuildingPhases(building: {
  phases?: readonly PhaseProgress[];
  units?: Unit[];
}) {
  const phases = building.phases;
  if (!phases?.length || !building.units?.length) return 0;
  let actualizados = 0;
  for (const unit of building.units) {
    if (!unit?.disciplines?.length) continue;
    let subio = false;
    const disciplines = unit.disciplines.map((discipline) => {
      const phase = phases.find((item) => item.id === discipline.id);
      if (!phase || typeof phase.progress !== "number" || !Number.isFinite(phase.progress)) return discipline;
      if (discipline.progress !== null && discipline.progress >= phase.progress) return discipline;
      subio = true;
      return { ...discipline, progress: phase.progress, status: "integrado" as const };
    });
    if (!subio) continue;
    actualizados += 1;
    unit.disciplines = disciplines;
    unit.progress = weightedUnitProgress(disciplines);
    if (unit.status !== "bloqueada") {
      unit.status = unit.progress >= 100 ? "terminada" : unit.progress > 0 ? "en_curso" : "pendiente";
    }
    unit.phase = currentPhaseName([...phases]);
    unit.source = "Plan de obra Project · avance por fase del edificio";
  }
  return actualizados;
}
