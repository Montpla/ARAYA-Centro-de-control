import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

let source = await readFile("lib/financial-governance.ts", "utf8");
source = source
  .replace(/import \{ FX_RATE_CUTOFF, USD_TO_DOP \} from "\.\/currency";/, `
    const FX_RATE_CUTOFF = "30/06/2026";
    const USD_TO_DOP = 59.5666666667;
  `)
  .replace(/import \{[\s\S]*?\} from "\.\/live-data";/, `
    const FINANCIAL_ROOTS = new Set([
      "fiduciaryStatementSummary", "antonelyPayableCategories",
      "reprogrammedFlowMonths", "financialProjection"
    ]);
    function isFinancialLiveKey(key) { return FINANCIAL_ROOTS.has(key.split(".")[0]); }
    function isCommercialLiveKey() { return false; }
    function materializeLiveRoot(root, baseline, values) {
      const copy = structuredClone(baseline ?? null);
      let output = copy;
      for (const [key, value] of Object.entries(values)) {
        if (key === root) { output = structuredClone(value); continue; }
        if (!key.startsWith(root + ".")) continue;
        const path = key.slice(root.length + 1).split(".");
        if (output === null || typeof output !== "object") output = /^\\d+$/.test(path[0]) ? [] : {};
        let cursor = output;
        for (let index = 0; index < path.length - 1; index += 1) {
          const segment = path[index];
          const next = path[index + 1];
          if (cursor[segment] === undefined) cursor[segment] = /^\\d+$/.test(next) ? [] : {};
          cursor = cursor[segment];
        }
        cursor[path.at(-1)] = structuredClone(value);
      }
      return output;
    }
  `);
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const finance = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

function update(key, value, overrides = {}) {
  return {
    key,
    valueJson: JSON.stringify(value),
    valueType: typeof value,
    area: "finanzas",
    cutoff: "2026-06-30",
    sourceCurrency: "DOP",
    sourceFileId: "file-1",
    sourceName: "Balance general junio 2026.pdf",
    ...overrides,
  };
}

const fiduciaryBaseline = {
  balance: {
    assetsDop: 150,
    liabilitiesDop: 80,
    contributedEquityDop: 60,
    accumulatedEquityResultDop: 5,
    grossEquityDop: 65,
    periodResultDop: 5,
    netEquityDop: 70,
  },
  monthlyResult: { incomeDop: 50, expensesDop: 20, netResultDop: 30 },
  accumulatedResult: { incomeDop: 90, expensesDop: 40, netResultDop: 50 },
  trialBalance: { debitDop: 200, creditDop: 200, differenceDop: 0 },
};

test("normaliza a la moneda canónica y conserva el original en la auditoría", () => {
  const input = update("fiduciaryStatementSummary.balance.assetsDop", 10, {
    sourceCurrency: "USD",
  });
  const result = finance.canonicalizeFinancialUpdates([input]);
  assert.equal(JSON.parse(result.updates[0].valueJson), 595.666667);
  assert.equal(result.audit[0].sourceValueJson, "10");
  assert.equal(result.audit[0].convertedFieldCount, 1);
  assert.deepEqual(result.audit[0].canonicalCurrencies, ["DOP"]);
});

test("publica un balance cuadrado con controles contables aprobados", () => {
  const updates = [
    update("fiduciaryStatementSummary.balance.assetsDop", 150),
    update("fiduciaryStatementSummary.balance.liabilitiesDop", 80),
    update("fiduciaryStatementSummary.balance.grossEquityDop", 65),
    update("fiduciaryStatementSummary.balance.periodResultDop", 5),
    update("fiduciaryStatementSummary.balance.netEquityDop", 70),
  ];
  const result = finance.validateFinancialPublication({
    updates,
    currentValues: {},
    currentPoints: [],
    baselineValues: { fiduciaryStatementSummary: fiduciaryBaseline },
  });
  assert.equal(result.status, "passed");
  assert.equal(result.blockingKeys.length, 0);
  assert.ok(result.checks.every((check) => check.status === "passed"));
});

