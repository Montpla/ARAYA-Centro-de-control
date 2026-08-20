import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La actualización a mano es la única vía que no depende de poder leer un
// archivo, así que es la que sostiene el caso que no tiene otra salida: el .mpp
// de Microsoft Project, un binario sin documentar que no se puede interpretar.
// Estas pruebas fijan que siga siendo una publicación normal —con su corte, su
// procedencia y su histórico— y no un atajo que se salte los controles.

const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const ruta = await readFile(new URL("../app/api/live-data/route.ts", import.meta.url), "utf8");
const estilos = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

const tarjeta = cliente.slice(
  cliente.indexOf("function ManualProgressCard"),
  cliente.indexOf("function TvScreensCard"),
);

test("la pantalla existe y está colocada donde se administra", () => {
  assert.ok(tarjeta.length > 0, "ManualProgressCard debe existir");
  assert.match(cliente, /<ManualProgressCard \/>/);
  assert.match(estilos, /\.manual-progress-grid/);
});

test("publica por el mismo camino que una carga de archivo", () => {
  // Escribir en el modelo vivo por otra vía dejaría cifras sin corte, sin
  // procedencia y sin entrada en el histórico: irrastreables justo en el caso
  // en el que no hay un archivo original al que volver.
  assert.match(tarjeta, /fetch\("\/api\/live-data"/);
  assert.match(tarjeta, /method: "POST"/);
  assert.match(tarjeta, /cutoff/);
  assert.match(tarjeta, /sourceName: "Actualización manual de avances"/);
});

test("sólo un administrador puede publicar avances", () => {
  // La pantalla no inventa su propio permiso: usa el endpoint que ya exige
  // administrador, así que no hay dos criterios distintos sobre quién publica.
  assert.match(ruta, /export async function POST[\s\S]{0,200}requireApiUser\(\{ admin: true \}\)/);
});

test("no se publica un porcentaje imposible", () => {
  assert.match(tarjeta, /valor < 0 \|\| valor > 100/);
  assert.match(tarjeta, /fuera de rango/);
});

test("escribir el mismo valor que ya había no genera una revisión", () => {
  // Si no, repasar el corte sin cambiar nada llenaría el histórico de
  // revisiones vacías y enterraría las que sí movieron algo.
  assert.match(tarjeta, /Math\.abs\(valor - building\.progress\) < 0\.005/);
});

test("un campo en blanco deja el edificio como estaba", () => {
  // Publicar "" borraría el avance existente, que es el modo de fallo que ya
  // apareció leyendo celdas vacías de Excel.
  assert.match(tarjeta, /if \(escrito === undefined \|\| !escrito\.trim\(\)\) return null;/);
  assert.match(tarjeta, /Los\s*\n?\s*que dejes en blanco se quedan como están/);
});

test("las claves van por código de edificio, no por posición", () => {
  // buildings.13.progress apuntaba a la posición 13 del array, que no es el
  // TH-13. Con el código, la cifra llega al edificio que la persona nombró.
  assert.match(tarjeta, /`buildings\.\$\{building\.shortName\}\.progress`/);
});

test("quien sube un .mpp ve la conversión y la salida manual urgente", () => {
  // El aviso de la subida confirma el proceso automático y conserva una salida
  // manual trazable para un corte que no pueda esperar 15 minutos.
  const aviso = cliente.slice(
    cliente.indexOf('deferredConversionExtension === "mpp"'),
    cliente.indexOf('deferredConversionExtension === "mpp"') + 1400,
  );
  assert.match(aviso, /15 minutos/);
  assert.match(aviso, /Actualizar porcentajes a\s*\n?\s*mano/);
});

test("sólo MPP y DWG usan conversión diferida", () => {
  const lista = cliente.match(/const DEFERRED_CONVERSION_EXTENSIONS = \[([^\]]*)\]/);
  assert.ok(lista, "debe existir la lista de formatos con conversión diferida");
  assert.doesNotMatch(lista[1], /"zip"/);
  assert.match(lista[1], /"mpp"/);
  assert.match(lista[1], /"dwg"/);
});
