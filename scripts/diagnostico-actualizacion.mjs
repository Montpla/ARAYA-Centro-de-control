#!/usr/bin/env node
// Diagnóstico: qué claves tocó cada publicación reciente y cuáles NO se movieron.
//
// Responde a "subí un archivo y hay datos/gráficos que no se actualizaron":
// muestra, por revisión, qué claves del modelo vivo escribió cada carga, para
// cruzarlas con lo que los paneles leen. Sólo imprime NOMBRES de clave, área y
// procedencia —nunca valores—, así que es seguro en un registro.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const sessionMatch = loginResponse.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!sessionMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${sessionMatch[1]}`;

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
if (!liveResponse.ok) {
  console.error(`✖ /api/live-data devolvió ${liveResponse.status}.`);
  process.exit(1);
}
const live = await liveResponse.json();
const provenance = live.provenance ?? {};

// Agrupar las claves por la revisión que las escribió.
const porRevision = new Map();
for (const [clave, info] of Object.entries(provenance)) {
  const rev = info.revision ?? 0;
  if (!porRevision.has(rev)) porRevision.set(rev, { info, claves: [] });
  porRevision.get(rev).claves.push(clave);
}

const revisiones = [...porRevision.entries()].sort((a, b) => b[0] - a[0]);
console.log(`=== Revisión viva actual: ${live.revision} · ${Object.keys(provenance).length} claves con procedencia ===`);
if (live.latestEvent) {
  const e = live.latestEvent;
  console.log(`Última publicación: rev ${e.revision} · ${e.changeCount} cambios · ${e.sourceName} · ${e.createdAt}`);
}

for (const [rev, { info, claves }] of revisiones.slice(0, 8)) {
  console.log(`\n--- Revisión ${rev} · ${info.sourceName || "(sin origen)"} · área ${info.area} · ${info.updatedAt || ""} ---`);
  // Se agrupan por raíz (lo que antes del primer punto) para ver a qué parte
  // del panel llegó cada carga.
  const porRaiz = {};
  for (const clave of claves.sort()) {
    const raiz = clave.split(".")[0];
    (porRaiz[raiz] ??= []).push(clave);
  }
  for (const [raiz, lista] of Object.entries(porRaiz)) {
    console.log(`   ${raiz} (${lista.length}): ${lista.slice(0, 8).join(", ")}${lista.length > 8 ? " …" : ""}`);
  }
}

// Avance del cronograma y previsión de fin: son indicadores de PROGRESO FÍSICO
// (porcentaje y fecha), no cifras financieras, así que su valor sí se imprime
// —es justo lo que hay que comprobar cuando se pregunta si el % del cronograma
// que ve el panel es el real del plan. NO se imprime ningún valor de dinero.
const valores = live.values ?? {};
const crono = valores["projectSnapshot.scheduleProgress"];
const fin = valores["projectSnapshot.forecastFinish"];
const edificios = Object.keys(valores).filter((k) => /^buildings\..+\.progress$/.test(k));
console.log(`\n=== Cronograma y obra (progreso físico, sin cifras de dinero) ===`);
console.log(`avance de cronograma (projectSnapshot.scheduleProgress): ${crono ?? "(sin dato)"}%`);
console.log(`previsión de fin (projectSnapshot.forecastFinish): ${fin ?? "(sin dato)"}`);
console.log(`edificios con avance físico publicado: ${edificios.length}`);
for (const clave of edificios.sort().slice(0, 30)) {
  console.log(`   ${clave}: ${valores[clave]}%`);
}
