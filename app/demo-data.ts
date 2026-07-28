export type UnitStatus = "terminada" | "en_curso" | "bloqueada" | "pendiente";

export type Unit = {
  id: string;
  code: string;
  floor: number;
  progress: number;
  status: UnitStatus;
  phase: string;
  deviationDays: number;
};

export type Building = {
  id: string;
  name: string;
  shortName: string;
  progress: number;
  planProgress: number | null;
  deviationDays: number;
  forecastFinish: string;
  units: Unit[];
};

export type TimelineEvent = {
  id: string;
  date: string;
  time: string;
  type: "hito" | "incidencia" | "avance" | "entrega";
  title: string;
  detail: string;
  building: string;
  author: string;
};

export type Supplier = {
  id: string;
  name: string;
  category: string;
  contact: string;
  status: "al_dia" | "revision" | "retraso";
  score: number;
  nextDelivery: string;
  amount: string;
};

export type CustomMetric = {
  id: string;
  name: string;
  value: string;
  target: string;
  trend: "up" | "down" | "flat";
  unit: string;
  owner: string;
};

export type WorkPackage = {
  name: string;
  progress: number;
  finish: string;
  baselineFinish: string;
  deviationDays: number;
  critical: boolean;
};

export type DataSource = {
  id: string;
  file: string;
  kind: string;
  declaredCutoff: string;
  savedAt: string;
  status: "validada" | "observada";
  records: string;
  notes: string[];
  downloadUrl?: string;
};

const buildingRows: Array<[string, number, number, string, number]> = [
  ["3", 40.6, 58, "12/11/2026", 100],
  ["2", 34.4, 62, "26/11/2026", 100],
  ["4", 25.0, 21, "26/11/2026", 100],
  ["6", 28.1, 41, "26/11/2026", 100],
  ["1", 31.2, 51, "26/11/2026", 100],
  ["5", 28.1, 30, "26/11/2026", 100],
  ["9", 21.9, 9, "26/11/2026", 100],
  ["8", 12.2, 0, "26/11/2026", 90],
  ["7", 12.2, -11, "26/11/2026", 90],
  ["12", 12.2, -13, "03/12/2026", 90],
  ["11", 5.9, 20, "18/01/2027", 90],
  ["10", 5.9, 4, "18/01/2027", 90],
  ["15", 3.1, 14, "10/02/2027", 0],
  ["14", 3.1, 14, "19/02/2027", 0],
  ["13", 0, 14, "02/03/2027", 0],
  ["18", 0, 13, "10/03/2027", 0],
  ["17", 0, 11, "19/03/2027", 0],
  ["16", 0, 13, "30/03/2027", 0],
  ["71", 0, 12, "07/04/2027", 0],
  ["70", 0, 10, "16/04/2027", 0],
  ["73", 0, 12, "27/04/2027", 0],
  ["72", 0, 9, "05/05/2027", 0],
  ["75", 0, 9, "14/05/2027", 0],
  ["74", 0, 10, "24/05/2027", 0],
  ["77", 0, 7, "01/06/2027", 0],
  ["76", 0, 7, "07/06/2027", 0],
];

const apartmentCodes = ["101", "102", "201", "202", "301", "302"];

function makeUnits(building: string, structureProgress: number): Unit[] {
  return apartmentCodes.map((apartment) => ({
    id: `${building}-${apartment}`,
    code: `${building}-${apartment}`,
    floor: Number(apartment[0]),
    progress: structureProgress,
    status:
      structureProgress === 100
        ? "terminada"
        : structureProgress > 0
          ? "en_curso"
          : "pendiente",
    phase: "Superestructura",
    deviationDays: 0,
  }));
}

export const buildings: Building[] = buildingRows.map(
  ([code, progress, deviationDays, forecastFinish, structureProgress]) => ({
    id: `edificio-${code}`,
    name: `Edificio ${code}`,
    shortName: code,
    progress,
    planProgress: null,
    deviationDays,
    forecastFinish,
    units: makeUnits(code, structureProgress),
  }),
);

export const monthlyPlan = [
  { month: "jun 25", planned: 0, actual: 0 },
  { month: "jul", planned: 0.5179, actual: 0.3139 },
  { month: "ago", planned: 1.2085, actual: 0.9417 },
  { month: "sep", planned: 2.0717, actual: 1.8834 },
  { month: "oct", planned: 2.7623, actual: 2.5112 },
  { month: "nov", planned: 3.7009, actual: 3.4529 },
  { month: "dic", planned: 4.1097, actual: 3.8285 },
  { month: "ene 26", planned: 4.481, actual: 4.4735 },
  { month: "feb", planned: 4.9729, actual: 6.0525 },
  { month: "mar", planned: 6.7168, actual: 8.9616 },
  { month: "abr", planned: 11.0745, actual: 11.5924 },
  { month: "may", planned: 16.6714, actual: 16.0016 },
  { month: "jun", planned: 21.2366, actual: 18.232 },
  { month: "jul", planned: 26.6071, actual: null },
  { month: "ago", planned: 35.2931, actual: null },
  { month: "sep", planned: 45.5789, actual: null },
  { month: "oct", planned: 57.4837, actual: null },
  { month: "nov", planned: 68.5614, actual: null },
  { month: "dic", planned: 77.4652, actual: null },
  { month: "ene 27", planned: 80.2773, actual: null },
  { month: "feb", planned: 85.8407, actual: null },
  { month: "mar", planned: 90.0037, actual: null },
  { month: "abr", planned: 93.2599, actual: null },
  { month: "may", planned: 95.2534, actual: null },
  { month: "jun", planned: 97.3777, actual: null },
  { month: "jul", planned: 98.8721, actual: null },
  { month: "ago", planned: 100, actual: null },
];

