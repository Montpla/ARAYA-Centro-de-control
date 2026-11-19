#!/usr/bin/env node
// Diagnóstico: qué claves tocó cada publicación reciente y cuáles NO se movieron.
//
// Responde a "subí un archivo y hay datos/gráficos que no se actualizaron":
// muestra, por revisión, qué claves del modelo vivo escribió cada carga, para
// cruzarlas con lo que los paneles leen. Sólo imprime NOMBRES de clave, área y
// procedencia —nunca valores—, así que es seguro en un registro.

import { buildings as baselineBuildings, urbanismAreas as baselineUrbanismAreas } from "../app/demo-data.ts";
import { urbanismReportAreas as baselineUrbanismReportAreas, constructionDisciplines as baselineConstructionDisciplines } from "../app/june-report-data.ts";
import { materializeLiveRoot } from "../lib/live-data.ts";
import { deriveUrbanismMapAreas, reconcileGeneralUrbanism } from "../lib/urbanism-map-progress.ts";
import { readXlsxSheets } from "../lib/xlsx-reader.ts";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import masterplan from "../lib/masterplan-layout.json" with { type: "json" };

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const sessionMatch = loginResponse.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!sessionMatch) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${sessionMatch[1]}`;

// Contraste de los fondos publicados: sólo identidad binaria y contadores.
console.log("=== Geometría del master plan desplegado ===");
for (const mode of ["visual", "tecnico"]) {
  const name = `araya-masterplan-20261119-${mode}.svg`;
  const local = await readFile(new URL(`../public/${name}`, import.meta.url));
  const response = await fetch(`${PRODUCTION_URL}/${name}`, { headers: { Cookie } });
  if (!response.ok) throw new Error(`No se pudo contrastar el plano ${mode} (${response.status}).`);
  const published = new Uint8Array(await response.arrayBuffer());
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (hash(local) !== hash(published)) throw new Error(`El plano ${mode} publicado no coincide con la revisión del código.`);
  console.log(`Plano ${mode}: identidad confirmada · SHA-256 ${hash(published)}`);
}
console.log(`Anclas del master plan: ${Object.keys(masterplan.buildings).length} edificios · ${masterplan.features.length} espacios identificados · ${masterplan.parkingCount} plazas representadas.`);

const liveResponse = await fetch(`${PRODUCTION_URL}/api/live-data`, { headers: { Cookie } });
if (!liveResponse.ok) {
  console.error(`✖ /api/live-data devolvió ${liveResponse.status}.`);
  process.exit(1);
}
const live = await liveResponse.json();
const provenance = live.provenance ?? {};

const controlRoomResponse = await fetch(`${PRODUCTION_URL}/api/control-room`, { headers: { Cookie } });
if (controlRoomResponse.ok) {
  const controlRoom = await controlRoomResponse.json();
  const documents = controlRoom.documents ?? {};
  const actions = controlRoom.actionSummary ?? {};
  console.log("=== Salud del expediente vigente ===");
  console.log(`documentos vigentes: ${documents.total ?? "?"} · resueltos: ${documents.approved ?? "?"} · pendientes: ${documents.pending ?? "?"}`);
  console.log(`propuestas pendientes: ${documents.pendingProposals ?? "?"} · discrepancias vigentes: ${documents.discrepancies ?? "?"}`);
  console.log(`acciones abiertas: ${actions.open ?? "?"} · en curso: ${actions.inProgress ?? "?"} · bloqueadas: ${actions.blocked ?? "?"}`);
  // Lo que el panel pinta ya derivado (avance físico del resumen y corte de
  // la Curva S). Son porcentajes y fechas, no cifras de dinero.
  const planning = controlRoom.planning ?? {};
  console.log("=== Resumen tal como lo sirve producción (derivado) ===");
  console.log(`avance físico: ${planning.physicalActual ?? "?"}% · plan: ${planning.kpiPlan ?? "?"}% · desvío: ${planning.kpiDeviationPoints ?? "?"} pp`);
  console.log(`Curva S en el corte: ${planning.curveCutoffLabel ?? "?"} · ejecutado ${planning.curveActualAtCutoff ?? "?"}% · plan ${planning.curvePlanAtCutoff ?? "?"}%`);
  console.log(`fin previsto: ${planning.forecastFinish ?? "?"} · fin base: ${planning.baselineFinish ?? "?"}`);
}

// Agrupar las claves por la revisión que las escribió.
const porRevision = new Map();
for (const [clave, info] of Object.entries(provenance)) {
  const rev = info.revision ?? 0;
  if (!porRevision.has(rev)) porRevision.set(rev, { info, claves: [] });
  porRevision.get(rev).claves.push(clave);
}

const revisiones = [...porRevision.entries()].sort((a, b) => b[0] - a[0]);
console.log(`=== Revisión viva actual: ${live.revision} · ${Object.keys(provenance).length} claves con procedencia ===`);
if (live.latestEvent) {
  const e = live.latestEvent;
  console.log(`Última publicación: rev ${e.revision} · ${e.changeCount} cambios · ${e.sourceName} · ${e.createdAt}`);
}

for (const [rev, { info, claves }] of revisiones.slice(0, 8)) {
  console.log(`\n--- Revisión ${rev} · ${info.sourceName || "(sin origen)"} · área ${info.area} · ${info.updatedAt || ""} ---`);
  // Se agrupan por raíz (lo que antes del primer punto) para ver a qué parte
  // del panel llegó cada carga.
  const porRaiz = {};
  for (const clave of claves.sort()) {
    const raiz = clave.split(".")[0];
    (porRaiz[raiz] ??= []).push(clave);
  }
  for (const [raiz, lista] of Object.entries(porRaiz)) {
    console.log(`   ${raiz} (${lista.length}): ${lista.slice(0, 8).join(", ")}${lista.length > 8 ? " …" : ""}`);
  }
}

// Avance del cronograma y previsión de fin: son indicadores de PROGRESO FÍSICO
// (porcentaje y fecha), no cifras financieras, así que su valor sí se imprime
// —es justo lo que hay que comprobar cuando se pregunta si el % del cronograma
// que ve el panel es el real del plan. NO se imprime ningún valor de dinero.
const valores = live.values ?? {};
const crono = valores["projectSnapshot.scheduleProgress"];
const avanceFisico = valores["projectSnapshot.overallProgress"];
const urbanismo = valores["urbanismAreas.0.progress"];
const fin = valores["projectSnapshot.forecastFinish"];
const edificios = Object.keys(valores).filter((k) => /^buildings\..+\.progress$/.test(k));
console.log(`\n=== Cronograma y obra (progreso físico, sin cifras de dinero) ===`);
console.log(`avance físico total (projectSnapshot.overallProgress): ${avanceFisico ?? "(sin dato)"}%`);
console.log(`avance de urbanismo (urbanismAreas.0.progress): ${urbanismo ?? "(sin dato)"}%`);
console.log(`avance de cronograma (projectSnapshot.scheduleProgress): ${crono ?? "(sin dato)"}%`);
console.log(`previsión de fin (projectSnapshot.forecastFinish): ${fin ?? "(sin dato)"}`);
console.log(`edificios con avance físico publicado: ${edificios.length}`);
// Avance global de cada edificio con su origen: es lo que decide su color.
const totales = edificios.filter((clave) => /^buildings\.[^.]+\.progress$/.test(clave))
  .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]));
console.log(`avance global por edificio (${totales.length}):`);
for (const clave of totales) {
  const origen = provenance[clave] ? ` · rev ${provenance[clave].revision} · ${provenance[clave].sourceName ?? ""}` : "";
  const nombre = baselineBuildings[Number(clave.split(".")[1])]?.name ?? "";
  console.log(`   ${clave}${nombre ? ` (${nombre})` : ""}: ${Number(valores[clave]).toFixed(2)}%${origen}`);
}

// El titular del resumen toma el último "actual" de la Curva S, no
// projectSnapshot.overallProgress: si la curva se queda en un mes anterior al
// corte declarado, el panel muestra un avance viejo aunque el informe nuevo
// esté publicado. Se imprimen ambos para poder cruzarlos.
const fisicas = Object.keys(valores)
  .filter((k) => /^(monthlyPlan|projectSnapshot\.(plannedProgress|declaredCutoff|activeBuildingsProgress|urbanismProgress|urbanismPlanned)|urbanismReportAreas\..+\.(progress|planned|name)|constructionDisciplines\..+\.(progress|planned|name)|buildings\..+\.(code|planProgress))/.test(k))
  .sort();
console.log(`\n=== Curva S y corte declarado (progreso físico) ===`);
for (const clave of fisicas) {
  const valor = valores[clave];
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  const origen = provenance[clave] ? ` · rev ${provenance[clave].revision} · ${provenance[clave].sourceName ?? ""}` : "";
  console.log(`   ${clave}: ${texto.slice(0, 600)}${origen}`);
}

// Urbanismo tal como lo pinta el plano: disciplinas del informe (por nombre) y
// áreas del plano (burbujas URB, VIAL, PAISAJISMO, P, EQ, ACCESO) ya
// conciliadas. Sólo porcentajes.
const disciplinas = materializeLiveRoot("urbanismReportAreas", baselineUrbanismReportAreas.map((area) => ({ ...area })), valores);
console.log("\n=== Disciplinas de urbanismo vivas (nombre · %) ===");
for (const area of disciplinas) console.log(`   ${area?.name}: ${area?.progress}%`);
const areasPlano = reconcileGeneralUrbanism(
  deriveUrbanismMapAreas(materializeLiveRoot("urbanismAreas", baselineUrbanismAreas, valores), disciplinas),
  valores["projectSnapshot.urbanismProgress"],
);
console.log("\n=== Áreas del plano (id · nombre · avance · plan · estado · fuente) ===");
for (const area of areasPlano) {
  console.log(`   ${area.id} · ${area.name} · ${area.progress ?? "sin dato"} · ${area.planned ?? "-"} · ${area.status} · ${area.source}`);
}

// El índice no identifica un oficio: se imprime la lista materializada por
// nombre para detectar una asignación incorrecta aunque los números existan.
console.log("\n=== Oficios del conjunto (nombre · porcentaje) ===");
const oficios = materializeLiveRoot("constructionDisciplines", baselineConstructionDisciplines, valores);
for (const oficio of oficios) console.log(`   ${oficio.name}: ${oficio.progress}%`);
console.log("\n=== Oficios propios de cada edificio ===");
const edificiosVivos = materializeLiveRoot("buildings", baselineBuildings, valores);
let desgloses = 0;
for (const edificio of edificiosVivos) {
  for (const oficio of edificio.constructionDisciplines ?? []) {
    console.log(`   ${edificio.name} · ${oficio.name}: ${oficio.progress}%`);
    desgloses += 1;
  }
}
console.log(`Desgloses publicados: ${desgloses}`);

// Contraste de la cubicación vigente más reciente. Los originales y los
// valores financieros sólo se comparan en memoria: se informa igualdad,
// corte y huella, nunca importes ni credenciales.
const fileResponse = await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } });
if (fileResponse.ok) {
  const { files = [] } = await fileResponse.json();
  const drawing = files.find((entry) => !entry.deletedAt && !entry.supersededByFileId && entry.originalName === masterplan.source);
  if (drawing) {
    const response = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(drawing.id)}`, { headers: { Cookie } });
    if (!response.ok) throw new Error(`No se pudo contrastar el DWG original (${response.status}).`);
    const hash = createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex");
    if (hash !== masterplan.sha256) throw new Error("El DWG archivado no coincide con el original usado para generar el plano.");
    console.log(`DWG original del master plan: identidad confirmada · SHA-256 ${hash}`);
  }
  const curve = files.filter((entry) => !entry.deletedAt && !entry.supersededByFileId &&
    entry.extension === "xlsx" && /curva.*rep.*gram/i.test(entry.originalName))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (curve) {
    const response = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(curve.id)}`, { headers: { Cookie } });
    if (!response.ok) throw new Error(`No se pudo contrastar el original de la curva (${response.status}).`);
    const bytes = await response.arrayBuffer();
    console.log(`Original de curva contrastado: ${curve.originalName}`);
    console.log(`Huella SHA-256 de curva: ${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}`);
  }
  const file = files.filter((entry) => !entry.deletedAt && !entry.supersededByFileId &&
    entry.extension === "xlsx" && /cubicaci[oó]n/i.test(entry.originalName))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (file) {
    const response = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
    if (!response.ok) throw new Error(`No se pudo contrastar el original de la cubicación (${response.status}).`);
    const bytes = await response.arrayBuffer();
    console.log(`\n=== Original contrastado: ${file.originalName} ===`);
    console.log(`Huella SHA-256: ${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}`);
    let numero = "";
    let certificado = null;
    for (const sheet of await readXlsxSheets(bytes)) {
      for (const row of sheet.slice(0, 20)) {
        const cells = Object.values(row);
        for (const cell of cells) {
          const match = cell.match(/^cubicacion\s+n(?:ro\.?|[o°º]\.?)?\.?\s*(\d+)/i);
          if (match) numero = match[1];
        }
        if (cells.some((cell) => /^monto\s+cubicaci[oó]n:?$/i.test(cell.trim()))) {
          const numeric = cells.filter((cell) => /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(cell));
          if (numeric.length === 1) certificado = Number(numeric[0]);
        }
      }
    }
    const entries = valores.cubicacionCaratula;
    const entry = Array.isArray(entries) ? entries.find((item) => new RegExp(`N[º°o]?\\s*${numero}$`, "i").test(item.label ?? "")) : null;
    const coincide = numero && Number.isFinite(certificado) && entry && typeof entry.montoDop === "number"
      ? Math.abs(entry.montoDop - Math.round(certificado * 100) / 100) < 0.005 : null;
    console.log(`Carátula financiera frente al original: ${coincide === null ? "no verificable" : coincide ? "coincide" : "NO coincide"}`);
    console.log(`Corte de la carátula: ${entry?.cutoff ?? "no disponible"}`);
  }
}
