#!/usr/bin/env node
// Corrección puntual: safetyMetrics llevaba semanas publicado con la semana
// del 10-15 de agosto (revisión 98) porque el reporte semanal más reciente
// ("Semana 1", 31 ago-5 sep, file_id 68514691) no dejó ningún registro en
// document_data_proposals -el lector ligero de PDF (lib/pdf-text.ts) sólo
// recuperaba la cabecera del reporte, no la tabla de datos-. Se releyó el
// original con PyMuPDF (mucho más completo) directamente en el workflow y
// esta corrección publica esas cifras reales.
//
// Lectura del PDF (páginas 5-9):
//   - "Total de Eventos Registrables": 4. El texto de la página 5 dice
//     además "no se registraron eventos no deseados" y todas las
//     subcategorías de accidente están en 0; la página 9 vuelve a citar "4
//     accidentes no registrables" junto a "16,268 horas trabajadas" -una
//     cifra de horas muy por encima de las 49 de esta semana-, así que ese 4
//     es el acumulado del proyecto que cita el propio informe, no un evento
//     nuevo de esta semana. eventsWeek se publica en 0 (coincide con el
//     texto) y eventsCumulative en 4 (la cifra que el documento declara,
//     más fiable que sumar sobre un acumulado de la serie que ya tiene un
//     hueco de semanas intermedias sin registrar).
//   - Total de empleados: 136. Horas Trabajadas del Proyecto: 49.00.
//   - Actividades relevantes: Reporte de Observaciones 10, Reunión de
//     Seguridad 5, Inspecciones 5, Auditorías 0, Capacitaciones 0.
//   - Sección VIII (Seguimiento a Acciones Levantadas): 3 hallazgos, los 3
//     "EN PROCESO" → 3 acciones abiertas.
//
// safetyWeeklySeries sólo llega hasta S4 (semana del 27/07-01/08): faltan
// las semanas del 3-8, 10-15, 17-22 y 24-29 de agosto (nunca se les dio de
// alta un registro propio, aunque sí actualizaron safetyMetrics en su
// momento). Los acumulados de horas/observaciones/reuniones/inspecciones de
// esta corrección suman sólo esta semana sobre el acumulado de S4: quedarán
// por debajo del acumulado real del proyecto hasta que se recuperen o se
// registren esas semanas intermedias. Se deja constancia en el mensaje de
// la publicación para que no se lea como una cifra cerrada.
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

// El contrato vivo sólo resuelve índices NUMÉRICOS dentro de un array
// (expectedAtPath, lib/live-data-contract.ts): a diferencia de la
// materialización en publicación (que sí admite "safetyMetrics.Accidentes"
// por nombre), la validación de contrato exige "safetyMetrics.0". El orden
// vigente coincide con el estático de app/june-report-data.ts, confirmado
// leyendo directamente live_data_points: 0 Accidentes, 1 Personal,
// 2 Horas-persona, 3 Observaciones, 4 Reuniones, 5 Inspecciones, 6 Acciones.
//
// safetyWeeklySeries.4 (añadir por índice) tampoco sirve aquí: el contrato
// valida un elemento nuevo sólo contra el PRIMER elemento no nulo del array
// (S1, que trae eventsWeek=null), así que un valor numérico como el 0 de
// esta semana rechazaría por "no coincide con el modelo autorizado". Publicar
// el ARRAY COMPLETO sí funciona: el contrato fusiona los campos de TODAS las
// filas existentes (S1-S4), y con eventsWeek visto como null en unas filas y
// como número en otras, acepta ambas formas en la fila nueva.
const semanasExistentes = [
  { week: "S1", startDate: "2026-07-06", endDate: "2026-07-11", cutoff: "2026-07-11", eventsWeek: null, eventsCumulative: 2, personnel: 134, hoursWeek: 48, hoursCumulative: 48, observationsWeek: 5, observationsCumulative: 5, meetingsWeek: 5, meetingsCumulative: 5, inspectionsWeek: 5, inspectionsCumulative: 5, openActions: 3 },
  { week: "S2", startDate: "2026-07-13", endDate: "2026-07-18", cutoff: "2026-07-18", eventsWeek: null, eventsCumulative: 2, personnel: 134, hoursWeek: 48, hoursCumulative: 96, observationsWeek: 5, observationsCumulative: 10, meetingsWeek: 5, meetingsCumulative: 10, inspectionsWeek: 5, inspectionsCumulative: 10, openActions: 3 },
  { week: "S3", startDate: "2026-07-20", endDate: "2026-07-25", cutoff: "2026-07-25", eventsWeek: 0, eventsCumulative: 2, personnel: 134, hoursWeek: 48, hoursCumulative: 144, observationsWeek: 7, observationsCumulative: 17, meetingsWeek: 4, meetingsCumulative: 14, inspectionsWeek: 5, inspectionsCumulative: 15, openActions: 2 },
  { week: "S4", startDate: "2026-07-27", endDate: "2026-08-01", cutoff: "2026-08-01", eventsWeek: 0, eventsCumulative: 2, personnel: 134, hoursWeek: 48, hoursCumulative: 192, observationsWeek: 7, observationsCumulative: 24, meetingsWeek: 5, meetingsCumulative: 19, inspectionsWeek: 5, inspectionsCumulative: 20, openActions: 2 },
];
const nuevaSemana = {
  week: "S1 (31 ago-5 sep)",
  startDate: "2026-08-31",
  endDate: "2026-09-05",
  cutoff: "2026-09-05",
  eventsWeek: 0,
  eventsCumulative: 4,
  personnel: 136,
  hoursWeek: 49,
  hoursCumulative: 192 + 49,
  observationsWeek: 10,
  observationsCumulative: 24 + 10,
  meetingsWeek: 5,
  meetingsCumulative: 19 + 5,
  inspectionsWeek: 5,
  inspectionsCumulative: 20 + 5,
  openActions: 3,
};

