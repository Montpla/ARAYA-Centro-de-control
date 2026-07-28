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
  planProgress: number;
  deviationDays: number;
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

const phases = [
  "Estructura",
  "Cerramientos",
  "Instalaciones",
  "Acabados",
  "Revisión final",
];

function makeUnits(building: string, total: number, baseProgress: number): Unit[] {
  return Array.from({ length: total }, (_, index) => {
    const floor = Math.floor(index / 4) + 1;
    const door = (index % 4) + 1;
    const progress = Math.max(
      8,
      Math.min(100, baseProgress + ((index * 13) % 29) - 14),
    );
    const deviationDays = index % 11 === 0 ? 9 : index % 7 === 0 ? 4 : 0;
    const status: UnitStatus =
      deviationDays >= 9
        ? "bloqueada"
        : progress === 100
          ? "terminada"
          : progress > 20
            ? "en_curso"
            : "pendiente";
    return {
      id: `${building}-${index + 1}`,
      code: `${building}-${floor}0${door}`,
      floor,
      progress,
      status,
      phase: phases[Math.min(phases.length - 1, Math.floor(progress / 21))],
      deviationDays,
    };
  });
}

export const buildings: Building[] = [
  {
    id: "edificio-a",
    name: "Edificio A · Levante",
    shortName: "A",
    progress: 68,
    planProgress: 71,
    deviationDays: 3,
    units: makeUnits("A", 16, 70),
  },
  {
    id: "edificio-b",
    name: "Edificio B · Poniente",
    shortName: "B",
    progress: 54,
    planProgress: 63,
    deviationDays: 9,
    units: makeUnits("B", 16, 55),
  },
  {
    id: "edificio-c",
    name: "Edificio C · Jardines",
    shortName: "C",
    progress: 42,
    planProgress: 44,
    deviationDays: 2,
    units: makeUnits("C", 12, 43),
  },
  {
    id: "zonas-comunes",
    name: "Zonas comunes",
    shortName: "ZC",
    progress: 31,
    planProgress: 37,
    deviationDays: 6,
    units: makeUnits("ZC", 4, 32),
  },
];

export const timeline: TimelineEvent[] = [
  {
    id: "evt-1",
    date: "28 jul",
    time: "11:40",
    type: "avance",
    title: "Forjado de planta 4 completado",
    detail: "Validación técnica cerrada con 12 comprobaciones conformes.",
    building: "Edificio A",
    author: "Dirección facultativa",
  },
  {
    id: "evt-2",
    date: "28 jul",
    time: "09:15",
    type: "incidencia",
    title: "Entrega de carpintería reprogramada",
    detail: "El proveedor confirma nueva llegada para el 2 de agosto. Impacto estimado: +4 días.",
    building: "Edificio B",
    author: "Compras",
  },
  {
    id: "evt-3",
    date: "27 jul",
    time: "17:20",
    type: "hito",
    title: "Inicio de instalaciones verticales",
    detail: "Fontanería y electricidad liberadas en los núcleos 1 y 2.",
    building: "Edificio C",
    author: "Jefatura de obra",
  },
  {
    id: "evt-4",
    date: "27 jul",
    time: "13:05",
    type: "entrega",
    title: "Recepción parcial de cerámica",
    detail: "Lote 03 recibido: 1.840 m², control de calidad conforme.",
    building: "Proyecto",
    author: "Almacén",
  },
  {
    id: "evt-5",
    date: "26 jul",
    time: "16:30",
    type: "incidencia",
    title: "Interferencia en patinillo técnico",
    detail: "Pendiente solución coordinada entre estructura e instalaciones.",
    building: "Edificio B",
    author: "BIM / Producción",
  },
];

export const suppliers: Supplier[] = [
  {
    id: "prov-1",
    name: "Hormigones del Este",
    category: "Estructura",
    contact: "María Ortega",
    status: "al_dia",
    score: 94,
    nextDelivery: "29 jul · 07:30",
    amount: "186.400 €",
  },
  {
    id: "prov-2",
    name: "Carpinterías Vega",
    category: "Carpintería exterior",
    contact: "Carlos Vega",
    status: "retraso",
    score: 71,
    nextDelivery: "02 ago · 08:00",
    amount: "248.900 €",
  },
  {
    id: "prov-3",
    name: "ElectroSur Instalaciones",
    category: "Electricidad",
    contact: "Andrea Romero",
    status: "al_dia",
    score: 89,
    nextDelivery: "31 jul · 10:00",
    amount: "312.600 €",
  },
  {
    id: "prov-4",
    name: "Cerámicas Bahía",
    category: "Acabados",
    contact: "Nuria León",
    status: "revision",
    score: 82,
    nextDelivery: "05 ago · pendiente",
    amount: "154.300 €",
  },
];

export const customMetrics: CustomMetric[] = [
  {
    id: "metric-1",
    name: "Avance físico",
    value: "55",
    target: "59",
    trend: "up",
    unit: "%",
    owner: "Producción",
  },
  {
    id: "metric-2",
    name: "Certificación acumulada",
    value: "4,82",
    target: "5,10",
    trend: "up",
    unit: "M €",
    owner: "Finanzas",
  },
  {
    id: "metric-3",
    name: "Incidencias críticas",
    value: "2",
    target: "0",
    trend: "down",
    unit: "",
    owner: "Calidad",
  },
  {
    id: "metric-4",
    name: "Seguridad · días sin baja",
    value: "43",
    target: "60",
    trend: "up",
    unit: "días",
    owner: "PRL",
  },
];

export const monthlyPlan = [
  { month: "Feb", planned: 12, actual: 11 },
  { month: "Mar", planned: 21, actual: 20 },
  { month: "Abr", planned: 31, actual: 29 },
  { month: "May", planned: 42, actual: 39 },
  { month: "Jun", planned: 51, actual: 48 },
  { month: "Jul", planned: 59, actual: 55 },
  { month: "Ago", planned: 68, actual: null },
  { month: "Sep", planned: 77, actual: null },
];

export const projectSnapshot = {
  project: "ARAYA",
  lastUpdated: "28/07/2026 11:42",
  overallProgress: 55,
  plannedProgress: 59,
  deviationDays: 8,
  budgetExecuted: 47.2,
  openIncidents: 11,
  criticalIncidents: 2,
  buildings,
  timeline,
  suppliers,
  metrics: customMetrics,
};

