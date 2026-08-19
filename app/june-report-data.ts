export const juneReport = {
  cutoff: "30/06/2026",
  published: "Junio 2026",
  physical: {
    actual: 18.23,
    planned: 21.24,
    gap: -3,
    efficiency: 86,
    reportDelayDays: 5,
    mppDelayDays: 7,
  },
  sales: {
    reservations: 279,
    active: 228,
    withdrawn: 51,
    averageMonthly: 16.5,
    activeAverageMonthly: 14.25,
    phaseOneActive: 136,
    phaseOneSales: 87,
    phaseTwoActive: 92,
    phaseTwoSales: 54,
    juneReservations: 18,
  },
  contracts: {
    reviewed: 198,
    pendingReview: 30,
    linked: 161,
    linking: 11,
    signing: 26,
    inReview: 6,
    awaitingDocuments: 24,
  },
  collections: {
    contracts: 172,
    current: 106,
    installmentsPending: 42,
    overdue: 24,
    overdueUsd: 136840.39,
    cutoff: "06/07/2026",
    // Dos indicadores que el informe declara como frase ("la morosidad no supera
    // el 1%", "se ha logrado el recaudo de más del 92% de lo proyectado"). El
    // lector de ventas los saca del texto cada mes; aquí quedan como línea base.
    arrearsMaxPercent: 1,
    collectedVsProjectedPercent: 92,
  },
  finance: {
    budgetDop: 3591280577.17,
    executedDop: 712326162.73,
    remainingDop: 2878954414.44,
    juneExecutedDop: 48998910.52,
    incomeAccumulatedDop: 746357587.11,
    paymentsAccumulatedDop: 702968643.04,
    projectedCashDecemberDop: -125196511.23,
    cxpDop: 18597489.63,
    advancesPendingDop: 9210448.86,
    liquidityDop: 48234289.3,
    assetsDop: 759714674.92,
    liabilitiesDop: 446209904.61,
    equityDop: 313504770.31,
    clientDepositsDop: 220997695.74,
  },
} as const;

// Bloques que la lectura descubre y para los que no existe ningún campo.
//
// Antes, cuando un documento traía información que el modelo no contemplaba, se
// apartaba como propuesta y esperaba a que alguien la mirara: quedaba fuera del
// panel indefinidamente sin que nada lo indicara. Este contenedor existe para
// que eso deje de pasar — el bloque entra solo, con su procedencia y su
// confianza a la vista, y se ve desde el primer momento.
//
// Empieza vacío a propósito: no hay ningún bloque descubierto que no tenga ya
// su sitio propio. Crece al ritmo de lo que traigan los documentos.
export type DiscoveredSection = {
  id: string;
  title: string;
  description: string;
  area: string;
  evidence: string;
  confidence: number;
  sourceName: string;
  detectedAt: string;
  values: Array<{ label: string; value: string }>;
};

export const discoveredSections: DiscoveredSection[] = [];

// Metas de recaudación por fase.
//
// Venían en el informe de ventas y el programa no tenía dónde ponerlas: las
// dejó apartadas como "propuesta de sección nueva" y allí se quedaron, sin que
// nadie las viera. Creando el campo, además de mostrarse, la lectura del mes
// que viene ya sabe dónde colocarlas.
//
// La lámina las declara en millones con un decimal ("FASE I US$22.1M"), que es
// la precisión que hay; no se le añade ninguna que el documento no dé.
export const collectionTargets = [
  { label: "Fase I", targetUsd: 22_100_000 },
  { label: "Fase II", targetUsd: 25_200_000 },
] as const;

// Aliados comerciales captados en el mes.
//
// El informe dice cuántos se captaron y trae el listado, pero de ese listado
// sólo llegó el recuento: los nombres no se recuperaron en la extracción. Se
// guarda lo que consta —el número— y queda el campo preparado para los nombres
// cuando la lectura los traiga, en vez de inventarlos.
export const commercialPartners = [
  { period: "2026-07", captured: 10, names: "" },
] as const;

export const salesModels = [
  { name: "Sunset", value: 32, june: 10 },
  { name: "Balcony Flex", value: 32, june: 6 },
  { name: "Garden", value: 28, june: 2 },
] as const;

export const salesLocations = [
  { name: "Interior", total: 49, garden: 13, sunset: 16, balcony: 20 },
  { name: "Parque Central + Vista", total: 20, garden: 6, sunset: 8, balcony: 6 },
  { name: "Parque Central", total: 13, garden: 4, sunset: 5, balcony: 4 },
  { name: "Lateral", total: 10, garden: 5, sunset: 3, balcony: 2 },
] as const;

