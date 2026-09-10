#!/usr/bin/env node
// Frente 4 del plan de fiabilidad: entorno de preproducción.
//
// Crea (si no existen ya) la base D1 y el bucket R2 de staging, y aplica
// contra la D1 de staging todas las migraciones de drizzle/, en orden. No
// toca ninguna base ni bucket de producción. No importa ningún dato real:
// la base de staging arranca vacía a propósito (ver comentario largo en
// .github/workflows/staging-provisionar.yml sobre por qué).
//
// Es idempotente: si ya existen, "wrangler d1 create"/"wrangler r2 bucket
// create" fallan con un mensaje claro y este script sigue adelante.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";

const run = promisify(execFile);
const D1_NAME = "araya-centro-control-d1-staging";
const R2_BUCKET = "araya-centro-control-staging-files";

async function wrangler(args) {
  try {
    const { stdout } = await run("npx", ["wrangler", ...args], { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    // "ya existe" es un resultado válido aquí: el script es idempotente.
    const output = String(error.stdout || "") + String(error.stderr || "");
    if (/already exists/i.test(output)) {
      console.log(`(ya existía, sin cambios) ${args.join(" ")}`);
      return output;
    }
    throw error;
  }
}

console.log(`=== Creando D1 de staging: ${D1_NAME} ===`);
console.log(await wrangler(["d1", "create", D1_NAME]));

console.log(`=== Creando bucket R2 de staging: ${R2_BUCKET} ===`);
console.log(await wrangler(["r2", "bucket", "create", R2_BUCKET]));

console.log("=== database_id de la D1 de staging (para wrangler.staging.jsonc) ===");
const info = await wrangler(["d1", "info", D1_NAME, "--json"]);
const parsed = JSON.parse(info);
console.log(`database_id: ${parsed.uuid}`);

const migrationFiles = readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort();
console.log(`\n=== Aplicando ${migrationFiles.length} migraciones contra ${D1_NAME} ===`);
for (const file of migrationFiles) {
  console.log(`--- drizzle/${file} ---`);
  try {
    console.log(await wrangler(["d1", "execute", D1_NAME, "--remote", "--file", `drizzle/${file}`]));
  } catch (error) {
    const output = String(error.stdout || "") + String(error.stderr || "");
    if (/already exists|duplicate column/i.test(output)) {
      console.log(`(ya aplicada, sin cambios) drizzle/${file}`);
      continue;
    }
    throw error;
  }
}
console.log("\nListo. Copia el database_id de arriba en wrangler.staging.jsonc antes del primer despliegue.");
