#!/usr/bin/env node
// Muestra la estructura del último plan de Project (XML) de edificios subido a
// producción: capítulos, edificios y avance ponderado por duración de cada
// capítulo en cada edificio. Sólo lectura y sólo porcentajes; ningún importe.
//
// Sirve para decidir a qué fase del modelo (obra común, superestructura,
// albañilería, instalaciones, acabados) pertenece cada capítulo del plan.

import { buildingCodeFromTaskName, readProjectTasks } from "../lib/project-xml.ts";

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
const tareas = readProjectTasks(await descarga.text(), 10_000);
console.log(`tareas: ${tareas.length}`);

// Resúmenes de los primeros niveles: así se ve cómo está organizado el plan.
console.log("\n=== Resúmenes de nivel 1 a 3 (nombre · %) ===");
for (const tarea of tareas) {
  if (!tarea.summary || (tarea.outlineLevel ?? 99) > 3) continue;
  const sangria = "  ".repeat(Math.max(0, (tarea.outlineLevel ?? 1) - 1));
  console.log(`${sangria}[${tarea.outlineLevel}] ${tarea.name} · ${tarea.percentComplete ?? "-"}%`);
}

// Avance por (edificio, capítulo): el capítulo es el ancestro de resumen más
// alto que no nombra un edificio.
const pila = [];
const celdas = new Map();
const capitulos = new Set();
for (const tarea of tareas) {
  const nivel = tarea.outlineLevel ?? 0;
  while (pila.length && pila[pila.length - 1].nivel >= nivel) pila.pop();
  if (tarea.summary) pila.push({ nivel, name: tarea.name });
  if (tarea.summary || tarea.percentComplete === null) continue;
  const edificio = [...pila].reverse().map((item) => buildingCodeFromTaskName(item.name)).find(Boolean)
    || buildingCodeFromTaskName(tarea.name);
  if (!edificio) continue;
  const capitulo = pila.find((item) => !buildingCodeFromTaskName(item.name) && item.nivel >= 1)?.name ?? "(sin capítulo)";
  capitulos.add(capitulo);
  const peso = tarea.durationHours > 0 ? tarea.durationHours : 1;
  const clave = `${edificio}|${capitulo}`;
  const previo = celdas.get(clave) ?? { suma: 0, peso: 0, hojas: 0 };
  previo.suma += Math.max(0, Math.min(100, tarea.percentComplete)) * peso;
  previo.peso += peso;
  previo.hojas += 1;
  celdas.set(clave, previo);
}

console.log("\n=== Capítulos con tareas de edificio (horas totales) ===");
const horasPorCapitulo = new Map();
for (const [clave, celda] of celdas) {
  const capitulo = clave.split("|")[1];
  horasPorCapitulo.set(capitulo, (horasPorCapitulo.get(capitulo) ?? 0) + celda.peso);
}
for (const capitulo of capitulos) {
  console.log(`   ${capitulo} · ${Math.round(horasPorCapitulo.get(capitulo) ?? 0)} h`);
}

console.log("\n=== Avance por edificio y capítulo (%) ===");
const edificios = [...new Set([...celdas.keys()].map((clave) => clave.split("|")[0]))].sort();
for (const edificio of edificios) {
  const partes = [...capitulos]
    .map((capitulo) => {
      const celda = celdas.get(`${edificio}|${capitulo}`);
      return celda ? `${capitulo}=${Math.round((celda.suma / celda.peso) * 10) / 10}` : null;
    })
    .filter(Boolean);
  console.log(`   ${edificio}: ${partes.join(" · ")}`);
}
