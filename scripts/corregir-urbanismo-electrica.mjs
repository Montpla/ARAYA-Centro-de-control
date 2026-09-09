#!/usr/bin/env node
// Corrección puntual: la publicación anterior (revisión 100) asumió el orden
// estático de app/june-report-data.ts (índice 5 = "Infraestructura eléctrica")
// pero el array vivo de urbanismReportAreas fue reemplazado por completo en la
// revisión 50 (PPTX del Informe Ejecutivo de julio) con OTRO orden, donde el
// índice 5 es "Instalaciones de gas" y el índice 3 es "Infraestructura
// eléctrica" (confirmado leyendo directamente live_data_points en D1). El 8%
// del .mpp de Fase I quedó así escrito en la disciplina equivocada.
//
// Esta corrección: pone el 8% en el índice correcto (3, Infraestructura
// eléctrica) y devuelve el índice 5 (Instalaciones de gas) a 0, que es su
// valor real en el archivo de Fase I.
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
      { key: "urbanismReportAreas.3.progress", value: 8 },
      { key: "urbanismReportAreas.5.progress", value: 0 },
    ],
    area: "planificacion",
    cutoff: "2026-08-30",
    sourceFileId: "5f1440d9-e29a-4c2c-be22-f04dbc72607f",
    sourceName: "Urbanismo fase I MOD ACTUALIZADO AJUSTADO FLUJO ENERO MODIFICADO CORTE 30-08-2026.mpp",
    message: "Corrección: la revisión 100 escribió el 8% en el índice 5 (Instalaciones de gas) asumiendo el orden estático del código; el array vivo tiene otro orden desde la revisión 50 y el índice correcto de Infraestructura eléctrica es el 3. Se corrige y se devuelve Instalaciones de gas a su 0% real.",
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
