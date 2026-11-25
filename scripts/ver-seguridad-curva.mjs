#!/usr/bin/env node
// Sólo lectura: ¿con qué archivo trabaja el panel en Seguridad y en la Curva S?
//
// Responde a dos preguntas de la oficina: «subo el reporte de Seguridad, me
// dice que está repetido y el personal no cambia» y «la curva no se
// actualiza». Lista los reportes de Seguridad registrados (con su huella, para
// saber a cuál se parece un archivo «repetido») y, para cada dato vivo de
// Seguridad, personal y Curva S, el archivo y la revisión que lo fijaron.
// No imprime importes: sólo indicadores de Seguridad, porcentajes y fechas.

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN en el entorno.");
  process.exit(1);
}
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!session) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}
const Cookie = `araya_session=${session[1]}`;
const leer = async (ruta) => {
  const respuesta = await fetch(`${PRODUCTION_URL}${ruta}`, { headers: { Cookie } });
  if (!respuesta.ok) throw new Error(`${ruta} devolvió ${respuesta.status}`);
  return respuesta.json();
};

const { files = [] } = await leer("/api/files?includeDeleted=1&limit=200");
const esSeguridad = (f) => f.area === "seguridad" || /seguridad|safety|personal/i.test(f.originalName ?? "");
console.log("=== Archivos de Seguridad registrados (más reciente primero) ===");
for (const f of files.filter(esSeguridad).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
  const huella = String(f.sha256 ?? f.checksum ?? "").slice(0, 12) || "?";
  console.log(`${f.createdAt} · ${f.originalName}`);
  console.log(`   área ${f.area} · corte ${f.detectedPeriod || "—"} · ${f.reviewStatus} · rev ${f.publicationRevision ?? "—"} · huella ${huella}${f.deletedAt ? " · ELIMINADO" : ""}${f.supersededByFileId ? " · sustituido" : ""}`);
}

const live = await leer("/api/live-data");
const values = live.values ?? {};
const provenance = live.provenance ?? {};
const origen = (clave) => provenance[clave]
  ? `rev ${provenance[clave].revision} · ${provenance[clave].sourceName ?? ""} · corte ${provenance[clave].cutoff ?? "—"}`
  : "sin procedencia";
const mostrar = (valor) => {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return String(texto).length > 400 ? `${String(texto).slice(0, 400)} …` : texto;
};

const claves = Object.keys({ ...values, ...provenance });
console.log("\n=== Datos vivos de Seguridad y personal ===");
for (const clave of claves.filter((k) => /^safety|personal|workers|trabajador|plantilla|headcount/i.test(k)).sort()) {
  console.log(`${clave}: ${mostrar(values[clave])}`);
  console.log(`   ← ${origen(clave)}`);
}

console.log("\n=== Curva S (monthlyPlan) por mes ===");
// Los valores vivos son planos («monthlyPlan.16.actual»); se agrupan por mes.
const meses = new Map();
for (const clave of claves) {
  const partes = clave.match(/^monthlyPlan\.(\d+)\.(\w+)$/);
  if (!partes) continue;
  if (!meses.has(Number(partes[1]))) meses.set(Number(partes[1]), {});
  meses.get(Number(partes[1]))[partes[2]] = clave;
}
for (const [i, campos] of [...meses.entries()].sort((a, b) => a[0] - b[0])) {
  const etiqueta = values[campos.month] ?? values[campos.label] ?? values[campos.date] ?? "";
  const texto = ["planned", "reprogrammed", "actual"]
    .filter((campo) => campos[campo])
    .map((campo) => `${campo}=${values[campos[campo]]} (${provenance[campos[campo]]?.sourceName ?? "—"})`);
  console.log(`[${i}] ${etiqueta} · ${texto.join(" · ")}`);
}
for (const clave of claves.filter((k) => /^projectSnapshot\.(overallProgress|declaredCutoff|plannedProgress|urbanismProgress)/.test(k))) {
  console.log(`${clave}: ${mostrar(values[clave])} ← ${origen(clave)}`);
}

try {
  const controlRoom = await leer("/api/control-room");
  const planning = controlRoom.planning ?? {};
  console.log(`\nPanel (derivado): avance ${planning.physicalActual}% · plan ${planning.kpiPlan}% · Curva S en ${planning.curveCutoffLabel}: ejecutado ${planning.curveActualAtCutoff}% · plan ${planning.curvePlanAtCutoff}%`);
} catch (error) {
  console.log(`(sin /api/control-room: ${error.message})`);
}
