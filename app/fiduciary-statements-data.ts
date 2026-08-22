export const fiduciaryStatementSummary = {
  cutoff: "30/06/2026",
  issuedAt: "20/07/2026",
  issuer: "Fiduciaria Universal",
  currency: "DOP",
  balance: {
    assetsDop: 758765771.05,
    liabilitiesDop: 448317797.67,
    contributedEquityDop: 323303678.01,
    accumulatedEquityResultDop: -6726258.37,
    grossEquityDop: 316577419.64,
    periodResultDop: -6129446.26,
    netEquityDop: 310447973.38,
    liquidityDop: 50353287.01,
    payablesDop: 24814585.2,
    constructionInProgressDop: 693427995.8,
  },
  monthlyResult: {
    incomeDop: 4701963.91,
    expensesDop: 10774703.46,
    netResultDop: -6072739.55,
  },
  accumulatedResult: {
    incomeDop: 43835537.2,
    expensesDop: 49964983.46,
    netResultDop: -6129446.26,
  },
  trialBalance: {
    debitDop: 311209328.75,
    creditDop: 311209328.75,
    differenceDop: 0,
  },
} as const;

export const fiduciaryBalanceSections = [
  {
    id: "assets",
    label: "Activos",
    totalDop: 758765771.05,
    lines: [
      { name: "Disponibilidades", amountDop: 50353287.01 },
      { name: "Inversiones", amountDop: 279926.69 },
      { name: "Cuentas y documentos por cobrar", amountDop: 14109754.98 },
      { name: "Gastos pagados por anticipado", amountDop: 594806.57 },
      { name: "Construcción en proceso", amountDop: 693427995.8 },
    ],
  },
  {
    id: "liabilities",
    label: "Pasivos",
    totalDop: 448317797.67,
    lines: [
      { name: "Comisiones por pagar", amountDop: 298360.12 },
      { name: "Cuentas por pagar", amountDop: 24814585.2 },
      { name: "Provisiones y acumulaciones por pagar", amountDop: 580988.98 },
      { name: "Promitentes compradores", amountDop: 222623863.37 },
      { name: "Préstamos por pagar a largo plazo", amountDop: 200000000 },
    ],
  },
  {
    id: "equity",
    label: "Patrimonio neto",
    totalDop: 310447973.38,
    lines: [
      { name: "Aportes en dinero y especie", amountDop: 323303678.01 },
      { name: "Resultados acumulados", amountDop: -6726258.37 },
      { name: "Resultado del periodo", amountDop: -6129446.26 },
    ],
  },
] as const;


export const fiduciaryManagementReconciliation = [
  {
    metric: "Activos",
    officialDop: 758765771.05,
    managementDop: 759714674.92,
    differenceDop: 948903.87,
    decision: "El estado de Fiduciaria prevalece como balance contable oficial; el Excel se conserva como control interno.",
  },
  {
    metric: "Pasivos",
    officialDop: 448317797.67,
    managementDop: 446209904.61,
    differenceDop: -2107893.06,
    decision: "Se mantienen separados por alcance y clasificación de cuentas.",
  },
  {
    metric: "Patrimonio neto",
    officialDop: 310447973.38,
    managementDop: 313504770.31,
    differenceDop: 3056796.93,
    decision: "El estado oficial incorpora el resultado del periodo de la Fiduciaria.",
  },
  {
    metric: "Disponibilidades",
    officialDop: 50353287.01,
    managementDop: 48234289.3,
    differenceDop: -2118997.71,
    decision: "No se compensan saldos sin una conciliación bancaria por cuenta.",
  },
  {
    metric: "Cuentas por pagar",
    officialDop: 24814585.2,
    managementDop: 18597489.63,
    differenceDop: -6217095.57,
    decision: "La cifra oficial incluye un alcance contable más amplio; la CxP operativa sigue siendo el KPI de gestión.",
  },
] as const;

export const fiduciaryStatementQualityIssues = [
  {
    title: "Balance oficial frente a control interno",
    detail: "Los estados de Fiduciaria y el Excel de gestión presentan diferencias de clasificación y alcance. Se muestran como dos capas y no se suman.",
  },
  {
    title: "Cuentas por pagar con distinto alcance",
    detail: "Fiduciaria declara DOP 24.814.585,20; el control consolidado operativo declara DOP 18.597.489,63. La diferencia no se trata como error hasta disponer de conciliación por cuenta.",
  },
  {
    title: "Disponibilidades pendientes de conciliación bancaria",
    detail: "Fiduciaria declara DOP 50.353.287,01 y el control interno DOP 48.234.289,30. Se mantiene abierta la diferencia de DOP 2.118.997,71.",
  },
] as const;
