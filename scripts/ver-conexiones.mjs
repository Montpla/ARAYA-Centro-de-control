#!/usr/bin/env node
// Sólo lectura: examina las sesiones de presencia y los avisos "user_connected"
// más recientes para un correo, para diagnosticar por qué llegan avisos de
// conexión repetidos o con la plataforma equivocada.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const CORREO = (process.env.CORREO ?? "").trim().toLowerCase();
if (!CORREO) {
  console.error("Falta CORREO.");
  process.exit(1);
}

const { stdout: presenceStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT session_id, device_id, platform, user_agent, connected_at, last_seen_at
   FROM user_presence
   WHERE lower(user_email) = '${CORREO}'
   ORDER BY last_seen_at DESC
   LIMIT 15;`,
], { maxBuffer: 16 * 1024 * 1024 });
const presenceRows = JSON.parse(presenceStdout)?.[0]?.results ?? [];
console.log(`=== ${presenceRows.length} sesión(es) de presencia para "${CORREO}" ===`);
for (const p of presenceRows) {
  console.log(`\n· session_id: ${p.session_id}`);
  console.log(`  device_id: ${p.device_id || "(vacío)"} · platform: "${p.platform}"`);
  console.log(`  user_agent: ${p.user_agent}`);
  console.log(`  conectado: ${p.connected_at} · visto por última vez: ${p.last_seen_at}`);
}

const { stdout: eventsStdout } = await run("npx", [
  "wrangler", "d1", "execute", "araya-centro-control-d1",
  "--remote", "--config", "wrangler.deploy.jsonc", "--json",
  "--command",
  `SELECT id, actor_email, title, body, payload_json, created_at
   FROM notification_events
   WHERE kind = 'user_connected' AND lower(actor_email) = '${CORREO}'
   ORDER BY id DESC
   LIMIT 20;`,
], { maxBuffer: 16 * 1024 * 1024 });
const eventRows = JSON.parse(eventsStdout)?.[0]?.results ?? [];
console.log(`\n=== ${eventRows.length} aviso(s) "user_connected" recientes de "${CORREO}" ===`);
for (const e of eventRows) {
  console.log(`\n· id: ${e.id} · creado: ${e.created_at}`);
  console.log(`  ${e.title} — ${e.body}`);
  console.log(`  payload: ${e.payload_json}`);
}
