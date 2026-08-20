import {
  activeBuildingsProgress,
  buildingProgressFromPhases,
  currentPhaseName,
  phasesFromValues,
  weightedUnitProgress,
  type PhaseProgress,
} from "../lib/progress-model.ts";

export type UnitStatus = "terminada" | "en_curso" | "bloqueada" | "pendiente";

export type UnitDiscipline = {
  id: "superestructura" | "albanileria" | "instalaciones" | "acabados";
  name: string;
  progress: number | null;
  status: "integrado" | "pendiente" | "conjunto";
};

export type UnitIssue = {
  id: string;
  title: string;
  severity: "critica" | "media" | "baja";
  status: "abierta" | "resuelta";
};

export type Unit = {
  id: string;
  code: string;
  floor: number;
  progress: number;
  status: UnitStatus;
  phase: string;
  deviationDays: number;
  responsible?: string;
  lastUpdated?: string;
  source?: string;
  disciplines?: UnitDiscipline[];
  issues?: UnitIssue[];
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
  mapCoordinates?: {
    visual: { x: number; y: number };
    technical: { x: number; y: number };
  };
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

export type UrbanismArea = {
  id: string;
  name: string;
  category: string;
  progress: number | null;
  planned: number | null;
  status: "integrado" | "pendiente";
  source: string;
  detail: string;
  pendingFields: string[];
  mapCoordinates?: {
    visual: { x: number; y: number; short: string };
    technical: { x: number; y: number; short: string };
  };
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

// Avance real de cada fase de cada edificio. Para los edificios 1 a 12 —los
// únicos con acabados en marcha— las cifras salen de la Cubicación Nº8 del
// Informe Ejecutivo de julio (corte 31/07/2026), que mide el avance físico
// ejecutado por oficio: obra común e infraestructura, superestructura,
// albañilería e instalaciones entran directas; los acabados son la media de las
// cinco disciplinas de terminación del informe (pintura, revestimientos,
// herrería, carpintería y misceláneos), que en su mayoría siguen a 0%. Los
// edificios 13 a 26, aún sin acabados, conservan la medición del plan de obra de
// Project (Araya 26 edificios · CORTE_30072026), atribuida por capítulo y
// promediada por duración. En ambos casos son la medición real, no una cifra
// derivada de un total: de ellas sale el porcentaje del edificio
// (lib/progress-model.ts). Su media sirve para leer el plano, pero no sustituye
// el avance físico oficial, que está ponderado por el monto total de obra.
//
// Columnas: [código, obra común, superestructura, albañilería, instalaciones, acabados].
const buildingPhaseRows: Array<[string, number, number, number, number, number]> = [
  ["3", 100, 100, 96.7, 34.7, 32.3],
  ["2", 100, 100, 96.7, 34.7, 21.7],
  ["4", 100, 100, 80, 34.7, 12.7],
  ["6", 100, 100, 80, 34.7, 14.8],
  ["1", 100, 100, 96.7, 34.7, 13.3],
  ["5", 100, 100, 80, 34.7, 13.1],
  ["9", 100, 100, 47, 33.1, 12.2],
  ["8", 100, 100, 47, 33.1, 9.6],
  ["7", 100, 100, 34.2, 33.1, 7.5],
  ["12", 100, 100, 17.4, 25.4, 5.2],
  ["11", 100, 100, 17.4, 25.4, 0.5],
  ["10", 100, 100, 17.4, 22.8, 5.2],
  ["15", 73.9, 90.5, 0, 0, 0],
  ["14", 73.9, 90.5, 0, 0, 0],
  ["13", 73.9, 90.5, 0, 0, 0],
  ["18", 0, 0, 0, 0, 0],
  ["17", 0, 0, 0, 0, 0],
  ["16", 0, 0, 0, 0, 0],
  ["71", 0, 0, 0, 0, 0],
  ["70", 0, 0, 0, 0, 0],
  ["73", 0, 0, 0, 0, 0],
  ["72", 0, 0, 0, 0, 0],
  ["75", 0, 0, 0, 0, 0],
  ["74", 0, 0, 0, 0, 0],
  ["77", 73.9, 0, 0, 0, 0],
  ["76", 73.9, 0, 0, 0, 0],
];

// Desvío de días y fin previsto por edificio, en el mismo orden.
const buildingScheduleRows: Array<[string, number, string]> = [
  ["3", 58, "12/11/2026"], ["2", 62, "26/11/2026"], ["4", 21, "26/11/2026"],
  ["6", 41, "26/11/2026"], ["1", 51, "26/11/2026"], ["5", 30, "26/11/2026"],
  ["9", 9, "26/11/2026"], ["8", 0, "26/11/2026"], ["7", -11, "26/11/2026"],
  ["12", -13, "03/12/2026"], ["11", 20, "18/01/2027"], ["10", 4, "18/01/2027"],
  ["15", 14, "10/02/2027"], ["14", 14, "19/02/2027"], ["13", 14, "02/03/2027"],
  ["18", 13, "10/03/2027"], ["17", 11, "19/03/2027"], ["16", 13, "30/03/2027"],
  ["71", 12, "07/04/2027"], ["70", 10, "16/04/2027"], ["73", 12, "27/04/2027"],
  ["72", 9, "05/05/2027"], ["75", 9, "14/05/2027"], ["74", 10, "24/05/2027"],
  ["77", 7, "01/06/2027"], ["76", 7, "07/06/2027"],
];

const apartmentCodes = ["101", "102", "201", "202", "301", "302"];

// Las cuatro disciplinas del apartamento son las fases reales del edificio menos
// la obra común, que es del edificio y no de ningún apartamento. Los seis
// apartamentos comparten valor: el plan mide a nivel de edificio, no de
// apartamento, y son el mismo plano repetido en tres plantas. El porcentaje del
// apartamento sale de esas cuatro disciplinas ponderadas (lib/progress-model.ts).
function makeUnits(building: string, phases: PhaseProgress[]): Unit[] {
  const disciplines: UnitDiscipline[] = phases
    .filter((fase) => fase.id !== "comun")
    .map((fase) => ({
      id: fase.id as UnitDiscipline["id"],
      name: fase.name,
      progress: fase.progress,
      status: "integrado",
    }));
  const unitProgress = weightedUnitProgress(disciplines);
  const estado: Unit["status"] =
    unitProgress >= 100 ? "terminada" : unitProgress > 0 ? "en_curso" : "pendiente";
  return apartmentCodes.map((apartment) => ({
    id: `${building}-${apartment}`,
    code: `${building}-${apartment}`,
    floor: Number(apartment[0]),
    progress: unitProgress,
    status: estado,
    phase: currentPhaseName(phases),
    deviationDays: 0,
    responsible: "Pendiente de asignar",
    lastUpdated: "30/07/2026",
    source: "Plan de obra Project · corte 30/07/2026",
    disciplines: disciplines.map((discipline) => ({ ...discipline })),
    issues: [],
  }));
}

const buildingSchedule = new Map(
  buildingScheduleRows.map(([code, deviationDays, forecastFinish]) => [code, { deviationDays, forecastFinish }]),
);

export const buildings: Building[] = buildingPhaseRows.map(([code, ...valores]) => {
  const phases = phasesFromValues(valores);
  const schedule = buildingSchedule.get(code) ?? { deviationDays: 0, forecastFinish: "" };
  return {
    id: `edificio-${code}`,
    name: `Edificio ${code}`,
    shortName: code,
    progress: buildingProgressFromPhases(phases),
    planProgress: null,
    deviationDays: schedule.deviationDays,
    forecastFinish: schedule.forecastFinish,
    units: makeUnits(code, phases),
  };
});

// Avance físico oficial del proyecto al corte de julio. Lo declara el Informe
// Ejecutivo y coincide con el último "Ejecutado Real" del Excel maestro de la
// Curva S. No se calcula promediando edificios: ese promedio describe el plano,
// pero no pondera el monto total de obra y por tanto no sustituye el KPI físico.
export const overallProgressNow = 22.71;

// Avance medio de los edificios ya en marcha (con obra empezada). Acompaña al
// global sin sustituirlo: el global mide el proyecto entero; éste, el ritmo de
// lo que se está construyendo. Se recalcula solo con cada cambio de edificio.
export const activeBuildingsProgressNow = activeBuildingsProgress(buildings) ?? overallProgressNow;

const planCurveMonths = [
  "jun 25", "jul", "ago", "sep", "oct", "nov", "dic", "ene 26", "feb", "mar",
  "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic", "ene 27",
  "feb", "mar", "abr", "may", "jun", "jul", "ago",
];

// El punto de julio (26,61%) es el Plan Operativo que declara el Informe
// Ejecutivo del corte, la misma cifra contra la que el informe mide la brecha
// (-3,9 pp) y la eficiencia del 85%. El resto de la curva conserva la forma de
// la línea base de Project mientras no llegue la reprogramación mensual
// completa; sólo el mes del corte —que es el que se compara con el ejecutado—
// se ancla al informe.
const planCurvePlanned = [
  0, 0.52, 1.21, 2.07, 2.76, 3.7, 4.11, 4.48, 4.97, 6.72, 11.07, 16.67, 23.29,
  26.61, 40.78, 52.44, 62.97, 74.74, 80.9, 83.02, 87.9, 92.75, 95.32, 97.31,
  98.75, 99.56, 100,
];

// Ejecutado real medido, mes a mes, hasta el corte anterior (jun 2025 → jun
// 2026). El último punto es el avance físico oficial del corte, no el promedio
// simple de edificios. En producción cada nuevo Excel/informe publica el punto
// mensual correspondiente y reemplaza esta línea base.
const planCurveActualsToDate = [
  0, 0.31, 0.94, 1.88, 2.51, 3.45, 3.83, 4.47, 6.05, 8.96, 11.59, 16, 18.23,
  overallProgressNow,
];

export const monthlyPlan = planCurveMonths.map((month, indice) => ({
  month,
  planned: planCurvePlanned[indice],
  actual: indice < planCurveActualsToDate.length ? planCurveActualsToDate[indice] : null,
}));

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

export const urbanismAreas: UrbanismArea[] = [
  {
    id: "urban-general",
    name: "Urbanismo general",
    category: "Indicador consolidado",
    progress: 18.28,
    planned: 16.18,
    status: "integrado",
    source: "Excel de avance físico",
    detail: "Indicador global disponible para el conjunto de las obras de urbanización.",
    pendingFields: ["Desglose por zona", "Responsable", "Coste", "Incidencias"],
  },
  {
    id: "urban-roads",
    name: "Viales y circulación",
    category: "Infraestructura exterior",
    progress: null,
    planned: null,
    status: "pendiente",
    source: "Identificado en plano DWG",
    detail: "Red viaria interior, accesos, glorietas y conexiones entre edificios.",
    pendingFields: ["Avance", "Plan", "Fechas", "Contratista", "Incidencias"],
  },
  {
    id: "urban-parking",
    name: "Estacionamientos",
    category: "Movilidad",
    progress: null,
    planned: null,
    status: "pendiente",
    source: "Identificado en plano DWG",
    detail: "Bandas de estacionamiento distribuidas junto a los conjuntos residenciales.",
    pendingFields: ["Cantidad", "Ejecutados", "Señalización", "Responsable"],
  },
  {
    id: "urban-landscape",
    name: "Paisajismo y áreas verdes",
    category: "Espacio público",
    progress: null,
    planned: null,
    status: "pendiente",
    source: "Identificado en plano y fotografía",
    detail: "Eje verde central, arbolado, jardines y espacios libres de la implantación.",
    pendingFields: ["Avance", "Especies", "Riego", "Contratista", "Mantenimiento"],
  },
  {
    id: "urban-facilities",
    name: "Equipamientos comunes",
    category: "Dotaciones",
    progress: null,
    planned: null,
    status: "pendiente",
    source: "Identificado en plano DWG",
    detail: "Edificaciones y espacios comunes situados a lo largo del eje central.",
    pendingFields: ["Uso", "Avance", "Plan", "Responsable", "Puesta en servicio"],
  },
  {
    id: "urban-access",
    name: "Acceso principal",
    category: "Accesos y control",
    progress: null,
    planned: null,
    status: "pendiente",
    source: "Identificado en plano DWG",
    detail: "Entrada sur, vial de aproximación y elementos de control de acceso.",
    pendingFields: ["Avance", "Seguridad", "Señalización", "Fecha operativa"],
  },
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
    detail: "El archivo registra 22,37% de avance del cronograma (corte 30/07) y proyecta el final para el 07/06/2027.",
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
  { id: "metric-schedule", name: "Avance del cronograma", value: "22,37", target: "21,24", trend: "up", unit: "%", owner: "Planificación · MPP" },
  { id: "metric-urban", name: "Urbanismo ejecutado", value: "18,28", target: "16,18", trend: "up", unit: "%", owner: "Producción · Excel" },
  { id: "metric-housing", name: "Apartamento ejecutado", value: "18,21", target: "23,55", trend: "down", unit: "%", owner: "Producción · Excel" },
  { id: "metric-cubicacion", name: "Cubicaciones acumuladas", value: "67.342.153,57", target: "71.731.477,87", trend: "down", unit: "DOP", owner: "Finanzas · Excel" },
];

// Certificaciones del proyecto.
//
// Llegó como "propuesta de sección nueva" del PDF de indicadores LEED y no tenía
// dónde vivir. Es información de proyecto con entidad propia —una certificación
// no es un avance ni una cifra financiera—, así que se le da su sección en vez
// de dejarla como bloque genérico. El dato es el que consta en el documento: no
// se le añade fecha ni nivel que el texto no dé.
export const projectCertifications = [
  { name: "LEED Gold", quantity: 3, cutoff: "", source: "Indicador nuevo LEED" },
] as const;

// Carátula de la cubicación mensual.
//
// La carátula de cada cubicación declara su monto y una relación de obra
// ejecutada (presupuesto, ejecutado del periodo y acumulados). De la Cubicación
// Nº8 la lectura recuperó el monto; los cuatro totales de la relación venían en
// el documento pero no llegaron estructurados, así que NO se inventan: cuando un
// lector de la carátula los extraiga, se añadirán aquí. El monto sí es real y ya
// tiene su sitio, junto a la serie de cubicaciones.
export const cubicacionCaratula = [
  { label: "Cubicación Nº8", montoDop: 33639335.5863896, cutoff: "2026-07-31" },
] as const;

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
      "La fuente no rotula la moneda; por la regla financiera del proyecto se interpreta como DOP y se conserva esa procedencia.",
    ],
    downloadUrl: "/data-center/junio-2026/avance-fisico-y-cubicaciones-junio-2026.xls",
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
      "El 22,37% del MPP y el 18,23% del Excel son indicadores distintos y requieren conciliación; el del MPP se recalcula con cada plan que se sube.",
    ],
    downloadUrl: "/data-center/junio-2026/cronograma-maestro-araya-30-06-2026.mpp",
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
  {
    id: "source-june-consolidated",
    file: "Araya_Informe_Junio_2026.pptx",
    kind: "Informe consolidado de junio",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "observada",
    records: "37 láminas · ventas · obra · finanzas · permisos",
    notes: [
      "Es la presentación consolidada de referencia; su contenido visual coincide con el PDF de 37 páginas.",
      "La lámina 29 declara RD$3.428,5 M de presupuesto, mientras la lámina 30 y el Excel detallado declaran RD$3.591,3 M.",
      "La lámina de proyección financiera conserva por error un pie “Mayo 2026”; los datos corresponden al informe de junio.",
    ],
    downloadUrl: "/data-center/junio-2026/araya-informe-junio-2026.pptx",
  },
  {
    id: "source-june-works",
    file: "Informe Obra Araya Junio 2026.pptx",
    kind: "Informe de obra",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "validada",
    records: "12 láminas · avance · desvíos · urbanismo · seguridad",
    notes: [
      "Amplía las láminas 17–26 del informe consolidado y aporta valores exactos de sus gráficos.",
      "Declara cinco días de retraso general; el MPP proyecta siete días. Ambos indicadores se conservan con procedencia.",
    ],
    downloadUrl: "/data-center/junio-2026/informe-obra-araya-junio-2026.pptx",
  },
  {
    id: "source-june-sales",
    file: "Informe Ventas Araya JUN2026 2.pptx",
    kind: "Informe comercial",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "observada",
    records: "13 láminas · reservas · vinculación · cobranza",
    notes: [
      "Las láminas comerciales coinciden con el consolidado salvo el detalle de morosidad.",
      "La morosidad de esta versión (31 clientes y USD 148.281,58) está superada por el consolidado actualizado al 06/07/2026.",
    ],
    downloadUrl: "/data-center/junio-2026/informe-ventas-araya-junio-2026.pptx",
  },
  {
    id: "source-june-finance",
    file: "INFORME_JUN_2026_ARAYA_v1_1.xlsx",
    kind: "Control financiero detallado",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "observada",
    records: "7 hojas · 6.074 celdas con datos · 2.554 fórmulas",
    notes: [
      "Fuente principal para presupuesto, costes, cuentas por pagar, anticipos, balance y proyección de caja.",
      "La hoja de intereses contiene tres resultados #REF! en U37:W37; se excluyen del control operativo.",
      "La hoja “1. RESUMEN EJECUTIVO (2)” está oculta y duplica el resumen visible.",
    ],
    downloadUrl: "/data-center/junio-2026/informe-junio-2026-araya.xlsx",
  },
  {
    id: "source-antonely-june-finance",
    file: "Datos para Informe Jun-26.xlsx",
    kind: "Soporte financiero departamental · Antonely",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "observada",
    records: "4 hojas · costes · 96 facturas · anticipos · balance",
    notes: [
      "Se integra como fuente de Finanzas y Administración y se conserva el original para trazabilidad.",
      "Anticipos y balance coinciden con el control existente; costes y cuentas por pagar requieren conciliación con el consolidado.",
      "La hoja de costes declara por error un inicio en junio de 2016; no se corrige silenciosamente.",
    ],
    downloadUrl: "/data-center/junio-2026/datos-para-informe-jun-26.xlsx",
  },
  {
    id: "source-may-cashflow",
    file: "Lamina Flujo.pptx",
    kind: "Flujo financiero histórico",
    declaredCutoff: "Mayo 2026",
    savedAt: "29/07/2026 14:33",
    status: "observada",
    records: "1 lámina · proyección anterior",
    notes: [
      "El archivo está rotulado “Informe Financiero | Mayo 2026”; se conserva como histórico.",
      "No sustituye los valores de junio del Excel ni del informe consolidado.",
    ],
    downloadUrl: "/data-center/junio-2026/lamina-flujo-mayo-2026.pptx",
  },
  {
    id: "source-june-pdf",
    file: "Presentación Informe Araya Junio 2026.pdf",
    kind: "Informe consolidado en PDF",
    declaredCutoff: "30/06/2026",
    savedAt: "29/07/2026 14:33",
    status: "validada",
    records: "37 páginas",
    notes: [
      "Versión renderizada del informe consolidado; se verificaron visualmente sus 37 páginas.",
      "Se conserva para consulta rápida y trazabilidad documental.",
    ],
    downloadUrl: "/data-center/junio-2026/presentacion-informe-araya-junio-2026.pdf",
  },
  {
    id: "source-supplier-contacts",
    file: "CONTACTOS DE PROVEEDORES PROYECTO ARAYA (2).xls",
    kind: "Maestro de proveedores y contactos",
    declaredCutoff: "30/07/2026",
    savedAt: "30/07/2026",
    status: "observada",
    records: "6 hojas · 71 registros fuente · 67 proveedores únicos",
    notes: [
      "Se revisaron todas las hojas; cuatro son plantillas sin altas materiales y se conservan para futuras incorporaciones.",
      "Hay 37 filas sin RNC, 13 sin correo y un RNC compartido por dos empresas. El dashboard mantiene estas incidencias visibles.",
      "Las condiciones y límites de crédito se muestran únicamente a usuarios autorizados para Finanzas.",
    ],
    downloadUrl: "/data-center/julio-2026/contactos-proveedores-araya.xls",
  },
  {
    id: "source-budget-type-a",
    file: "COMPARATIVO PRESUPUESTO EDIF. TIPO A ARAYA.xls",
    kind: "Presupuesto técnico · edificio tipo A",
    declaredCutoff: "30/07/2026",
    savedAt: "30/07/2026",
    status: "validada",
    records: "209 hojas · 164 partidas · 15 capítulos",
    notes: [
      "Se verificó el consolidado y cada ficha de análisis de precio unitario, incluidas sus revisiones históricas.",
      "El presupuesto actualizado es RD$20.065.326,06 por edificio, RD$162.223,54 por encima del original.",
      "Las hojas con sufijos (2) y (3) se conservan como versiones históricas porque algunas contienen variaciones reales.",
    ],
    downloadUrl: "/data-center/julio-2026/comparativo-presupuesto-edificio-tipo-a.xls",
  },
  {
    id: "source-ifc-analysis",
    file: "Informe-2026-07-29.pdf",
    kind: "Análisis de obligaciones del préstamo IFC",
    declaredCutoff: "29/07/2026",
    savedAt: "29/07/2026",
    status: "observada",
    records: "2 páginas · compromisos · reportes · seguros · negociación",
    notes: [
      "Se integra como apoyo de cumplimiento; no sustituye la revisión del contrato original ni el criterio jurídico.",
      "Destaca reportes mensuales, estados auditados anuales y notificación de incidentes significativos en tres días.",
      "Por su contenido financiero y contractual, el documento queda restringido a usuarios con permiso de Finanzas.",
    ],
    downloadUrl: "/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf",
  },
  {
    id: "source-procurement-comparison",
    file: "CUADRO COMPARATIVO-PROVEEDORES 30-07-2026.xlsx",
    kind: "Comparativos y flujo de compras",
    declaredCutoff: "30/07/2026",
    savedAt: "30/07/2026",
    status: "observada",
    records: "12 hojas · 14 paquetes · 58 ofertas · 2.237 fórmulas",
    notes: [
      "El flujo mensual auditado suma RD$202.373.400,47 para 26 edificios.",
      "La fórmula de total del archivo omite RD$4.095.000 de revestimiento de pared de ducha, aunque la partida sí figura en los pagos mensuales.",
      "Se excluyen cuatro valores de prueba y se señalan seis fechas cuyo año no coincide con el calendario de pagos.",
    ],
    downloadUrl: "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30.xlsx",
  },
  {
    id: "source-procurement-comparison-duplicate",
    file: "CUADRO COMPARATIVO-PROVEEDORES 30-07-2026 (2).xlsx",
    kind: "Copia idéntica del comparativo de proveedores",
    declaredCutoff: "30/07/2026",
    savedAt: "30/07/2026",
    status: "observada",
    records: "Duplicado exacto · SHA-256 coincidente",
    notes: [
      "El tamaño y la huella SHA-256 coinciden exactamente con el comparativo sin sufijo.",
      "Se conserva el archivo recibido para trazabilidad, pero no genera registros ni importes adicionales.",
    ],
    downloadUrl: "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30-copia.xlsx",
  },
  {
    id: "source-supplier-analysis",
    file: "Informe-2026-07-30.pdf",
    kind: "Análisis del maestro de proveedores",
    declaredCutoff: "30/07/2026",
    savedAt: "30/07/2026",
    status: "observada",
    records: "2 páginas · segmentación · crédito · recomendaciones",
    notes: [
      "El informe se conserva como lectura analítica y se contrasta con el maestro antes de alimentar indicadores.",
      "La afirmación de que la mayoría ofrece crédito a 30 días solo es válida dentro de las relaciones con crédito explícito, no sobre todo el directorio.",
    ],
    downloadUrl: "/data-center/julio-2026/informe-analisis-proveedores-2026-07-30.pdf",
  },
  {
    id: "source-june-deviation",
    file: "CUADRO RESUMEN DESVIACION MENSUAL JUNIO 2026.xlsx",
    kind: "Desviación mensual de presupuesto",
    declaredCutoff: "30/06/2026",
    savedAt: "30/07/2026",
    status: "observada",
    records: "2 hojas · 24 partidas · 360 fórmulas",
    notes: [
      "Las fórmulas vigentes arrojan un incremento de RD$60.450,62 por edificio (+0,30%) y un impacto ponderado de ahorro de RD$1.613.789,94.",
      "Los comentarios finales del archivo están desactualizados y no coinciden con sus propias fórmulas; el dashboard usa los resultados calculados.",
      "El análisis se presenta separado del comparativo técnico de 209 hojas porque corresponde a una versión y un alcance de junio distintos.",
    ],
    downloadUrl: "/data-center/julio-2026/desviacion-mensual-junio-2026.xlsx",
  },
  {
    id: "source-reprogrammed-flow-phase-1",
    file: "ARAYA_Flujo_I_reprogramado_con_fase_II.xlsx",
    kind: "Flujo de obra reprogramado · Fase I",
    declaredCutoff: "31/07/2026",
    savedAt: "31/07/2026 12:17",
    status: "observada",
    records: "6 hojas · 1.228 fórmulas · real dic-25/jul-26 · proyección ago-26/jul-27",
    notes: [
      "El alcance se limita a Urbanismo y Edificios de la Fase I; no sustituye el flujo de caja ni el presupuesto global del proyecto.",
      "La reprogramación conserva el total de RD$751.309.284,94 y concentra RD$70.674.794,13 de desviación acumulada en agosto y septiembre de 2026.",
      "La portada describe una redistribución solo del sobrante de los últimos meses, pero las fórmulas redistribuyen la desviación acumulada desde diciembre de 2025. El dashboard usa las fórmulas vigentes.",
      "Dos importes de la hoja Reprogramación tienen formato porcentual erróneo y Hoja1 contiene cálculos auxiliares sin etiquetas; ninguno altera los indicadores.",
      "El archivo no contiene medición física, cantidades ejecutadas ni porcentajes de avance.",
    ],
    downloadUrl: "/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx",
  },
  {
    id: "source-fiduciary-trial-balance",
    file: "Balance de comprobación junio 2026.pdf",
    kind: "Fideicomiso · balance de comprobación oficial",
    declaredCutoff: "30/06/2026",
    savedAt: "20/07/2026",
    status: "validada",
    records: "2 páginas · 47 cuentas · Debe = Haber",
    notes: [
      "Reporte oficial de Fiduciaria Universal emitido el 20/07/2026.",
      "Las sumas del periodo cuadran exactamente: Debe y Haber ascienden a RD$311.209.328,75.",
      "Es la fuente oficial del mayor contable; no sustituye los controles operativos de presupuesto y costes.",
    ],
    downloadUrl: "/data-center/junio-2026/fideicomiso/balance-comprobacion-junio-2026.pdf",
  },
  {
    id: "source-fiduciary-balance-sheet",
    file: "Balance general junio 2026.pdf",
    kind: "Fideicomiso · estado de situación oficial",
    declaredCutoff: "30/06/2026",
    savedAt: "20/07/2026",
    status: "validada",
    records: "1 página · activos · pasivos · patrimonio",
    notes: [
      "Reporte oficial de Fiduciaria Universal en pesos dominicanos.",
      "Cuadra exactamente: activos RD$758.765.771,05 = pasivos RD$448.317.797,67 + patrimonio neto RD$310.447.973,38.",
      "El balance del Excel de gestión se conserva en paralelo y no se mezcla con este estado contable.",
    ],
    downloadUrl: "/data-center/junio-2026/fideicomiso/balance-general-junio-2026.pdf",
  },
  {
    id: "source-fiduciary-income-accumulated",
    file: "Estado de resultados acumulado junio 2026.pdf",
    kind: "Fideicomiso · resultados acumulados oficiales",
    declaredCutoff: "01/01/2026–30/06/2026",
    savedAt: "20/07/2026",
    status: "validada",
    records: "1 página · ingresos · gastos · resultado acumulado",
    notes: [
      "Ingresos acumulados RD$43.835.537,20 y gastos RD$49.964.983,46.",
      "El resultado de -RD$6.129.446,26 coincide con el beneficio del periodo incorporado al estado de situación.",
    ],
    downloadUrl: "/data-center/junio-2026/fideicomiso/estado-resultados-acumulado-junio-2026.pdf",
  },
  {
    id: "source-fiduciary-income-monthly",
    file: "Estado de resultados junio 2026.pdf",
    kind: "Fideicomiso · resultados mensuales oficiales",
    declaredCutoff: "01/06/2026–30/06/2026",
    savedAt: "20/07/2026",
    status: "validada",
    records: "1 página · ingresos · gastos · resultado de junio",
    notes: [
      "Ingresos de junio RD$4.701.963,91 y gastos RD$10.774.703,46.",
      "La pérdida del mes es RD$6.072.739,55 y se presenta separada del resultado acumulado.",
    ],
    downloadUrl: "/data-center/junio-2026/fideicomiso/estado-resultados-junio-2026.pdf",
  },
];

export const projectSnapshot = {
  project: "ARAYA",
  declaredCutoff: "31/07/2026",
  lastUpdated: "31/07/2026",
  // Avance físico global del corte de julio. En producción lo recalcula el
  // ciclo en vivo desde el último "Ejecutado Real" de la Curva S; estos valores
  // son el punto de partida y se mantienen alineados con ese corte.
  overallProgress: overallProgressNow,
  activeBuildingsProgress: activeBuildingsProgressNow,
  apartmentAverageProgress: 18.8,
  plannedProgress: 26.61,
  scheduleProgress: 22.37,
  deviationPoints: Math.round((overallProgressNow - 26.61) * 100) / 100,
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
  currency: "DOP",
  buildings,
  timeline,
  suppliers,
  metrics: customMetrics,
  workPackages,
  urbanismAreas,
  dataSources,
};
