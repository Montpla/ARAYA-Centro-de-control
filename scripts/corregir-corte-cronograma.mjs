#!/usr/bin/env node
// Corrección puntual: el usuario confirmó que el cronograma subido
// ("Araya 26 edificios CORTE 30-08-2026 CAMBIO EDIFICIOS AFI (convertido de
// MPP).xml", id b230fdf8-6f98-4d05-8f42-c0002aa25c83) es el vigente de
// septiembre, aunque su nombre traiga la fecha de corte de agosto. Se ajusta
// detected_period/declared_cutoff a hoy (2026-09-10) para que
// reconcileReportingPeriods lo cuente en el periodo de septiembre, no el de
// agosto. No toca ninguna cifra ni evento ya publicado, sólo la fecha de
// corte del expediente.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const FILE_ID = "b230fdf8-6f98-4d05-8f42-c0002aa25c83";
const NUEVO_CORTE = "2026-09-10";

const { stdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `UPDATE uploaded_files SET detected_period = '${NUEVO_CORTE}', declared_cutoff = '${NUEVO_CORTE}', updated_at = CURRENT_TIMESTAMP WHERE id = '${FILE_ID}';`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(stdout);

const { stdout: verificacion } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, original_name, detected_period, declared_cutoff FROM uploaded_files WHERE id = '${FILE_ID}';`,
], { maxBuffer: 16 * 1024 * 1024 });
console.log(verificacion);