export const arrearsBreakdown = [
  { name: "Separación", clients: 4, amountUsd: 50864.87 },
  { name: "Cuotas", clients: 15, amountUsd: 54163.38 },
  { name: "Realtors", clients: 5, amountUsd: 31812.19 },
] as const;

export const constructionDisciplines = [
  { name: "Infraestructura", progress: 56.34 },
  { name: "Superestructura", progress: 44.66 },
  { name: "Albañilería", progress: 22.17 },
  { name: "Inst. eléctricas, sanitarias y gas", progress: 14.11 },
  { name: "Pintura", progress: 13.85 },
  { name: "Revestimientos y cerámica", progress: 2.35 },
  { name: "Misceláneos", progress: 1.62 },
  { name: "Herrería", progress: 0.66 },
  { name: "Carpintería", progress: 0 },
] as const;

export const structuralDelay = [
  { building: "E8", days: 30 },
  { building: "E7", days: 23 },
  { building: "E12", days: 16 },
  { building: "E15", days: 10 },
  { building: "E14", days: 10 },
  { building: "E13", days: 10 },
  { building: "E11", days: 9 },
  { building: "E18", days: 9 },
  { building: "E17", days: 9 },
  { building: "E16", days: 9 },
  { building: "E71", days: 8 },
  { building: "E70", days: 8 },
  { building: "E73", days: 8 },
  { building: "E72", days: 7 },
  { building: "E75", days: 7 },
  { building: "E74", days: 6 },
  { building: "E77", days: 5 },
  { building: "E76", days: 5 },
  { building: "E10", days: 2 },
] as const;

export const urbanismReportAreas = [
  { name: "Movimiento de tierra", progress: 72.76 },
  { name: "Hidrosanitarias", progress: 25.03 },
  { name: "Paisajismo", progress: 12.24 },
  { name: "Vialidad", progress: 6.33 },
  { name: "Sistemas especiales", progress: 3.51 },
  { name: "Infraestructura eléctrica", progress: 0 },
  { name: "Telecomunicaciones", progress: 0 },
  { name: "Gas", progress: 0 },
  { name: "Obras exteriores", progress: 0 },
] as const;

export const delayedUrbanismStarts = [
  { area: "Nivelación y compactación · E70–E71", start: "20/04/2026", days: 70 },
  { area: "Nivelación y compactación · E72–E73", start: "23/04/2026", days: 67 },
  { area: "Avenida 2", start: "23/04/2026", days: 67 },
  { area: "Nivelación y compactación · E74–E75", start: "28/04/2026", days: 62 },
  { area: "Nivelación y compactación · E76–E77", start: "01/05/2026", days: 59 },
  { area: "Calle 1", start: "07/05/2026", days: 53 },
  { area: "Calle 3", start: "13/05/2026", days: 47 },
  { area: "Calle 5", start: "19/05/2026", days: 41 },
  { area: "Calle 7", start: "25/05/2026", days: 35 },
  { area: "Calle 2", start: "29/05/2026", days: 31 },
  { area: "Calle 4", start: "09/06/2026", days: 20 },
  { area: "Calle 6", start: "15/06/2026", days: 14 },
  { area: "Avenida 10", start: "19/06/2026", days: 10 },
] as const;

export const financialProjection = [
  { month: "Jul", income: 118000000, costs: 143700628.5, net: -25700628.5, cumulative: 23499178.12 },
  { month: "Ago", income: 118000000, costs: 101926544.92, net: 16073455.08, cumulative: 39572633.2 },
  { month: "Sep", income: 8000000, costs: 106054700.1, net: -98054700.1, cumulative: -58482066.9 },
  { month: "Oct", income: 18000000, costs: 96702272.57, net: -78702272.57, cumulative: -137184339.47 },
  { month: "Nov", income: 178000000, costs: 96017781.13, net: 81982218.87, cumulative: -55202120.6 },
  { month: "Dic", income: 18000000, costs: 87994390.63, net: -69994390.63, cumulative: -125196511.23 },
] as const;

export const costBreakdown = [
  { name: "Construcción", cumulative: 486337251.8, june: 32332892.34 },
  { name: "Operación", cumulative: 185400954.79, june: 14734752.42 },
  { name: "Otros", cumulative: 40587955.14, june: 1931265.76 },
] as const;

export const cxpAging = [
  { name: "Corriente", amount: 11183495.34, percent: 60.13 },
  { name: "Menos de 1 mes", amount: 7140113.04, percent: 38.39 },
  { name: "1 mes", amount: 147770.75, percent: 0.79 },
  { name: "2 meses o más", amount: 126110.5, percent: 0.68 },
] as const;

