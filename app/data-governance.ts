export type SourceAuthority = "oficial" | "control" | "soporte" | "histórico" | "duplicado";
export type DataControlStatus = "conciliado" | "separado" | "observado";

export const sourceGovernance: Record<string, {
  authority: SourceAuthority;
  scope: string;
  feeds: string;
}> = {
  "source-xls": {
    authority: "oficial",
    scope: "Avance físico y cubicaciones al corte",
    feeds: "Resumen, Planificación, Edificios, Apartamentos y Finanzas",
  },
  "source-mpp": {
    authority: "oficial",
    scope: "Cronograma, fechas, tareas y camino crítico",
    feeds: "Planificación, Edificios, Apartamentos y Cronología",
  },
  "source-dwg-implantacion": {
    authority: "oficial",
    scope: "Geometría de implantación y urbanismo",
    feeds: "Implantación general, Edificios, Apartamentos y Urbanismo",
  },
  "source-june-consolidated": {
    authority: "control",
    scope: "Informe transversal de Dirección",
    feeds: "Resumen, Comercial, Obra, Finanzas, Seguridad y Permisos",
  },
  "source-june-works": {
    authority: "control",
    scope: "Detalle mensual de obra y seguridad",
    feeds: "Planificación, Edificios, Urbanismo y Seguridad",
  },
  "source-june-sales": {
    authority: "histórico",
    scope: "Informe comercial anterior al consolidado",
    feeds: "Consulta histórica; no sustituye la morosidad vigente",
  },
  "source-june-finance": {
    authority: "control",
    scope: "Presupuesto, costes, caja y obligaciones de gestión",
    feeds: "Finanzas e informes de Dirección",
  },
  "source-antonely-june-finance": {
    authority: "soporte",
    scope: "Detalle departamental de costes, CxP, anticipos y balance",
    feeds: "Finanzas y Proveedores",
  },
  "source-may-cashflow": {
    authority: "histórico",
    scope: "Proyección de caja anterior",
    feeds: "Consulta histórica",
  },
  "source-june-pdf": {
    authority: "soporte",
    scope: "Versión renderizada del informe consolidado",
    feeds: "Consulta y trazabilidad documental",
  },
  "source-supplier-contacts": {
    authority: "control",
    scope: "Maestro operativo de proveedores",
    feeds: "Proveedores y Compras",
  },
  "source-budget-type-a": {
    authority: "control",
    scope: "Presupuesto técnico del edificio tipo A",
    feeds: "Finanzas, Edificios y Compras",
  },
  "source-ifc-analysis": {
    authority: "soporte",
    scope: "Matriz auxiliar de obligaciones IFC",
    feeds: "Seguridad, Permisos y Finanzas",
  },
  "source-procurement-comparison": {
    authority: "control",
    scope: "Comparativos, ofertas y calendario de compras",
    feeds: "Proveedores, Compras y Finanzas",
  },
  "source-procurement-comparison-duplicate": {
    authority: "duplicado",
    scope: "Copia binaria idéntica",
    feeds: "Trazabilidad únicamente; excluida de todos los cálculos",
  },
  "source-supplier-analysis": {
    authority: "soporte",
    scope: "Lectura analítica del maestro de proveedores",
    feeds: "Proveedores",
  },
  "source-june-deviation": {
    authority: "control",
    scope: "Desviación mensual de presupuesto",
    feeds: "Finanzas y Edificios",
  },
  "source-reprogrammed-flow-phase-1": {
    authority: "control",
    scope: "Flujo de Urbanismo y Edificios de la Fase I",
    feeds: "Finanzas y Planificación",
  },
  "source-fiduciary-trial-balance": {
    authority: "oficial",
    scope: "Mayor y balance de comprobación del fideicomiso",
    feeds: "Finanzas · Fideicomiso",
  },
  "source-fiduciary-balance-sheet": {
    authority: "oficial",
    scope: "Estado de situación del fideicomiso",
    feeds: "Finanzas · Fideicomiso",
  },
  "source-fiduciary-income-accumulated": {
    authority: "oficial",
    scope: "Resultados acumulados enero-junio de 2026",
    feeds: "Finanzas · Fideicomiso",
  },
  "source-fiduciary-income-monthly": {
    authority: "oficial",
    scope: "Resultados del mes de junio de 2026",
    feeds: "Finanzas · Fideicomiso",
  },
};

