import assert from "node:assert/strict";
import test from "node:test";
import { nothingExtractedMessage } from "../lib/upload-messages.ts";

// El mensaje que sustituyen estas pruebas ("queda pendiente de interpretación")
// sostuvo meses de espera: daba a entender que el procesamiento seguía en
// marcha cuando en realidad ya había terminado sin publicar nada.
test("el mpp confirma la conversión automática", () => {
  const mensaje = nothingExtractedMessage("Obra", "mpp");
  assert.match(mensaje, /conversión automática/);
  assert.match(mensaje, /15 minutos/);
  assert.match(mensaje, /enlazado/);
});

test("el dwg confirma que creará una vista navegable", () => {
  const mensaje = nothingExtractedMessage("Obra", "dwg");
  assert.match(mensaje, /vista automática/);
  assert.match(mensaje, /móvil\/tableta/);
  assert.match(mensaje, /una hora/);
});

test("el zip ya no se anuncia como formato que no se lee", () => {
  // Los comprimidos se abren y se procesa lo que llevan dentro. Seguir
  // diciendo que sus cifras no van a llegar desanimaba a subir el corte del
  // mes, que es justo como viene casi siempre.
  const mensaje = nothingExtractedMessage("Obra", "zip");
  assert.doesNotMatch(mensaje, /no lo hará más adelante/);
  assert.match(mensaje, /siguen como estaban/);
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
