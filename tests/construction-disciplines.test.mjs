import assert from "node:assert/strict";
import test from "node:test";

import { constructionDisciplineInText, constructionDisciplineLabel } from "../lib/construction-disciplines.ts";

test("cada oficio se reconoce con las grafías de la cubicación y del Informe Ejecutivo", () => {
  const casos = [
    ["INFRAESTRUCTURA.", "infraestructura"],
    ["Superestructura", "superestructura"],
    ["ALBAÑILERIA", "albanileria"],
    ["Inst. eléctricas, sanitarias y gas", "instalaciones"],
    ["Instalaciones (elec./sanit./gas)", "instalaciones"],
    ["PINTURA", "pintura"],
    ["Revestimientos / Cerámica", "revestimientos"],
    ["MISCELANEOS", "miscelaneos"],
    ["Herrería", "herreria"],
    ["Carpintería (puertas/closets)", "carpinteria"],
  ];
  for (const [texto, esperado] of casos) assert.equal(constructionDisciplineInText(texto), esperado, texto);
});

test("un texto que nombra dos oficios o ninguno no designa ninguno", () => {
  assert.equal(constructionDisciplineInText("Herrería y carpintería apenas arrancan"), null);
  assert.equal(constructionDisciplineInText("Diapositiva 5, gráfico de capítulos"), null);
});

test("la infraestructura eléctrica de urbanismo no es el oficio de infraestructura", () => {
  assert.equal(constructionDisciplineInText("Infraestructura eléctrica 14,9%"), null);
});

test("la etiqueta no lleva punto, que partiría la clave viva", () => {
  assert.ok(!constructionDisciplineLabel("instalaciones").includes("."));
});
