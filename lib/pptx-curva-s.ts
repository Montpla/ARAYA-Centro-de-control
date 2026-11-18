import { decodeXml, readZipEntries } from "./xlsx-reader";
import { curveMonthIndex } from "./monthly-plan";

/**
 * Lee la Curva S que el Informe Ejecutivo dibuja como gráfico de PowerPoint.
 *
 * El Informe trae cada mes el avance acumulado mes a mes en un gráfico con
 * tres series: "Plan Operativo" (el cronograma original), "Ejecutado Real" y,
 * desde la reprogramación de septiembre de 2026, "Plan reprogramado". Ningún
 * lector lo miraba: la Curva S sólo se movía cuando llegaba el Excel maestro,
 * así que en noviembre faltaba el ejecutado de septiembre (29,38 %) y el plan
 * reprogramado acabó escrito encima del Plan Operativo, haciendo bajar una
 * curva acumulada. Un gráfico es un dato estructurado: se lee sin IA.
 *
 * Sólo se acepta un gráfico que es de verdad una Curva S acumulada: al menos
 * seis meses, porcentajes entre 0 y 100, un plan que no retrocede y que llega
 * a completarse. Un gráfico de barras mensuales (presupuestado frente a real
 * de un mes) no cumple eso y se ignora.
 */

/** Meses del calendario de la Curva S: junio 2025 → agosto 2027. */
export const CURVA_S_MONTH_COUNT = 27;

export type CurvaSSeriesRole = "planned" | "actual" | "reprogrammed";

export type CurvaSPoint = { index: number; value: number };

export type CurvaSChart = Partial<Record<CurvaSSeriesRole, CurvaSPoint[]>>;

const SPANISH_MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Índice de la Curva S (junio 2025 = 0) para una categoría de gráfico. */
export function curvaSCategoryIndex(category: string): number | null {
  const text = category.trim().toLowerCase();
  const iso = /^(20\d{2})[-/.](\d{1,2})/.exec(text);
  if (iso) return curveMonthIndex(`${iso[1]}-${iso[2].padStart(2, "0")}`);
  const named = /^([a-z]{3})[a-z]*[\s.\-/]*'?(\d{2}|20\d{2})$/.exec(text.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  if (named && SPANISH_MONTHS[named[1]]) {
    const year = named[2].length === 2 ? `20${named[2]}` : named[2];
    return curveMonthIndex(`${year}-${String(SPANISH_MONTHS[named[1]]).padStart(2, "0")}`);
  }
  // Fecha de Excel (número de serie) en el eje de categorías.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(text)) * 86_400_000);
    return curveMonthIndex(date.toISOString().slice(0, 7));
  }
  return null;
}

function seriesRole(name: string): CurvaSSeriesRole | null {
  const text = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/reprogram/.test(text)) return "reprogrammed";
  if (/ejecutad|\breal\b/.test(text)) return "actual";
  if (/plan|program/.test(text)) return "planned";
  return null;
}

function points(block: string) {
  return [...block.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)]
    .map((match) => [Number(match[1]), decodeXml(match[2])] as const);
}

/** Interpreta el XML de un gráfico; null si no es una Curva S acumulada. */
export function parseCurvaSChartXml(xml: string): CurvaSChart | null {
  const chart: CurvaSChart = {};
  for (const [, serie] of xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)) {
    const name = decodeXml(serie.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/)?.[1] ?? "");
    const role = seriesRole(name);
    if (!role || chart[role]) continue;
    const categories = new Map(points(serie.match(/<c:cat>([\s\S]*?)<\/c:cat>/)?.[1] ?? ""));
    const values: CurvaSPoint[] = [];
    for (const [idx, raw] of points(serie.match(/<c:val>([\s\S]*?)<\/c:val>/)?.[1] ?? "")) {
      const index = curvaSCategoryIndex(categories.get(idx) ?? "");
      const value = Number(raw);
      if (index === null || !Number.isFinite(value)) continue;
      values.push({ index, value });
    }
    if (values.length) chart[role] = values.sort((left, right) => left.index - right.index);
  }
  const planned = chart.planned ?? [];
  const actual = chart.actual ?? [];
  if (planned.length < 6 || actual.length < 2) return null;
  // Un gráfico con formato de porcentaje guarda fracciones (0,3206).
  const all = Object.values(chart).flat();
  const scale = all.every((point) => point.value <= 1.0001) ? 100 : 1;
  for (const role of Object.keys(chart) as CurvaSSeriesRole[]) {
    chart[role] = chart[role]!.map((point) => ({ ...point, value: Math.round(point.value * scale * 100) / 100 }));
  }
  const scaled = Object.values(chart).flat();
  if (scaled.some((point) => point.value < 0 || point.value > 100)) return null;
  const plannedValues = chart.planned!.map((point) => point.value);
  const cumulative = plannedValues.every((value, index) => index === 0 || value >= plannedValues[index - 1]);
  if (!cumulative || Math.max(...plannedValues) < 95) return null;
  return chart;
}

/** Busca la Curva S entre los gráficos de una presentación. */
export async function readPptxCurvaS(bytes: ArrayBuffer): Promise<CurvaSChart | null> {
  const entries = await readZipEntries(bytes, (name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  for (const entry of entries) {
    const chart = parseCurvaSChartXml(new TextDecoder().decode(entry.data));
    if (chart) return chart;
  }
  return null;
}

/**
 * Claves vivas de la Curva S. `monthCount` es la longitud del calendario del
 * modelo (junio 2025 → agosto 2027): un mes fuera de él no se publica.
 */
export function curvaSUpdates(chart: CurvaSChart, monthCount: number) {
  const updates: Array<{ key: string; value: number }> = [];
  for (const role of ["planned", "actual", "reprogrammed"] as const) {
    for (const point of chart[role] ?? []) {
      if (point.index < 0 || point.index >= monthCount) continue;
      updates.push({ key: `monthlyPlan.${point.index}.${role}`, value: point.value });
    }
  }
  return updates;
}
