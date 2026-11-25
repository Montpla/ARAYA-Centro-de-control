import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const client=await readFile(new URL("../app/dashboard-client.tsx",import.meta.url),"utf8");
const catalog=client.slice(client.indexOf("const staffGuides = ["),client.indexOf("function GuidesPanel"));
const guides=[
  ["corporativa-bricket-control-personal-obra",8,[/77 edificios/,/462 apartamentos/,/no hay mediciones individuales/,/seguridad.*mensual/]],
  ["actualizacion-mensual-araya",4,[/excel de la curva fija el avance global/,/no fija la curva s/,/cubicacion del corte/,/gantt html/,/no son mediciones por apartamento/,/no cierra automaticamente el periodo/]],
  ["formatos-araya",5,[/\.html/,/no recoloca por si sola/,/sin ejecutar/,/no utilices usuarios/]],
  ["envio-project-araya",5,[/la recepcion no garantiza/,/cubicacion/,/no crea mediciones individuales/,/gantt html/]],
  ["financiera-araya",4,[/anticipos acumulados/,/no se vuelve a sumar/,/el excel del flujo prevalece/,/prevision/]],
  ["avisos-araya",4,[/la cubicacion no mueve la curva s/,/integrado/,/revisar carga/,/sin cambios/,/no deben incluir importes/]],
];
for(const [name,pages,patterns] of guides)test(`la guía ${name} publicada coincide con su catálogo y su alcance vigente`,async()=>{
  const file=`guia-${name}.pdf`;
  const bytes=await readFile(new URL(`../historical/data-center/guias/${file}`,import.meta.url));
  const pageCount=(bytes.toString("latin1").match(/\/Type\s*\/Page\b/g)??[]).length;
  assert.equal(pageCount,pages,"el PDF debe conservar todas sus páginas");
  const entry=catalog.slice(catalog.lastIndexOf("{",catalog.indexOf(`/data-center/guias/${file}`)),catalog.indexOf(`/data-center/guias/${file}`));
  assert.ok(entry.includes(`pages: "${pages} páginas · 25.11.2026"`),"el catálogo debe indicar las páginas y edición reales");
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
  const doc=await task.promise;
  const parts=[];
  try {
    assert.equal(doc.numPages,pages);
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i);const content=await page.getTextContent();
      parts.push(content.items.filter(item=>"str" in item).map(item=>item.str).join(" "));
    }
  } finally {await task.destroy();}
  const text=parts.join(" ").normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/\s+/g," ").toLowerCase();
  assert.ok(text.includes("25.11.2026"),"el PDF publicado debe contener la nueva edición");
  for(const pattern of patterns)assert.ok(pattern.test(text),`falta contenido vigente: ${pattern}`);
  assert.ok(!text.includes("tres archivos y el mes queda cerrado"),"no se debe confundir una carga con el cierre del periodo");
});
