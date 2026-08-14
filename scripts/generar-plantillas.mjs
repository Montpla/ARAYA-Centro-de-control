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

import { mkdir, writeFile } from "node:fs/promises";
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

await mkdir(SALIDA, { recursive: true });
for (const plantilla of plantillas) {
  await writeFile(new URL(plantilla.archivo, SALIDA), csv(plantilla.filas), "utf8");
  console.log(`${plantilla.archivo.padEnd(34)} ${String(plantilla.filas.length).padStart(3)} filas · ${plantilla.titulo}`);
}
console.log(`\n${plantillas.length} plantillas en plantillas/`);
