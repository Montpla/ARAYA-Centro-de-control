import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userPresence } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { scheduleNotificationDispatch } from "../../../lib/notification-dispatch";

export const runtime = "edge";

// El latido sólo se envía con la pestaña visible (ver dashboard-client.tsx),
// así que cualquier ausencia se acumula sin heartbeats mientras tanto. 90 s
// bastaba para que bloquear la pantalla del móvil un momento ya contara como
// "reconexión nueva" y disparase un aviso — varias veces al día, cada vez.
// Media hora es un hueco real de verdad estar fuera de la app.
const ACTIVE_WINDOW_MS = 30 * 60_000;
const SESSION_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

function limitedText(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

function responseWithNoStore(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: { sessionId?: unknown; deviceId?: unknown; platform?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return responseWithNoStore({ error: "El latido de presencia no es válido." }, { status: 400 });
  }

  const sessionId = limitedText(payload.sessionId, 128);
  if (!SESSION_PATTERN.test(sessionId)) {
    return responseWithNoStore({ error: "La sesión del dispositivo no es válida." }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const userEmail = auth.user.email.toLowerCase();
  const db = getDb();
  const existingSession = await db
    .select()
    .from(userPresence)
    .where(eq(userPresence.sessionId, sessionId))
    .limit(1);
  const currentSession = existingSession[0];
  if (currentSession && currentSession.userEmail.toLowerCase() !== userEmail) {
    return responseWithNoStore({ error: "La sesión ya pertenece a otro usuario." }, { status: 409 });
  }

  const deviceId = limitedText(payload.deviceId, 128);
  const platform = limitedText(
    payload.platform || request.headers.get("sec-ch-ua-platform"),
    80,
  );
  const userAgent = limitedText(request.headers.get("user-agent"), 500);
  const sessionWasActive = Boolean(
    currentSession && Date.parse(currentSession.lastSeenAt) >= now.getTime() - ACTIVE_WINDOW_MS,
  );
  const becameActive = !sessionWasActive;

  await db
    .insert(userPresence)
    .values({
      sessionId,
      userEmail,
      userName: auth.user.displayName,
      deviceId,
      platform,
      userAgent,
      connectedAt: sessionWasActive && currentSession ? currentSession.connectedAt : nowIso,
      lastSeenAt: nowIso,
    })
    .onConflictDoUpdate({
      target: userPresence.sessionId,
      set: {
        userName: auth.user.displayName,
        deviceId,
        platform,
        userAgent,
        connectedAt: sessionWasActive && currentSession ? currentSession.connectedAt : nowIso,
        lastSeenAt: nowIso,
      },
    });

  if (becameActive) scheduleNotificationDispatch();

  return responseWithNoStore({
    online: true,
    becameActive,
    sessionId,
    lastSeenAt: nowIso,
    activeWindowMs: ACTIVE_WINDOW_MS,
  });
}
