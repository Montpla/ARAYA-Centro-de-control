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

export const reprogrammedFlowMonths: ReprogrammedFlowMonth[] = [
  { month: "dic-25", status: "actual", originalDop: 2_508_825.32446154, currentDop: 16_398_543.68, varianceDop: -13_889_718.35553846, urbanismDop: 15_407_306.5, buildingsDop: 991_237.18 },
  { month: "ene-26", status: "actual", originalDop: 1_817_025.89926154, currentDop: 2_355_501.36, varianceDop: -538_475.46073846, urbanismDop: 222_844.91, buildingsDop: 2_132_656.45 },
  { month: "feb-26", status: "actual", originalDop: 9_597_781.61340302, currentDop: 8_871_467.26, varianceDop: 726_314.353403021, urbanismDop: 2_449_569.83, buildingsDop: 6_421_897.43 },
  { month: "mar-26", status: "actual", originalDop: 12_613_658.1777769, currentDop: 25_457_547.15, varianceDop: -12_843_888.9722231, urbanismDop: 1_833_923.43, buildingsDop: 23_623_623.72 },
  { month: "abr-26", status: "actual", originalDop: 31_678_657.2413378, currentDop: 19_895_044.07, varianceDop: 11_783_613.1713378, urbanismDop: 2_442_502.32, buildingsDop: 17_452_541.75 },
  { month: "may-26", status: "actual", originalDop: 43_173_658.6002926, currentDop: 21_384_560.13, varianceDop: 21_789_098.4702926, urbanismDop: 4_340_947.83, buildingsDop: 17_043_612.3 },
  { month: "jun-26", status: "actual", originalDop: 79_890_966.3655527, currentDop: 28_809_561.44, varianceDop: 51_081_404.9255527, urbanismDop: 5_475_884.73, buildingsDop: 23_333_676.71 },
  { month: "jul-26", status: "forecast", originalDop: 44_301_742.7108736, currentDop: 44_301_742.7108736, varianceDop: 0, urbanismDop: 2_233_363.79118127, buildingsDop: 42_068_378.9196923 },
  { month: "ago-26", status: "forecast", originalDop: 76_919_440.1346064, currentDop: 105_973_614.197142, varianceDop: 29_054_174.0625358, urbanismDop: 22_669_378.7727767, buildingsDop: 83_304_235.4243654 },
  { month: "sep-26", status: "forecast", originalDop: 78_273_088.3197879, currentDop: 107_327_262.382324, varianceDop: 29_054_174.0625358, urbanismDop: 15_810_008.4367274, buildingsDop: 91_517_253.9455962 },
  { month: "oct-26", status: "forecast", originalDop: 72_479_874.0260279, currentDop: 72_479_874.0260279, varianceDop: 0, urbanismDop: 30_184_986.2567971, buildingsDop: 42_294_887.7692308 },
  { month: "nov-26", status: "forecast", originalDop: 70_524_549.3022695, currentDop: 70_524_549.3022695, varianceDop: 0, urbanismDop: 22_131_186.5330388, buildingsDop: 48_393_362.7692308 },
  { month: "dic-26", status: "forecast", originalDop: 62_499_896.5527713, currentDop: 62_499_896.5527713, varianceDop: 0, urbanismDop: 22_631_604.3916559, buildingsDop: 39_868_292.1611154 },
  { month: "ene-27", status: "forecast", originalDop: 33_484_763.2797713, currentDop: 33_484_763.2797713, varianceDop: 0, urbanismDop: 18_550_349.1751559, buildingsDop: 14_934_414.1046154 },
  { month: "feb-27", status: "forecast", originalDop: 43_988_027.8416175, currentDop: 43_988_027.8416175, varianceDop: 0, urbanismDop: 14_846_961.0181559, buildingsDop: 29_141_066.8234616 },
  { month: "mar-27", status: "forecast", originalDop: 33_879_669.5460031, currentDop: 33_879_669.5460031, varianceDop: 0, urbanismDop: 19_972_418.3702339, buildingsDop: 13_907_251.1757692 },
  { month: "abr-27", status: "forecast", originalDop: 17_315_280.4211538, currentDop: 17_315_280.4211538, varianceDop: 0, urbanismDop: 3_961_494.565, buildingsDop: 13_353_785.8561538 },
  { month: "may-27", status: "forecast", originalDop: 13_975_913.5257692, currentDop: 13_975_913.5257692, varianceDop: 0, urbanismDop: 8_561_974.33, buildingsDop: 5_413_939.19576923 },
  { month: "jun-27", status: "forecast", originalDop: 260_986.155, currentDop: 260_986.155, varianceDop: 0, urbanismDop: 0, buildingsDop: 260_986.155 },
  { month: "jul-27", status: "forecast", originalDop: 0, currentDop: 0, varianceDop: 0, urbanismDop: 0, buildingsDop: 0 },
];

