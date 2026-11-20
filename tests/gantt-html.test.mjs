import assert from "node:assert/strict";
import test from "node:test";
import { readGanttHtml } from "../lib/gantt-html.ts";

const html = (data) => `<html><script>throw new Error('No ejecutar');</script><script id="gantt-data" type="application/json">${JSON.stringify(data)}</script></html>`;
const row = { proj: "P1", key: "Ventanería", pct: .375, ini: "2026-11-02", fin: "2027-01-20", bini: "2026-09-01", bfin: "2026-10-20", crit: true, mat: { orden: "2026-10-15" }, dep: "Albañilería", nota: "Revisión del frente", total: 6, comp: 2.25 };
const buildings = () => ({ hoy: "2026-10-31", metas: { P1: { meta: "2027-01-20" } }, rows: [{ ...row }] });

test("lee el bloque de datos completo sin ejecutar el HTML y conserva el detalle del alcance", () => {
  const result = readGanttHtml(html(buildings()), "Gantt edificios.html");
  assert.equal(result.kind, "buildings"); assert.equal(result.schedule.cutoff, "2026-10-31");
  assert.equal(result.schedule.tasks.length, 1);
  const task = result.schedule.tasks[0];
  assert.equal(task.progress, 37.5); assert.equal(task.start, "2026-11-02");
  assert.equal(task.dependencies, "Albañilería"); assert.equal(task.critical, true);
  assert.deepEqual(JSON.parse(task.originalData), row);
  assert.equal(JSON.parse(task.materials).orden, "2026-10-15");
});

test("urbanismo conserva jerarquía, fechas vigentes y línea base diferenciadas", () => {
  const result = readGanttHtml(html({ corte: "2026-10-31", reinicio: "2026-11-02", meta: "2027-05-24", limite: "2027-05-10", rows: [{ name: "Piscina", grp: "ELEMENTOS URBANOS", lvl: 1, pct: .2, plan: .8, ini: "2026-11-02", fin: "2027-03-01", oini: "2026-06-01", ofin: "2026-10-01" }] }), "Gantt urbanismo.html");
  assert.equal(result.kind, "urbanism");
  assert.equal(result.schedule.tasks[0].plannedLabel, "80 %");
  assert.equal(result.schedule.tasks[0].baselineFinish, "2026-10-01");
  assert.equal(result.schedule.tasks[0].finish, "2027-03-01");
  assert.equal(result.schedule.tasks[0].level, 1);
});

test("rechaza datos parciales, fechas imposibles, porcentajes ambiguos y propiedades peligrosas", () => {
  for (const mutate of [
    (d) => { d.rows[0].pct = 37.5; }, (d) => { d.rows[0].pct = -1; },
    (d) => { d.rows[0].ini = "2026-02-30"; }, (d) => { d.rows.push({}); },
  ]) { const d = buildings(); mutate(d); assert.throws(() => readGanttHtml(html(d), "gantt.html")); }
  assert.throws(() => readGanttHtml(html(buildings()) + html(buildings()), "gantt.html"));
  assert.throws(() => readGanttHtml('<script id="gantt-data" type="application/json">{"__proto__":{}}</script>', "gantt.html"));
  assert.equal(readGanttHtml("<p>Un documento sin datos estructurados</p>", "otro.html"), null);
});
