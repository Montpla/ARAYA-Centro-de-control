import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { composeWeeklySummary } from "../lib/weekly-summary.ts";
import { validRecipients } from "../lib/email-resend.ts";

// El resumen semanal es lo primero que ve el dueño el lunes por la mañana, así
// que lo que importa es que cuente bien la VARIACIÓN de la semana —no un total
// suelto— y que nunca se rompa por no tener con qué comparar.

const base = {
  weekLabel: "del 11 al 17 de agosto de 2026",
  overallNow: 22.1,
  overallPrev: 18.2,
  buildings: [
    { code: "7", name: "Edificio 7", now: 30.6, prev: 26.5 },   // +4,1 mover
    { code: "3", name: "Edificio 3", now: 55, prev: 50 },       // +5,0 mover (mayor)
    { code: "11", name: "Edificio 11", now: 25.2, prev: 25.2 }, // en obra, sin cambio
    { code: "18", name: "Edificio 18", now: 0, prev: 0 },       // no empezado
    { code: "9", name: "Edificio 9", now: 100, prev: 100 },     // terminado
  ],
  documentsThisWeek: 4,
};

test("cuenta la variación de la semana, no sólo el total", () => {
  const r = composeWeeklySummary(base);
  assert.match(r.text, /22,1%/);
  assert.match(r.text, /\+3,9 puntos/); // 22,1 - 18,2
  assert.match(r.subject, /\+3,9 pts/);
});

test("ordena los edificios por lo que más subieron y muestra su avance", () => {
  const r = composeWeeklySummary(base);
  assert.match(r.text, /TH-07: 30,6% \(\+4,1\)/);
  assert.match(r.text, /TH-03: 55% \(\+5\)/);
  // El mayor (TH-03, +5) va antes que TH-07 (+4,1).
  assert.ok(r.text.indexOf("TH-03") < r.text.indexOf("TH-07"), "ordenado por variación");
});

test("señala los edificios en obra que no se movieron, y no los que están a 0 o al 100", () => {
  const r = composeWeeklySummary(base);
  assert.match(r.text, /sin avance esta semana/i);
  assert.match(r.text, /TH-11/); // en obra (25,2%) y sin cambio
  assert.doesNotMatch(r.text, /TH-18/); // a 0: no empezado, no es "parado"
  assert.doesNotMatch(r.text, /TH-09/); // al 100: terminado, no es "parado"
});

test("cuenta los documentos subidos, en singular y plural", () => {
  assert.match(composeWeeklySummary({ ...base, documentsThisWeek: 4 }).text, /4 documentos/);
  assert.match(composeWeeklySummary({ ...base, documentsThisWeek: 1 }).text, /1 documento\b/);
  assert.doesNotMatch(composeWeeklySummary({ ...base, documentsThisWeek: 0 }).text, /documento/);
});

test("el primer resumen no se rompe por no tener semana anterior", () => {
  const r = composeWeeklySummary({
    ...base,
    overallPrev: null,
    buildings: base.buildings.map((b) => ({ ...b, prev: null })),
  });
  assert.match(r.text, /primer resumen/i);
  assert.doesNotMatch(r.subject, /pts/); // sin variación en el asunto
  assert.doesNotMatch(r.text, /NaN/);
});

test("una semana sin cambios lo dice en vez de inventar movimiento", () => {
  const quieto = composeWeeklySummary({
    ...base,
    overallNow: 18.2,
    buildings: base.buildings.map((b) => ({ ...b, now: b.prev ?? 0 })),
  });
  assert.match(quieto.text, /se ha mantenido igual/);
  assert.doesNotMatch(quieto.text, /más se movió/);
});

test("el HTML es un correo válido y sin marcadores sin sustituir", () => {
  const r = composeWeeklySummary(base);
  assert.match(r.html, /<div/);
  assert.match(r.html, /22,1/);
  assert.doesNotMatch(r.html, /\$\{/); // ningún template sin resolver
  assert.doesNotMatch(r.html, /undefined|NaN/);
});

test("los destinatarios se limpian: sin repetidos, sin correos inválidos", () => {
  const limpios = validRecipients([
    "Uno@Araya.com", "uno@araya.com", "  dos@araya.com ", "no-es-correo", "",
  ]);
  assert.deepEqual(limpios, ["uno@araya.com", "dos@araya.com"]);
});

// --- La migración crea la tabla que la comparación semanal necesita ---------

test("la migración 0023 crea weekly_summary_snapshots", async () => {
  const root = new URL("../", import.meta.url);
  const journal = JSON.parse(await readFile(new URL("drizzle/meta/_journal.json", root), "utf8"));
  const db = new DatabaseSync(":memory:");
  for (const entry of journal.entries) {
    const sql = await readFile(new URL(`drizzle/${entry.tag}.sql`, root), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt.trim());
    }
  }
  const cols = db.prepare("PRAGMA table_info(weekly_summary_snapshots)").all().map((r) => r.name);
  for (const col of ["overall_progress", "buildings_json", "documents_count", "created_at"]) {
    assert.ok(cols.includes(col), `falta la columna ${col}`);
  }
  db.close();
});
