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

// Centros de las cubiertas de los 77 edificios sobre la imagen visual original
// de 982 × 1602 px. Cada punto procede del centro del componente gris de su
// cubierta, no de una cuadrícula estimada. Los códigos conservan el orden real
// que figura en el DWG: no coinciden con la posición dentro de cada manzana y
// por eso se declaran explícitamente por fila.
export const visualPlanCoordinates = coordinatesFromRows([
  { codes: ["37", "38", "39", "40", "41", "42", "43", "44", "45"], x: [18.74, 27.04, 35.49, 43.64, 51.73, 60.49, 69.09, 78.05, 87.42], y: [10.11, 9.74, 9.36, 9.05, 8.27, 7.96, 7.58, 7.15, 6.55] },
  { codes: ["36", "35", "34"], x: [22.35, 30.65, 38.95], y: [18.07, 17.92, 17.73] },
  { codes: ["31", "32", "33"], x: [22.35, 30.6, 38.8], y: [21.82, 21.72, 21.57] },
  { codes: ["49", "48", "47", "46"], x: [56.21, 64.97, 73.78, 82.89], y: [16.6, 16.39, 16.17, 16.01] },
  { codes: ["50", "51", "52", "53"], x: [56.11, 64.82, 73.63, 82.69], y: [20.57, 20.44, 20.26, 20.13] },
  { codes: ["30", "29", "28"], x: [22.2, 30.5, 38.7], y: [29.71, 29.68, 29.62] },
  { codes: ["25", "26", "27"], x: [22.15, 30.35, 38.59], y: [33.46, 33.43, 33.43] },
  { codes: ["57", "56", "55", "54"], x: [56.01, 64.61, 73.32, 82.23], y: [28.78, 28.75, 28.65, 28.62] },
  { codes: ["58", "59", "60", "61"], x: [55.86, 64.46, 73.12, 82.08], y: [32.71, 32.71, 32.71, 32.71] },
  { codes: ["24", "23", "22"], x: [22.05, 30.3, 38.59], y: [41.26, 41.32, 41.42] },
  { codes: ["19", "20", "21"], x: [21.95, 30.19, 38.44], y: [44.91, 45.04, 45.16] },
  { codes: ["65", "64", "63", "62"], x: [55.7, 64.15, 72.81, 81.52], y: [40.79, 40.86, 40.82, 40.89] },
  { codes: ["66", "67", "68", "69"], x: [55.55, 64, 72.61, 81.36], y: [44.63, 44.69, 44.79, 44.85] },
  { codes: ["18", "17", "16"], x: [21.64, 29.94, 38.14], y: [52.81, 52.97, 53.12] },
  { codes: ["13", "14", "15"], x: [21.44, 29.74, 37.98], y: [56.55, 56.71, 56.9] },
  { codes: ["71", "70"], x: [58.86, 67.36], y: [52.62, 52.78] },
  { codes: ["72", "73"], x: [58.71, 67.16], y: [56.46, 56.62] },
  { codes: ["12", "11", "10"], x: [20.88, 29.18, 37.53], y: [64.51, 64.7, 64.92] },
  { codes: ["7", "8", "9"], x: [20.57, 28.97, 37.27], y: [68.32, 68.54, 68.66] },
  { codes: ["75", "74"], x: [58.55, 67.06], y: [64.45, 64.64] },
  { codes: ["76", "77"], x: [58.4, 66.96], y: [68.35, 68.57] },
  { codes: ["6", "5", "4"], x: [20.01, 28.56, 36.91], y: [76.5, 76.75, 76.9] },
  { codes: ["1", "2", "3"], x: [19.86, 28.31, 36.66], y: [80.43, 80.62, 80.87] },
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
