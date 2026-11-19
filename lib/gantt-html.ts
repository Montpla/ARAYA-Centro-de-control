import type { GanttSchedule, GanttTask } from "./gantt-data";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
const date = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("El Gantt contiene una fecha no válida.");
  return value;
};

/** Lee exclusivamente el bloque JSON de datos; nunca ejecuta el HTML adjunto. */
export function readGanttHtml(html: string, sourceName: string) {
  if (html.length > 2_000_000) throw new Error("El HTML supera el tamaño admitido por el lector de Gantt.");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const blocks = scripts.filter(([, attrs]) => /\bid\s*=\s*(["'])gantt-data\1/i.test(attrs) && /\btype\s*=\s*(["'])application\/json\1/i.test(attrs));
  if (!blocks.length) return null;
  if (blocks.length !== 1) throw new Error("Hay más de un bloque de datos Gantt; no se publica una interpretación ambigua.");
  const data: unknown = JSON.parse(blocks[0][2], (key, value: unknown) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("El bloque Gantt contiene una propiedad no autorizada.");
    return value;
  });
  if (!isRecord(data) || !Array.isArray(data.rows) || !data.rows.length || data.rows.length > 1000) throw new Error("El Gantt no contiene una lista completa de tareas admitida.");
  const kind = typeof data.corte === "string" ? "urbanism" : typeof data.hoy === "string" && isRecord(data.metas) ? "buildings" : null;
  if (!kind) throw new Error("No se reconoce el alcance del Gantt.");
  const cutoff = date(kind === "urbanism" ? data.corte : data.hoy);
  if (!cutoff) throw new Error("El Gantt debe declarar su fecha de corte.");
  const tasks: GanttTask[] = data.rows.map((row: unknown, index) => {
    if (!isRecord(row)) throw new Error("El Gantt contiene una tarea no válida.");
    if (typeof row.pct !== "number" || !Number.isFinite(row.pct) || row.pct < 0 || row.pct > 1) throw new Error("El avance de una tarea debe estar expresado entre cero y uno.");
    const name = text(kind === "urbanism" ? row.name : row.key).trim();
    if (!name) throw new Error("Hay tareas sin nombre en el Gantt.");
    const group = text(kind === "urbanism" ? row.grp : row.proj);
    const notes = [row.nota, row.com, row.motivo, row.bnota, row.alc].map(text).filter(Boolean).join(" · ");
    const task: GanttTask = {
      code: `${kind === "urbanism" ? "URB" : "EDI"}-${index + 1}`,
      name, group, level: typeof row.lvl === "number" ? row.lvl : 0,
      progress: row.pct * 100,
      plannedLabel: typeof row.plan === "number" && Number.isFinite(row.plan) && row.plan >= 0 && row.plan <= 1 ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(row.plan * 100)} %` : "Sin dato",
      start: date(row.ini), finish: date(row.fin),
      baselineStart: date(kind === "urbanism" ? row.oini : row.bini),
      baselineFinish: date(kind === "urbanism" ? row.ofin : row.bfin),
      reportedState: text(row.estado ?? row.cat), riskLabel: text(row.riesgo), critical: row.crit === true,
      durationLabel: text(row.durV ?? row.dur), resources: text(row.asig ?? row.resp),
      dependencies: text(row.dep), materials: text(row.mat), notes,
      originalData: JSON.stringify(row),
    };
    if (Object.values(task).some((v) => typeof v === "string" && v.length > 10_000)) throw new Error("Una tarea supera el tamaño permitido; no se publica el Gantt parcialmente.");
    return task;
  });
  const scope = kind === "buildings" ? JSON.stringify(data.metas) : `Reinicio: ${date(data.reinicio)} · Meta: ${date(data.meta)} · Límite interno: ${date(data.limite)}`;
  const schedule: GanttSchedule = { title: kind === "buildings" ? "Gantt de edificaciones" : "Gantt de urbanismo", cutoff, sourceName, scope, tasks };
  return { kind, schedule };
}
