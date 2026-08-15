import type { Unit, UnitDiscipline } from "../app/demo-data";
import { weightedUnitProgress } from "./progress-model.ts";

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
  return weightedUnitProgress(unitDisciplines(unit, constructionDisciplines));
}
