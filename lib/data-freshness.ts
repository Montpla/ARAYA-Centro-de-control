// Semáforo de frescura por indicador.
//
// El Centro de Control se refresca en segundos, pero eso solo describe la
// velocidad del transporte: un KPI puede estar "en vivo" y referirse a un
// corte de hace dos meses porque nadie ha subido el Excel nuevo. Sin esta
// señal, la inmediatez de la interfaz sugiere una frescura que el dato no
// tiene. Aquí se calcula la edad real a partir de la procedencia que
// /api/live-data ya publica por clave.
//
// Se mide contra la fecha de corte del dato (a qué fecha se refiere), no
// contra la de publicación: si un archivo de junio se sube en agosto, el
// número sigue siendo de junio. Cuando no hay corte declarado se usa la
// fecha de actualización como aproximación, y queda señalado como tal.

export type FreshnessLevel = "fresh" | "aging" | "stale" | "unknown";

export type ProvenanceEntry = {
  area?: string;
  cutoff?: string;
  revision?: number;
  sourceName?: string;
  updatedAt?: string;
  updatedByName?: string;
};

export type FreshnessReading = {
  level: FreshnessLevel;
  ageDays: number | null;
  basis: "cutoff" | "updatedAt" | "none";
  cutoff: string;
  sourceName: string;
  updatedAt: string;
  label: string;
};

// El proyecto trabaja con cortes mensuales: por debajo de 35 días el dato
// pertenece al ciclo vigente; entre 35 y 70 se ha saltado un cierre; por
// encima, dos o más.
export const FRESH_MAX_DAYS = 35;
export const AGING_MAX_DAYS = 70;

const DAY_MS = 24 * 60 * 60 * 1000;

// Acepta ISO (2026-06-30, con o sin hora) y el formato español dd/mm/aaaa
// que usan varios cortes declarados del proyecto.
function parseDate(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const spanish = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (spanish) {
    const [, day, month, year] = spanish;
    const parsed = Date.parse(`${year}-${month}-${day}T00:00:00Z`);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function levelForAge(ageDays: number): FreshnessLevel {
  if (ageDays <= FRESH_MAX_DAYS) return "fresh";
  if (ageDays <= AGING_MAX_DAYS) return "aging";
  return "stale";
}

function describe(reading: Omit<FreshnessReading, "label">): string {
  if (reading.level === "unknown" || reading.ageDays === null) {
    return "Sin procedencia registrada: este valor procede de la base documental integrada.";
  }
  const origin = reading.basis === "cutoff"
    ? `corte ${reading.cutoff}`
    : `publicado el ${reading.updatedAt.slice(0, 10)} (sin corte declarado)`;
  const age = reading.ageDays <= 0
    ? "de hoy"
    : reading.ageDays === 1
      ? "de hace 1 día"
      : `de hace ${reading.ageDays} días`;
  const verdict = reading.level === "fresh"
    ? "Dentro del ciclo mensual vigente."
    : reading.level === "aging"
      ? "Se ha saltado un cierre mensual: conviene pedir la actualización."
      : "Dos o más cierres sin actualizar: el valor puede no reflejar la obra actual.";
  return `Dato ${age} · ${origin}. ${verdict}`;
}

/**
 * Lee la frescura de un indicador a partir de las claves de procedencia que
 * lo alimentan. Se admite tanto la clave exacta como cualquier subclave
 * (`monthlyPlan` cubre `monthlyPlan.12.actual`), y entre todas las
 * coincidencias gana la más reciente: un indicador es tan fresco como su
 * evidencia más nueva.
 */
export function readFreshness(
  provenance: Record<string, ProvenanceEntry>,
  keys: readonly string[],
  now: number = Date.now(),
): FreshnessReading {
  let best: { timestamp: number; entry: ProvenanceEntry; basis: "cutoff" | "updatedAt" } | null = null;

  for (const [key, entry] of Object.entries(provenance ?? {})) {
    const matches = keys.some((candidate) => key === candidate || key.startsWith(`${candidate}.`));
    if (!matches || !entry) continue;
    const cutoffTime = parseDate(entry.cutoff ?? "");
    const updatedTime = parseDate(entry.updatedAt ?? "");
    const timestamp = cutoffTime ?? updatedTime;
    if (timestamp === null) continue;
    if (!best || timestamp > best.timestamp) {
      best = { timestamp, entry, basis: cutoffTime === null ? "updatedAt" : "cutoff" };
    }
  }

  if (!best) {
    const reading = {
      level: "unknown" as const,
      ageDays: null,
      basis: "none" as const,
      cutoff: "",
      sourceName: "",
      updatedAt: "",
    };
    return { ...reading, label: describe(reading) };
  }

  const ageDays = Math.max(0, Math.floor((now - best.timestamp) / DAY_MS));
  const reading = {
    level: levelForAge(ageDays),
    ageDays,
    basis: best.basis,
    cutoff: best.entry.cutoff ?? "",
    sourceName: best.entry.sourceName ?? "",
    updatedAt: best.entry.updatedAt ?? "",
  };
  return { ...reading, label: describe(reading) };
}

/**
 * Claves vivas que alimentan cada indicador del resumen. El semáforo solo se
 * muestra en los indicadores presentes aquí: preferimos no señalar nada antes
 * que atribuir a un KPI una procedencia que no es la suya.
 */
export const STAT_CARD_FRESHNESS_KEYS: Record<string, readonly string[]> = {
  "Avance físico": ["monthlyPlan", "projectSnapshot"],
  "Plan operativo": ["monthlyPlan", "projectSnapshot"],
  "Cronograma MPP": ["projectSnapshot", "workPackages"],
  "Fin previsto": ["projectSnapshot", "workPackages"],
  "Previsión final": ["projectSnapshot", "workPackages"],
  "Paquetes": ["workPackages"],
  "Camino crítico": ["workPackages"],
  "Alcance residencial": ["buildings", "projectSnapshot"],
  "Apartamentos integrados": ["advances", "buildings"],
  "Edificios relacionados": ["buildings"],
  "Reservas activas": ["juneReport", "salesModels"],
  "Fase I": ["juneReport", "salesModels"],
  "Fase II": ["juneReport", "salesModels"],
  "Cartera vencida": ["juneReport", "arrearsBreakdown"],
  "Medición físico-financiera": ["urbanismAreas", "urbanismReportAreas"],
  "Actividades terminadas": ["urbanismReportAreas", "urbanismAreas"],
  "Mayor avance": ["urbanismReportAreas", "urbanismAreas"],
  "Arranques demorados": ["delayedUrbanismStarts"],
  "Facturas consolidadas": ["antonelyPayableInvoiceLines", "antonelyDetailTotals"],
  "Mayor exposición": ["antonelyPayableVendorsAll", "antonelyPayableInvoiceLines"],
  "CxP departamental": ["cxpCategories", "antonelyPayableCategories"],
  "Presupuesto de control": ["juneReport", "costBreakdown"],
  "Coste acumulado": ["costBreakdown", "juneReport"],
  "Cuentas por pagar": ["cxpAging", "antonelyDetailTotals"],
  "Caja proyectada · dic": ["financialProjection"],
};
