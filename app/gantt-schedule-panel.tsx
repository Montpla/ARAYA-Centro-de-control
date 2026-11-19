"use client";
import { useMemo, useState } from "react";
import type { ganttSchedules, GanttTask } from "../lib/gantt-data";

const labels: Record<string, string> = { total: "Unidades del alcance", comp: "Unidades completadas", pend: "Unidades pendientes", unit: "Unidad", act: "Actividad", alc: "Alcance", dep: "Dependencias", resp: "Responsable", com: "Comentarios", repro: "Reprogramada", ajust: "Ajustada", motivo: "Motivo", exceso: "Exceso declarado", sinavance: "Sin avance", riesgo: "Riesgo", bnota: "Nota de línea base", justif: "Justificación", mat: "Materiales", wbs: "Código WBS", prop: "Propuesta", durV: "Duración vigente", atr: "Atrasada", atrP: "Atraso frente al plan", dur: "Duración", asig: "Asignación", cuad: "Cuadrillas", holgL: "Holgura al límite", holgM: "Holgura a la meta", pini: "Inicio previsto", pfin: "Fin previsto", oini: "Inicio original", ofin: "Fin original" };
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return Object.entries(value).map(([key, val]) => `${labels[key] ?? key}: ${display(val)}`).join(" · ");
  return String(value);
}

export function GanttSchedulePanel({ schedules }: { schedules: typeof ganttSchedules }) {
  const [selected, setSelected] = useState<"buildings" | "urbanism">("buildings");
  const [group, setGroup] = useState(""); const [query, setQuery] = useState("");
  const schedule = schedules[selected];
  const groups = [...new Set(schedule.tasks.map((task) => task.group))];
  const filtered = schedule.tasks.filter((task) => (!group || task.group === group) && `${task.name} ${task.notes}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const dates = useMemo(() => schedule.tasks.flatMap((task) => [task.start, task.finish, task.baselineStart, task.baselineFinish]).filter(Boolean).map(Date.parse), [schedule.tasks]);
  const start = dates.length ? Math.min(...dates) : 0; const end = dates.length ? Math.max(...dates) : 1;
  const span = Math.max(86_400_000, end - start);
  const position = (date: string) => (Date.parse(date) - start) / span * 100;
  const scope = (() => { try { return display(JSON.parse(schedule.scope)); } catch { return schedule.scope; } })();
  return <section className="panel imported-gantt">
    <div className="panel-heading"><div><span className="section-kicker">CRONOGRAMAS DOCUMENTALES</span><h3>Gantt de edificaciones y urbanismo</h3></div></div>
    <div className="plan-layer-switch" role="group" aria-label="Cronograma documental">
      <button type="button" className={selected === "buildings" ? "active" : ""} onClick={() => { setSelected("buildings"); setGroup(""); }}>Edificaciones · {schedules.buildings.tasks.length} tareas</button>
      <button type="button" className={selected === "urbanism" ? "active" : ""} onClick={() => { setSelected("urbanism"); setGroup(""); }}>Urbanismo · {schedules.urbanism.tasks.length} tareas</button>
    </div>
    {!schedule.tasks.length ? <p>El cronograma se mostrará cuando se incorpore su archivo HTML.</p> : <>
      <p className="section-intro">Fuente: {schedule.sourceName} · corte {schedule.cutoff}. El avance mostrado pertenece al alcance de cada tarea del cronograma. El avance físico certificado se consulta en el resumen del proyecto.</p>
      <p className="gantt-scope">{scope}</p>
      <div className="gantt-filters"><label>Frente o proyecto<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="">Todos</option>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Buscar tarea<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre u observación" /></label><span>{filtered.length} de {schedule.tasks.length} tareas</span></div>
      <div className="gantt-table-scroll"><table className="gantt-task-table"><thead><tr><th>Tarea y alcance</th><th>Avance declarado</th><th>Plan declarado</th><th>Inicio / fin vigente</th><th>Línea base</th><th>Calendario · {new Date(start).toISOString().slice(0, 7)} a {new Date(end).toISOString().slice(0, 7)}</th></tr></thead><tbody>
        {filtered.map((task: GanttTask) => <tr key={task.code}>
          <th scope="row"><small>{task.group}{task.critical ? " · Crítica" : ""}</small><strong style={{ paddingLeft: task.level * 10 }}>{task.name}</strong>
            <details><summary>Estado, recursos y observaciones</summary><p>{task.reportedState} {task.riskLabel && `· Riesgo ${task.riskLabel}`}</p>{task.notes && <p>{task.notes}</p>}
              <dl>{Object.entries(JSON.parse(task.originalData) as Record<string, unknown>).filter(([key, value]) => labels[key] && value !== null && value !== "").map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{display(value)}</dd></div>)}</dl>
            </details>
          </th><td>{new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(task.progress)} %</td><td>{task.plannedLabel}</td>
          <td>{task.start || "Sin fecha"}<br />{task.finish || "Sin fecha"}</td><td>{task.baselineStart || "Sin fecha"}<br />{task.baselineFinish || "Sin fecha"}</td>
          <td><div className="gantt-track" aria-label={`${task.name}: ${task.start || "sin inicio"} a ${task.finish || "sin fin"}`}>
            {task.baselineStart && task.baselineFinish && <i className="gantt-baseline" style={{ left: `${position(task.baselineStart)}%`, width: `${Math.max(.3,position(task.baselineFinish)-position(task.baselineStart))}%` }} />}
            {task.start && task.finish && <i className={`gantt-current ${task.critical ? "critical" : ""}`} style={{ left: `${position(task.start)}%`, width: `${Math.max(.3,position(task.finish)-position(task.start))}%` }}><b style={{ width: `${task.progress}%` }} /></i>}
            {schedule.cutoff && <i className="gantt-cutoff" style={{ left: `${position(schedule.cutoff)}%` }} />}
          </div></td>
        </tr>)}
      </tbody></table></div>
      <p className="data-note">Barra gris: línea base · barra verde: calendario vigente · relleno: avance declarado · marca vertical: corte del documento.</p>
    </>}
  </section>;
}
