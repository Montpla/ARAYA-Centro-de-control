import {
  buildings as baselineBuildings,
  projectSnapshot,
  urbanismAreas as baselineUrbanismAreas,
} from "../app/demo-data";
import {
  LiveDataMap,
  compactLiveEntities,
  materializeLiveRoot,
} from "./live-data";

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
  const unitCount = buildings.reduce((total, building) => total + building.units.length, 0);

  return {
    buildings,
    urbanismAreas,
    projectSnapshot: {
      ...snapshot,
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
