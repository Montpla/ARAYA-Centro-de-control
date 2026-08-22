import { requireApiUser } from "../../../lib/access-control";
import {
  closeReportingPeriod,
  emitPreferenceDigests,
  ensureCurrentReportingPeriods,
  getAutomationCenterSnapshot,
  reconcileReportingPeriods,
  recordBackupRun,
  resolveAutomationIncident,
  retryAutomationIncident,
  runOperationalAudit,
  saveAutomationPreferences,
  sendReportingReminders,
} from "../../../lib/automation-center";

export const runtime = "edge";

function privateJson(payload: unknown, init?: ResponseInit) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  await ensureCurrentReportingPeriods(auth.user.email);
  await reconcileReportingPeriods();
  return privateJson(await getAutomationCenterSnapshot(auth.user));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return privateJson({ error: "La solicitud no contiene datos válidos." }, { status: 400 });
  }
  const action = String(body.action ?? "");
  try {
    if (action === "preferences" || action === "onboarding") {
      await saveAutomationPreferences({
        user: auth.user,
        notificationAreas: Array.isArray(body.notificationAreas)
          ? body.notificationAreas.map(String)
          : undefined,
        criticalOnly: body.criticalOnly === undefined ? undefined : Boolean(body.criticalOnly),
        digestFrequency: body.digestFrequency === undefined ? undefined : String(body.digestFrequency),
        quietStart: body.quietStart === undefined ? undefined : String(body.quietStart),
        quietEnd: body.quietEnd === undefined ? undefined : String(body.quietEnd),
        timezoneOffsetMinutes: body.timezoneOffsetMinutes === undefined ? undefined : Number(body.timezoneOffsetMinutes),
        onboardingStep: body.onboardingStep === undefined ? undefined : Number(body.onboardingStep),
        onboardingCompleted: body.onboardingCompleted === undefined ? undefined : Boolean(body.onboardingCompleted),
      });
      return privateJson({ ok: true, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (auth.user.role !== "admin") {
      return privateJson({ error: "Esta acción requiere permisos de administrador." }, { status: 403 });
    }
    if (action === "run_audit") {
      const result = await runOperationalAudit({
        actorEmail: auth.user.email,
        actorName: auth.user.displayName,
        idempotencyKey: String(body.idempotencyKey ?? "") || `manual-audit:${crypto.randomUUID()}`,
      });
      return privateJson({ ok: true, result, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "reconcile_periods") {
      await ensureCurrentReportingPeriods(auth.user.email);
      await reconcileReportingPeriods();
      return privateJson({ ok: true, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "close_period") {
      await closeReportingPeriod(String(body.periodId ?? ""), auth.user);
      return privateJson({ ok: true, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "send_reminders") {
      const sent = await sendReportingReminders(auth.user, String(body.periodId ?? "") || undefined);
      return privateJson({ ok: true, sent, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "send_digests") {
      const frequency = body.frequency === "weekly" ? "weekly" : "daily";
      const sent = await emitPreferenceDigests(frequency);
      return privateJson({ ok: true, sent });
    }
    if (action === "retry_incident") {
      await retryAutomationIncident(Number(body.incidentId ?? 0), auth.user);
      return privateJson({ ok: true, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "resolve_incident") {
      await resolveAutomationIncident(
        Number(body.incidentId ?? 0),
        auth.user,
        String(body.resolution ?? "Resuelta por administración."),
      );
      return privateJson({ ok: true, snapshot: await getAutomationCenterSnapshot(auth.user) });
    }
    if (action === "record_backup") {
      const idempotencyKey = String(body.idempotencyKey ?? "").trim();
      if (!idempotencyKey) return privateJson({ error: "La copia necesita una clave idempotente." }, { status: 400 });
      await recordBackupRun({
        idempotencyKey,
        status: body.status === "observed" ? "observed" : "passed",
        summary: String(body.summary ?? "Backup verificado."),
        metrics: typeof body.metrics === "object" && body.metrics ? body.metrics as Record<string, unknown> : {},
      });
      return privateJson({ ok: true });
    }
    return privateJson({ error: "Acción de automatización desconocida." }, { status: 400 });
  } catch (error) {
    return privateJson({
      error: error instanceof Error ? error.message : "No se pudo completar la automatización.",
    }, { status: 409 });
  }
}
