#!/usr/bin/env node
// Muestra la estructura del último plan de Project (XML) de edificios subido a
// producción: capítulos, edificios y avance ponderado por duración de cada
// capítulo en cada edificio. Sólo lectura y sólo porcentajes; ningún importe.
//
// Sirve para decidir a qué fase del modelo (obra común, superestructura,
// albañilería, instalaciones, acabados) pertenece cada capítulo del plan.

import { buildings as baselineBuildings } from "../app/demo-data.ts";
import { extractProjectXmlUpdates, phaseForChapter, readProjectTasks } from "../lib/project-xml.ts";
import { PHASE_WEIGHTS } from "../lib/progress-model.ts";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const FILTRO = (process.env.FILTRO ?? "26 edificios").toLowerCase();

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!session) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${session[1]}`;

const listado = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
const { files = [] } = await listado.json();
const candidatos = files
  .filter((file) => /\.xml$/i.test(file.originalName) && file.originalName.toLowerCase().includes(FILTRO))
  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
if (!candidatos.length) {
  console.error(`✖ No hay XML de Project cuyo nombre contenga "${FILTRO}".`);
  process.exit(1);
}
const archivo = candidatos[0];
console.log(`=== ${archivo.originalName} · subido ${archivo.createdAt} ===`);

const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(archivo.id)}`, { headers: { Cookie } });
if (!descarga.ok) {
  console.error(`✖ La descarga devolvió ${descarga.status}.`);
  process.exit(1);
}
const texto = await descarga.text();
const tareas = readProjectTasks(texto, 10_000);
console.log(`tareas: ${tareas.length}`);

// Resúmenes de los primeros niveles: así se ve cómo está organizado el plan.
console.log("\n=== Resúmenes de nivel 1 a 3 (nombre · %) ===");
for (const tarea of tareas) {
  if (!tarea.summary || (tarea.outlineLevel ?? 99) > 3) continue;
  const sangria = "  ".repeat(Math.max(0, (tarea.outlineLevel ?? 1) - 1));
  console.log(`${sangria}[${tarea.outlineLevel}] ${tarea.name} · ${tarea.percentComplete ?? "-"}%`);
}

// Fases por edificio tal como las publicará el importador, al lado de la línea
// base de julio (de la que salen hoy los apartamentos).
const extraccion = extractProjectXmlUpdates(texto, undefined, archivo.originalName);
const capitulosSinFase = [...new Set(
  tareas.filter((tarea) => tarea.summary && (tarea.outlineLevel ?? 0) === 3 && !phaseForChapter(tarea.name))
    .map((tarea) => tarea.name),
)];
console.log(`\ncapítulos sin fase asignada: ${capitulosSinFase.length ? capitulosSinFase.join(", ") : "ninguno"}`);
console.log(`resumen del importador: ${extraccion.summary}`);
const valores = Object.fromEntries(extraccion.updates.map((update) => [update.key, update.value]));
const fases = PHASE_WEIGHTS.map((fase) => fase.id);
console.log(`\n=== Fases por edificio: octubre (julio) · ${fases.join(" / ")} ===`);
for (const edificio of baselineBuildings.filter((item) => item.phases?.some((fase) => fase.progress > 0) || valores[`buildings.TH-${item.shortName.padStart(2, "0")}.progress`] !== undefined)) {
  const codigo = `TH-${edificio.shortName.padStart(2, "0")}`;
  const partes = fases.map((fase, posicion) => {
    const nuevo = valores[`buildings.${codigo}.phases.${posicion}.progress`];
    const julio = edificio.phases?.[posicion]?.progress;
    return `${nuevo ?? "-"} (${julio ?? "-"})`;
  });
  console.log(`   ${codigo}: total ${valores[`buildings.${codigo}.progress`] ?? "-"} · ${partes.join(" / ")}`);
}
