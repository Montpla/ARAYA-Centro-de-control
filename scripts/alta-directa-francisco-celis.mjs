#!/usr/bin/env node
// Da de alta a Francisco Celis directamente en D1, saltando la ruta
// /api/admin/users: esa ruta convierte CUALQUIER excepción del INSERT en el
// mensaje genérico "Ese correo ya está registrado.", así que dos intentos
// reales por esa vía (409 los dos) no permiten distinguir un choque de
// correo real de otra causa. La lectura directa a la base, por tres vías
// distintas, confirmó que no existe ninguna fila con este correo. Autorizado
// explícitamente por el usuario para completar el alta por esta vía directa.
//
// El PIN se calcula exactamente igual que hashPin() en lib/pin.ts, para que
// la cuenta quede utilizable de inmediato con el PIN 0000 rellenado en el
// formulario.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scryptSync, randomBytes } from "node:crypto";

const run = promisify(execFile);

function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const now = new Date().toISOString();
const pinHash = hashPin("0000");

const sql = `INSERT INTO app_users (
  email, display_name, role, area, finance_access, finance_upload_access,
  finance_approve_access, active, pin_hash, created_by_email, updated_at
) VALUES (
  'f.celis@grupobak.com', 'Francisco Celis', 'member', 'obra', 1, 1, 1, 1,
  '${pinHash}', 'admin@sistema', '${now}'
);`;

try {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 16 * 1024 * 1024 });
  console.log("=== Resultado ===");
  console.log(stdout);
} catch (error) {
  console.log("=== Error real de SQLite ===");
  console.log(error.stdout || "");
  console.log(error.stderr || error.message);
  process.exit(1);
}

const { stdout: verificacion } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  "SELECT id, email, display_name, role, area, active FROM app_users WHERE email = 'f.celis@grupobak.com';",
], { maxBuffer: 16 * 1024 * 1024 });
console.log("=== Verificación ===");
console.log(verificacion);
