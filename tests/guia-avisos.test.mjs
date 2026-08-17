import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La guía de avisos es lo que se manda a cada persona para que active las
// notificaciones. Si el PDF no está publicado, o el paso del iPhone se pierde,
// la gente cree que los avisos no funcionan cuando el problema es que nadie
// dio el permiso. Estas pruebas fijan lo que no puede quedarse fuera.

const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const generador = await readFile(new URL("../scripts/generate_notifications_guide_pdf.py", import.meta.url), "utf8");
const pdf = await readFile(new URL("../historical/data-center/guias/guia-avisos-araya.pdf", import.meta.url));

test("la guía está publicada donde el Centro de datos la sirve", () => {
  // El despliegue sube a R2 todo lo que hay bajo historical/data-center/. Si
  // el PDF no está ahí, el enlace del panel devuelve un 404 en producción.
  assert.ok(pdf.byteLength > 20_000, "el PDF publicado debe existir y tener contenido");
});

test("aparece en los accesos con una sola entrada", () => {
  // staffGuides es la fuente única: cabecera, Centro de datos, Usuarios y el
  // menú Más de móvil la recorren.
  const lista = cliente.slice(
    cliente.indexOf("const staffGuides = ["),
    cliente.indexOf("function GuidesPanel"),
  );
  assert.match(lista, /id: "avisos"/);
  assert.equal((lista.match(/guia-avisos-araya\.pdf/g) ?? []).length, 2, "url y fileName");
});

test("el paso de dar permiso una vez está en la guía", () => {
  // El gesto que activa todo: sin él, ningún aviso llega, y es lo que más se
  // olvida explicar.
  assert.match(generador, /Activar notificaciones/);
  assert.match(generador, /Permitir/);
});

test("la guía advierte del paso extra en iPhone", () => {
  // En iOS los avisos sólo llegan si la app está instalada. Omitirlo hace que
  // los usuarios de iPhone crean que el sistema está roto.
  assert.match(generador, /iPhone/);
  assert.match(generador, /pantalla de inicio/);
  assert.match(generador, /Apple/);
});

test("reutiliza la identidad visual en vez de duplicarla", () => {
  // Un cambio de color o tipografía debe hacerse una sola vez.
  assert.match(generador, /from generate_staff_guide_pdf import/);
  assert.doesNotMatch(generador, /HexColor\(/);
});
