export type SitePlanPoint = { x: number; y: number };

type CoordinateRow = {
  codes: readonly string[];
  x: readonly number[];
  y: number | readonly number[];
};

function coordinatesFromRows(rows: readonly CoordinateRow[]) {
  const result: Record<string, SitePlanPoint> = {};
  for (const row of rows) {
    if (row.codes.length !== row.x.length) {
      throw new Error("La fila de implantación no tiene una coordenada por edificio.");
    }
    if (Array.isArray(row.y) && row.codes.length !== row.y.length) {
      throw new Error("La fila de implantación no tiene una altura por edificio.");
    }
    row.codes.forEach((code, index) => {
      if (result[code]) throw new Error(`El edificio TH-${code} está duplicado en la implantación.`);
      result[code] = {
        x: row.x[index],
        y: Array.isArray(row.y) ? row.y[index] : row.y,
      };
    });
  }
  return result;
}

// Centros de los 77 edificios sobre la imagen visual. Los códigos conservan el
// orden real que figura en el DWG: no coinciden con la posición dentro de cada
// manzana y por eso se declaran explícitamente por fila.
export const visualPlanCoordinates = coordinatesFromRows([
  { codes: ["37", "38", "39", "40", "41", "42", "43", "44", "45"], x: [18.56, 26.94, 35.31, 43.69, 52.16, 60.63, 69.19, 77.76, 86.33], y: 9.45 },
  { codes: ["36", "35", "34"], x: [22.16, 30.48, 38.8], y: 17.57 },
  { codes: ["31", "32", "33"], x: [22.16, 30.48, 38.8], y: 21.21 },
  { codes: ["49", "48", "47", "46"], x: [56.17, 64.62, 73.07, 81.52], y: 16.35 },
  { codes: ["50", "51", "52", "53"], x: [56.17, 64.62, 73.07, 81.52], y: 20.18 },
  { codes: ["30", "29", "28"], x: [21.96, 30.28, 38.6], y: 28.93 },
  { codes: ["25", "26", "27"], x: [21.96, 30.28, 38.6], y: 32.76 },
  { codes: ["57", "56", "55", "54"], x: [56.12, 64.57, 73.02, 81.47], y: 28.49 },
  { codes: ["58", "59", "60", "61"], x: [56.12, 64.57, 73.02, 81.47], y: 32.41 },
  { codes: ["24", "23", "22"], x: [21.86, 30.18, 38.5], y: 40.98 },
  { codes: ["19", "20", "21"], x: [21.86, 30.18, 38.5], y: 44.88 },
  { codes: ["65", "64", "63", "62"], x: [56.07, 64.52, 72.97, 81.42], y: 40.75 },
  { codes: ["66", "67", "68", "69"], x: [56.07, 64.52, 72.97, 81.42], y: 44.6 },
  { codes: ["18", "17", "16"], x: [21.68, 30, 38.24], y: [52.81, 52.97, 53.12] },
  { codes: ["13", "14", "15"], x: [21.44, 29.83, 38.05], y: [56.34, 56.52, 56.68] },
  { codes: ["71", "70"], x: [58.91, 67.39], y: [52.62, 52.81] },
  { codes: ["72", "73"], x: [58.74, 67.2], y: [56.24, 56.4] },
  { codes: ["12", "11", "10"], x: [20.91, 29.23, 37.57], y: [64.51, 64.7, 64.89] },
  { codes: ["7", "8", "9"], x: [20.7, 28.98, 37.31], y: [68.13, 68.26, 68.45] },
  { codes: ["75", "74"], x: [58.58, 67.11], y: [64.45, 64.67] },
  { codes: ["76", "77"], x: [58.46, 66.97], y: [68.16, 68.32] },
  { codes: ["6", "5", "4"], x: [20.04, 28.54, 37.01], y: [76.5, 76.72, 76.94] },
  { codes: ["1", "2", "3"], x: [19.9, 28.26, 36.78], y: [80.21, 80.37, 80.62] },
]);

// La fotografía del plano técnico tiene una perspectiva distinta; estas
// coordenadas mantienen cada botón encima del mismo TH en esa segunda vista.
export const technicalPlanCoordinates = coordinatesFromRows([
  { codes: ["37", "38", "39", "40", "41", "42", "43", "44", "45"], x: [18.7, 26.9, 35, 43.3, 51.5, 59.9, 68.3, 76.8, 85.4], y: 9.5 },
  { codes: ["36", "35", "34"], x: [22.6, 30.8, 39], y: 17.1 },
  { codes: ["31", "32", "33"], x: [22.6, 30.8, 39], y: 21 },
  { codes: ["49", "48", "47", "46"], x: [56.2, 64.9, 73.6, 82.4], y: 16.2 },
  { codes: ["50", "51", "52", "53"], x: [56.2, 64.9, 73.6, 82.4], y: 20.2 },
  { codes: ["30", "29", "28"], x: [22.2, 30.2, 38.3], y: 28.1 },
  { codes: ["25", "26", "27"], x: [22.2, 30.2, 38.3], y: 32.1 },
  { codes: ["57", "56", "55", "54"], x: [55.8, 64.4, 73, 81.7], y: 28.1 },
  { codes: ["58", "59", "60", "61"], x: [55.8, 64.4, 73, 81.7], y: 32 },
  { codes: ["24", "23", "22"], x: [22.1, 30, 38], y: 39.5 },
  { codes: ["19", "20", "21"], x: [22.1, 30, 38], y: 43.2 },
  { codes: ["65", "64", "63", "62"], x: [55.6, 64.3, 72.9, 81.6], y: 39.4 },
  { codes: ["66", "67", "68", "69"], x: [55.6, 64.3, 72.9, 81.6], y: 43 },
  { codes: ["18", "17", "16"], x: [22.1, 30.6, 39.1], y: [50.4, 50.5, 50.6] },
  { codes: ["13", "14", "15"], x: [21.6, 29.8, 38.1], y: [54.5, 54.5, 54.6] },
  { codes: ["71", "70"], x: [59, 66.6], y: [50.2, 50.3] },
  { codes: ["72", "73"], x: [59, 66.6], y: [54.1, 54.2] },
  { codes: ["12", "11", "10"], x: [20.6, 28.7, 36.7], y: [60.7, 60.7, 60.8] },
  { codes: ["7", "8", "9"], x: [20.7, 28.7, 36.7], y: [64.7, 64.8, 64.8] },
  { codes: ["75", "74"], x: [58.9, 66.5], y: [61.2, 61.3] },
  { codes: ["76", "77"], x: [59, 66.6], y: [65.1, 65.1] },
  { codes: ["6", "5", "4"], x: [23.3, 31.1, 38.4], y: [70.5, 70.6, 70.7] },
  { codes: ["1", "2", "3"], x: [20.4, 28.7, 36.7], y: [74.4, 74.6, 74.5] },
]);

export const masterPlanBuildingCodes = Array.from({ length: 77 }, (_, index) => String(index + 1));

export const buildingMapCoordinates = Object.fromEntries(
  masterPlanBuildingCodes.map((code) => [code, {
    visual: visualPlanCoordinates[code],
    technical: technicalPlanCoordinates[code],
  }]),
) as Record<string, { visual: SitePlanPoint; technical: SitePlanPoint }>;