const response = await fetch(`${PRODUCTION_URL}/api/live-data`, {
  method: "POST",
  headers: { Cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    updates: [
      { key: "safetyMetrics.0.value", value: "0" },
      { key: "safetyMetrics.0.detail", value: "Sin eventos no deseados esta semana (31 ago-5 sep)" },
      { key: "safetyMetrics.1.value", value: "136" },
      { key: "safetyMetrics.1.detail", value: "Total de empleados · semana 31 ago-5 sep" },
      { key: "safetyMetrics.2.value", value: "49.00" },
      { key: "safetyMetrics.2.detail", value: "Horas Trabajadas del Proyecto esta semana" },
      { key: "safetyMetrics.3.value", value: "10" },
      { key: "safetyMetrics.3.detail", value: "Reporte de Observaciones" },
      { key: "safetyMetrics.4.value", value: "5" },
      { key: "safetyMetrics.4.detail", value: "Reunión de Seguridad" },
      { key: "safetyMetrics.5.value", value: "5" },
      { key: "safetyMetrics.5.detail", value: "Inspecciones ejecutadas" },
      { key: "safetyMetrics.6.value", value: "3" },
      { key: "safetyMetrics.6.detail", value: "Seguimiento a Acciones Levantadas, en proceso" },
      { key: "safetyWeeklySeries", value: [...semanasExistentes, nuevaSemana] },
    ],
    area: "seguridad",
    cutoff: "2026-09-05",
    sourceFileId: "68514691-2e29-4e98-97cc-78c055a67b15",
    sourceName: "ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.1 31-08-2026 al 05-09-2026.pdf",
    message: "Corrección: safetyMetrics llevaba la semana del 10-15 de agosto (revisión 98) porque el reporte más reciente no dejó propuesta de la IA (el lector ligero de PDF no descifra la tabla de datos, sólo la cabecera). Se releyó el original con PyMuPDF y se publican las cifras reales de la semana del 31 ago al 5 sep, más su entrada en safetyWeeklySeries. El acumulado de eventos (4) es el que cita el propio informe, no una suma local: el texto de la página 5 dice que no hubo eventos nuevos esta semana. Los demás acumulados de la serie sólo suman esta semana sobre S4 (01/08); faltan 4 semanas intermedias sin registro propio en la serie, así que quedan por debajo del acumulado real del proyecto hasta que se recuperen.",
  }),
});
const body = await response.json().catch(() => ({}));
console.log(response.status, JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