export const cxpCategories = [
  { name: "Edificaciones", amount: 9079360.65 },
  { name: "Comisiones", amount: 4011222.37 },
  { name: "Urbanismo", amount: 2409540.07 },
  { name: "Indirectos", amount: 806796.06 },
  { name: "Inspección", amount: 506964.3 },
] as const;

export const antonelyFinanceSource = {
  file: "Datos para Informe Jun-26.xlsx",
  area: "Finanzas y administración",
  owner: "Antonely",
  cutoff: "30/06/2026",
  previousAccumulatedDop: 663337405.87,
  juneCostsDop: 48988755.86,
  accumulatedCostsDop: 712326161.73,
  payablesDetailDop: 18627534.91,
  payablesLedgerDop: 18612245.9,
  advancesGrantedDop: 10035120.72,
  advancesPendingDop: 9210448.86,
  liquidityDop: 48234289.3,
  assetsDop: 759714674.92,
  liabilitiesDop: 446209904.61,
  equityDop: 313504770.31,
  sha256: "C87ABEA3FEA21BB44D598313C2FAA8719F22FF4B265C30EBD45358897B9D590F",
} as const;

export const payablesReconciliation = [
  { source: "Relación consolidada", amount: 18597489.63, role: "Control vigente" },
  { source: "Balance contable", amount: 18612245.9, role: "Mayor contable" },
  { source: "Archivo Antonely", amount: 18627534.91, role: "Detalle departamental" },
] as const;

export const antonelyPayableVendors = [
  { name: "Blue Wave Agregados", amount: 5366258.28 },
  { name: "Inversiones Romur", amount: 1862967.11 },
  { name: "Técnica MMHB", amount: 1452035.32 },
  { name: "Kiswer Investments", amount: 1333524.72 },
  { name: "PPCRE Paradise Punta Cana Real Estate", amount: 1078306.48 },
  { name: "Bellon", amount: 785241.67 },
  { name: "Kinnox", amount: 715000 },
  { name: "Inversiones Seracini", amount: 581828.5 },
  { name: "Navia Real Estate", amount: 530812.67 },
  { name: "Ing. Omar Cordero", amount: 506964.3 },
] as const;

export const advances = [
  { name: "Grupo Alugav", amount: 2195930.65 },
  { name: "Distrito Verón", amount: 1628532.75 },
  { name: "Inversiones Romur", amount: 1532228.98 },
  { name: "DASS", amount: 689910.09 },
  { name: "Félix Campos · anticipo 1", amount: 625800 },
  { name: "Félix Campos · anticipo 2", amount: 567718.8 },
] as const;

export const safetyMetrics = [
  { label: "Accidentes", value: "0", detail: "Semanas 3 y 4" },
  { label: "Personal", value: "120", detail: "Última semana · 80 en semana 1" },
  { label: "Horas-persona", value: "192", detail: "Acumuladas" },
  { label: "Observaciones", value: "22", detail: "Reportes de seguridad" },
  { label: "Reuniones", value: "21", detail: "Charlas y reuniones" },
  { label: "Inspecciones", value: "12", detail: "Ejecutadas" },
  { label: "Acciones", value: "3", detail: "Correctivas en proceso" },
] as const;

export const safetyFindings = [
  "Uso incompleto de equipos de protección personal.",
  "Escombros y residuos en zonas de circulación.",
  "Metales empotrados y exceso de clavos expuestos.",
  "Extensiones eléctricas deterioradas.",
  "El reporte de la semana 2 no fue incluido en la fuente.",
] as const;

// Seguimiento de cada hallazgo: quién lo cierra, para cuándo y con qué prueba.
//
// Es el único dato del área que no puede salir de ningún documento. El informe
// de obra dice qué se encontró —y eso ya se lee solo—, pero no dice quién se
// hace cargo ni cuándo queda cerrado: eso lo pone la obra desde el propio
// panel. El estado inicial no está inventado: sale del apartado "seguimiento a
// acciones" del informe de junio, que da por cerrada la entrega de EPP y deja
// en proceso la retirada de escombros.
export const safetyFindingTracking = [
  {
    finding: "Personal sin EPP",
    responsible: "",
    status: "Cerrado",
    dueDate: "",
    evidence: "Se suministraron los EPP a todo el personal (semana 4).",
  },
  {
    finding: "Escombros acumulados",
    responsible: "",
    status: "En proceso",
    dueDate: "",
    evidence: "Pendiente designar contratista para la retirada.",
  },
  {
    finding: "Metal incrustado",
    responsible: "",
    status: "Abierto",
    dueDate: "",
    evidence: "",
  },
] as const;

