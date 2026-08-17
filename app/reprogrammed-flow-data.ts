export type ReprogrammedFlowMonth = {
  month: string;
  status: "actual" | "forecast";
  originalDop: number;
  currentDop: number;
  varianceDop: number;
  urbanismDop: number;
  buildingsDop: number;
};

export type FlowScopeLine = {
  id: "urbanism" | "buildings" | "total";
  label: string;
  budgetPeriodDop: number;
  actualPeriodDop: number;
  varianceDop: number;
  varianceRatio: number;
  projectBudgetDop: number;
  priorActualDop: number;
  actualToCutoffDop: number;
  remainingForecastDop: number;
};

// Flujo reprogramado de la Fase I (Urbanismo + Edificios), corte 31/07/2026,
// leído del Excel "ARAYA_Flujo_I_reprogramado ... con fase II". Julio ya es real;
// de agosto de 2026 en adelante es la reprogramación (presupuesto redistribuido).
// Los importes salen directos de las hojas Resumen, Comparación Mensual y
// Reprogramación del propio libro, sin interpretación.
export const reprogrammedFlowMonths: ReprogrammedFlowMonth[] = [
  { month: "dic-25", status: "actual", originalDop: 2508825.324462, currentDop: 16398543.68, varianceDop: -13889718.355538, urbanismDop: 15407306.5, buildingsDop: 991237.18 },
  { month: "ene-26", status: "actual", originalDop: 1817025.899262, currentDop: 2355501.36, varianceDop: -538475.460738, urbanismDop: 222844.91, buildingsDop: 2132656.45 },
  { month: "feb-26", status: "actual", originalDop: 9597781.613403, currentDop: 8871467.26, varianceDop: 726314.353403, urbanismDop: 2449569.83, buildingsDop: 6421897.43 },
  { month: "mar-26", status: "actual", originalDop: 12613658.177777, currentDop: 25457547.15, varianceDop: -12843888.972223, urbanismDop: 1833923.43, buildingsDop: 23623623.72 },
  { month: "abr-26", status: "actual", originalDop: 31678657.241338, currentDop: 19895044.07, varianceDop: 11783613.171338, urbanismDop: 2442502.32, buildingsDop: 17452541.75 },
  { month: "may-26", status: "actual", originalDop: 43173658.600293, currentDop: 21384560.13, varianceDop: 21789098.470293, urbanismDop: 4340947.83, buildingsDop: 17043612.3 },
  { month: "jun-26", status: "actual", originalDop: 79890966.365553, currentDop: 28809561.44, varianceDop: 51081404.925553, urbanismDop: 5475884.73, buildingsDop: 23333676.71 },
  { month: "jul-26", status: "actual", originalDop: 44301742.710874, currentDop: 31735296.71, varianceDop: 12566446.000874, urbanismDop: 8125258.55, buildingsDop: 23610038.16 },
  { month: "ago-26", status: "forecast", originalDop: 76919440.134606, currentDop: 112256837.197579, varianceDop: 35337397.062973, urbanismDop: 19723431.393367, buildingsDop: 92533405.804211 },
  { month: "sep-26", status: "forecast", originalDop: 78273088.319788, currentDop: 113610485.38276, varianceDop: 35337397.062973, urbanismDop: 12864061.057318, buildingsDop: 100746424.325442 },
  { month: "oct-26", status: "forecast", originalDop: 72479874.026028, currentDop: 72479874.026028, varianceDop: 0, urbanismDop: 30184986.256797, buildingsDop: 42294887.769231 },
  { month: "nov-26", status: "forecast", originalDop: 70524549.30227, currentDop: 70524549.30227, varianceDop: 0, urbanismDop: 22131186.533039, buildingsDop: 48393362.769231 },
  { month: "dic-26", status: "forecast", originalDop: 62499896.552771, currentDop: 62499896.552771, varianceDop: 0, urbanismDop: 22631604.391656, buildingsDop: 39868292.161115 },
  { month: "ene-27", status: "forecast", originalDop: 33484763.279771, currentDop: 33484763.279771, varianceDop: 0, urbanismDop: 18550349.175156, buildingsDop: 14934414.104615 },
  { month: "feb-27", status: "forecast", originalDop: 43988027.841617, currentDop: 43988027.841617, varianceDop: 0, urbanismDop: 14846961.018156, buildingsDop: 29141066.823461 },
  { month: "mar-27", status: "forecast", originalDop: 33879669.546003, currentDop: 33879669.546003, varianceDop: 0, urbanismDop: 19972418.370234, buildingsDop: 13907251.175769 },
  { month: "abr-27", status: "forecast", originalDop: 17315280.421154, currentDop: 17315280.421154, varianceDop: 0, urbanismDop: 3961494.565, buildingsDop: 13353785.856154 },
  { month: "may-27", status: "forecast", originalDop: 13975913.525769, currentDop: 13975913.525769, varianceDop: 0, urbanismDop: 8561974.33, buildingsDop: 5413939.195769 },
  { month: "jun-27", status: "forecast", originalDop: 260986.155, currentDop: 260986.155, varianceDop: 0, urbanismDop: 0, buildingsDop: 260986.155 },
  { month: "jul-27", status: "forecast", originalDop: 0, currentDop: 0, varianceDop: 0, urbanismDop: 0, buildingsDop: 0 },
];

