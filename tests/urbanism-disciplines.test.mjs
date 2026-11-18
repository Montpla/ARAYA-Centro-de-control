import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findUrbanismDisciplineIndex,
  urbanismDisciplineInText,
} from "../lib/urbanism-disciplines.ts";

// Orden y grafías reales de la lista viva desde el Informe Ejecutivo de julio.
const vivas = [
  "MOVIMIENTO DE TIERRA", "HIDROSANITARIAS", "SISTEMA ESPECIALES", "INFRAESTRUCTURA ELECTRICA",
  "INSTALACIONES TELECOMUNICACIONES", "INSTALACIONES DE GAS", "VIALIDAD", "PAISAJISMO", "OBRAS EXTERIORES",
].map((name) => ({ name, progress: 0 }));

test("cada disciplina se reconoce con las grafías de los distintos documentos", () => {
  const casos = {
    "Movimiento de tierra": 0, "Hidrosanitarias": 1, "Sistemas especiales": 2, "Sist. Especiales — Planta de Tratamiento": 2,
    "Infraestructura eléctrica": 3, "ELECTRIFICACION": 3, "Telecomunicaciones": 4, "Instalaciones de gas": 5, "Gas": 5,
    "Vialidad": 6, "Paisajismo": 7, "Obras exteriores": 8, "OBRAS EXTERIOES": 8,
  };
  for (const [nombre, posicion] of Object.entries(casos)) {
    assert.equal(findUrbanismDisciplineIndex(vivas, nombre), posicion, nombre);
  }
});

test("un texto que nombra dos disciplinas o ninguna no designa ninguna", () => {
  assert.equal(urbanismDisciplineInText("Hidrosanitarias (57%) y Gas (8%)"), null);
  assert.equal(urbanismDisciplineInText("Diapositiva 4, gráfico de capítulos"), null);
  assert.equal(findUrbanismDisciplineIndex(vivas, "Elementos urbanos"), -1, "no existe todavía en la lista viva");
  assert.equal(findUrbanismDisciplineIndex(vivas, "Cargas de trabajo"), -1, '"gas" sólo como palabra entera');
});

test("una disciplina repetida en la lista no se resuelve a ciegas", () => {
  const duplicada = [...vivas, { name: "Instalaciones de Gas", progress: 0 }];
  assert.equal(findUrbanismDisciplineIndex(duplicada, "Gas"), -1);
});

test("la traducción a posición resuelve las disciplinas por nombre contra la lista viva", async () => {
  const fuente = await readFile("lib/spatial-identity-upsert.ts", "utf8");
  assert.match(fuente, /segments\[0\] === "urbanismReportAreas"[\s\S]{0,400}findUrbanismDisciplineIndex/);
});
