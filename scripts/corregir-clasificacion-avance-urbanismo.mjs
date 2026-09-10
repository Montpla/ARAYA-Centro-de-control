#!/usr/bin/env node
// Corrección puntual: "Avance urbanismo.xlsx" (id ab9f837d-3513-4a01-be16-
// 01cb63c3668a) quedó clasificado area="obra" documentType="avance_obra" por
// el empate "avance"/"urbanismo" ya corregido en el código (PR #169). Su
// contenido real actualizó urbanismAreas.0.progress y es claramente de
// urbanismo, así que se corrige su clasificación para que el checklist de
// "Avance de urbanismo" lo reconozca -sin tocar ninguna cifra ni evento ya
// publicado, sólo la etiqueta de área/tipo del expediente.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const FILE_ID = "ab9f837d-3513-4a01-be16-01cb63c3668a";

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `UPDATE uploaded_files SET area = 'urbanismo', document_type = 'urbanismo', updated_at = CURRENT_TIMESTAMP WHERE id = '${FILE_ID}' AND original_name = 'Avance urbanismo.xlsx';`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(stdout);

const { stdout: verificacion } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, original_name, area, document_type FROM uploaded_files WHERE id = '${FILE_ID}';`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(verificacion);
