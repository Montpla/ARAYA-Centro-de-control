import test from "node:test";
import assert from "node:assert/strict";
import { filtroEfectivo, seleccionarObjetivo } from "../scripts/reprocesar-filtro.mjs";

const files = [
  { id: "a", originalName: "Reporte Semanal.pdf", extension: "pdf" },
  { id: "b", originalName: "Cubicación jul.xlsx", extension: "xlsx" },
  { id: "c", originalName: "Borrado jul.xlsx", extension: "xlsx", deletedAt: "2026-01-01" },
];

test("con FILE_ID se ignora el filtro por nombre", () => {
  const r = seleccionarObjetivo(files, { fileId: "a", filtro: "jul" });
  assert.deepEqual(r.map((f) => f.id), ["a"]);
  assert.equal(filtroEfectivo("a", "jul"), "");
});

test("sin FILE_ID el filtro se aplica como siempre", () => {
  assert.deepEqual(seleccionarObjetivo(files, { filtro: "jul" }).map((f) => f.id), ["b"]);
  assert.deepEqual(seleccionarObjetivo(files, { fileId: "  ", filtro: "jul" }).map((f) => f.id), ["b"]);
});

test("con FILE_ID siguen excluyéndose los eliminados", () => {
  assert.deepEqual(seleccionarObjetivo(files, { fileId: "c", filtro: "jul" }), []);
});