test("el patrimonio de julio suma aportes, acumulados y resultado del ejercicio", () => {
  const updates = [
    update("fiduciaryStatementSummary.balance.assetsDop", 796_960_916.83, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.liabilitiesDop", 483_862_152.04, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.contributedEquityDop", 322_917_733.81, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.accumulatedEquityResultDop", -6_364_163.55, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.grossEquityDop", 316_553_570.26, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.periodResultDop", -3_454_805.47, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
    update("fiduciaryStatementSummary.balance.netEquityDop", 313_098_764.79, { cutoff: "2026-07-31", sourceFileId: "bce-jul", sourceName: "BCE 07-26.pdf" }),
  ];
  const result = finance.validateFinancialPublication({
    updates,
    currentValues: {},
    currentPoints: [],
    baselineValues: { fiduciaryStatementSummary: fiduciaryBaseline },
  });
  assert.equal(result.status, "passed");
  assert.ok(result.checks.some((check) => check.id === "fiduciary-balance-equation" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "fiduciary-equity-rollforward" && check.status === "passed"));
});

test("una auditoría no completa julio con componentes históricos de junio", () => {
  const updates = [
    update("fiduciaryStatementSummary.balance.assetsDop", 796_960_916.83, { cutoff: "2026-07-31", sourceFileId: "bce-jul" }),
    update("fiduciaryStatementSummary.balance.liabilitiesDop", 483_862_152.04, { cutoff: "2026-07-31", sourceFileId: "bce-jul" }),
    update("fiduciaryStatementSummary.balance.periodResultDop", -6_364_163.55, { cutoff: "2026-07-31", sourceFileId: "bce-jul" }),
    update("fiduciaryStatementSummary.balance.netEquityDop", 313_098_764.79, { cutoff: "2026-07-31", sourceFileId: "bce-jul" }),
  ];
  const result = finance.validateFinancialPublication({
    updates,
    currentValues: {},
    currentPoints: [],
    baselineValues: {},
  });
  assert.equal(result.status, "passed");
  assert.ok(result.checks.some((check) => check.id === "fiduciary-balance-equation" && check.status === "passed"));
  assert.ok(!result.checks.some((check) => check.id === "fiduciary-equity-rollforward"));
});

test("aísla sólo el grupo financiero descuadrado y deja intacto otro grupo válido", () => {
  const updates = [
    update("fiduciaryStatementSummary.balance.assetsDop", 999),
    update("reprogrammedFlowMonths.0.currentDop", 30, { sourceName: "Flujo reprogramado.xlsx" }),
    update("reprogrammedFlowMonths.0.urbanismDop", 10, { sourceName: "Flujo reprogramado.xlsx" }),
    update("reprogrammedFlowMonths.0.buildingsDop", 20, { sourceName: "Flujo reprogramado.xlsx" }),
  ];
  const result = finance.validateFinancialPublication({
    updates,
    currentValues: {},
    currentPoints: [],
    baselineValues: {
      fiduciaryStatementSummary: fiduciaryBaseline,
      reprogrammedFlowMonths: [{ month: "jun-26", currentDop: 30, urbanismDop: 10, buildingsDop: 20 }],
    },
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.blockingKeys.includes("fiduciaryStatementSummary.balance.assetsDop"));
  assert.ok(!result.blockingKeys.some((key) => key.startsWith("reprogrammedFlowMonths")));
  assert.ok(result.checks.some((check) => check.id === "flow-month-0" && check.status === "passed"));
});

test("una fuente antigua o de menor autoridad no sustituye la cifra vigente", () => {
  const stale = update("fiduciaryStatementSummary.balance.assetsDop", 150, {
    cutoff: "2026-05-31",
    sourceName: "Informe de dirección mayo.pdf",
  });
  const result = finance.validateFinancialPublication({
    updates: [stale],
    currentValues: {},
    currentPoints: [{
      key: stale.key,
      valueJson: "150",
      sourceName: "Balance general junio 2026.pdf",
      sourceCurrency: "DOP",
      cutoff: "2026-06-30",
    }],
    baselineValues: { fiduciaryStatementSummary: fiduciaryBaseline },
  });
  assert.equal(result.authority[0].status, "stale");
  assert.deepEqual(result.blockingKeys, [stale.key]);
});

test("el recibo enumera las pantallas afectadas por cada raíz financiera", () => {
  const views = finance.affectedViewsForUpdates([
    { key: "fiduciaryStatementSummary.balance.assetsDop" },
    { key: "antonelyPayableCategories.0.total" },
    { key: "reprogrammedFlowMonths.0.currentDop" },
  ]);
  for (const view of ["Centro de datos", "Resumen ejecutivo", "Finanzas", "Fideicomiso", "Proveedores", "Obra", "Planificación", "Informes"]) {
    assert.ok(views.includes(view), view);
  }
});
