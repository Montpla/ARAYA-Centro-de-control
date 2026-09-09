#!/usr/bin/env node
// Publicación puntual: el .mpp "Urbanismo fase I" (corte 30-08-2026) trae el
// avance por disciplina. Regla acordada con el usuario: solo se actualiza una
// disciplina si su cifra en el archivo es MAYOR que la ya publicada; un 0% en
// el archivo se trata como "sin dato" y no toca el valor existente. De las 9
// disciplinas, solo "Infraestructura eléctrica" cumple la regla (0% -> 8%);
// las demás quedan igual porque el archivo trae una cifra menor (Fase I es un
// subconjunto del total, no el avance completo).
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const response = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates: [
      { key: "urbanismReportAreas.5.progress", value: 8 },
    ],
    area: "planificacion",
    cutoff: "2026-08-30",
    sourceFileId: "5f1440d9-e29a-4c2c-be22-f04dbc72607f",
    sourceName: "Urbanismo fase I MOD ACTUALIZADO AJUSTADO FLUJO ENERO MODIFICADO CORTE 30-08-2026.mpp",
    message: "Infraestructura eléctrica: 0% -> 8% (único dato de Fase I mayor que el ya publicado; el resto de disciplinas se conserva porque Fase I es un subconjunto del avance total).",
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
