import { createHash } from "node:crypto";
import { desc, eq, notInArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { controlActions, tvDeviceTokens } from "../../../db/schema";
import { conditionalJson } from "../../../lib/conditional-json";
import { buildControlRoomBaseline } from "../../../lib/control-room";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { financeProtectedAreaValues } from "../../../lib/live-data";
import { materializeSpatialLiveData } from "../../../lib/spatial-live-data";

export const runtime = "edge";

// Resumen de solo lectura para el modo TV/obra (pantallas siempre
// encendidas). La autenticación es un token de dispositivo creado por un
// administrador — no una sesión de usuario — y el contenido es
// deliberadamente NO financiero: la vía de datos es la misma que ve un
// usuario sin permiso financiero (readEffectiveLiveData(false) y
// buildControlRoomBaseline(false, ...)), nunca una copia paralela que pueda
// divergir. Una pantalla en la oficina de obra es semi-pública por
// naturaleza, así que el recorte financiero no es opcional.

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function unauthorized(message: string) {
  const response = Response.json({ error: message }, { status: 401 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = (bearer || url.searchParams.get("token") || "").trim();
  if (!token || token.length < 32) {
    return unauthorized("Falta el token de pantalla.");
  }

  const db = getDb();
  let tokenRow: typeof tvDeviceTokens.$inferSelect | undefined;
  try {
    [tokenRow] = await db
      .select()
      .from(tvDeviceTokens)
      .where(eq(tvDeviceTokens.tokenHash, hashToken(token)))
      .limit(1);
  } catch {
    return unauthorized("El registro de pantallas no está disponible (¿migración 0021 pendiente?).");
  }
  if (!tokenRow || tokenRow.revokedAt) {
    return unauthorized("Este enlace de pantalla no es válido o fue revocado.");
  }
  if (new Date(tokenRow.expiresAt).getTime() < Date.now()) {
    return unauthorized("Este enlace de pantalla ha caducado. Pide a un administrador uno nuevo.");
  }

  // Marca de último uso, oportunista: no bloquea ni condiciona la respuesta.
  void db
    .update(tvDeviceTokens)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(tvDeviceTokens.id, tokenRow.id))
    .catch(() => undefined);

  const [live, actionRows] = await Promise.all([
    readEffectiveLiveData(false),
    db
      .select({
        status: controlActions.status,
        dueDate: controlActions.dueDate,
        severity: controlActions.severity,
        title: controlActions.title,
        area: controlActions.area,
      })
      .from(controlActions)
      .where(notInArray(controlActions.area, financeProtectedAreaValues()))
      .orderBy(desc(controlActions.updatedAt))
      .limit(150)
      .catch(() => []),
  ]);

  const spatial = materializeSpatialLiveData(live.values);
  const baseline = buildControlRoomBaseline(false, spatial.projectSnapshot, spatial.monthlyPlan);
  const today = new Date().toISOString().slice(0, 10);
  const openActions = actionRows.filter((row) => row.status !== "completed");
  const overdueActions = openActions.filter((row) => row.dueDate && row.dueDate < today);

  return conditionalJson(request, {
    project: "ARAYA · Punta Cana",
    label: tokenRow.label,
    revision: live.revision,
    latestEvent: live.latestEvent
      ? {
        revision: live.latestEvent.id,
        sourceName: live.latestEvent.sourceName,
        area: live.latestEvent.area,
        createdAt: live.latestEvent.createdAt,
      }
      : null,
    planning: baseline.planning,
    spatial: baseline.spatial,
    monthlyPlan: spatial.monthlyPlan,
    urbanism: {
      executed: spatial.projectSnapshot.urbanismProgress ?? null,
      planned: spatial.projectSnapshot.urbanismPlanned ?? null,
    },
    actions: {
      open: openActions.length,
      overdue: overdueActions.length,
      critical: openActions.filter((row) => row.severity === "critical").length,
      highlights: overdueActions.slice(0, 5).map((row) => ({
        title: row.title,
        dueDate: row.dueDate,
        area: row.area,
      })),
    },
    refreshIntervalMs: 30_000,
    refreshedAt: new Date().toISOString(),
  }, { volatile: ["refreshedAt"] });
}
