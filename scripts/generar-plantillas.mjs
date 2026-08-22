#!/usr/bin/env node
// Genera las plantillas CSV con las que se actualizan los datos del Centro de
// Control a mano.
//
// Existen porque la extracción por IA de un Excel o un PDF interpreta, y a
// veces se equivoca de campo o no encuentra a qué edificio se refiere una
// cifra. Un CSV con columnas clave/valor entra por el extractor determinista
// (lib/ingestion.ts): lo que está escrito es exactamente lo que se publica,
// sin interpretación de por medio. Es la vía fiable cuando importa acertar.
//
// Las plantillas se generan desde el modelo real en vez de mantenerse a mano
// para que no envejezcan: si mañana un edificio cambia de nombre o aparece un
// campo nuevo, basta con volver a ejecutar
//
//   node scripts/generar-plantillas.mjs
//
// Los edificios se nombran como los nombra la obra (TH-14), nunca por su
// posición en la lista: los 26 edificios no están ordenados por su código, así
// que "buildings.14" apunta a TH-13 y no a TH-14 (ver HANDOFF.md).

import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { buildings, monthlyPlan, projectSnapshot, urbanismAreas } from "../app/demo-data.ts";

const SALIDA = new URL("../plantillas/", import.meta.url);
// El extractor determinista procesa como mucho 250 filas por archivo, así que
// las plantillas largas se parten en varias con el mismo encabezado.
const MAX_FILAS = 240;

function nombreEdificio(building) {
  return `TH-${String(building.shortName).padStart(2, "0")}`;
}

