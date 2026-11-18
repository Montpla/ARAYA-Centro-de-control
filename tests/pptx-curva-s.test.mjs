import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as xlsxReader from "../lib/xlsx-reader.ts";
import * as monthlyPlan from "../lib/monthly-plan.ts";

async function cargar() {
  const source = await readFile(new URL("../lib/pptx-curva-s.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(output, {
    module: compiled, exports: compiled.exports, console, Math, Number, Date, TextDecoder, Object,
    require: (especificador) => {
      if (especificador === "./xlsx-reader") return xlsxReader;
      if (especificador === "./monthly-plan") return monthlyPlan;
      throw new Error(`Import inesperado: ${especificador}`);
    },
  });
  return compiled.exports;
}

function serie(nombre, puntos) {
  const pts = (valores) => valores.map(([idx, v]) => `<c:pt idx="${idx}"><c:v>${v}</c:v></c:pt>`).join("");
  return `<c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>${nombre}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
    `<c:cat><c:strRef><c:strCache>${pts(puntos.map(([mes], i) => [i, mes]))}</c:strCache></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:numCache>${pts(puntos.map(([, v], i) => [i, v]))}</c:numCache></c:numRef></c:val></c:ser>`;
}

const MESES = Array.from({ length: 27 }, (_, i) => {
  const fecha = new Date(Date.UTC(2025, 5 + i, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
});
// Valores reales del gráfico del Informe Ejecutivo de octubre de 2026.
const PLAN = [0, 0.52, 1.21, 2.07, 2.76, 3.7, 4.11, 4.48, 4.97, 6.72, 11.07, 16.67, 21.24, 26.61, 35.29, 45.58, 57.48, 68.56, 77.47, 80.28, 85.84, 90, 93.26, 95.25, 97.38, 98.87, 100];
const REAL = [0, 0.31, 0.94, 1.88, 2.51, 3.45, 3.83, 4.47, 6.05, 8.96, 11.59, 16, 18.23, 22.71, 27.9, 29.38, 32.06];
const REPROGRAMADO = [[15, 32.99], [16, 39.8], [17, 54.46], [26, 100]];

const curvaOctubre = `<c:chartSpace>${serie("Plan Operativo", PLAN.map((v, i) => [MESES[i], v]))}` +
  `${serie("Ejecutado Real", REAL.map((v, i) => [MESES[i], v]))}` +
  `${serie("Plan reprogramado (conjunto)", REPROGRAMADO.map(([i, v]) => [MESES[i], v]))}</c:chartSpace>`;

test("lee las tres series de la Curva S del Informe Ejecutivo", async () => {
  const { parseCurvaSChartXml, curvaSUpdates, CURVA_S_MONTH_COUNT } = await cargar();
  const grafico = parseCurvaSChartXml(curvaOctubre);
  assert.ok(grafico, "se reconoce como Curva S");
  const claves = Object.fromEntries(curvaSUpdates(grafico, CURVA_S_MONTH_COUNT).map(({ key, value }) => [key, value]));
  assert.equal(claves["monthlyPlan.16.planned"], 57.48, "octubre del Plan Operativo, no el reprogramado");
  assert.equal(claves["monthlyPlan.15.actual"], 29.38, "el ejecutado de septiembre que faltaba");
  assert.equal(claves["monthlyPlan.16.actual"], 32.06);
  assert.equal(claves["monthlyPlan.16.reprogrammed"], 39.8);
  assert.equal(claves["monthlyPlan.17.actual"], undefined, "noviembre no tiene ejecutado todavía");
});

test("acepta meses en español y fracciones de porcentaje", async () => {
  const { curvaSCategoryIndex, parseCurvaSChartXml } = await cargar();
  assert.equal(curvaSCategoryIndex("Oct-26"), 16);
  assert.equal(curvaSCategoryIndex("dic 2025"), 6);
  assert.equal(curvaSCategoryIndex("2026-10"), 16);
  const fracciones = `${serie("Plan Operativo", PLAN.map((v, i) => [MESES[i], v / 100]))}${serie("Ejecutado Real", REAL.map((v, i) => [MESES[i], v / 100]))}`;
  const grafico = parseCurvaSChartXml(fracciones);
  assert.equal(grafico.actual.find((p) => p.index === 16).value, 32.06);
});

test("ignora un gráfico de barras mensuales que no es una curva acumulada", async () => {
  const { parseCurvaSChartXml } = await cargar();
  const barras = `${serie("Presupuestado", [["Dic-25", 1.1], ["Ene-26", 0.4], ["Feb-26", 5.8], ["Mar-26", 0.7], ["Abr-26", 1.9], ["May-26", 4.6], ["Jun-26", 11.2]])}` +
    `${serie("Real", [["Dic-25", 15.4], ["Ene-26", 0.2], ["Feb-26", 2.4], ["Mar-26", 1.8], ["Abr-26", 2.4], ["May-26", 4.3], ["Jun-26", 5.5]])}`;
  assert.equal(parseCurvaSChartXml(barras), null);
});
