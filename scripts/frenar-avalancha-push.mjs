#!/usr/bin/env node
// El arreglo del reparto (24-08-2026) desatascó de golpe el atraso acumulado
// de avisos que nunca se habían podido repartir por el bug: ahora se están
// entregando todos como push en vivo, uno tras otro. Este script cancela sólo
// las entregas TODAVÍA pendientes (no las ya entregadas, imposible deshacer)
// de eventos anteriores al momento en que se desplegó la corrección: no tiene
// sentido avisar "en vivo" de algo que ya pasó hace días. No borra ningún
// evento ni entrega del historial -- sólo cambia su estado a "cancelado" con
// un motivo, igual que cualquier entrega que ya no procede.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const APLICAR = process.env.APLICAR === "1";
// Despliegue de la corrección del reparto: PR #104, deploy.yml run 160,
// completado 2026-08-24T14:29:53Z. Cualquier evento creado antes es atraso.
const CORTE = process.env.CORTE ?? "2026-08-24T14:29:53.000Z";

async function query(sqlText) {
  const { stdout } = await run("npx", [
    "wrangler", "d1", "execute", "araya-centro-control-d1",
    "--remote", "--config", "wrangler.deploy.jsonc", "--json",
    "--command", sqlText,
  ], { maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return parsed?.[0]?.results ?? parsed?.[0]?.meta ?? {};
}

const pendientes = await query(`
  SELECT COUNT(*) AS total FROM notification_deliveries d
  JOIN notification_events e ON e.id = d.notification_id
  WHERE d.status IN ('pending', 'retry') AND e.created_at < '${CORTE}';
`);
const total = pendientes?.[0]?.total ?? 0;
console.log(`=== Entregas pendientes/retry de eventos anteriores a ${CORTE}: ${total} ===`);

if (!total) {
  console.log("Nada que frenar.");
  process.exit(0);
}

if (!APLICAR) {
  console.log("Simulación (APLICAR=0): no se cancela nada todavía.");
  process.exit(0);
}

const resultado = await query(`
  UPDATE notification_deliveries
  SET status = 'cancelled',
      last_error = 'Aviso atrasado del historial: no se envía con retraso tras corregir el reparto.',
      claimed_at = '',
      updated_at = '${new Date().toISOString()}'
  WHERE id IN (
    SELECT d.id FROM notification_deliveries d
    JOIN notification_events e ON e.id = d.notification_id
    WHERE d.status IN ('pending', 'retry') AND e.created_at < '${CORTE}'
  );
`);
console.log("Aplicado.", JSON.stringify(resultado));
