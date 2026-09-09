#!/usr/bin/env node
// Confirma en producción, leyendo GET /api/live-data, que las tres correcciones
// de esta sesión (mpp, Semana 2, Curva S) están realmente publicadas.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`✖ El login falló (${login.status}).`);
  process.exit(1);
}
const Cookie = `araya_session=${session}`;

const response = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
const data = await response.json();

console.log("=== Estado vivo del Centro de Control ===");
console.log("revisión actual:", data.revision);
console.log("último evento:", JSON.stringify(data.latestEvent, null, 2));

const v = data.values;
console.log("\n--- Curva S (monthlyPlan) ---");
for (let i = 12; i <= 16 && v[`monthlyPlan.${i}.actual`] !== undefined; i += 1) {
  console.log(`  índice ${i}: planned=${v[`monthlyPlan.${i}.planned`]} · actual=${v[`monthlyPlan.${i}.actual`]}`);
}
console.log("overallProgress:", v["projectSnapshot.overallProgress"]);
console.log("plannedProgress:", v["projectSnapshot.plannedProgress"]);
console.log("scheduleProgress (MPP):", v["projectSnapshot.scheduleProgress"]);
console.log("forecastFinish (MPP):", v["projectSnapshot.forecastFinish"]);

console.log("\n--- Claves de edificios publicadas (todas) ---");
const buildingKeys = Object.keys(v).filter((k) => k.startsWith("buildings."));
console.log(`  ${buildingKeys.length} clave(s) buildings.* en total`);
for (const k of buildingKeys.slice(0, 12)) console.log(`  ${k}: ${JSON.stringify(v[k])}`);

console.log("\n--- Seguridad (Semana 2) ---");
console.log(JSON.stringify(v.safetyMetrics, null, 2)?.slice(0, 800));

console.log("\n=== /api/control-room (lo que realmente ve el panel) ===");
const cr = await fetch(`${PRODUCTION_URL}/api/control-room`, { headers: { Cookie } }).then((r) => r.json());
console.log("planning:", JSON.stringify(cr.planning, null, 2));
console.log("spatial:", JSON.stringify(cr.spatial, null, 2));
console.log("cutoff:", cr.cutoff);
console.log("live:", JSON.stringify(cr.live, null, 2));
