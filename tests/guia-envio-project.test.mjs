import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La guía de envío desde Project es la que cierra el bucle automático del .mpp:
// sin ella, el macro existe pero nadie sabe instalarlo. Estas pruebas fijan que
// esté publicada, en el panel y con los pasos que de verdad hay que seguir.

const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const generador = await readFile(new URL("../scripts/generate_macro_guide_pdf.py", import.meta.url), "utf8");
const macro = await readFile(new URL("../scripts/araya-project-autoenvio.bas", import.meta.url), "utf8");
const pdf = await readFile(new URL("../historical/data-center/guias/guia-envio-project-araya.pdf", import.meta.url));

test("la guía está publicada donde el Centro de datos la sirve", () => {
  assert.ok(pdf.byteLength > 20_000, "el PDF publicado debe existir y tener contenido");
});

test("aparece en el catálogo con una sola entrada", () => {
  const lista = cliente.slice(
    cliente.indexOf("const staffGuides = ["),
    cliente.indexOf("function GuidesPanel"),
  );
  assert.match(lista, /id: "envio-project"/);
  assert.equal((lista.match(/guia-envio-project-araya\.pdf/g) ?? []).length, 2, "url y fileName");
});

test("los pasos de la guía coinciden con lo que pide el macro", () => {
  // Si la guía y el macro se separan, alguien seguirá una ruta que ya no existe.
  // Se comprueba que los anclajes reales del macro están en la guía.
  assert.match(generador, /ARAYA_TOKEN/);
  assert.match(macro, /ARAYA_TOKEN/);
  assert.match(generador, /Project_BeforeSave/);
  assert.match(macro, /Project_BeforeSave/);
  assert.match(generador, /araya-project-autoenvio\.bas/);
  assert.match(generador, /Alt \+ F11/);
});

test("deja claro que el token es central y revocable", () => {
  // El punto que responde la duda de «¿lo instala cada uno o se despliega?»:
  // el macro es local, el token se controla desde el panel.
  assert.match(generador, /Usuarios y accesos → Cargas automáticas/);
  assert.match(generador, /revoca/);
  assert.match(generador, /no se instala solo desde el centro de control/i);
});

test("reutiliza la identidad visual en vez de duplicarla", () => {
  assert.match(generador, /from generate_staff_guide_pdf import/);
  assert.doesNotMatch(generador, /HexColor\(/);
});
