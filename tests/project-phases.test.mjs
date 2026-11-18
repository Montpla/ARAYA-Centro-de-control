import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildings } from "../app/demo-data.ts";
import { extractProjectXmlUpdates, phaseForChapter } from "../lib/project-xml.ts";
import { syncUnitsWithBuildingPhases, unitOverallProgress } from "../lib/unit-progress.ts";

function tarea(name, nivel, { summary = false, pct = null, horas = 8 } = {}) {
  return `<Task><Name>${name}</Name><OutlineLevel>${nivel}</OutlineLevel><Summary>${summary ? 1 : 0}</Summary>` +
    (pct === null ? "" : `<PercentComplete>${pct}</PercentComplete>`) +
    `<Duration>PT${horas}H0M0S</Duration><Start>2026-07-01T08:00:00</Start><Finish>2027-07-06T17:00:00</Finish></Task>`;
}

// Misma forma que el plan real de octubre: EDIFICACIONES → capítulo → edificio → tareas.
const plan = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Tasks>${[
  tarea("Araya 26 edificios", 0, { summary: true }),
  tarea("ARAYA-PTA CANA (CONSTRUCCION 26 EDIFICIOS)", 1, { summary: true }),
  tarea("EDIFICACIONES", 2, { summary: true }),
  tarea("INFRAESTRUCTURA", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Platea", 5, { pct: 100, horas: 40 }),
  tarea("SUPERESTRUCTURA", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Muros", 5, { pct: 100, horas: 40 }),
  tarea("ALBAÑILERIA", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Bloques", 5, { pct: 100, horas: 20 }),
  tarea("INSTALACION DE GAS, SONDEO Y COLGANTES AGUA RESIDUAL", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Gas", 5, { pct: 60, horas: 10 }),
  tarea("INSTALACIONES ELECTRICAS", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Cableado", 5, { pct: 0, horas: 10 }),
  tarea("ESTUCADO", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Estuco", 5, { pct: 80, horas: 30 }),
  tarea("PINTURA", 3, { summary: true }),
  tarea("TH-03", 4, { summary: true }),
  tarea("Pintura interior", 5, { pct: 20, horas: 10 }),
].join("")}</Tasks></Project>`;

test("cada capítulo del plan real cae en su fase", () => {
  assert.equal(phaseForChapter("INFRAESTRUCTURA"), "comun");
  assert.equal(phaseForChapter("ESCALERA"), "comun");
  assert.equal(phaseForChapter("IMPERMABILIZACION"), "comun");
  assert.equal(phaseForChapter("PAREDES DE PATIOS Y OBRAS EXTERIORES"), "comun");
  assert.equal(phaseForChapter("PANEL SOLAR"), "comun");
  assert.equal(phaseForChapter("SUPERESTRUCTURA"), "superestructura");
  assert.equal(phaseForChapter("ALBAÑILERIA"), "albanileria");
  assert.equal(phaseForChapter("INSTALACION DE GAS, SONDEO Y COLGANTES AGUA RESIDUAL"), "instalaciones");
  assert.equal(phaseForChapter("INSTALACIONES ELECTRICAS"), "instalaciones");
  assert.equal(phaseForChapter("INSTALACIONES SANITARIAS"), "instalaciones");
  for (const acabado of ["ESTUCADO", "REVESTIMIENTOS", "VIDRIO Y ALUMINIO", "HERRERIA", "PINTURA", "PISO DE VINYL",
    "CARPINTERIA", "ZOCALO Y MASILLA", "PLAFON EN TECHO", "MAMPARA BAÑOS", "TEXTURIZADO", "REMATES Y LIMPIEZA"]) {
    assert.equal(phaseForChapter(acabado), "acabados", acabado);
  }
  assert.equal(phaseForChapter("EDIFICACIONES"), null);
  assert.equal(phaseForChapter("TH-14"), null);
});

test("el plan publica el avance por fase de cada edificio, ponderado por duración", () => {
  const { updates, summary } = extractProjectXmlUpdates(plan);
  const valor = (key) => updates.find((update) => update.key === key)?.value;
  assert.equal(valor("buildings.TH-03.phases.0.progress"), 100);
  assert.equal(valor("buildings.TH-03.phases.1.progress"), 100);
  assert.equal(valor("buildings.TH-03.phases.2.progress"), 100);
  assert.equal(valor("buildings.TH-03.phases.3.progress"), 30, "gas 60% y eléctricas 0%, 10 h cada una");
  assert.equal(valor("buildings.TH-03.phases.4.progress"), 65, "estuco 80% (30 h) y pintura 20% (10 h)");
  assert.ok(valor("buildings.TH-03.progress") > 0);
  assert.match(summary, /Avance por fase de 1 edificio/);
  assert.ok(updates.length <= 250);
});

test("los apartamentos heredan las fases nuevas del edificio y cambian de color", () => {
  const edificio = structuredClone(buildings.find((item) => item.shortName === "3"));
  const antes = unitOverallProgress(edificio.units[0], []);
  edificio.phases = edificio.phases.map((fase) => ({ ...fase, progress: { comun: 100, superestructura: 100, albanileria: 100, instalaciones: 60, acabados: 65 }[fase.id] }));

  const actualizados = syncUnitsWithBuildingPhases(edificio);

  assert.equal(actualizados, edificio.units.length);
  const despues = unitOverallProgress(edificio.units[0], []);
  assert.ok(despues > antes, `${despues} debe superar ${antes}`);
  assert.equal(edificio.units[0].disciplines.find((d) => d.id === "acabados").progress, 65);
  assert.equal(edificio.units[0].progress, despues);
  assert.equal(edificio.units[0].status, "en_curso");
});

test("una disciplina anotada a mano por encima del edificio se conserva", () => {
  const edificio = structuredClone(buildings.find((item) => item.shortName === "3"));
  edificio.units[0].disciplines = edificio.units[0].disciplines.map((d) => d.id === "acabados" ? { ...d, progress: 90 } : d);
  edificio.phases = edificio.phases.map((fase) => fase.id === "acabados" ? { ...fase, progress: 65 } : fase);
  syncUnitsWithBuildingPhases(edificio);
  assert.equal(edificio.units[0].disciplines.find((d) => d.id === "acabados").progress, 90);
  assert.equal(edificio.units[1].disciplines.find((d) => d.id === "acabados").progress, 65);
});

test("un apartamento bloqueado no pierde su estado", () => {
  const edificio = structuredClone(buildings.find((item) => item.shortName === "3"));
  edificio.units[0].status = "bloqueada";
  edificio.phases = edificio.phases.map((fase) => ({ ...fase, progress: 100 }));
  syncUnitsWithBuildingPhases(edificio);
  assert.equal(edificio.units[0].status, "bloqueada");
  assert.equal(edificio.units[1].status, "terminada");
});

test("servidor y cliente sincronizan los apartamentos con las fases del edificio", async () => {
  const [servidor, cliente] = await Promise.all([
    readFile("lib/spatial-live-data.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
  ]);
  assert.match(servidor, /syncUnitsWithBuildingPhases\(materialized\)/);
  assert.match(cliente, /syncUnitsWithBuildingPhases\(building\)/);
});