export const reprogrammedFlowScopes: FlowScopeLine[] = [
  {
    id: "urbanism",
    label: "Urbanismo",
    budgetPeriodDop: 25_745_270.9662785,
    actualPeriodDop: 32_172_979.55,
    varianceDop: -6_427_708.5837215,
    varianceRatio: -0.24966560236,
    projectBudgetDop: 235_852_185.100335,
    priorActualDop: 22_125_479.9096121,
    actualToCutoffDop: 54_298_459.4596121,
    remainingForecastDop: 181_553_725.640723,
  },
  {
    id: "buildings",
    label: "Edificios",
    budgetPeriodDop: 155_535_302.255808,
    actualPeriodDop: 90_999_245.54,
    varianceDop: 64_536_056.715808,
    varianceRatio: 0.41492867394,
    projectBudgetDop: 515_457_099.84,
    priorActualDop: 0,
    actualToCutoffDop: 90_999_245.54,
    remainingForecastDop: 424_457_854.3,
  },
  {
    id: "total",
    label: "Total alcance",
    budgetPeriodDop: 181_280_573.222087,
    actualPeriodDop: 123_172_225.09,
    varianceDop: 58_108_348.1320865,
    varianceRatio: 0.320543713533,
    projectBudgetDop: 751_309_284.940335,
    priorActualDop: 22_125_479.9096121,
    actualToCutoffDop: 145_297_705,
    remainingForecastDop: 606_011_579.940335,
  },
];

export const reprogrammedFlowAudit = {
  cutoff: "30/06/2026",
  workbookSheetCount: 6,
  formulaCount: 1_137,
  formulaErrorCount: 0,
  externalFormulaCount: 0,
  originalTotalDop: 751_309_284.94735,
  reprogrammedTotalDop: 751_309_284.940335,
  totalCheckDifferenceDop: -0.007015,
  actualPeriodDop: 123_172_225.09,
  actualToCutoffDop: 145_297_705,
  remainingForecastDop: 606_011_579.940335,
  cumulativeVarianceRedistributedDop: 58_108_348.1320865,
  augustAdjustmentDop: 29_054_174.0625358,
  septemberAdjustmentDop: 29_054_174.0625358,
  juneScopedActualDop: 28_809_561.44,
  juneFullFinanceActualDop: 48_998_910.52,
  juneScopeDifferenceDop: 20_189_349.08,
};

export const reprogrammedFlowQualityIssues = [
  {
    title: "Metodología descrita de forma inconsistente",
    detail: "La portada y el Resumen hablan de redistribuir solo el sobrante de junio. Las fórmulas y la hoja Reprogramación redistribuyen la desviación acumulada completa de diciembre de 2025 a junio de 2026. El dashboard sigue las fórmulas vigentes.",
    severity: "warning" as const,
  },
  {
    title: "Dos importes aparecen como porcentajes",
    detail: "Reprogramación!B27 y B53 contienen importes DOP, pero tienen formato porcentual. Sus valores correctos son -RD$6.427.708,59 y RD$64.536.056,72.",
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
    detail: "El libro registra importes presupuestados, reales y reprogramados, pero no contiene mediciones físicas, cantidades ejecutadas ni porcentajes de avance de obra. El avance físico permanece en 18,23%.",
    severity: "info" as const,
  },
];