export const workPackages: WorkPackage[] = [
  { name: "Infraestructura", progress: 55, finish: "07/10/2026", baselineFinish: "10/08/2026", deviationDays: 58, critical: false },
  { name: "Superestructura", progress: 45, finish: "26/11/2026", baselineFinish: "19/11/2026", deviationDays: 7, critical: false },
  { name: "Escalera", progress: 26, finish: "04/12/2026", baselineFinish: "27/11/2026", deviationDays: 7, critical: false },
  { name: "Albañilería", progress: 31, finish: "18/12/2026", baselineFinish: "11/12/2026", deviationDays: 7, critical: false },
  { name: "Estucado", progress: 26, finish: "12/01/2027", baselineFinish: "29/12/2026", deviationDays: 14, critical: false },
  { name: "Revestimientos", progress: 4, finish: "01/02/2027", baselineFinish: "22/01/2027", deviationDays: 10, critical: false },
  { name: "Vidrio y aluminio", progress: 0, finish: "09/02/2027", baselineFinish: "02/02/2027", deviationDays: 7, critical: true },
  { name: "Herrería", progress: 0, finish: "02/02/2027", baselineFinish: "25/01/2027", deviationDays: 8, critical: false },
  { name: "Impermeabilización", progress: 0, finish: "21/12/2026", baselineFinish: "14/12/2026", deviationDays: 7, critical: false },
  { name: "Instalación de gas y aguas residuales", progress: 23, finish: "08/12/2026", baselineFinish: "01/12/2026", deviationDays: 7, critical: false },
  { name: "Pintura", progress: 0, finish: "27/05/2027", baselineFinish: "20/05/2027", deviationDays: 7, critical: true },
  { name: "Piso de vinyl", progress: 0, finish: "16/04/2027", baselineFinish: "09/04/2027", deviationDays: 7, critical: true },
  { name: "Carpintería", progress: 0, finish: "03/05/2027", baselineFinish: "26/04/2027", deviationDays: 7, critical: false },
  { name: "Zócalo y masilla", progress: 0, finish: "07/05/2027", baselineFinish: "30/04/2027", deviationDays: 7, critical: false },
  { name: "Instalaciones eléctricas", progress: 0, finish: "11/05/2027", baselineFinish: "04/05/2027", deviationDays: 7, critical: true },
  { name: "Instalaciones sanitarias", progress: 0, finish: "07/05/2027", baselineFinish: "30/04/2027", deviationDays: 7, critical: false },
  { name: "Plafón en techo", progress: 0, finish: "10/05/2027", baselineFinish: "03/05/2027", deviationDays: 7, critical: false },
  { name: "Mampara baños", progress: 0, finish: "13/05/2027", baselineFinish: "06/05/2027", deviationDays: 7, critical: false },
  { name: "Texturizado", progress: 0, finish: "11/01/2027", baselineFinish: "28/12/2026", deviationDays: 14, critical: false },
  { name: "Patios y obras exteriores", progress: 0, finish: "03/02/2027", baselineFinish: "27/01/2027", deviationDays: 7, critical: false },
  { name: "Panel solar", progress: 0, finish: "18/05/2027", baselineFinish: "11/05/2027", deviationDays: 7, critical: false },
  { name: "Remates y limpieza", progress: 0, finish: "07/06/2027", baselineFinish: "31/05/2027", deviationDays: 7, critical: true },
];

export const timeline: TimelineEvent[] = [
  {
    id: "evt-cutoff",
    date: "30 jun",
    time: "corte",
    type: "avance",
    title: "Avance físico acumulado: 18,23%",
    detail: "El plan operativo acumulado era 21,24%; la brecha es de -3,00 puntos porcentuales.",
    building: "Proyecto",
    author: "Excel de gráficos",
  },
  {
    id: "evt-mpp-save",
    date: "14 jul",
    time: "14:39",
    type: "hito",
    title: "Cronograma MPP guardado",
    detail: "El archivo registra 17% de avance del cronograma y proyecta el final para el 07/06/2027.",
    building: "Proyecto",
    author: "Microsoft Project",
  },
  {
    id: "evt-baseline",
    date: "31 may",
    time: "2027",
    type: "hito",
    title: "Fin de línea base",
    detail: "La previsión vigente termina siete días naturales después de esta fecha.",
    building: "Proyecto",
    author: "Línea base MPP",
  },
  {
    id: "evt-forecast",
    date: "07 jun",
    time: "2027",
    type: "entrega",
    title: "Fin previsto del proyecto",
    detail: "Remates y limpieza figuran en camino crítico y cierran el cronograma.",
    building: "Proyecto",
    author: "Previsión MPP",
  },
];

