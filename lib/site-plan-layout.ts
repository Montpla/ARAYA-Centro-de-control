import layout from "./masterplan-layout.json" with { type: "json" };

export type SitePlanPoint = { x: number; y: number };

// Ambas vistas usan la misma proyección ortogonal del nuevo DWG. Cada centro
// pertenece a su bloque arquitectónico y se ha contrastado con el rótulo TH.
// Las coordenadas guardadas por fuentes antiguas no cambian esta geometría.
export const visualPlanCoordinates: Record<string, SitePlanPoint> = Object.fromEntries(
  Object.entries(layout.buildings).map(([code, point]) => [code, { x: point.x, y: point.y }]),
);
export const technicalPlanCoordinates: Record<string, SitePlanPoint> = Object.fromEntries(
  Object.entries(visualPlanCoordinates).map(([code, point]) => [code, { ...point }]),
);
export const masterPlanBuildingCodes = Array.from({ length: 77 }, (_, index) => String(index + 1));
export const buildingMapCoordinates = Object.fromEntries(
  masterPlanBuildingCodes.map((code) => [code, {
    visual: visualPlanCoordinates[code], technical: technicalPlanCoordinates[code],
  }]),
) as Record<string, { visual: SitePlanPoint; technical: SitePlanPoint }>;

export const masterPlan = layout;
export type MasterPlanFeature = (typeof layout.features)[number];

// Son accesos a las disciplinas agregadas, distintos de las fichas geométricas
// de cada piscina, parque o servicio. No asignan avance global a un equipamiento.
export const currentUrbanismMapPoints: Record<string, SitePlanPoint & { short: string }> = {
  "urban-general": { x: 48.2, y: 62.2, short: "URB" },
  "urban-roads": { x: 73.0, y: 39.5, short: "VIAL" },
  "urban-parking": { x: 32.0, y: 40.7, short: "P" },
  "urban-landscape": { x: 51.0, y: 53.7, short: "PAISAJISMO" },
  "urban-facilities": { x: 47.1, y: 30.6, short: "EQ" },
  "urban-access": { x: 56.2, y: 77.0, short: "ACCESO" },
};
