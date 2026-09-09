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
  const edificios = resultado.updates.filter((u) => u.key.startsWith("buildings."));
  assert.equal(edificios.length, 2, "sólo TH-14 y TH-03");
  assert.ok(resultado.warnings.some((aviso) => /no cuelgan de ningún edificio/.test(aviso)));
  assert.match(resultado.summary, /2 edificios actualizados/);
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

test("un MPP parcial no sustituye el porcentaje ni la fecha del cronograma maestro", () => {
  const resultado = extractProjectXmlUpdates(
    planDeObra,
    edificiosReales,
    "Urbanismo fase I MODIFICADO CORTE 30-07-2026 (convertido de MPP).xml",
  );
  assert.ok(!resultado.updates.some((u) => u.key === "projectSnapshot.scheduleProgress"));
  assert.ok(!resultado.updates.some((u) => u.key === "projectSnapshot.forecastFinish"));
  assert.ok(resultado.updates.some((u) => u.key === "buildings.TH-14.progress"));
  assert.ok(resultado.warnings.some((aviso) => /plan parcial/.test(aviso)));
});

test("el MPP maestro sí puede actualizar el porcentaje global", () => {
  const resultado = extractProjectXmlUpdates(
    planDeObra,
    edificiosReales,
    "Araya 26 edificios CORTE 30-07-2026 (convertido de MPP).xml",
  );
  assert.ok(resultado.updates.some((u) => u.key === "projectSnapshot.scheduleProgress"));
});

test("la fecha de fin del proyecto sale de la tarea más tardía del plan", () => {
  // TH-14 Estructura acaba el 2026-09-30; es la única con fecha, así que marca
  // el fin del proyecto. El dato vivo usa ISO y la pantalla lo formatea aparte.
  const resultado = extractProjectXmlUpdates(planDeObra, edificiosReales);
  const fin = resultado.updates.find((u) => u.key === "projectSnapshot.forecastFinish");
  assert.ok(fin, "el plan debe publicar la fecha de fin");
  assert.equal(fin.value, "2026-09-30");
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

// Reproduce el archivo real "Urbanismo fase I": un capítulo de urbanismo con
// disciplinas como tareas resumen, sin ningún edificio TH-xx colgando de ellas.
const planUrbanismo = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
  <Task><Name>ARAYA-PTA CANA (URBANISMO)</Name><PercentComplete>8</PercentComplete><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task>
  <Task><Name>MOVIMIENTO DE TIERRA</Name><PercentComplete>71</PercentComplete><OutlineLevel>2</OutlineLevel><Summary>1</Summary></Task>
  <Task><Name>ELECTRIFICACION</Name><PercentComplete>8</PercentComplete><OutlineLevel>2</OutlineLevel><Summary>1</Summary></Task>
  <Task><Name>INSTALACIONES DE GAS</Name><PercentComplete>0</PercentComplete><OutlineLevel>2</OutlineLevel><Summary>1</Summary></Task>
</Tasks></Project>`;

// El orden vivo NO coincide con el del código fuente: se reprodujo así en
// producción tras un reemplazo completo del array desde otro archivo. El
// índice 3 -no el que tendría en app/june-report-data.ts- es el real.
const urbanismoVivo = [
  { name: "MOVIMIENTO DE TIERRA", progress: 72.76 },
  { name: "HIDROSANITARIAS", progress: 5 },
  { name: "SISTEMA ESPECIALES", progress: 0 },
  { name: "INFRAESTRUCTURA ELECTRICA", progress: 0 },
  { name: "INSTALACIONES TELECOMUNICACIONES", progress: 0 },
  { name: "INSTALACIONES DE GAS", progress: 0 },
  { name: "VIALIDAD", progress: 0 },
  { name: "PAISAJISMO", progress: 0 },
  { name: "OBRAS EXTERIORES", progress: 0 },
];

test("reconoce una disciplina de urbanismo aunque el plan y urbanismReportAreas usen nombres distintos", () => {
  const resultado = extractProjectXmlUpdates(planUrbanismo, undefined, "", urbanismoVivo);
  const electrica = resultado.updates.find((u) => u.key === "urbanismReportAreas.INFRAESTRUCTURA ELECTRICA.progress");
  assert.ok(electrica, "ELECTRIFICACION del plan debe casar con INFRAESTRUCTURA ELECTRICA");
  assert.equal(electrica.value, 8);
  assert.match(resultado.summary, /1 disciplina de urbanismo actualizada/);
});

test("usa el nombre exacto que ya tiene la disciplina en producción, no una posición calculada a mano", () => {
  // Con el orden vivo real, INFRAESTRUCTURA ELECTRICA está en el índice 3, no
  // en el 5: la clave debe nombrarla, nunca usar un índice numérico fijo, que
  // es justo el fallo que mandó el 8% a "Instalaciones de gas" en producción.
  const resultado = extractProjectXmlUpdates(planUrbanismo, undefined, "", urbanismoVivo);
  assert.ok(!resultado.updates.some((u) => u.key === "urbanismReportAreas.5.progress"));
  assert.ok(!resultado.updates.some((u) => u.key.startsWith("urbanismReportAreas.INSTALACIONES DE GAS")));
});

test("una disciplina sólo avanza: un valor menor o igual al vigente no se publica", () => {
  // MOVIMIENTO DE TIERRA trae 71% en el archivo pero ya hay 72.76% publicado
  // (de otra fuente con más alcance); no debe retroceder.
  const resultado = extractProjectXmlUpdates(planUrbanismo, undefined, "", urbanismoVivo);
  assert.ok(!resultado.updates.some((u) => u.key.startsWith("urbanismReportAreas.MOVIMIENTO DE TIERRA")));
});

test("un 0% de disciplina se trata como sin dato, no borra lo ya publicado", () => {
  const conGasYaAvanzado = urbanismoVivo.map((area) =>
    area.name === "INSTALACIONES DE GAS" ? { ...area, progress: 40 } : area,
  );
  const resultado = extractProjectXmlUpdates(planUrbanismo, undefined, "", conGasYaAvanzado);
  assert.ok(!resultado.updates.some((u) => u.key.startsWith("urbanismReportAreas.INSTALACIONES DE GAS")));
});

test("sin currentUrbanismReportAreas no se calcula ninguna disciplina", () => {
  const resultado = extractProjectXmlUpdates(planUrbanismo);
  assert.ok(!resultado.updates.some((u) => u.key.startsWith("urbanismReportAreas.")));
});
