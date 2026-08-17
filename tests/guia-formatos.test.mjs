import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// La guía de formatos es la única documentación que el personal consulta antes
// de subir un archivo, así que una afirmación desfasada aquí cuesta un corte
// mensual sin publicar. Estas pruebas fijan lo que no puede quedarse atrás
// cuando cambie lo que el programa sabe leer.

const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
const generador = await readFile(new URL("../scripts/generate_formats_guide_pdf.py", import.meta.url), "utf8");
const generadorCarga = await readFile(new URL("../scripts/generate_upload_guide_pdf.py", import.meta.url), "utf8");
const pdf = await readFile(new URL("../historical/data-center/guias/guia-formatos-araya.pdf", import.meta.url));

test("la guía está publicada donde el Centro de datos la sirve", () => {
  // El despliegue sube a R2 todo lo que hay bajo historical/data-center/. Si
  // el PDF no está ahí, el enlace del panel devuelve un 404 en producción y
  // nada lo detecta antes.
  assert.ok(pdf.byteLength > 20_000, "el PDF publicado debe existir y tener contenido");
});

test("aparece en los cuatro accesos con una sola entrada", () => {
  // staffGuides es la fuente única: cabecera, Centro de datos, Usuarios y el
  // menú Más de móvil la recorren. Añadir una guía tocando otro sitio es lo
  // que esa lista existe para evitar.
  const lista = cliente.slice(
    cliente.indexOf("const staffGuides = ["),
    cliente.indexOf("function GuidesPanel"),
  );
  assert.match(lista, /id: "formatos"/);
  assert.match(lista, /guia-formatos-araya\.pdf/);
  assert.equal((lista.match(/guia-formatos-araya\.pdf/g) ?? []).length, 2, "url y fileName");
});

test("el texto del panel cuenta las guías que hay", () => {
  // El conteo del texto debe seguir a la lista de guías: decía «dos» con tres
  // en la lista, el tipo de desajuste que hace dudar de todo lo demás.
  assert.match(cliente, /Cuatro documentos breves/);
  assert.doesNotMatch(cliente, /Tres documentos breves/);
  assert.doesNotMatch(cliente, /Dos documentos breves/);
});

test("las dos guías no se contradicen sobre el ZIP", () => {
  // La de carga listaba el ZIP entre los que «sólo se archivan» mucho después
  // de que los comprimidos empezaran a abrirse. Dos guías que dicen cosas
  // distintas son peores que una sola.
  const soloArchivan = generadorCarga.slice(
    generadorCarga.indexOf('"SOLO SE ARCHIVAN"'),
    generadorCarga.indexOf('"SOLO SE ARCHIVAN"') + 400,
  );
  assert.doesNotMatch(soloArchivan, /ZIP/);
  assert.match(soloArchivan, /Planos DWG/);
  assert.match(soloArchivan, /Cronogramas MPP/);
});

test("sólo el mpp y el dwg figuran como ilegibles", () => {
  // Es la afirmación que más caduca de toda la guía: cada lector nuevo saca un
  // formato de esta lista, y dejarlo dentro desanima a subirlo.
  const grupo = generador.slice(
    generador.indexOf('"Sólo se guarda"'),
    generador.indexOf('"Sólo se guarda"') + 300,
  );
  assert.match(grupo, /\[".mpp", ".dwg"\]/);
});

test("el zip y el pdf figuran entre los que se leen solos", () => {
  const grupo = generador.slice(
    generador.indexOf('"Se lee tal cual"'),
    generador.indexOf('"Se lee tal cual"') + 400,
  );
  for (const formato of [".csv", ".xlsx", ".docx", ".pptx", ".pdf", ".zip", ".xml"]) {
    assert.match(grupo, new RegExp(`"\\${formato}"`), formato);
  }
});

test("la guía lleva a la pantalla de avance manual con su ruta exacta", () => {
  // Si la ruta escrita no coincide con el rótulo de la aplicación, quien la
  // sigue no encuentra nada y vuelve a quedarse sin publicar el corte.
  assert.match(generador, /Usuarios → Actualizar porcentajes a mano/);
  assert.match(cliente, /Actualizar porcentajes a mano/);
});

test("reutiliza la identidad visual en vez de duplicarla", () => {
  // Un cambio de color o de tipografía debe hacerse una sola vez. Copiar la
  // paleta aquí haría que la tercera guía se desviara de las otras dos sin
  // que nadie lo notara hasta tenerlas impresas al lado.
  assert.match(generador, /from generate_staff_guide_pdf import/);
  assert.doesNotMatch(generador, /HexColor\(/);
});
