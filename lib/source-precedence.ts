// Reglas de prioridad entre fuentes: qué documento manda cuando dos dicen
// cosas distintas del mismo dato. Son decisiones del dueño del proyecto; la
// versión legible y completa está en .github/claude/reglas-de-prioridad.md, y
// cada regla nueva que él decida se añade allí y, si se puede aplicar sola,
// aquí.
//
// Hoy se aplica al avance físico (edificios, oficios, urbanismo, avance total y
// el ejecutado de la Curva S): "deben mandar los edificios y la cubicación".
// Un documento de menos prioridad no pisa lo que ya fijó uno de más prioridad
// para el mismo periodo (el Informe Ejecutivo de octubre dejó Carpintería al
// 96,2 % por encima de la cubicación); sí puede adelantar un periodo nuevo,
// que la siguiente cubicación corregirá.

type SourceRule = { pattern: RegExp; rank: number; label: string };

const PHYSICAL_PROGRESS_SOURCES: SourceRule[] = [
  { pattern: /cubicaci[oó]n/i, rank: 40, label: "Cubicación" },
  { pattern: /avance[ _-]*(de[ _-]*)?(edificios?|urbanismo)/i, rank: 30, label: "Excel de avance de edificios o urbanismo" },
  { pattern: /convertido de mpp|\.mpp\b|\.xml\b/i, rank: 20, label: "Plan de Project" },
  { pattern: /informe[ _-]*ejecutivo|\.pptx?\b/i, rank: 10, label: "Informe Ejecutivo o presentación" },
];

export const PHYSICAL_PROGRESS_KEY = /^(buildings\.[^.]+\.(progress|constructionDisciplines(?:\.\d+\.progress)?)|buildings\.[^.]+\.units\.[^.]+\.(progress|disciplines\.[^.]+)|constructionDisciplines\.[^.]+\.progress|urbanismAreas\.[^.]+\.progress|urbanismReportAreas\.[^.]+(?:\.progress)?|projectSnapshot\.(overallProgress|urbanismProgress|activeBuildingsProgress)|monthlyPlan\.\d+\.actual)$/;

// Decisión de la oficina de obra, trasladada por el dueño (25/11/2026): el
// ejecutado de la Curva S —y con él el avance global del resumen— sale del
// Excel de la curva («EJECUTADOS MES …»), no de la cubicación. La cubicación
// sigue mandando en edificios, oficios y urbanismo.
export const CURVE_ACTUAL_KEY = /^(monthlyPlan\.\d+\.actual|projectSnapshot\.overallProgress)$/;
const CURVE_FILE = /curva.*rep.*gram.*\.xlsx\b/i;

/**
 * Prioridad de un documento para el avance físico (0 si no tiene regla).
 * Con `key`, aplica además las excepciones por dato (el ejecutado de la curva).
 */
export function physicalProgressRank(sourceName: string, key?: string) {
  const name = String(sourceName ?? "");
  if (key && CURVE_ACTUAL_KEY.test(key) && CURVE_FILE.test(name)) return 50;
  return PHYSICAL_PROGRESS_SOURCES.find((rule) => rule.pattern.test(name))?.rank ?? 0;
}

export function physicalProgressSourceLabel(sourceName: string) {
  const name = String(sourceName ?? "");
  return PHYSICAL_PROGRESS_SOURCES.find((rule) => rule.pattern.test(name))?.label ?? "otro documento";
}

const month = (cutoff: string) => String(cutoff ?? "").slice(0, 7);
const PLANNING_CURVE_KEY = /^monthlyPlan\.\d+\.(planned|reprogrammed|originalDocumentProgress|reprogrammedBuildingsProgress|reprogrammedUrbanismProgress)$/;
const FINANCIAL_FLOW_KEY = /^reprogrammedFlow(?:Months|Scopes|Audit)(?:\.|$)/;
const financialFlowRank = (source: string) => /flujo.*reprogram.*\.xlsx\b/i.test(source) ? 40 : /\.pptx?\b/i.test(source) ? 10 : 0;
const masterCurve = /graficos[ _-]*araya|plan[ _-]*operativo/i;
function planningRank(source: string, key: string) {
  if (/\.planned$/.test(key) && masterCurve.test(source) && /\.xlsx\b/i.test(source)) return 40;
  if (!/\.planned$/.test(key) && /curva.*rep.*gram.*\.xlsx\b/i.test(source)) return 40;
  return /\.pptx?\b|informe[ _-]*ejecutivo/i.test(source) ? 10 : 0;
}

/**
 * ¿Debe apartarse este dato porque una fuente con más prioridad ya fijó la
 * misma clave para el mismo periodo (o uno posterior)?
 */
export function blockedByHigherPrioritySource(input: {
  key: string;
  incomingSource: string;
  incomingCutoff: string;
  liveSource?: string | null;
  liveCutoff?: string | null;
}) {
  const planning = PLANNING_CURVE_KEY.test(input.key);
  const financialFlow = FINANCIAL_FLOW_KEY.test(input.key);
  if (!PHYSICAL_PROGRESS_KEY.test(input.key) && !planning && !financialFlow) return false;
  const liveSource = String(input.liveSource ?? "");
  if (!liveSource || liveSource === input.incomingSource) return false;
  const liveRank = financialFlow ? financialFlowRank(liveSource) : planning ? planningRank(liveSource, input.key) : physicalProgressRank(liveSource, input.key);
  const incomingRank = financialFlow ? financialFlowRank(input.incomingSource) : planning ? planningRank(input.incomingSource, input.key) : physicalProgressRank(input.incomingSource, input.key);
  if (liveRank <= incomingRank) return false;
  // La serie «Original» de un informe no sustituye la línea base operativa
  // del Excel maestro, aunque el informe se publique en un mes posterior.
  if (planning && /\.planned$/.test(input.key) && liveRank === 40) return true;
  const incomingMonth = month(input.incomingCutoff);
  const liveMonth = month(input.liveCutoff ?? "");
  // Un periodo nuevo sí entra aunque venga de una fuente de menos prioridad.
  if (/^\d{4}-\d{2}$/.test(incomingMonth) && /^\d{4}-\d{2}$/.test(liveMonth) && incomingMonth > liveMonth) return false;
  return true;
}
