#!/usr/bin/env node
// Sólo lectura: diagnostica por qué los avisos push "en vivo" no llegan
// aunque la prueba manual de servidor (/api/push/test) sí funciona.
// Comprueba: suscripciones activas, preferencias de cada usuario (el motivo
// típico es que digest_frequency no sea "immediate", o que el área del
// aviso no esté en su lista de áreas), y el resultado real de las últimas
// entregas intentadas (delivered/cancelled/retry y su motivo).
// No imprime ningún dato financiero ni de negocio, solo metadatos de
// entrega y preferencias.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

async function query(sqlText) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sqlText,
  ], { maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return parsed?.[0]?.results ?? [];
}

console.log("=== Suscripciones push activas ===");
const subs = await query(
  "SELECT user_email, platform, active, failure_count, last_success_at, created_at FROM push_subscriptions ORDER BY created_at DESC LIMIT 20;"
);
console.log(`${subs.length} fila(s)`);
for (const s of subs) {
  console.log(`  · ${s.user_email} · ${s.platform || "?"} · activa: ${s.active ? "sí" : "no"} · fallos: ${s.failure_count} · último éxito: ${s.last_success_at || "(nunca)"}`);
}

console.log("\n=== Preferencias de notificación por usuario ===");
const prefs = await query(
  "SELECT user_email, digest_frequency, critical_only, notification_areas_json, quiet_start, quiet_end FROM user_automation_preferences;"
);
console.log(`${prefs.length} fila(s) (sin fila = permite todo por defecto)`);
for (const p of prefs) {
  console.log(`  · ${p.user_email} · digest: ${p.digest_frequency} · sólo críticos: ${p.critical_only ? "sí" : "no"} · áreas: ${p.notification_areas_json} · silencio: ${p.quiet_start || "(ninguno)"}-${p.quiet_end || "(ninguno)"}`);
}

console.log("\n=== Últimos 15 eventos de notificación y sus entregas ===");
const events = await query(
  "SELECT id, kind, area, audience, title, created_at FROM notification_events ORDER BY id DESC LIMIT 15;"
);
for (const e of events) {
  console.log(`\n--- evento ${e.id} · ${e.kind} · área ${e.area} · audiencia ${e.audience} · ${e.created_at} ---`);
  console.log(`    título: ${e.title}`);
  const deliveries = await query(
    `SELECT status, last_error, attempt_count FROM notification_deliveries WHERE notification_id = ${Number(e.id)};`
  );
  if (!deliveries.length) {
    console.log("    (sin entregas -- el reparto nunca se generó para este evento)");
    continue;
  }
  for (const d of deliveries) {
    console.log(`    · ${d.status} · intentos ${d.attempt_count} · ${d.last_error || "(sin error)"}`);
  }
}
