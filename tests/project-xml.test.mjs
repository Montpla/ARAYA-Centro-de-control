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

test("el plan de Project NO publica avance por edificio ni avance físico", () => {
  // NORMA: el porcentaje de una tarea del MPP es avance de CRONOGRAMA, no obra
  // ejecutada medida. Publicar buildings.*.progress desde el plan movía el
  // avance físico del panel (media de los edificios), que por gobernanza sale
  // del Excel/informe de obra. El MPP no debe emitir ninguna clave de edificio.
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  const edificios = resultado.updates.filter((u) => u.key.startsWith("buildings."));
  assert.equal(edificios.length, 0, "el plan no publica ninguna clave buildings.*");
  assert.match(resultado.summary, /no el avance físico/);
});

test("el avance del cronograma sale del propio plan, no de un número a mano", () => {
  // Media de TODAS las hojas ponderada por duración, tengan edificio o no: la
  // estructura de TH-14 (60%, 494 h de PT01/09) pesa mucho más que el resto.
  // Lo importante es que salga un valor del plan y que no se congele en 17.
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  const crono = resultado.updates.find((u) => u.key === "projectSnapshot.scheduleProgress");
  assert.ok(crono, "el plan debe publicar el % de cronograma");
  assert.ok(crono.value > 0 && crono.value <= 100, "es un porcentaje válido");
  // Con estas cinco tareas (60, 40, 85, 100 en hojas), el cronograma no puede
  // ser 0 ni el 17 congelado del baseline.
  assert.notEqual(crono.value, 17);
});

test("la fecha de fin del proyecto sale de la tarea más tardía del plan", () => {
  // TH-14 Estructura acaba el 2026-09-30; es la única con fecha, así que marca
  // el fin del proyecto, en el formato del panel (DD/MM/YYYY).
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  const fin = resultado.updates.find((u) => u.key === "projectSnapshot.forecastFinish");
  assert.ok(fin, "el plan debe publicar la fecha de fin");
  assert.equal(fin.value, "30/09/2026");
});

test("ninguna tarea da de alta claves de edificio, exista o no el código", () => {
  const plan = planDeObra.replace("TH-14 Estructura", "TH-99 Estructura");
  const resultado = extractProjectXmlUpdates(plan, edificiosReales);
  assert.ok(!resultado.updates.some((update) => update.key.startsWith("buildings.")));
});

test("un XML que no es de Project se rechaza con una indicación útil", () => {
  const resultado = extractProjectXmlUpdates("<catalogo><item/></catalogo>", edificiosReales);
  assert.equal(resultado.updates.length, 0);
  assert.ok(resultado.warnings.length > 0);
});

test("el avance de cronograma pondera las tareas por duración", () => {
  // El % de cronograma es la media de TODAS las hojas ponderada por duración.
  // No se publica ninguna clave de edificio (el avance físico sale del Excel).
  const plan = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
  <Task><Name>Edificio 3</Name><PercentComplete>0</PercentComplete><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task>
  <Task><Name>Estructura</Name><PercentComplete>80</PercentComplete><Duration>PT300H0M0S</Duration><OutlineLevel>2</OutlineLevel><Summary>0</Summary></Task>
  <Task><Name>Remates</Name><PercentComplete>0</PercentComplete><Duration>PT20H0M0S</Duration><OutlineLevel>2</OutlineLevel><Summary>0</Summary></Task>
</Tasks></Project>`;
  const r = extractProjectXmlUpdates(plan, new Set(["3"]));
  const crono = r.updates.find((u) => u.key === "projectSnapshot.scheduleProgress");
  // Ponderado por duración: 80·300 + 0·20 sobre 320 = 75, no la media simple 40.
  assert.equal(crono.value, 75);
  assert.ok(!r.updates.some((u) => u.key.startsWith("buildings.")), "no publica edificios");
});

test("los porcentajes se acotan al rango razonable en el cronograma", () => {
  const plan = planDeObra.replace("<PercentComplete>60</PercentComplete>", "<PercentComplete>140</PercentComplete>");
  const resultado = extractProjectXmlUpdates(plan, edificiosReales);
  const crono = resultado.updates.find((update) => update.key === "projectSnapshot.scheduleProgress");
  assert.ok(crono.value <= 100, "un 140 no puede empujar el cronograma por encima de 100");
});
