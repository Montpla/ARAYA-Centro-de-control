import {
  buildings as baselineBuildings,
  monthlyPlan as baselineMonthlyPlan,
  projectSnapshot,
  urbanismAreas as baselineUrbanismAreas,
} from "../app/demo-data";
import { constructionDisciplines as baselineConstructionDisciplines } from "../app/june-report-data";
import {
  LiveDataMap,
  compactLiveEntities,
  materializeLiveRoot,
} from "./live-data";
import { unitOverallProgress } from "./unit-progress";

export function materializeSpatialLiveData(values: LiveDataMap) {
  const buildings = compactLiveEntities(
    materializeLiveRoot("buildings", baselineBuildings, values),
  ).map((building) => ({
    ...building,
    units: compactLiveEntities(building.units),
  }));
  const urbanismAreas = compactLiveEntities(
    materializeLiveRoot("urbanismAreas", baselineUrbanismAreas, values),
  );
  const snapshot = materializeLiveRoot("projectSnapshot", projectSnapshot, values);
  const monthlyPlan = materializeLiveRoot("monthlyPlan", baselineMonthlyPlan, values);
  const unitCount = buildings.reduce((total, building) => total + building.units.length, 0);
  const constructionDisciplines = materializeLiveRoot(
    "constructionDisciplines",
    baselineConstructionDisciplines,
    values,
  );
  // El avance físico por apartamento (promedio de las 4 disciplinas de cada
  // unidad) se conserva como métrica de apoyo, pero ya no manda sobre el
  // avance físico global: el equipo de obra lleva su control real en el
  // Excel maestro (Curva S / plan operativo), así que es el último
  // "Ejecutado Real" que ese Excel declare el que decide overallProgress.
  const allUnits = buildings.flatMap((building) => building.units);
  const apartmentAverageProgress = allUnits.length
    ? allUnits.reduce((sum, unit) => sum + unitOverallProgress(unit, constructionDisciplines), 0) / allUnits.length
    : snapshot.apartmentAverageProgress;
  let lastDeclaredActual: number | null = null;
  for (const entry of monthlyPlan) {
    if (entry.actual !== null) lastDeclaredActual = entry.actual;
  }
  const overallProgress = lastDeclaredActual ?? snapshot.overallProgress;
  const deviationPoints = Math.round((overallProgress - snapshot.plannedProgress) * 100) / 100;

  return {
    buildings,
    urbanismAreas,
    monthlyPlan,
    projectSnapshot: {
      ...snapshot,
      overallProgress,
      apartmentAverageProgress,
      deviationPoints,
      buildings,
      urbanismAreas,
      buildingCount: buildings.length,
      unitCount,
      buildingsPendingIntegration: Math.max(
        0,
        snapshot.masterPlanBuildingCount - buildings.length,
      ),
    },
  };
}
