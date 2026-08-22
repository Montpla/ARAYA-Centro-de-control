import {
  buildings as baselineBuildings,
  monthlyPlan as baselineMonthlyPlan,
  projectSnapshot,
  urbanismAreas as baselineUrbanismAreas,
} from "../app/demo-data";
import {
  constructionDisciplines as baselineConstructionDisciplines,
  urbanismReportAreas as baselineUrbanismReportAreas,
} from "../app/june-report-data";
import {
  LiveDataMap,
  compactLiveEntities,
  materializeLiveRoot,
} from "./live-data";
import {
  activeBuildingsProgress,
  projectDateForDisplay,
} from "./progress-model";
import { clearTrailingMonthlyActualPlaceholders } from "./monthly-plan";
import { deriveUrbanismMapAreas } from "./urbanism-map-progress";
import { unitOverallProgress } from "./unit-progress";

export function materializeSpatialLiveData(values: LiveDataMap) {
  const buildings = compactLiveEntities(
    materializeLiveRoot("buildings", baselineBuildings, values),
  ).map((building) => ({
    ...building,
    forecastFinish: projectDateForDisplay(building.forecastFinish),
    units: compactLiveEntities(building.units),
  }));
  const spatialUrbanismAreas = compactLiveEntities(
    materializeLiveRoot("urbanismAreas", baselineUrbanismAreas, values),
  );
  const urbanismReportBaseline = baselineUrbanismReportAreas.map((area) => ({ ...area }));
  const urbanismReportAreas = compactLiveEntities(
    materializeLiveRoot("urbanismReportAreas", urbanismReportBaseline, values),
  );
  const urbanismAreas = deriveUrbanismMapAreas(spatialUrbanismAreas, urbanismReportAreas);
  const snapshot = materializeLiveRoot("projectSnapshot", projectSnapshot, values);
  const monthlyPlan = materializeLiveRoot("monthlyPlan", baselineMonthlyPlan, values);
  clearTrailingMonthlyActualPlaceholders(monthlyPlan);
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
  let cutoffIndex = -1;
  for (let index = 0; index < monthlyPlan.length; index += 1) {
    if (monthlyPlan[index].actual !== null) cutoffIndex = index;
  }
  // El avance físico global procede del último "Ejecutado Real" publicado en
  // la Curva S; si todavía no existe ese corte, cae al valor declarado por el
  // Informe Ejecutivo. El promedio de edificios es una métrica de apoyo y no
  // puede sustituir un KPI ponderado por el monto total de obra.
  const cutoffEntry = cutoffIndex >= 0 ? monthlyPlan[cutoffIndex] : null;
  const overallProgress = cutoffEntry?.actual ?? snapshot.overallProgress;
  const plannedProgress = cutoffEntry?.planned ?? snapshot.plannedProgress;
  const deviationPoints = Math.round((overallProgress - plannedProgress) * 100) / 100;
  // Ritmo de los edificios ya en marcha, aparte del global (que reparte entre
  // los 26). Se recalcula solo con cada cambio de edificio.
  const activeProgress = activeBuildingsProgress(buildings) ?? overallProgress;
  // Urbanismo general es un KPI consolidado y ponderado. Vialidad, paisajismo
  // y el resto son desgloses: no se promedian con él porque alteraría el total.
  const generalUrbanism = urbanismAreas.find((area) => area.id === "urban-general");
  const urbanismProgress = generalUrbanism?.progress ?? snapshot.urbanismProgress;
  const urbanismPlanned = generalUrbanism?.planned ?? snapshot.urbanismPlanned;

  return {
    buildings,
    urbanismAreas,
    monthlyPlan,
    projectSnapshot: {
      ...snapshot,
      forecastFinish: projectDateForDisplay(snapshot.forecastFinish),
      overallProgress,
      activeBuildingsProgress: activeProgress,
      urbanismProgress,
      urbanismPlanned,
      plannedProgress,
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