export const permits = [
  { entity: "Ayuntamiento de Higüey", reference: "No objeción", status: "Aprobado", date: "15/01/2024" },
  { entity: "Distrito Verón", reference: "No objeción", status: "Aprobado", date: "19/02/2024" },
  { entity: "Medio Ambiente", reference: "DEIA-3249-2023", status: "Aprobado", date: "22/10/2023" },
  { entity: "Turismo", reference: "DPPP01-01611", status: "Aprobado", date: "19/04/2024" },
  { entity: "CPEM", reference: "9078286-ARAYA", status: "Aprobado", date: "Sin fecha" },
  { entity: "INAPA", reference: "Factibilidad", status: "Aprobado", date: "30/11/2023" },
  { entity: "MIVED", reference: "VUC0255-2024", status: "Aprobado", date: "12/02/2024" },
  { entity: "CONFOTUR provisional", reference: "Núm. 61-2025", status: "Aprobado", date: "10/10/2024" },
  { entity: "CONFOTUR definitivo", reference: "CONFOTUR01-01201", status: "En proceso", date: "Consejo pendiente" },
] as const;

export const financingProcesses = [
  { entity: "IFC", amountDop: 420000000, status: "Formalización", detail: "Aprobado; primer desembolso previsto en julio de 2026." },
  { entity: "ALNAP", amountDop: 1400000000, status: "Preaprobado", detail: "Pendiente permiso definitivo y título." },
  { entity: "BLDH", amountDop: 495000000, status: "Aprobado", detail: "Primera fase; pendiente permiso y título." },
  { entity: "Banco Popular", amountDop: 500000000, status: "Preaprobado", detail: "Gestión financiera en curso." },
  { entity: "Banco Santa Cruz", amountDop: 440000000, status: "Revisión", detail: "Fase I en revisión/preaprobación." },
  { entity: "Banco Alaver", amountDop: 300000000, status: "Evaluación", detail: "Extensión del crédito bajo evaluación." },
] as const;

export const managementActions = [
  "Emitir pedidos inmediatos de carpintería, ventanas, pisos y piezas sanitarias para los edificios 1–6 y 9; continuar con 7, 8 y 12.",
  "Abrir un segundo frente de revestimientos para los edificios 12, 11, 10, 15, 14 y 13.",
  "Repriorizar urbanismo y contratar la cuadrilla de barandillas para los edificios 7–15.",
  "Reevaluar la curva y actualizar la línea base si los desvíos no se recuperan.",
] as const;

export const juneDataQualityIssues = [
  {
    title: "Presupuesto total",
    detail: "La lámina 29 muestra RD$3.428,5 M; el Excel y la lámina 30 muestran RD$3.591,3 M. Se usa el Excel como control detallado.",
  },
  {
    title: "Desvío de plazo",
    detail: "El informe de obra indica 5 días y el MPP proyecta 7 días. Ambos se conservan con su fuente.",
  },
  {
    title: "Plan físico de junio",
    detail: "El KPI principal declara 21,24% planificado y la serie mensual de la Curva S muestra 23,29%. Se mantienen para conciliación.",
  },
  {
    title: "Cuentas por pagar",
    detail: "La relación consolidada suma RD$18.597.489,63; el balance, RD$18.612.245,90; y el detalle de Antonely, RD$18.627.534,91. Se mantienen las tres cifras para conciliación.",
  },
  {
    title: "Fórmulas de intereses",
    detail: "La fila “Total crédito interino” contiene tres resultados #REF! (U37:W37); no se incorporan como dato operativo.",
  },
  {
    title: "Morosidad",
    detail: "El desglose suma USD 136.840,44, cinco centavos más que el total declarado de USD 136.840,39.",
  },
  {
    title: "Versión comercial",
    detail: "El informe de ventas aislado conserva una lámina anterior de 31 clientes y USD 148.281,58; prevalece el consolidado actualizado al 06/07/2026.",
  },
  {
    title: "Costes · fuente Antonely",
    detail: "Antonely registra RD$48.988.755,86 en junio y RD$712.326.161,73 acumulados; el consolidado registra RD$48.998.910,52 y RD$712.326.162,73. Diferencias: RD$10.154,66 y RD$1,00.",
  },
  {
    title: "Cabecera de periodo",
    detail: "La hoja de costes de Antonely declara “1 June 2016 to 30 June 2026”. Por contexto y cifras se interpreta como un error de rotulación, pero el original no se altera.",
  },
  {
    title: "Anticipos · balance frente a detalle",
    detail: "El balance registra RD$9.210.448,94 y el detalle de 26 anticipos suma RD$9.210.448,86. La diferencia de RD$0,08 queda abierta para conciliación.",
  },
] as const;
