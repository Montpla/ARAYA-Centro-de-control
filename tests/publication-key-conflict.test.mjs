import assert from "node:assert/strict";
import test from "node:test";
import { publicationKeyConflict } from "../lib/live-data-publication-recovery.ts";

// Norma: la publicación no admite mezclar una lista con una ruta hija suya ni
// claves repetidas. Este detector es el que usa la publicación y el que usa la
// ingesta automática para resolver el choque antes de publicar. Si alguien
// cambia su comportamiento, el informe de ventas (lista de metas + sus filas)
// volvería a no poder publicarse: por eso queda blindado aquí.

test("detecta la mezcla de una lista con su ruta hija", () => {
  const conflicto = publicationKeyConflict([
    "collectionTargets",
    "collectionTargets.0.targetUsd",
  ]);
  assert.ok(conflicto, "debería detectar el choque lista/fila");
  assert.equal(conflicto.ancestor, "collectionTargets");
  assert.equal(conflicto.descendant, "collectionTargets.0.targetUsd");
});

test("detecta una clave repetida", () => {
  const conflicto = publicationKeyConflict([
    "juneReport.sales.reservations",
    "juneReport.sales.reservations",
  ]);
  assert.ok(conflicto);
  assert.equal(conflicto.duplicate, "juneReport.sales.reservations");
});

test("quitar el antepasado deja el lote publicable (gana la fila)", () => {
  // Reproduce la resolución de la ingesta automática: la fila del lector se
  // conserva y la lista entera de la IA se descarta.
  const claves = ["collectionTargets", "collectionTargets.0.targetUsd", "collectionTargets.1.targetUsd"];
  const resueltas = claves.filter((clave) => clave !== "collectionTargets");
  assert.equal(publicationKeyConflict(resueltas), null);
  assert.deepEqual(resueltas, ["collectionTargets.0.targetUsd", "collectionTargets.1.targetUsd"]);
});

test("un lote de ventas sin listas enteras no tiene choques", () => {
  assert.equal(
    publicationKeyConflict([
      "juneReport.sales.reservations",
      "salesModels.0.value",
      "salesModels.1.value",
      "collectionTargets.0.targetUsd",
      "collectionTargets.1.targetUsd",
    ]),
    null,
  );
});
