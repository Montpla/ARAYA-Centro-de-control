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
import {
  activeBuildingsProgress,
  averageNumeric,
  projectProgressFromBuildings,
} from "./progress-model";
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
  // El avance físico global y el último punto "Ejecutado Real" de la Curva S
  // salen del avance real de los edificios, para que se muevan A LA VEZ que
  // ellos: cuando una cubicación cambia los edificios/apartamentos, el número
  // grande y la curva cambian con ellos, sin depender de que además se toque
  // otra cifra aparte. El "Plan operativo" (KPI) se sigue leyendo del mismo mes
  // de monthlyPlan que el ejecutado, para no comparar el avance de julio contra
  // el plan congelado de junio.
  const overallFromBuildings = projectProgressFromBuildings(buildings);
  let cutoffIndex = -1;
  for (let index = 0; index < monthlyPlan.length; index += 1) {
    if (monthlyPlan[index].actual !== null) cutoffIndex = index;
  }
  // El mes del corte adopta el promedio vivo de los edificios como "Ejecutado
  // Real", así el plano y la curva muestran exactamente lo mismo.
  const coupledMonthlyPlan = overallFromBuildings === null || cutoffIndex < 0
    ? monthlyPlan
    : monthlyPlan.map((entry, index) =>
      index === cutoffIndex ? { ...entry, actual: overallFromBuildings } : entry);
  const cutoffEntry = cutoffIndex >= 0 ? coupledMonthlyPlan[cutoffIndex] : null;
  const overallProgress = cutoffEntry?.actual ?? overallFromBuildings ?? snapshot.overallProgress;
  const plannedProgress = cutoffEntry?.planned ?? snapshot.plannedProgress;
  const deviationPoints = Math.round((overallProgress - plannedProgress) * 100) / 100;
  // Ritmo de los edificios ya en marcha, aparte del global (que reparte entre
  // los 26). Se recalcula solo con cada cambio de edificio.
  const activeProgress = activeBuildingsProgress(buildings) ?? overallProgress;
  // Urbanismo: media viva de sus áreas, no un número a mano. La fecha de fin,
  // el desvío y la línea base salen del plan (lib/project-xml) y viven ya en
  // snapshot vía las claves projectSnapshot.*, así que no se recalculan aquí.
  const urbanismProgress = averageNumeric(urbanismAreas.map((area) => area.progress)) ?? snapshot.urbanismProgress;
  const urbanismPlanned = averageNumeric(urbanismAreas.map((area) => area.planned)) ?? snapshot.urbanismPlanned;

  return {
    buildings,
    urbanismAreas,
    monthlyPlan: coupledMonthlyPlan,
    projectSnapshot: {
      ...snapshot,
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