export const suppliers: Supplier[] = [];

export const customMetrics: CustomMetric[] = [
  { id: "metric-physical", name: "Avance físico acumulado", value: "18,23", target: "21,24", trend: "down", unit: "%", owner: "Producción · Excel" },
  { id: "metric-schedule", name: "Avance del cronograma", value: "17", target: "21,24", trend: "down", unit: "%", owner: "Planificación · MPP" },
  { id: "metric-urban", name: "Urbanismo ejecutado", value: "18,28", target: "16,18", trend: "up", unit: "%", owner: "Producción · Excel" },
  { id: "metric-housing", name: "Vivienda ejecutada", value: "18,21", target: "23,55", trend: "down", unit: "%", owner: "Producción · Excel" },
  { id: "metric-cubicacion", name: "Cubicaciones acumuladas", value: "67.342.153,57", target: "71.731.477,87", trend: "down", unit: "moneda fuente", owner: "Finanzas · Excel" },
];

export const cubicaciones = [
  { period: "Diciembre", measured: 30338215.998886, accounting: 35003006.87 },
  { period: "Enero", measured: 3283239.8226520014, accounting: 2355501 },
  { period: "Febrero", measured: 11865723.723938, accounting: 8871467 },
  { period: "Marzo", measured: 21854974.027675997, accounting: 25501503 },
];

export const dataSources: DataSource[] = [
  {
    id: "source-xls",
    file: "01 - GRAFICOS ARAYA FASE II COMPLETO MODIFICADO JULIO.xls",
    kind: "Avance físico y cubicaciones",
    declaredCutoff: "30/06/2026",
    savedAt: "No indicado en celdas",
    status: "observada",
    records: "27 meses · 2 áreas · 4 cubicaciones",
    notes: [
      "La hoja de cubicaciones dice “FASE I (26 EDIFICIOS)” y el nombre del archivo dice “FASE II”.",
      "La moneda de las cubicaciones no está identificada; se conserva como moneda de la fuente.",
    ],
  },
  {
    id: "source-mpp",
    file: "Araya 26 edificios CORTE 30-06-2026 CAMBIO EDIFICIOS AFI.mpp",
    kind: "Cronograma maestro",
    declaredCutoff: "30/06/2026",
    savedAt: "14/07/2026 14:39",
    status: "observada",
    records: "2.228 tareas · 26 edificios · 156 apartamentos",
    notes: [
      "El archivo no tiene fecha de estado interna; el corte se toma del nombre del archivo.",
      "El 17% del MPP y el 18,23% del Excel son indicadores distintos y requieren conciliación.",
    ],
  },
  {
    id: "source-dwg-implantacion",
    file: "002 - IMPLANTACIÓN GENERAL.dwg",
    kind: "Plano general de implantación",
    declaredCutoff: "Sin fecha de corte declarada",
    savedAt: "28/07/2026 17:26",
    status: "validada",
    records: "TH-01 a TH-77 · viales · estacionamientos · urbanismo",
    notes: [
      "La implantación se contrastó con la fotografía aportada: coinciden el perímetro, la retícula vial y la distribución general.",
      "Sólo 26 edificios tienen datos de avance integrados; los otros 51 permanecen visibles como implantación sin estado operativo.",
      "Se conserva el DWG original de 17,59 MB para descarga y revisión en software CAD compatible.",
    ],
    downloadUrl: "/data-center/002-implantacion-general.dwg",
  },
];

export const projectSnapshot = {
  project: "ARAYA",
  declaredCutoff: "30/06/2026",
  lastUpdated: "14/07/2026 14:39",
  overallProgress: 18.23,
  plannedProgress: 21.24,
  scheduleProgress: 17,
  deviationPoints: -3.0,
  forecastFinish: "07/06/2027",
  baselineFinish: "31/05/2027",
  deviationDays: 7,
  masterPlanBuildingCount: 77,
  buildingCount: 26,
  buildingsPendingIntegration: 51,
  unitCount: 156,
  urbanismProgress: 18.28,
  urbanismPlanned: 16.18,
  cubicacionesMeasured: 67342153.573152,
  cubicacionesAccounting: 71731477.87,
  cubicacionesDifference: 4389324.296848,
  currency: "No indicada en la fuente",
  buildings,
  timeline,
  suppliers,
  metrics: customMetrics,
  workPackages,
  dataSources,
};
