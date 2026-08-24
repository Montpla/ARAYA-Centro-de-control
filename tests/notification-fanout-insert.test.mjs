import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Producción confirmó (24-08-2026, diagnóstico de sólo lectura) que TODOS los
// eventos de notificación quedaban en fanout_status "pending" para siempre,
// con fanout_error "Insert select error: selected fields are not the same or
// are in a different order compared to the table definition". La causa:
// insert(table).select(subquery) de Drizzle exige que las columnas
// seleccionadas coincidan exactamente (nombre y orden) con TODAS las columnas
// de la tabla, incluida la clave autoincremental "id" — que no se puede fijar
// a mano al repartir un aviso entre suscripciones activas. Por eso ningún
// aviso push "en vivo" llegaba nunca: sólo la prueba manual (/api/push/test,
// que no pasa por este reparto) funcionaba. La corrección selecciona los IDs
// de suscripción primero y los inserta con .values(), que no exige esa
// coincidencia exacta de columnas.
test("el reparto de avisos no usa insert(tabla).select(...) contra notificationDeliveries", async () => {
  const source = await readFile("lib/notifications.ts", "utf8");
  assert.doesNotMatch(
    source,
    /\.insert\(notificationDeliveries\)\s*\.select\(/,
    "insert(table).select(...) exige que las columnas coincidan con TODAS las de la tabla (incluida \"id\"); rompía el reparto para todo aviso, siempre",
  );
  assert.match(source, /\.insert\(notificationDeliveries\)\s*\n?\s*\.values\(/);
  assert.match(source, /activeSubscriptions\.map/);
});