function celda(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(filas) {
  // Ninguna columna de ayuda puede llamarse "dato": normalizeUpdate lee
  // value ?? valor ?? dato, así que una columna con ese nombre acabaría
  // publicándose como si fuera la cifra en cuanto alguien borrara "valor".
  const cabecera = ["clave", "valor", "descripcion", "valor actual"];
  return [
    cabecera.join(","),
    ...filas.map((fila) => [fila.clave, fila.valor, fila.descripcion, fila.actual].map(celda).join(",")),
  ].join("\n") + "\n";
}

// El valor se deja vacío a propósito: una plantilla prerrellenada con las
// cifras vigentes se acaba subiendo tal cual y republica datos viejos con
// fecha de hoy, que es justo el problema de los datos congelados que este
// proyecto lleva tiempo persiguiendo. La cifra actual va en una columna
// aparte, que el extractor ignora, sólo como referencia visual.
function fila(clave, descripcion, actual) {
  return { clave, valor: "", descripcion, actual: actual ?? "" };
}

const plantillas = [];

function registrar(nombre, titulo, filas) {
  if (!filas.length) return;
  const trozos = [];
  for (let inicio = 0; inicio < filas.length; inicio += MAX_FILAS) {
    trozos.push(filas.slice(inicio, inicio + MAX_FILAS));
  }
  trozos.forEach((trozo, indice) => {
    const sufijo = trozos.length > 1 ? `-${indice + 1}de${trozos.length}` : "";
    plantillas.push({ archivo: `${nombre}${sufijo}.csv`, titulo, filas: trozo });
  });
}

// --- Avance por edificio -----------------------------------------------------
registrar("01-avance-edificios", "Avance por edificio", buildings.flatMap((building) => {
  const nombre = nombreEdificio(building);
  return [
    fila(`buildings.${nombre}.progress`, `${nombre} · avance ejecutado (%)`, building.progress),
    fila(`buildings.${nombre}.planProgress`, `${nombre} · avance previsto (%)`, building.planProgress),
    fila(`buildings.${nombre}.deviationDays`, `${nombre} · desviación (días)`, building.deviationDays),
    fila(`buildings.${nombre}.forecastFinish`, `${nombre} · fin previsto (dd/mm/aaaa)`, building.forecastFinish),
  ];
}));

// --- Avance por apartamento --------------------------------------------------
// Es lo que decide el color de cada vivienda en la implantación: 100 terminada,
// más de 0 en curso, 0 pendiente.
registrar("02-avance-apartamentos", "Avance por apartamento", buildings.flatMap((building) => {
  const nombre = nombreEdificio(building);
  return building.units.flatMap((unit) => [
    fila(`buildings.${nombre}.units.${unit.code}.progress`, `${nombre} · apto ${unit.code} · avance (%)`, unit.progress),
    fila(`buildings.${nombre}.units.${unit.code}.phase`, `${nombre} · apto ${unit.code} · fase`, unit.phase),
  ]);
}));

// --- Urbanismo ---------------------------------------------------------------
registrar("03-urbanismo", "Avance de urbanismo", urbanismAreas.flatMap((area) => [
  fila(`urbanismAreas.${area.id}.progress`, `${area.name} · avance ejecutado (%)`, area.progress),
  fila(`urbanismAreas.${area.id}.planned`, `${area.name} · avance previsto (%)`, area.planned),
]));

// --- Curva S / plan mensual --------------------------------------------------
// El avance físico global del proyecto sale de aquí: se toma el último mes con
// "actual" relleno, y de esa misma fila se leen previsto y ejecutado.
registrar("04-curva-s-mensual", "Plan mensual (Curva S)", monthlyPlan.flatMap((entry, indice) => [
  fila(`monthlyPlan.${indice}.planned`, `${entry.month} · previsto acumulado (%)`, entry.planned),
  fila(`monthlyPlan.${indice}.actual`, `${entry.month} · ejecutado real acumulado (%)`, entry.actual),
]));

// --- Resumen del proyecto ----------------------------------------------------
const camposResumen = [
  ["overallProgress", "Avance físico global ejecutado (%)"],
  ["plannedProgress", "Avance físico global previsto (%)"],
  ["urbanismProgress", "Avance de urbanismo consolidado (%)"],
  ["apartmentAverageProgress", "Media de avance por apartamento (%)"],
];
registrar("05-resumen-proyecto", "Resumen del proyecto", camposResumen
  .filter(([campo]) => campo in projectSnapshot)
  .map(([campo, descripcion]) => fila(`projectSnapshot.${campo}`, descripcion, projectSnapshot[campo])));

// --- Resto del modelo: gestión, economía y comercial -------------------------
//
// Las listas de esta parte se recorren solas en vez de escribirse a mano: son
// una veintena, cambian de campos con cada informe, y mantenerlas manualmente
// garantizaba que acabaran desfasadas respecto al modelo real.
//
// Cada una se nombra por el campo con el que la reconoce el sistema, salvo que
// ese campo se repita dentro de la lista. Ahí se vuelve a las posiciones: un
// nombre que señala a dos filas no se resuelve —y con razón, porque repartir un
// importe a cara o cruz entre dos partidas es peor que no escribirlo—, así que
// una plantilla que los usara no publicaría nada. Le pasa a la Curva S, que
// repite "jul" tres veces al no llevar año más que en enero.
const CAMPOS_NOMBRE = ["id", "code", "name", "month", "period", "entity", "category", "concept", "label"];

const ETIQUETAS = {
  amount: "importe", amountDop: "importe (DOP)", amountUsd: "importe (USD)",
  cumulative: "acumulado", june: "junio", income: "ingresos", costs: "costes",
  net: "neto", percent: "porcentaje (%)", progress: "avance (%)",
  planned: "previsto (%)", measured: "medido", accounting: "contabilizado",
  clients: "clientes", value: "unidades", total: "total", deviationDays: "desviación (días)",
};

// Espejo de keyPattern (lib/live-data.ts) para un solo segmento hijo.
const SEGMENTO_VALIDO = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

function tokenNombre(value) {
  return String(value ?? "").trim().toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function plantillaDeLista(archivo, titulo, raiz, lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  const muestra = lista.find((item) => item && typeof item === "object");
  if (!muestra) return;
  const campoNombre = CAMPOS_NOMBRE.find((campo) => typeof muestra[campo] === "string" && muestra[campo]);
  const camposNumericos = Object.keys(muestra).filter((campo) => typeof muestra[campo] === "number");
  if (!camposNumericos.length) return;

  const tokens = campoNombre ? lista.map((item) => tokenNombre(item[campoNombre])) : [];
  // Un nombre sólo sirve para dirigir un dato si identifica a una sola fila y
  // si cabe entero en un segmento de clave. Lo segundo no es teórico: el punto
  // es el separador de segmentos, así que "Inst. eléctricas" partiría la clave
  // por la mitad y el dato se perdería. Cuando cualquiera de las dos
  // condiciones falla se usan posiciones en toda la lista, no sólo en la fila
  // problemática, para que la plantilla no mezcle dos formas de nombrar.
  const nombresUsables = Boolean(campoNombre) &&
    lista.every((item) => SEGMENTO_VALIDO.test(String(item[campoNombre] ?? "")));
  const nombresUnicos = nombresUsables && new Set(tokens).size === tokens.length && tokens.every(Boolean);

  registrar(archivo, titulo, lista.flatMap((item, indice) => {
    const referencia = nombresUnicos ? item[campoNombre] : String(indice);
    const rotulo = campoNombre ? item[campoNombre] : `fila ${indice + 1}`;
    return camposNumericos.map((campo) => fila(
      `${raiz}.${referencia}.${campo}`,
      `${rotulo} · ${ETIQUETAS[campo] ?? campo}`,
      item[campo],
    ));
  }));
}

const [demo, junio, fiduciario, flujo] = await Promise.all([
  import("../app/demo-data.ts"),
  import("../app/june-report-data.ts"),
  import("../app/fiduciary-statements-data.ts"),
  import("../app/reprogrammed-flow-data.ts"),
]);
const modelo = { ...demo, ...junio };

const RESTO = [
  ["06-paquetes-de-obra", "Paquetes de obra", "workPackages"],
  ["07-disciplinas", "Disciplinas de construcción", "constructionDisciplines"],
  ["08-urbanismo-informe", "Urbanismo (informe)", "urbanismReportAreas"],
  ["09-cxp-por-categoria", "Cuentas por pagar por categoría", "cxpCategories"],
  ["10-cxp-vencimientos", "Cuentas por pagar por antigüedad", "cxpAging"],
  ["11-desglose-de-coste", "Desglose de coste", "costBreakdown"],
  ["12-anticipos", "Anticipos a proveedores", "advances"],
  ["14-proyeccion-financiera", "Proyección financiera", "financialProjection"],
  ["15-financiacion", "Procesos de financiación", "financingProcesses"],
  ["16-cubicaciones", "Cubicaciones", "cubicaciones"],
  ["17-ventas-por-modelo", "Ventas por modelo", "salesModels"],
  ["18-ventas-por-ubicacion", "Ventas por ubicación", "salesLocations"],
  ["19-morosidad", "Morosidad", "arrearsBreakdown"],
];

// El nombre con el que un módulo exporta una lista no siempre coincide con el
// de la raíz publicable: `antonelyPayableVendors` se exporta así pero el modelo
// la llama `antonelyPayableVendorsAll`, y una plantilla generada con el nombre
// del export produce claves que el contrato rechaza en bloque. Comprobarlo aquí
// convierte ese error silencioso en un fallo ruidoso al generar.
const { LIVE_DATA_ROOTS } = await import("../lib/live-data.ts");
const raicesValidas = new Set(LIVE_DATA_ROOTS);
const raicesInvalidas = RESTO.filter(([, , raiz]) => !raicesValidas.has(raiz));
if (raicesInvalidas.length) {
  console.error("Estas raíces no pertenecen al modelo vivo y no se pueden publicar:");
  for (const [, titulo, raiz] of raicesInvalidas) console.error(`  ${raiz} (${titulo})`);
  process.exit(1);
}

for (const [archivo, titulo, raiz] of RESTO) {
  plantillaDeLista(archivo, titulo, raiz, modelo[raiz]);
}

const resumenFiduciario = fiduciario.fiduciaryStatementSummary;
registrar("18-balance-fideicomiso", "Balance del fideicomiso", [
  fila("fiduciaryStatementSummary.cutoff", "Fecha de corte (AAAA-MM-DD)", resumenFiduciario.cutoff),
  fila("fiduciaryStatementSummary.issuedAt", "Fecha de emisión (AAAA-MM-DD)", resumenFiduciario.issuedAt),
  fila("fiduciaryStatementSummary.issuer", "Entidad emisora", resumenFiduciario.issuer),
  fila("fiduciaryStatementSummary.currency", "Moneda del estado", resumenFiduciario.currency),
  ...Object.entries(resumenFiduciario.balance).map(([campo, actual]) => fila(
    `fiduciaryStatementSummary.balance.${campo}`,
    `Balance · ${ETIQUETAS[campo] ?? campo}`,
    actual,
  )),
  ...Object.entries(resumenFiduciario.trialBalance).map(([campo, actual]) => fila(
    `fiduciaryStatementSummary.trialBalance.${campo}`,
    `Balance de comprobación · ${ETIQUETAS[campo] ?? campo}`,
    actual,
  )),
]);

registrar("19-resultados-fideicomiso", "Resultados del fideicomiso", [
  ...Object.entries(resumenFiduciario.monthlyResult).map(([campo, actual]) => fila(
    `fiduciaryStatementSummary.monthlyResult.${campo}`,
    `Resultado mensual · ${ETIQUETAS[campo] ?? campo}`,
    actual,
  )),
  ...Object.entries(resumenFiduciario.accumulatedResult).map(([campo, actual]) => fila(
    `fiduciaryStatementSummary.accumulatedResult.${campo}`,
    `Resultado acumulado · ${ETIQUETAS[campo] ?? campo}`,
    actual,
  )),
]);

registrar("20-flujo-mensual-finanzas", "Flujo mensual financiero", flujo.reprogrammedFlowMonths.flatMap((mes, indice) => [
  fila(`reprogrammedFlowMonths.${indice}.month`, `Mes ${indice + 1}`, mes.month),
  fila(`reprogrammedFlowMonths.${indice}.status`, `${mes.month} · real o previsión`, mes.status),
  fila(`reprogrammedFlowMonths.${indice}.currentDop`, `${mes.month} · total DOP`, mes.currentDop),
  fila(`reprogrammedFlowMonths.${indice}.urbanismDop`, `${mes.month} · Urbanismo DOP`, mes.urbanismDop),
  fila(`reprogrammedFlowMonths.${indice}.buildingsDop`, `${mes.month} · Edificios DOP`, mes.buildingsDop),
]));

await mkdir(SALIDA, { recursive: true });
const archivosVigentes = new Set(plantillas.map((plantilla) => plantilla.archivo));
for (const archivo of await readdir(SALIDA)) {
  if (!/^(?:01-avance-edificios|02-avance-apartamentos)(?:-\d+de\d+)?\.csv$/.test(archivo)) continue;
  if (!archivosVigentes.has(archivo)) await unlink(new URL(archivo, SALIDA));
}
for (const plantilla of plantillas) {
  await writeFile(new URL(plantilla.archivo, SALIDA), csv(plantilla.filas), "utf8");
  console.log(`${plantilla.archivo.padEnd(34)} ${String(plantilla.filas.length).padStart(3)} filas · ${plantilla.titulo}`);
}
console.log(`\n${plantillas.length} plantillas en plantillas/`);
