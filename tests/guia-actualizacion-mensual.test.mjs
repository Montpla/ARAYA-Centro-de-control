import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La guía de actualización mensual es la que dice qué se sube cada mes para que
// el panel se ponga al día solo. Si se desfasa (un formato que ya no aplica, un
// archivo que ya no hace falta), el mes se cierra a medias. Estas pruebas fijan
// lo esencial.

const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const generador = await readFile(new URL("../scripts/generate_monthly_update_guide_pdf.py", import.meta.url), "utf8");
const pdf = await readFile(new URL("../historical/data-center/guias/guia-actualizacion-mensual-araya.pdf", import.meta.url));

test("la guía está publicada donde el Centro de datos la sirve", () => {
  assert.ok(pdf.byteLength > 20_000, "el PDF publicado debe existir y tener contenido");
});

test("aparece en los accesos con una sola entrada", () => {
  const lista = cliente.slice(
    cliente.indexOf("const staffGuides = ["),
    cliente.indexOf("function GuidesPanel"),
  );
  assert.match(lista, /id: "actualizacion-mensual"/);
  assert.equal((lista.match(/guia-actualizacion-mensual-araya\.pdf/g) ?? []).length, 2, "url y fileName");
});

test("cubre los tres archivos del mes y lo que actualiza cada uno", () => {
  // Los tres formatos que cierran el mes: informe (obra), Excel (finanzas) y
  // plan de Project (cronograma). Si falta uno, el mes queda a medias.
  assert.match(generador, /Informe Ejecutivo/);
  assert.match(generador, /Excel de flujo reprogramado/);
  assert.match(generador, /Plan de Project/);
  assert.match(generador, /Curva S/);
  assert.match(generador, /Flujo mensual de finanzas/);
  assert.match(generador, /cronograma/);
});

test("deja claro que entra solo, sin revisión", () => {
  assert.match(generador, /sin revisión/i);
});

test("reutiliza la identidad visual en vez de duplicarla", () => {
  assert.match(generador, /from generate_staff_guide_pdf import/);
  assert.doesNotMatch(generador, /HexColor\(/);
});
