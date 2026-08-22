#!/usr/bin/env node
// Restaura el AVANCE FÍSICO por edificio a su fuente correcta (Excel/informe de
// obra), deshaciendo la sobrescritura que hizo el plan de Project.
//
// Contexto: al publicar el .mpp de julio se escribieron buildings.N.progress con
// el % de CRONOGRAMA de cada tarea. El avance físico global del panel es la
// media de esos 26 edificios, así que pasó de 22,36% (Excel) a ~19% (plan). El
// % de una tarea del MPP es avance de cronograma, no obra ejecutada medida: el
// avance físico debe salir del Excel. Este script vuelve a poner en cada
// buildings.N.progress su valor físico (el del modelo base) y deja el % de
// cronograma (projectSnapshot.scheduleProgress) intacto.
//
// Simula por defecto; APLICAR=1 publica. Sólo imprime porcentajes de avance
// (progreso físico), nunca cifras de dinero.

import { buildings } from "../app/demo-data.ts";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const APLICAR = process.env.APLICAR === "1";

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
const cookieMatch = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!cookieMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${cookieMatch[1]}`;

// Estado vivo actual, para comparar antes/después (sólo porcentajes de avance).
const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const live = liveResponse.ok ? await liveResponse.json() : { values: {} };
const valores = live.values ?? {};

const media = (nums) => Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;

// Valor físico de cada edificio según el modelo base (fuente Excel/informe).
const updates = buildings.map((edificio, indice) => ({
  key: `buildings.${indice}.progress`,
  value: edificio.progress,
}));
const objetivo = media(updates.map((u) => u.value));

// Media que muestra el panel ahora mismo (con lo que escribió el plan).
const actuales = updates.map((u) => {
  const v = valores[u.key];
  return typeof v === "number" ? v : u.value;
});
const antes = media(actuales);

console.log(`=== Restaurar avance físico por edificio (${updates.length} edificios) ===`);
console.log(`avance físico global AHORA:      ${antes}%`);
console.log(`avance físico global RESTAURADO: ${objetivo}%`);
console.log(`avance de cronograma (no se toca): ${valores["projectSnapshot.scheduleProgress"] ?? "(sin dato)"}%`);
const cambian = updates.filter((u, i) => actuales[i] !== u.value).length;
console.log(`edificios cuyo valor cambia: ${cambian} de ${updates.length}`);

if (!APLICAR) {
  console.log("\nSimulación (APLICAR=0): no se publica; sólo se compara.");
  process.exit(0);
}

const publicar = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates,
    area: "obra",
    cutoff: new Date().toISOString().slice(0, 10),
    sourceName: "Restauración de avance físico",
    message: `Avance físico por edificio restaurado a la fuente de obra (media ${objetivo}%); el % de cronograma del plan de Project no se toca.`,
  }),
});
const cuerpo = await publicar.json().catch(() => ({}));
if (!publicar.ok) {
  console.error(`✖ La publicación devolvió ${publicar.status} · ${cuerpo.error ?? ""}`);
  process.exit(1);
}
console.log(`\n✔ Avance físico restaurado (media ${objetivo}%). ${cuerpo.message ?? cuerpo.processingSummary ?? ""}`);