export const dataAuthorityMatrix = [
  {
    id: "physical-progress",
    metric: "Avance físico ejecutado",
    primarySourceId: "source-xls",
    supportSourceIds: ["source-june-works", "source-june-consolidated"],
    status: "conciliado",
    decision: "18,23% al 30/06/2026. Solo cambia con una medición física posterior validada.",
  },
  {
    id: "schedule-progress",
    metric: "Avance y fechas del cronograma",
    primarySourceId: "source-mpp",
    supportSourceIds: ["source-june-works"],
    status: "separado",
    decision: "El avance del cronograma (MPP) no sustituye al avance físico: miden conceptos diferentes.",
  },
  // Estas dos entradas citan el avance físico y de cronograma dentro del
  // texto de "decision" (no en un campo numérico aparte), así que el valor
  // declarado arriba se queda fijo como línea base. liveDataAuthorityMatrix()
  // sustituye ambas frases con los porcentajes vivos en el momento de mostrarlas.
  {
    id: "master-plan",
    metric: "Implantación y geometría",
    primarySourceId: "source-dwg-implantacion",
    supportSourceIds: [],
    status: "conciliado",
    decision: "El DWG manda sobre la posición de edificios, apartamentos y urbanismo.",
  },
  {
    id: "sales",
    metric: "Ventas y cobranza",
    primarySourceId: "source-june-consolidated",
    supportSourceIds: ["source-june-sales"],
    status: "conciliado",
    decision: "Prevalece la actualización de morosidad al 06/07/2026; la presentación aislada queda histórica.",
  },
  {
    id: "management-budget",
    metric: "Presupuesto y costes de gestión",
    primarySourceId: "source-june-finance",
    supportSourceIds: ["source-antonely-june-finance", "source-june-consolidated"],
    status: "observado",
    decision: "El Excel detallado controla el presupuesto de DOP 3.591,3 M; la cifra de DOP 3.428,5 M queda observada.",
  },
  {
    id: "management-payables",
    metric: "Cuentas por pagar operativas",
    primarySourceId: "source-june-finance",
    supportSourceIds: ["source-antonely-june-finance"],
    status: "observado",
    decision: "El KPI de gestión permanece en DOP 18.597.489,63 hasta conciliación del detalle departamental.",
  },
  {
    id: "fiduciary-balance",
    metric: "Balance contable del fideicomiso",
    primarySourceId: "source-fiduciary-balance-sheet",
    supportSourceIds: ["source-fiduciary-trial-balance", "source-antonely-june-finance"],
    status: "separado",
    decision: "Fiduciaria Universal es la fuente oficial. El balance del Excel se conserva como control interno.",
  },
  {
    id: "fiduciary-results",
    metric: "Resultados del fideicomiso",
    primarySourceId: "source-fiduciary-income-accumulated",
    supportSourceIds: ["source-fiduciary-income-monthly", "source-fiduciary-balance-sheet"],
    status: "conciliado",
    decision: "El resultado acumulado de -DOP 6.129.446,26 coincide con el incorporado al patrimonio.",
  },
  {
    id: "supplier-master",
    metric: "Maestro de proveedores",
    primarySourceId: "source-supplier-contacts",
    supportSourceIds: ["source-supplier-analysis"],
    status: "observado",
    decision: "67 proveedores únicos; las carencias de RNC y correo continúan visibles.",
  },
  {
    id: "procurement-flow",
    metric: "Comparativos y flujo de compras",
    primarySourceId: "source-procurement-comparison",
    supportSourceIds: ["source-procurement-comparison-duplicate"],
    status: "conciliado",
    decision: "La copia idéntica se excluye. El total auditado incluye la partida omitida por la fórmula de portada.",
  },
  {
    id: "phase-one-flow",
    metric: "Flujo de obra reprogramado",
    primarySourceId: "source-reprogrammed-flow-phase-1",
    supportSourceIds: [],
    status: "conciliado",
    decision: "Se usan las fórmulas vigentes y se mantiene separado del flujo de caja global y del avance físico.",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  metric: string;
  primarySourceId: string;
  supportSourceIds: readonly string[];
  status: DataControlStatus;
  decision: string;
}>;


export const dataGovernanceSummary = {
  registeredSources: Object.keys(sourceGovernance).length,
  governedMetrics: dataAuthorityMatrix.length,
  reconciledMetrics: dataAuthorityMatrix.filter((item) => item.status === "conciliado").length,
  separatedMetrics: dataAuthorityMatrix.filter((item) => item.status === "separado").length,
  observedMetrics: dataAuthorityMatrix.filter((item) => item.status === "observado").length,
} as const;

