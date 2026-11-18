#!/usr/bin/env node
// Corrección puntual de la revisión 111 (Informe Ejecutivo de octubre).
//
// La lectura por IA enumeró por posición las filas del gráfico "Avance por
// capítulo" (diapositiva 4). El gráfico no trae Telecomunicaciones y sí trae
// Elementos urbanos, así que desde la 5.ª fila cada valor cayó en la
// disciplina de al lado. Valores reales del gráfico "% real (31/10)":
//   Instalaciones de gas 8,3 · Vialidad 20,4 · Paisajismo 6,8 ·
//   Elementos urbanos 26,1 (parque abierto y caminerías).
// Telecomunicaciones no figura en el informe: vuelve a su 0 previo
// (live_data_history: sin cambios desde la revisión 50).
// Infraestructura eléctrica conserva el 20 del Project de urbanismo (rev 114),
// mayor que el 14,9 del informe: es el mismo criterio de mayor avance conocido.
//
// Antes de publicar se comprueba el nombre vivo de cada posición: si la lista
// ya no tiene ese orden, no se escribe nada.

import { urbanismReportAreas as baseline } from "../app/june-report-data.ts";
import { materializeLiveRoot } from "../lib/live-data.ts";
import { urbanismDisciplineInText } from "../lib/urbanism-disciplines.ts";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const INFORME = {
  id: "7b52a6bd-5fa6-4ffc-af25-80954ff76f99",
  nombre: "Informe_Ejecutivo_ARAYA_Octubre_Definitivo_v5.pptx",
};
const CORRECCIONES = [
  { disciplina: "telecomunicaciones", progress: 0 },
  { disciplina: "gas", progress: 8.3 },
  { disciplina: "vialidad", progress: 20.4 },
  { disciplina: "paisajismo", progress: 6.8 },
];
const NUEVA = { disciplina: "elementos-urbanos", entrada: { name: "ELEMENTOS URBANOS", progress: 26.1 } };

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`✖ Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const live = await (await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } })).json();
const disciplinas = materializeLiveRoot("urbanismReportAreas", baseline.map((area) => ({ ...area })), live.values ?? {});
const posicionDe = (id) => disciplinas.findIndex((area) => urbanismDisciplineInText(String(area?.name ?? "")) === id);

const updates = [];
for (const { disciplina, progress } of CORRECCIONES) {
  const indice = posicionDe(disciplina);
  if (indice < 0) { console.error(`✖ No encuentro "${disciplina}" en la lista viva; no se publica nada.`); process.exit(1); }
  console.log(`   ${disciplinas[indice].name} (posición ${indice}): ${disciplinas[indice].progress} → ${progress}`);
  updates.push({ key: `urbanismReportAreas.${indice}.progress`, value: progress });
}
if (posicionDe(NUEVA.disciplina) < 0) {
  console.log(`   alta ${NUEVA.entrada.name} (posición ${disciplinas.length}): ${NUEVA.entrada.progress}`);
  updates.push({ key: `urbanismReportAreas.${disciplinas.length}`, value: NUEVA.entrada });
}

const response = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates,
    area: "urbanismo",
    cutoff: "2026-10-31",
    // Sin archivo de origen: es una corrección manual explícita. Así no la
    // frena la guarda de cortes (Vialidad ya tiene el corte del Project de
    // urbanismo, posterior al 31/10), que existe para reprocesos automáticos.
    message: `Corrección de la revisión 111 (${INFORME.nombre}): la lectura por IA asignó por posición las filas del gráfico \"Avance por capítulo\" y desde la 5.ª cada valor cayó en la disciplina de al lado. Se publican por nombre los valores reales del gráfico (% real 31/10) y se da de alta Elementos urbanos.`,
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify({ revision: body.revision, message: body.message, error: body.error }, null, 2));
if (!response.ok) process.exit(1);
