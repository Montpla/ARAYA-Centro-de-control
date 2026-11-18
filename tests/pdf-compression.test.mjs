import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Los PDF de fotos escaneadas (24,7 y 32 MB en octubre de 2026) hacían que el
// Worker devolviera un 503 vacío en cada intento. Se desvían a compresión.
test("un PDF de más de 15 MB se comprime en GitHub antes de leerse", async () => {
  const [route, trigger, script, workflow] = await Promise.all([
    readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pdf-compression-trigger.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/comprimir-pdf.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/comprimir-pdf.yml", import.meta.url), "utf8"),
  ]);
  assert.match(trigger, /export const LARGE_PDF_BYTES = 15 \* 1024 \* 1024;/);
  assert.match(trigger, /const WORKFLOW_FILE = "comprimir-pdf\.yml";/);
  assert.match(
    route,
    /extension === "pdf" && candidate\.size > LARGE_PDF_BYTES && !derivedFromFileId[\s\S]{0,900}triggerPdfCompression\(id\);[\s\S]{0,200}return Response\.json\(/,
    "la ruta no intenta leer el PDF pesado: pide su compresión y responde",
  );
  // El script usa el mismo umbral, marca el derivado y cierra el original.
  assert.match(script, /const UMBRAL_BYTES = 15 \* 1024 \* 1024;/);
  assert.match(script, /form\.set\("automationKind", AUTOMATIZACION\)/);
  assert.match(script, /\/api\/files\/supersede/);
  // La descripción no lleva fechas: detectPeriod las tomaría como periodo.
  assert.doesNotMatch(script, /form\.set\("description", `[^`]*toISOString/);
  assert.match(workflow, /node scripts\/comprimir-pdf\.mjs/);
  assert.match(workflow, /file_id:/);
});
