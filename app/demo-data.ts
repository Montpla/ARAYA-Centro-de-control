import {
  currentPhaseName,
  phasesFromBuildingProgress,
  unitProgressFromBuildingProgress,
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

// El avance de cada apartamento y de cada disciplina se deriva del porcentaje
// real del edificio (el de la cubicación), en cascada por fases de obra. Así
// las tres cifras dejan de contradecirse: el edificio ya no puede ir al 40,6%
// con sus apartamentos al 100%. La regla vive en lib/progress-model.ts, un solo
// sitio donde cambiar los pesos el día que la oficina fije los suyos.
function makeUnits(building: string, buildingProgress: number): Unit[] {
  const unitProgress = unitProgressFromBuildingProgress(buildingProgress);
  const fases = phasesFromBuildingProgress(buildingProgress);
  const faseDe = (id: string) => fases.find((fase) => fase.id === id)?.progress ?? 0;
  const estado: Unit["status"] =
    unitProgress >= 100 ? "terminada" : unitProgress > 0 ? "en_curso" : "pendiente";
  return apartmentCodes.map((apartment) => ({
    id: `${building}-${apartment}`,
    code: `${building}-${apartment}`,
    floor: Number(apartment[0]),
    progress: unitProgress,
    status: estado,
    phase: currentPhaseName(buildingProgress),
    deviationDays: 0,
    responsible: "Pendiente de asignar",
    lastUpdated: "30/06/2026",
    source: "Cubicación de obra · junio 2026",
    disciplines: [
      { id: "superestructura", name: "Superestructura", progress: faseDe("superestructura"), status: "integrado" },
      { id: "albanileria", name: "Albañilería", progress: faseDe("albanileria"), status: "integrado" },
      { id: "instalaciones", name: "Instalaciones", progress: faseDe("instalaciones"), status: "integrado" },
      { id: "acabados", name: "Acabados", progress: faseDe("acabados"), status: "integrado" },
    ],
    issues: [],
  }));
}

export const buildings: Building[] = buildingRows.map(
  ([code, progress, deviationDays, forecastFinish]) => ({
    id: `edificio-${code}`,
    name: `Edificio ${code}`,
    shortName: code,
    progress,
    planProgress: null,
    deviationDays,
    forecastFinish,
    units: makeUnits(code, progress),
  }),
);

export const monthlyPlan = [
  { month: "jun 25", planned: 0, actual: 0 },
  { month: "jul", planned: 0.52, actual: 0.31 },
  { month: "ago", planned: 1.21, actual: 0.94 },
  { month: "sep", planned: 2.07, actual: 1.88 },
  { month: "oct", planned: 2.76, actual: 2.51 },
  { month: "nov", planned: 3.7, actual: 3.45 },
  { month: "dic", planned: 4.11, actual: 3.83 },
  { month: "ene 26", planned: 4.48, actual: 4.47 },
  { month: "feb", planned: 4.97, actual: 6.05 },
  { month: "mar", planned: 6.72, actual: 8.96 },
  { month: "abr", planned: 11.07, actual: 11.59 },
  { month: "may", planned: 16.67, actual: 16 },
  { month: "jun", planned: 23.29, actual: 18.23 },
  { month: "jul", planned: 31.41, actual: null },
  { month: "ago", planned: 40.78, actual: null },
  { month: "sep", planned: 52.44, actual: null },
  { month: "oct", planned: 62.97, actual: null },
  { month: "nov", planned: 74.74, actual: null },
  { month: "dic", planned: 80.9, actual: null },
  { month: "ene 27", planned: 83.02, actual: null },
  { month: "feb", planned: 87.9, actual: null },
  { month: "mar", planned: 92.75, actual: null },
  { month: "abr", planned: 95.32, actual: null },
  { month: "may", planned: 97.31, actual: null },
  { month: "jun", planned: 98.75, actual: null },
  { month: "jul", planned: 99.56, actual: null },
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
  { id: "metric-housing", name: "Apartamento ejecutado", value: "18,21", target: "23,55", trend: "down", unit: "%", owner: "Producción · Excel" },
  { id: "metric-cubicacion", name: "Cubicaciones acumuladas", value: "67.342.153,57", target: "71.731.477,87", trend: "down", unit: "DOP", owner: "Finanzas · Excel" },
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
      "El 17% del MPP y el 18,23% del Excel son indicadores distintos y requieren conciliación.",
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
    file: "ARAYA_-Flujo I reprogramado.xlsx",
    kind: "Flujo de obra reprogramado · Fase I",
    declaredCutoff: "30/06/2026",
    savedAt: "30/07/2026 12:17",
    status: "observada",
    records: "6 hojas · 1.137 fórmulas · real dic-25/jun-26 · proyección jul-26/jul-27",
    notes: [
      "El alcance se limita a Urbanismo y Edificios de la Fase I; no sustituye el flujo de caja ni el presupuesto global del proyecto.",
      "La reprogramación conserva el total de RD$751.309.284,94 y concentra RD$58.108.348,13 de desviación acumulada en agosto y septiembre de 2026.",
      "La portada describe una redistribución solo del sobrante de junio, pero las fórmulas redistribuyen la desviación acumulada desde diciembre de 2025. El dashboard usa las fórmulas vigentes.",
      "Dos importes de la hoja Reprogramación tienen formato porcentual erróneo y Hoja1 contiene cálculos auxiliares sin etiquetas; ninguno altera los indicadores.",
      "El archivo no contiene medición física, cantidades ejecutadas ni porcentajes de avance. El avance físico permanece en 18,23%.",
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
  declaredCutoff: "30/06/2026",
  lastUpdated: "30/07/2026 12:17",
  overallProgress: 18.23,
  apartmentAverageProgress: 18.23,
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
  currency: "DOP",
  buildings,
  timeline,
  suppliers,
  metrics: customMetrics,
  workPackages,
  urbanismAreas,
  dataSources,
};