export const reprogrammedFlowScopes: FlowScopeLine[] = [
  {
    id: "urbanism",
    label: "Urbanismo",
    budgetPeriodDop: 27978634.75746,
    actualPeriodDop: 40298238.1,
    varianceDop: -12319603.34254,
    varianceRatio: -0.440322,
    projectBudgetDop: 235852185.100335,
    priorActualDop: 22125479.909612,
    actualToCutoffDop: 62423718.009612,
    remainingForecastDop: 173428467.090723,
  },
  {
    id: "buildings",
    label: "Edificios",
    budgetPeriodDop: 197603681.1755,
    actualPeriodDop: 114609283.7,
    varianceDop: 82994397.4755,
    varianceRatio: 0.420004,
    projectBudgetDop: 515457099.84,
    priorActualDop: 0,
    actualToCutoffDop: 114609283.7,
    remainingForecastDop: 400847816.14,
  },
  {
    id: "total",
    label: "Total alcance",
    budgetPeriodDop: 225582315.93296,
    actualPeriodDop: 154907521.8,
    varianceDop: 70674794.13296,
    varianceRatio: 0.313299,
    projectBudgetDop: 751309284.940335,
    priorActualDop: 22125479.909612,
    actualToCutoffDop: 177033001.709612,
    remainingForecastDop: 574276283.230723,
  },
];

export const reprogrammedFlowAudit = {
  cutoff: "31/07/2026",
  workbookSheetCount: 6,
  formulaCount: 1228,
  formulaErrorCount: 0,
  externalFormulaCount: 0,
  originalTotalDop: 751309284.940335,
  reprogrammedTotalDop: 751309284.940335,
  totalCheckDifferenceDop: 0,
  actualPeriodDop: 154907521.8,
  actualToCutoffDop: 177033001.709612,
  remainingForecastDop: 574276283.230723,
  cumulativeVarianceRedistributedDop: 70674794.13296,
  augustAdjustmentDop: 35337397.06648,
  septemberAdjustmentDop: 35337397.06648,
  julyScopedActualDop: 31735296.71,
};

export const reprogrammedFlowQualityIssues = [
  {
    title: "Metodología descrita de forma inconsistente",
    detail: "La portada y el Resumen hablan de redistribuir solo el sobrante de los últimos meses. Las fórmulas y la hoja Reprogramación redistribuyen la desviación acumulada completa de diciembre de 2025 al corte. El dashboard sigue las fórmulas vigentes.",
    severity: "warning" as const,
  },
  {
    title: "Dos importes aparecen como porcentajes",
    detail: "Reprogramación!B27 y B53 contienen importes DOP, pero tienen formato porcentual. Sus valores correctos son -RD$12.319.603,35 y RD$82.994.397,48.",
    severity: "warning" as const,
  },
  {
    title: "Hoja auxiliar sin etiquetas",
    detail: "Hoja1 contiene cálculos sueltos sin título, procedencia ni categorías. Se conserva en el original, pero no alimenta indicadores.",
    severity: "warning" as const,
  },
  {
    title: "Alcance financiero parcial",
    detail: "El flujo solo incluye Urbanismo y Edificios de la Fase I. Excluye terreno, diseño, gerencia, indirectos, inspección, permisos y gastos financieros; por ello no sustituye el presupuesto ni el flujo de caja global.",
    severity: "info" as const,
  },
  {
    title: "Sin indicador de avance físico",
    detail: "El libro registra importes presupuestados, reales y reprogramados, pero no contiene mediciones físicas, cantidades ejecutadas ni porcentajes de avance de obra.",
    severity: "info" as const,
  },
];
