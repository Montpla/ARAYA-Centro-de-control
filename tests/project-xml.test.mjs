import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingCodeFromTaskName,
  extractProjectXmlUpdates,
  isProjectXml,
  readProjectTasks,
} from "../lib/project-xml.ts";

// Fragmento con la forma real de un MSPDI: cabecera con el espacio de nombres
// de Microsoft, tareas resumen con sus hijas, porcentajes y rótulos como los
// escribe un plan de obra.
const planDeObra = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Araya 26 edificios</Name>
  <Tasks>
    <Task>
      <UID>1</UID>
      <Name>EDIFICACIÓN</Name>
      <PercentComplete>31</PercentComplete>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>2</UID>
      <Name>TH-14 Estructura</Name>
      <PercentComplete>60</PercentComplete>
      <Start>2026-07-01T08:00:00</Start>
      <Finish>2026-09-30T17:00:00</Finish>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
    </Task>
    <Task>
      <UID>3</UID>
      <Name>TH-14 Albañilería</Name>
      <PercentComplete>40</PercentComplete>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
    </Task>
    <Task>
      <UID>4</UID>
      <Name>Edificio 3 &amp; anexos</Name>
      <PercentComplete>85</PercentComplete>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
    </Task>
    <Task>
      <UID>5</UID>
      <Name>Reunión de coordinación</Name>
      <PercentComplete>100</PercentComplete>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
    </Task>
  </Tasks>
</Project>`;

const edificiosReales = new Set(["14", "3", "7"]);

test("reconoce un XML guardado desde Project", () => {
  assert.equal(isProjectXml(planDeObra), true);
  assert.equal(isProjectXml("<?xml version=\"1.0\"?><catalogo><item/></catalogo>"), false);
});

test("lee las tareas con su porcentaje y distingue las de resumen", () => {
  const tareas = readProjectTasks(planDeObra);
  assert.equal(tareas.length, 5);
  const estructura = tareas.find((tarea) => tarea.name === "TH-14 Estructura");
  assert.equal(estructura.percentComplete, 60);
  assert.equal(estructura.summary, false);
  assert.equal(estructura.start, "2026-07-01T08:00:00");
  // La tarea resumen agrega a sus hijas: su porcentaje lo calcula Project, no
  // se mide en obra, así que queda marcada para dejarla fuera.
  assert.equal(tareas.find((tarea) => tarea.name === "EDIFICACIÓN").summary, true);
});

test("decodifica las entidades XML de los nombres", () => {
  const tareas = readProjectTasks(planDeObra);
  assert.ok(tareas.some((tarea) => tarea.name === "Edificio 3 & anexos"));
});

test("reconoce el edificio en los rótulos que usa un plan de obra", () => {
  assert.equal(buildingCodeFromTaskName("TH-14 Estructura"), "TH-14");
  assert.equal(buildingCodeFromTaskName("Edificio 3 & anexos"), "TH-03");
  assert.equal(buildingCodeFromTaskName("ED. 7 · instalaciones"), "TH-07");
  assert.equal(buildingCodeFromTaskName("Edif 12 remates"), "TH-12");
});

test("no adivina un edificio donde no lo hay", () => {
  // "Fase 14" lleva un número, pero no nombra un edificio. Adivinarlo metería
  // el avance en el edificio equivocado, que es el error que costó meses.
  assert.equal(buildingCodeFromTaskName("Fase 14"), "");
  assert.equal(buildingCodeFromTaskName("Reunión de coordinación"), "");
  assert.equal(buildingCodeFromTaskName("Hormigonado 3er nivel"), "");
});

test("promedia las tareas de un mismo edificio", () => {
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  const th14 = resultado.updates.find((update) => update.key === "buildings.TH-14.progress");
  assert.ok(th14, "TH-14 debe actualizarse");
  assert.equal(th14.value, 50, "media de 60 y 40");
  const th03 = resultado.updates.find((update) => update.key === "buildings.TH-03.progress");
  assert.equal(th03.value, 85);
});

test("deja fuera las tareas que no nombran ningún edificio y lo dice", () => {
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  assert.equal(resultado.updates.length, 2, "sólo TH-14 y TH-03");
  assert.ok(resultado.warnings.some((aviso) => /no cuelgan de ningún edificio/.test(aviso)));
  assert.match(resultado.summary, /2 edificios actualizados/);
});

test("un edificio que no existe no se da de alta desde una tarea", () => {
  const plan = planDeObra.replace("TH-14 Estructura", "TH-99 Estructura");
  const resultado = extractProjectXmlUpdates(plan, edificiosReales);
  assert.ok(!resultado.updates.some((update) => update.key.includes("TH-99")));
});

test("un XML que no es de Project se rechaza con una indicación útil", () => {
  const resultado = extractProjectXmlUpdates("<catalogo><item/></catalogo>", edificiosReales);
  assert.equal(resultado.updates.length, 0);
  assert.ok(resultado.warnings.length > 0);
});

test("atribuye a un edificio las tareas que cuelgan de él sin nombrarlo", () => {
  // Un plan real se organiza por capítulos y las tareas de detalle no repiten
  // el nombre del edificio: cuelgan de él. Deben contar igualmente.
  const plan = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
  <Task><Name>Edificio 3</Name><PercentComplete>0</PercentComplete><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task>
  <Task><Name>Estructura</Name><PercentComplete>80</PercentComplete><Duration>PT300H0M0S</Duration><OutlineLevel>2</OutlineLevel><Summary>0</Summary></Task>
  <Task><Name>Remates</Name><PercentComplete>0</PercentComplete><Duration>PT20H0M0S</Duration><OutlineLevel>2</OutlineLevel><Summary>0</Summary></Task>
</Tasks></Project>`;
  const r = extractProjectXmlUpdates(plan, new Set(["3"]));
  const th03 = r.updates.find((u) => u.key === "buildings.TH-03.progress");
  // Ponderado por duración: 80·300 + 0·20 sobre 320 = 75, no la media simple 40.
  assert.equal(th03.value, 75);
});

test("los porcentajes se acotan al rango razonable", () => {
  const plan = planDeObra.replace("<PercentComplete>60</PercentComplete>", "<PercentComplete>140</PercentComplete>");
  const resultado = extractProjectXmlUpdates(plan, edificiosReales);
  const th14 = resultado.updates.find((update) => update.key === "buildings.TH-14.progress");
  assert.equal(th14.value, 70, "140 se acota a 100, media con 40");
});
