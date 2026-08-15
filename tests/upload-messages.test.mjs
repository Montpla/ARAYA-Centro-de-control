import assert from "node:assert/strict";
import test from "node:test";
import { nothingExtractedMessage } from "../lib/upload-messages.ts";

// El mensaje que sustituyen estas pruebas ("queda pendiente de interpretación")
// sostuvo meses de espera: daba a entender que el procesamiento seguía en
// marcha cuando en realidad ya había terminado sin publicar nada.
test("el mpp señala la salida que sí funciona", () => {
  // Los .mpp tienen una salida propia y mejor que la del resto: Project guarda
  // en XML de forma nativa y ese formato se lee entero, así que el mensaje
  // lleva ahí en vez de a una exportación a Excel, que pierde estructura.
  const mensaje = nothingExtractedMessage("Obra", "mpp");
  assert.match(mensaje, /no se leen por dentro/);
  assert.match(mensaje, /XML/);
  assert.match(mensaje, /Guardar como/);
  assert.doesNotMatch(mensaje, /pendiente de interpretación/);
});

test("dwg y zip siguen sin tener salida y lo dicen", () => {
  for (const extension of ["dwg", "zip"]) {
    const mensaje = nothingExtractedMessage("Obra", extension);
    assert.match(mensaje, /no lo hará más adelante/);
    assert.match(mensaje, /Excel o CSV/);
  }
});

test("un formato legible sin datos aprovechables arrastra el motivo concreto", () => {
  const mensaje = nothingExtractedMessage("Obra", "xlsx", [
    "La clave buildings.patio no pertenece al modelo vivo de ARAYA.",
  ]);
  assert.match(mensaje, /siguen como estaban/);
  assert.match(mensaje, /buildings\.patio/);
});

test("el mensaje no se desborda con una lista larga de avisos", () => {
  const mensaje = nothingExtractedMessage("Obra", "pdf", [
    "Primer aviso.",
    "Segundo aviso.",
    "Tercer aviso.",
    "Cuarto aviso.",
  ]);
  assert.match(mensaje, /Primer aviso/);
  assert.match(mensaje, /Segundo aviso/);
  assert.doesNotMatch(mensaje, /Tercer aviso/);
});

test("sin avisos el mensaje sigue siendo legible", () => {
  const mensaje = nothingExtractedMessage("Finanzas", "pdf", []);
  assert.match(mensaje, /Archivo registrado en Finanzas/);
  assert.doesNotMatch(mensaje, /\s{2,}/);
});
