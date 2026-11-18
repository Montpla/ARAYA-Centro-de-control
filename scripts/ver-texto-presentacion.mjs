#!/usr/bin/env node
// Muestra, diapositiva a diapositiva, las líneas de una presentación subida a
// producción que mencionan urbanismo o zonas comunes (vialidad, paisajismo,
// acceso, parqueos, equipamientos…). Sólo lectura; no imprime líneas con
// importes para que el registro de Actions no exponga cifras financieras.

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const FILTRO = (process.env.FILTRO || "informe_ejecutivo_araya_octubre").toLowerCase();
const PALABRAS = /(urban|movimiento|tierra|hidro|sanitar|pluvial|electri|telecom|gas|vial|paisaj|jard|parque|acceso|garita|estacion|parqueo|equipamiento|club|social|amenidad|exterior|especiales|frentes|calle|avenida|acera|area verde|área verde)/i;
const DINERO = /(RD\$|US\$|\$|DOP|USD|millones|mm\b)/i;

const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
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

const { files = [] } = await (await fetch(`${PRODUCTION_URL}/api/files?limit=200`, { headers: { Cookie } })).json();
const archivo = files
  .filter((file) => /\.pptx$/i.test(file.originalName) && file.originalName.toLowerCase().includes(FILTRO))
  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
if (!archivo) {
  console.error(`✖ No hay presentación cuyo nombre contenga "${FILTRO}".`);
  process.exit(1);
}
console.log(`=== ${archivo.originalName} · subido ${archivo.createdAt} ===`);

const descarga = await fetch(`${PRODUCTION_URL}/api/files?download=${encodeURIComponent(archivo.id)}`, { headers: { Cookie } });
if (!descarga.ok) {
  console.error(`✖ La descarga devolvió ${descarga.status}.`);
  process.exit(1);
}
const carpeta = await mkdtemp(join(tmpdir(), "pptx-"));
try {
  const ruta = join(carpeta, "presentacion.pptx");
  await writeFile(ruta, Buffer.from(await descarga.arrayBuffer()));
  const listado = execFileSync("unzip", ["-Z1", ruta], { encoding: "utf8" })
    .split("\n")
    .filter((entrada) => /^ppt\/slides\/slide\d+\.xml$/.test(entrada))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  for (const entrada of listado) {
    const xml = execFileSync("unzip", ["-p", ruta, entrada], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    // Cada párrafo (<a:p>) es una línea; las celdas de tabla son párrafos.
    const lineas = xml
      .split(/<\/a:p>/)
      .map((parrafo) => [...parrafo.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("").trim())
      .filter(Boolean);
    const relevantes = [];
    lineas.forEach((linea, indice) => {
      if (!PALABRAS.test(linea) || DINERO.test(linea)) return;
      // La cifra de una tabla suele ir en la celda siguiente: se muestra junto.
      const siguientes = lineas.slice(indice + 1, indice + 4).filter((celda) => /^-?\d+([.,]\d+)?\s*%?$/.test(celda));
      relevantes.push(siguientes.length ? `${linea} | ${siguientes.join(" | ")}` : linea);
    });
    if (relevantes.length) {
      console.log(`\n--- ${entrada.replace("ppt/slides/", "")} ---`);
      for (const linea of relevantes) console.log(`   ${linea.slice(0, 220)}`);
    }
  }

  // Gráficos: categoría → valor por serie. Sólo se muestran los que son
  // porcentajes (todos los valores entre 0 y 100) y nombran urbanismo o zonas;
  // un gráfico de importes nunca pasa el filtro.
  const graficos = execFileSync("unzip", ["-Z1", ruta], { encoding: "utf8" })
    .split("\n")
    .filter((entrada) => /^ppt\/charts\/chart\d+\.xml$/.test(entrada));
  const puntos = (bloque) => [...bloque.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].map((m) => [Number(m[1]), m[2]]);
  for (const entrada of graficos) {
    const xml = execFileSync("unzip", ["-p", ruta, entrada], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const series = [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => m[1]);
    const lineas = [];
    for (const serie of series) {
      const nombre = serie.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/)?.[1] ?? "(serie)";
      const categorias = new Map(puntos(serie.match(/<c:cat>([\s\S]*?)<\/c:cat>/)?.[1] ?? ""));
      const valores = puntos(serie.match(/<c:val>([\s\S]*?)<\/c:val>/)?.[1] ?? "").map(([idx, v]) => [idx, Number(v)]);
      if (!valores.length || valores.some(([, v]) => !Number.isFinite(v) || v < 0 || v > 100)) continue;
      if (![...categorias.values()].some((categoria) => PALABRAS.test(categoria)) && !PALABRAS.test(nombre)) continue;
      lineas.push(`   serie "${nombre}": ${valores.map(([idx, v]) => `${categorias.get(idx) ?? idx}=${Math.round(v * 100) / 100}`).join(" · ")}`);
    }
    if (lineas.length) {
      console.log(`\n--- gráfico ${entrada.replace("ppt/charts/", "")} ---`);
      for (const linea of lineas) console.log(linea.slice(0, 900));
    }
  }
} finally {
  await rm(carpeta, { recursive: true, force: true });
}
