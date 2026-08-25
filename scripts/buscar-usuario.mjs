#!/usr/bin/env node
// Sólo lectura: busca en app_users por correo exacto (normalizado) para ver
// si existe una fila activa, eliminada (archivada) o ninguna -- sin exponer
// el hash del PIN.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const CORREO = (process.env.CORREO ?? "").trim().toLowerCase();
if (!CORREO) {
  console.error("✖ Falta CORREO.");
  process.exit(1);
}

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, email, display_name, role, active, deleted_at, deleted_by_email, created_at, updated_at FROM app_users WHERE lower(email) = '${CORREO}';`,
], { maxBuffer: 16 * 1024 * 1024 });

const parsed = JSON.parse(stdout);
const rows = parsed?.[0]?.results ?? [];
console.log(`=== ${rows.length} fila(s) para "${CORREO}" ===`);
for (const fila of rows) {
  console.log(`\n· id: ${fila.id}`);
  console.log(`  email guardado: "${fila.email}"`);
  console.log(`  nombre: ${fila.display_name}`);
  console.log(`  rol: ${fila.role} · activo: ${fila.active ? "sí" : "no"}`);
  console.log(`  eliminado: ${fila.deleted_at || "no"}${fila.deleted_by_email ? " · por " + fila.deleted_by_email : ""}`);
  console.log(`  creado: ${fila.created_at} · actualizado: ${fila.updated_at}`);
}
