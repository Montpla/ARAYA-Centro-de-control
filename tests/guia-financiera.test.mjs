import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [cliente, generador, pdf] = await Promise.all([
  readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../scripts/generate_financial_guide_pdf.py", import.meta.url), "utf8"),
  readFile(new URL("../historical/data-center/guias/guia-financiera-araya.pdf", import.meta.url)).catch(() => Buffer.alloc(0)),
]);

test("la guía financiera está registrada y publicada", () => {
  assert.match(cliente, /id: "finanzas"/);
  assert.equal((cliente.match(/guia-financiera-araya\.pdf/g) ?? []).length, 2);
  assert.ok(pdf.byteLength > 20_000, "el PDF financiero debe existir y tener contenido");
});

test("la guía explica permisos, controles, moneda, fuente y recibo", () => {
  for (const pattern of [
    /Entregar no significa poder consultar/,
    /ACTIVO = PASIVO \+ PATRIMONIO/,
    /INGRESOS - GASTOS = RESULTADO/,
    /DÉBITO = CRÉDITO/,
    /TOTAL = URBANISMO \+ EDIFICIOS/,
    /moneda canónica/,
    /mayor autoridad/,
    /EL RECIBO ES LA RESPUESTA/,
  ]) assert.match(generador, pattern);
});

test("la guía comparte la identidad corporativa", () => {
  assert.match(generador, /from generate_staff_guide_pdf import/);
  assert.doesNotMatch(generador, /HexColor\(/);
});
