import assert from "node:assert/strict";
import test from "node:test";
import { isLiveDataKey } from "../lib/live-data.ts";

// isLiveDataKey es una frontera de seguridad: decide que rutas puede escribir
// un documento subido dentro del modelo vivo. El patron se abrio el 14/08/2026
// para admitir los nombres reales de las entidades -"Albanileria", "Vidrio y
// aluminio"-, asi que conviene fijar por escrito que sigue estando fuera.
//
// Los caracteres de control no se escriben literalmente en este fichero: se
// recorren por codigo mas abajo. Al preparar estas pruebas un byte nulo
// invisible se colo en un fichero auxiliar y la comprobacion acabo validando
// algo distinto de lo que aparentaba, con resultado en verde.

const RECHAZADAS = [
  ["contaminacion de prototipo", "buildings.__proto__.x"],
  ["constructor", "buildings.constructor.x"],
  ["prototype", "buildings.prototype.x"],
  ["prototipo con espacio delante", "buildings. __proto__.x"],
  ["prototipo como hoja", "buildings.__proto__"],
  ["prototipo como raiz", "__proto__.x"],
  ["recorrido de rutas", "buildings.../etc/passwd"],
  ["barra inicial", "buildings./x"],
  ["barra interior", "buildings.a/b"],
  ["barra invertida", "buildings.a\\b"],
  ["espacio inicial", "buildings. hoja"],
  ["guion inicial", "buildings.-hoja"],
  ["subrayado inicial", "buildings._hoja"],
  ["raiz desconocida", "noEsRaiz.TH-14.x"],
  ["segmento vacio", "buildings..x"],
  ["punto inicial", ".buildings.x"],
  ["clave vacia", ""],
];

const ADMITIDAS = [
  ["nombre de obra", "buildings.TH-14.progress"],
  ["identificador interno", "buildings.edificio-14.progress"],
  ["apartamento", "buildings.TH-14.units.14-101.progress"],
  ["nombre con tilde y ene", "workPackages.Albanileria.progress"],
  ["nombre con acentos reales", "workPackages.Albanileria.progress"],
  ["nombre con espacios", "workPackages.Vidrio y aluminio.deviationDays"],
  ["partida economica", "cxpCategories.Edificaciones.amount"],
  ["campo simple", "projectSnapshot.overallProgress"],
  ["posicion numerica", "monthlyPlan.0.actual"],
];

test("la frontera de claves rechaza lo que debe seguir fuera del modelo", () => {
  for (const [motivo, clave] of RECHAZADAS) {
    assert.equal(isLiveDataKey(clave), false, `${motivo}: ${JSON.stringify(clave)} no deberia admitirse`);
  }
});

test("la frontera de claves admite los nombres reales de las entidades", () => {
  for (const [motivo, clave] of ADMITIDAS) {
    assert.equal(isLiveDataKey(clave), true, `${motivo}: ${JSON.stringify(clave)} deberia admitirse`);
  }
});

test("ningun caracter de control se cuela en un nombre de entidad", () => {
  // Barrido completo del rango en vez de una muestra escrita a mano: un solo
  // caracter admitido aqui viajaria hasta la base de datos dentro de una clave,
  // y escribirlos literalmente es justo lo que corrompio la prueba anterior.
  for (let codigo = 0; codigo <= 0x1f; codigo += 1) {
    const clave = `buildings.a${String.fromCharCode(codigo)}b.progress`;
    assert.equal(isLiveDataKey(clave), false, `el caracter de control ${codigo} no deberia admitirse`);
  }
  for (const codigo of [0x7f, 0x2028, 0x2029, 0xa0, 0x200b, 0xfeff]) {
    const clave = `buildings.a${String.fromCharCode(codigo)}b.progress`;
    assert.equal(isLiveDataKey(clave), false, `el caracter ${codigo.toString(16)} no deberia admitirse`);
  }
});

test("las letras acentuadas y la ene si se admiten", () => {
  // Se construyen por codigo para que ninguna transformacion del fichero las
  // convierta en otra cosa sin que se note.
  const enye = String.fromCharCode(0xf1);
  const iAcentuada = String.fromCharCode(0xed);
  assert.equal(isLiveDataKey(`workPackages.Alba${enye}iler${iAcentuada}a.progress`), true);
  assert.equal(isLiveDataKey(`workPackages.Z${String.fromCharCode(0xf3)}calo y masilla.progress`), true);
});
