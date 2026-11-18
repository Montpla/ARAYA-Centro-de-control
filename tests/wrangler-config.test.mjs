import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// scripts/sync-historical-documents.mjs y scripts/deploy.mjs leen la
// configuración de producción con JSON.parse. Un comentario "//" (válido en
// jsonc) rompió el despliegue del 18/11/2026 después de publicar el Worker.
test("wrangler.deploy.jsonc es JSON estricto y vincula el Worker consigo mismo", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.deploy.jsonc", import.meta.url), "utf8"));
  assert.ok(config.r2_buckets?.some((bucket) => bucket.binding === "FILES"));
  assert.deepEqual(
    config.services?.find((service) => service.binding === "SELF"),
    { binding: "SELF", service: config.name },
  );
});
