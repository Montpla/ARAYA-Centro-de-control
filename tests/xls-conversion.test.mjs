import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Un .xls antiguo no da datos en el lector del Worker: se convierte a .xlsx
// en GitHub (LibreOffice) y la copia entra por la ingesta normal.
test("un .xls se desvía a la conversión automática a .xlsx", async () => {
  const [ruta, disparador, script, workflow] = await Promise.all([
    readFile("app/api/files/route.ts", "utf8"),
    readFile("lib/xls-conversion-trigger.ts", "utf8"),
    readFile("scripts/convertir-xls.mjs", "utf8"),
    readFile(".github/workflows/convertir-xls.yml", "utf8"),
  ]);
  assert.match(ruta, /extension === "xls" && !derivedFromFileId/);
  assert.match(ruta, /triggerXlsConversion\(id\)/);
  assert.match(disparador, /convertir-xls\.yml/);
  assert.match(script, /--convert-to", "xlsx"/);
  assert.match(script, /automationKind", AUTOMATIZACION/);
  assert.match(script, /const AUTOMATIZACION = "xls_convert"/);
  assert.match(script, /\/api\/files\/supersede/);
  assert.match(workflow, /libreoffice-calc/);
  assert.match(workflow, /node scripts\/convertir-xls\.mjs/);
});

test("cada dato descartado en la publicación automática queda registrado con su motivo", async () => {
  const ruta = await readFile("app/api/files/route.ts", "utf8");
  assert.match(ruta, /eventType: "datos_descartados"/);
  assert.match(ruta, /su corte es anterior al ya publicado/);
  assert.match(ruta, /no encaja en el contrato del dato vivo/);
});
