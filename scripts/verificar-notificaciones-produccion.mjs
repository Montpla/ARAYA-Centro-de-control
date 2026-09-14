#!/usr/bin/env node
// Comprobación puntual, solo lectura: confirma en producción que, tras el
// PR #217, ya no se generan avisos automáticos de negocio. Se retira tras
// la comprobación.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sql,
  ], { maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return parsed[0]?.results ?? [];
}

console.log("=== Notificaciones creadas en las últimas 24h, por tipo ===");
const recentByKind = await query(`
  SELECT kind, COUNT(*) AS total, MAX(created_at) AS ultima
  FROM notification_events
  WHERE created_at >= datetime('now', '-24 hours')
  GROUP BY kind
  ORDER BY total DESC;
`);
console.log(JSON.stringify(recentByKind, null, 2));

console.log("=== Cualquier notificación desde el despliegue del PR #217 (2026-09-14 08:25 UTC) que NO sea user_connected/file_uploaded/test ===");
const unexpected = await query(`
  SELECT id, kind, title, created_at
  FROM notification_events
  WHERE created_at >= '2026-09-14 08:25:00'
    AND kind NOT IN ('user_connected', 'file_uploaded', 'test')
  ORDER BY created_at DESC
  LIMIT 50;
`);
console.log(JSON.stringify(unexpected, null, 2));

console.log("=== Últimas 15 notificaciones de cualquier tipo (contexto general) ===");
const latest = await query(`
  SELECT id, kind, title, created_at
  FROM notification_events
  ORDER BY created_at DESC
  LIMIT 15;
`);
console.log(JSON.stringify(latest, null, 2));
