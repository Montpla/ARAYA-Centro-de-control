import { and, eq } from "drizzle-orm";
import { buildPushPayload } from "@block65/webcrypto-web-push";

import { getDb } from "../../../../db";
import { pushSubscriptions } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

// Prueba real de extremo a extremo: envía un aviso push DE SERVIDOR a los
// dispositivos del propio usuario y devuelve qué respondió el servicio push de
// Apple/Google en cada uno. A diferencia del "aviso de prueba" del navegador
// (que es local y funciona sin claves), esto ejerce el mismo camino que un
// aviso de verdad, así que su resultado dice si el push del servidor funciona y,
// si no, exactamente por qué (sin suscripción, claves mal, o rechazo del
// servicio con su código).

function noStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.VAPID_SUBJECT ?? "").trim();
  const vapidConfigured = Boolean(publicKey && privateKey && subject);

  const db = getDb();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.userEmail, auth.user.email.toLowerCase()),
      eq(pushSubscriptions.active, true),
    ));

  if (!vapidConfigured) {
    return noStore({
      ok: false,
      reason: "sin_claves",
      subscriptions: subs.length,
      message: "Faltan las claves de notificación (VAPID) en el servidor. Ponlas en Cloudflare y vuelve a probar.",
    });
  }
  if (!subs.length) {
    return noStore({
      ok: false,
      reason: "sin_suscripcion",
      subscriptions: 0,
      message: "Este dispositivo no está suscrito. Abre los avisos, pulsa Activar notificaciones y acepta el permiso; luego prueba de nuevo.",
    });
  }

  const message = JSON.stringify({
    title: "Prueba de servidor · Bricket Control",
    body: "Si ves esto con la app cerrada, los avisos del servidor funcionan.",
    url: "/",
    tag: "bricket-server-test",
    kind: "test",
  });

  const now = new Date().toISOString();
  const results: Array<{ platform: string; status: number; ok: boolean; error?: string }> = [];
  for (const sub of subs) {
    try {
      const payload = await buildPushPayload(
        { data: message, options: { ttl: 3_600, urgency: "high" } },
        {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime ? Number(sub.expirationTime) : null,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        { publicKey, privateKey, subject },
      );
      const response = await fetch(sub.endpoint, {
        ...payload,
        body: new Uint8Array(payload.body).buffer,
        signal: AbortSignal.timeout(8_000),
      });
      results.push({ platform: sub.platform || "desconocido", status: response.status, ok: response.ok });
      if (response.ok) {
        await db.update(pushSubscriptions)
          .set({ failureCount: 0, lastSuccessAt: now, updatedAt: now })
          .where(eq(pushSubscriptions.id, sub.id));
      } else if (response.status === 404 || response.status === 410) {
        // El servicio dice que esa suscripción ya no existe: se desactiva para
        // que el dispositivo la vuelva a crear al reabrir la app.
        await db.update(pushSubscriptions)
          .set({ active: false, updatedAt: now })
          .where(eq(pushSubscriptions.id, sub.id));
      }
    } catch (error) {
      results.push({
        platform: sub.platform || "desconocido",
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 200) : "fallo de envío",
      });
    }
  }

  const delivered = results.filter((result) => result.ok).length;
  const rechazo = results.find((result) => !result.ok && result.status > 0);
  let message2: string;
  if (delivered > 0) {
    message2 = `Enviado a ${delivered} de ${subs.length} dispositivo(s). Míralo en el móvil (mejor con la pantalla bloqueada).`;
  } else if (rechazo) {
    // El caso típico de "nunca funcionan con las claves ya puestas": la pareja
    // pública/privada no coincide, y el servicio la rechaza con 401/403.
    const pista = rechazo.status === 401 || rechazo.status === 403
      ? " El servicio rechazó la firma: casi seguro la clave pública y la privada no son del mismo par. Regenera un par nuevo y pon las tres claves del mismo bloque."
      : "";
    message2 = `El servidor envió, pero el servicio push respondió ${rechazo.status} y no entregó.${pista}`;
  } else {
    message2 = "El servidor no pudo contactar con el servicio push. Reintenta en un momento.";
  }

  return noStore({
    ok: delivered > 0,
    reason: delivered > 0 ? "enviado" : "rechazado",
    subscriptions: subs.length,
    delivered,
    results,
    message: message2,
  });
}
