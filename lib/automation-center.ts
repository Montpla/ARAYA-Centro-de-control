import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  appUsers,
  automationIncidents,
  automationRuns,
  notificationEvents,
  reportingPeriods,
  reportingRequirements,
  uploadedFiles,
  userAutomationPreferences,
} from "../db/schema";
import type { AuthorizedUser } from "./access-control";
import { readEffectiveLiveData } from "./effective-live-data";
import { validateFinancialPublication, type FinancialUpdateLike } from "./financial-governance";
import { requiresFinanceAccessForArea } from "./live-data";
import { validateLiveDataContract } from "./live-data-contract";
import { emitMissingNotifications, notificationVisibleToUser, type NotificationInput } from "./notifications";
import { scheduleNotificationDispatch } from "./notification-dispatch";

export const DEFAULT_REPORTING_REQUIREMENTS = [
  { area: "planificacion", documentType: "cronograma", label: "Cronograma actualizado" },
  { area: "obra", documentType: "avance_obra", label: "Informe de avance de obra" },
  { area: "urbanismo", documentType: "urbanismo", label: "Avance de urbanismo" },
  { area: "comercial", documentType: "ventas_cobranza", label: "Ventas y cobranza" },
  { area: "finanzas", documentType: "estado_financiero", label: "Estados y control financiero" },
  { area: "compras", documentType: "proveedores_compras", label: "Compras y proveedores" },
  { area: "seguridad", documentType: "seguridad_permisos", label: "Seguridad y permisos" },
] as const;

type IncidentCandidate = {
  fingerprint: string;
  severity: "critical" | "medium" | "low";
  area: string;
  title: string;
  detail: string;
  sourceFileId?: string;
  assigneeEmail?: string;
  nextRetryAt?: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthPeriod(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const id = `month-${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    id,
    cadence: "monthly",
    label: new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

function weekPeriod(now: Date) {
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday + 1);
  const start = new Date(cursor);
  const end = new Date(cursor);
  end.setUTCDate(end.getUTCDate() + 6);
  const id = `week-${isoDate(start)}`;
  return {
    id,
    cadence: "weekly",
    label: `Semana ${isoDate(start)} · ${isoDate(end)}`,
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

function fileBusinessDate(file: typeof uploadedFiles.$inferSelect) {
  const candidates = [file.detectedPeriod, file.declaredCutoff, file.createdAt];
  for (const value of candidates) {
    const match = String(value ?? "").match(/(20\d{2})[-/]?(\d{2})[-/]?(\d{2})?/);
    if (!match) continue;
    const day = match[3] || "01";
    return `${match[1]}-${match[2]}-${day}`;
  }
  return file.createdAt.slice(0, 10);
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function ensureCurrentReportingPeriods(actorEmail = "system", now = new Date()) {
  const db = getDb();
  const periods = [weekPeriod(now), monthPeriod(now)];
  const activeUsers = await db.select().from(appUsers).where(and(eq(appUsers.active, true), eq(appUsers.deletedAt, "")));
  for (const period of periods) {
    await db.insert(reportingPeriods).values({ ...period, createdByEmail: actorEmail }).onConflictDoNothing();
    for (const requirement of DEFAULT_REPORTING_REQUIREMENTS) {
      const owner = activeUsers.find((user) => user.area === requirement.area) ??
        activeUsers.find((user) => user.role === "admin");
      await db.insert(reportingRequirements).values({
        periodId: period.id,
        area: requirement.area,
        documentType: requirement.documentType,
        label: requirement.label,
        ownerEmail: owner?.email ?? "",
        dueAt: `${period.endDate}T18:00:00.000Z`,
      }).onConflictDoNothing();
    }
  }
  return periods;
}

export async function reconcileReportingPeriods() {
  const db = getDb();
  const [periods, requirements, files] = await Promise.all([
    db.select().from(reportingPeriods).orderBy(desc(reportingPeriods.endDate)).limit(8),
    db.select().from(reportingRequirements),
    db.select().from(uploadedFiles).where(and(eq(uploadedFiles.deletedAt, ""), eq(uploadedFiles.supersededAt, ""))),
  ]);
  const now = new Date().toISOString();
  for (const requirement of requirements) {
    const period = periods.find((item) => item.id === requirement.periodId);
    if (!period || period.status === "closed") continue;
    // Sólo documentType, no también area: un derivado automático (el XML que
    // sale de convertir un .mpp) se archiva deliberadamente en Obra para que
    // su publicación no se frene por "sin clasificar" -ver
    // lib/mpp-conversion-trigger.ts-, aunque su documentType siga siendo
    // "cronograma". Exigir también area="planificacion" dejaba el requisito
    // "Cronograma actualizado" en pendiente para siempre, así avanzara el
    // cronograma o no: cada documentType de DEFAULT_REPORTING_REQUIREMENTS ya
    // es único y no ambiguo, así que basta con él para identificar el archivo.
    const winner = files
      .filter((file) =>
        file.status === "integrado" &&
        file.documentType === requirement.documentType &&
        fileBusinessDate(file) >= period.startDate &&
        fileBusinessDate(file) <= period.endDate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const nextStatus = winner ? "received" : requirement.dueAt && requirement.dueAt < now ? "overdue" : "pending";
    if (nextStatus === requirement.status && (winner?.id ?? "") === requirement.sourceFileId) continue;
    await db.update(reportingRequirements).set({
      status: nextStatus,
      sourceFileId: winner?.id ?? "",
      fulfilledAt: winner ? winner.publishedAt || winner.processedAt || winner.createdAt : "",
      updatedAt: now,
    }).where(eq(reportingRequirements.id, requirement.id));
  }
  return getReportingPeriodSnapshot();
}

export async function getReportingPeriodSnapshot() {
  const db = getDb();
  const [periods, requirements] = await Promise.all([
    db.select().from(reportingPeriods).orderBy(desc(reportingPeriods.endDate)).limit(8),
    db.select().from(reportingRequirements).orderBy(reportingRequirements.id),
  ]);
  return periods.map((period) => {
    const rows = requirements.filter((requirement) => requirement.periodId === period.id);
    const received = rows.filter((row) => row.status === "received").length;
    return {
      ...period,
      requirements: rows,
      received,
      required: rows.filter((row) => row.required).length,
      completion: rows.length ? Math.round((received / rows.length) * 100) : 0,
    };
  });
}

export async function closeReportingPeriod(periodId: string, actor: AuthorizedUser) {
  const db = getDb();
  const [period] = await db.select().from(reportingPeriods).where(eq(reportingPeriods.id, periodId)).limit(1);
  if (!period) throw new Error("El periodo que intentas cerrar no existe.");
  if (period.status === "closed") return;
  const requirements = await db.select().from(reportingRequirements).where(eq(reportingRequirements.periodId, periodId));
  if (!requirements.length) throw new Error("El periodo todavía no tiene entregables configurados.");
  const pending = requirements.filter((item) => item.required && item.status !== "received");
  if (pending.length) throw new Error(`Faltan ${pending.length} documento(s) obligatorio(s) para cerrar el periodo.`);
  const now = new Date().toISOString();
  await db.update(reportingPeriods).set({
    status: "closed",
    closedAt: now,
    closedByEmail: actor.email,
  }).where(eq(reportingPeriods.id, periodId));
  await emitMissingNotifications([{
    kind: "reporting_period_closed",
    area: "direccion",
    audience: "all",
    actorEmail: actor.email,
    actorName: actor.displayName,
    subjectType: "reporting_period",
    subjectId: periodId,
    title: "Periodo documental cerrado",
    body: "Todos los documentos obligatorios están recibidos y el periodo queda bloqueado para su informe.",
    view: "fuentes",
    payload: { periodId },
  }]);
  scheduleNotificationDispatch();
}

export async function sendReportingReminders(actor: AuthorizedUser, periodId?: string) {
  const db = getDb();
  const conditions = [ne(reportingRequirements.status, "received")];
  if (periodId) conditions.push(eq(reportingRequirements.periodId, periodId));
  const rows = await db.select().from(reportingRequirements).where(and(...conditions));
  const now = new Date().toISOString();
  const dueSoon = rows.filter((row) => !row.lastReminderAt || Date.parse(now) - Date.parse(row.lastReminderAt) >= 20 * 60 * 60 * 1000);
  await emitMissingNotifications(dueSoon.map((row) => ({
    kind: "reporting_requirement_due",
    area: row.area,
    audience: row.ownerEmail ? `user:${row.ownerEmail}` : `area:${row.area}`,
    actorEmail: actor.email,
    actorName: actor.displayName,
    subjectType: "reporting_requirement",
    subjectId: `${row.periodId}:${row.id}:${now.slice(0, 10)}`,
    title: row.status === "overdue" ? `Documento vencido · ${row.label}` : `Documento pendiente · ${row.label}`,
    body: `Entrega prevista antes de ${row.dueAt.slice(0, 10)}. Puedes subirlo sin seleccionar área: el sistema lo clasificará.`,
    view: "fuentes",
    payload: { periodId: row.periodId, requirementId: row.id },
  })));
  for (const row of dueSoon) {
    await db.update(reportingRequirements).set({ lastReminderAt: now, updatedAt: now })
      .where(eq(reportingRequirements.id, row.id));
  }
  if (dueSoon.length) scheduleNotificationDispatch();
  return dueSoon.length;
}

async function upsertIncident(candidate: IncidentCandidate, seenAt: string) {
  const db = getDb();
  await db.insert(automationIncidents).values({
    ...candidate,
    sourceFileId: candidate.sourceFileId ?? "",
    assigneeEmail: candidate.assigneeEmail ?? "",
    nextRetryAt: candidate.nextRetryAt ?? "",
    firstDetectedAt: seenAt,
    lastSeenAt: seenAt,
  }).onConflictDoUpdate({
    target: automationIncidents.fingerprint,
    set: {
      status: "open",
      severity: candidate.severity,
      area: candidate.area,
      title: candidate.title,
      detail: candidate.detail,
      sourceFileId: candidate.sourceFileId ?? "",
      assigneeEmail: candidate.assigneeEmail ?? "",
      nextRetryAt: candidate.nextRetryAt ?? "",
      lastSeenAt: seenAt,
      resolvedAt: "",
      resolvedByEmail: "",
      resolution: "",
    },
  });
}

export async function runOperationalAudit(input: {
  actorEmail: string;
  actorName: string;
  idempotencyKey?: string;
  now?: Date;
}) {
  const db = getDb();
  const now = input.now ?? new Date();
  const startedAt = now.toISOString();
  const key = input.idempotencyKey || `nightly-audit:${startedAt.slice(0, 10)}`;
  const existing = await db.select().from(automationRuns).where(eq(automationRuns.idempotencyKey, key)).limit(1);
  if (existing[0]?.status === "passed") {
    return { run: existing[0], reused: true, incidents: [] as IncidentCandidate[] };
  }
  await db.insert(automationRuns).values({
    kind: "global_audit",
    idempotencyKey: key,
    actorEmail: input.actorEmail,
    actorName: input.actorName,
    startedAt,
  }).onConflictDoUpdate({
    target: automationRuns.idempotencyKey,
    set: { status: "running", summary: "", startedAt, completedAt: "" },
  });

  const [snapshot, files] = await Promise.all([
    readEffectiveLiveData(true),
    db.select().from(uploadedFiles).where(eq(uploadedFiles.deletedAt, "")),
  ]);
  const candidates: IncidentCandidate[] = [];
  for (const point of snapshot.points) {
    const contract = validateLiveDataContract(point.key, point.valueJson, snapshot.values);
    if (!contract.valid) candidates.push({
      fingerprint: `audit:contract:${point.key}`,
      severity: "critical",
      area: point.area || "direccion",
      title: `Dato vivo incompatible · ${point.key}`,
      detail: contract.reason || "El valor no cumple el contrato vivo.",
      sourceFileId: point.sourceFileId,
    });
  }

  // Cada ecuación financiera se audita dentro de UNA fuente y UN corte. Unir
  // campos de junio con campos de julio puede fabricar un descuadre que no
  // existe en ninguno de los dos estados, justo lo que ocurrió con el
  // patrimonio fiduciario de julio. Los grupos incompletos no se completan con
  // el histórico: esperan a que el lector publique todas sus partidas.
  const financialGroups = new Map<string, FinancialUpdateLike[]>();
  for (const point of snapshot.points) {
    const update: FinancialUpdateLike = {
      key: point.key,
      valueJson: point.valueJson,
      valueType: point.valueType,
      area: point.area,
      cutoff: point.cutoff,
      sourceCurrency: point.sourceCurrency === "USD" ? "USD" : "DOP",
      sourceFileId: point.sourceFileId,
      sourceName: point.sourceName,
    };
    const groupKey = `${point.sourceFileId || point.sourceName || "legacy"}::${point.cutoff || "sin-corte"}`;
    const group = financialGroups.get(groupKey) ?? [];
    group.push(update);
    financialGroups.set(groupKey, group);
  }
  for (const [groupKey, updates] of financialGroups) {
    const finance = validateFinancialPublication({
      updates,
      currentValues: {},
      currentPoints: snapshot.points.filter((point) =>
        `${point.sourceFileId || point.sourceName || "legacy"}::${point.cutoff || "sin-corte"}` === groupKey),
      baselineValues: {},
    });
    finance.checks.filter((check) => check.status === "blocked").forEach((check) => candidates.push({
      fingerprint: `audit:finance:${check.id}:${groupKey}`,
      severity: "critical",
      area: "finanzas",
      title: `Control financiero pendiente · ${check.label}`,
      detail: check.message,
      sourceFileId: updates[0]?.sourceFileId || "",
    }));
  }

  for (const file of files) {
    if (["integrado", "rechazado", "historico"].includes(file.status)) continue;
    const technicalFailure = Boolean(file.lastProcessingError) || file.processingAttempts >= 3;
    const stalled = ["recibido", "extraccion_en_curso"].includes(file.processingStage) &&
      now.getTime() - Date.parse(file.updatedAt || file.createdAt) > 20 * 60 * 1000;
    if (!technicalFailure && !stalled) continue;
    const retryable = file.processingAttempts < 3;
    candidates.push({
      fingerprint: `audit:file:${file.id}`,
      severity: retryable ? "medium" : "critical",
      area: file.area,
      title: `${retryable ? "Reintento preparado" : "Intervención necesaria"} · ${file.originalName}`,
      detail: file.lastProcessingError || `La carga lleva detenida en ${file.processingStage}.`,
      sourceFileId: file.id,
      assigneeEmail: file.uploaderEmail,
      nextRetryAt: retryable ? startedAt : "",
    });
    if (retryable) {
      await db.update(uploadedFiles).set({
        ingestionVersion: "",
        nextRetryAt: startedAt,
        processingStage: "observado",
        processingSummary: "El auditor automático ha preparado un reproceso seguro del original.",
        updatedAt: startedAt,
      }).where(eq(uploadedFiles.id, file.id));
    }
  }

  for (const candidate of candidates) await upsertIncident(candidate, startedAt);
  const activeFingerprints = candidates.map((candidate) => candidate.fingerprint);
  const openAuditIncidents = await db.select().from(automationIncidents)
    .where(and(
      inArray(automationIncidents.status, ["open", "retrying"]),
      sql`${automationIncidents.fingerprint} LIKE 'audit:%'`,
    ));
  for (const incident of openAuditIncidents) {
    if (activeFingerprints.includes(incident.fingerprint)) continue;
    await db.update(automationIncidents).set({
      status: "resolved_auto",
      resolvedAt: startedAt,
      resolvedByEmail: "system",
      resolution: "La comprobación posterior ya no reproduce la incidencia.",
      lastSeenAt: startedAt,
    }).where(eq(automationIncidents.id, incident.id));
  }

  const status = candidates.some((candidate) => candidate.severity === "critical") ? "observed" : "passed";
  const metrics = {
    livePoints: snapshot.points.length,
    files: files.length,
    incidents: candidates.length,
    critical: candidates.filter((candidate) => candidate.severity === "critical").length,
    retryPrepared: candidates.filter((candidate) => candidate.nextRetryAt).length,
  };
  const summary = candidates.length
    ? `${candidates.length} incidencia(s) detectadas; ${metrics.retryPrepared} reproceso(s) preparados.`
    : `Auditoría correcta: ${snapshot.points.length} puntos vivos y ${files.length} archivos comprobados.`;
  const completedAt = new Date().toISOString();
  await db.update(automationRuns).set({ status, summary, metricsJson: JSON.stringify(metrics), completedAt })
    .where(eq(automationRuns.idempotencyKey, key));

  const critical = candidates.filter((candidate) => candidate.severity === "critical");
  if (critical.length) {
    await emitMissingNotifications(critical.map((candidate) => ({
      kind: "automation_audit_incident",
      area: candidate.area,
      audience: requiresFinanceAccessForArea(candidate.area) ? "finance" : "admin",
      actorEmail: input.actorEmail,
      actorName: input.actorName,
      subjectType: "automation_incident",
      subjectId: candidate.fingerprint,
      title: candidate.title,
      body: candidate.detail.slice(0, 300),
      view: "fuentes",
      payload: { fingerprint: candidate.fingerprint, sourceFileId: candidate.sourceFileId ?? "" },
    })));
    scheduleNotificationDispatch();
  }
  const [run] = await db.select().from(automationRuns).where(eq(automationRuns.idempotencyKey, key)).limit(1);
  return { run, reused: false, incidents: candidates };
}

export async function retryAutomationIncident(id: number, actor: AuthorizedUser) {
  const db = getDb();
  const [incident] = await db.select().from(automationIncidents).where(eq(automationIncidents.id, id)).limit(1);
  if (!incident) throw new Error("La incidencia ya no existe.");
  if (!incident.sourceFileId) throw new Error("Esta incidencia no está asociada a un archivo reprocesable.");
  const now = new Date().toISOString();
  await db.update(uploadedFiles).set({
    ingestionVersion: "",
    nextRetryAt: now,
    processingStage: "observado",
    processingSummary: "Reproceso solicitado desde el Centro de incidencias.",
    updatedAt: now,
  }).where(eq(uploadedFiles.id, incident.sourceFileId));
  await db.update(automationIncidents).set({
    status: "retrying",
    attemptCount: incident.attemptCount + 1,
    nextRetryAt: now,
    assigneeEmail: actor.email,
    lastSeenAt: now,
  }).where(eq(automationIncidents.id, id));
}

export async function resolveAutomationIncident(id: number, actor: AuthorizedUser, resolution: string) {
  const now = new Date().toISOString();
  await getDb().update(automationIncidents).set({
    status: "resolved",
    resolvedAt: now,
    resolvedByEmail: actor.email,
    resolution: resolution.slice(0, 500),
    lastSeenAt: now,
  }).where(eq(automationIncidents.id, id));
}

export async function getAutomationCenterSnapshot(user: AuthorizedUser) {
  const db = getDb();
  const [runs, incidents, periods, preferenceRows] = await Promise.all([
    db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(20),
    db.select().from(automationIncidents).orderBy(desc(automationIncidents.lastSeenAt)).limit(100),
    getReportingPeriodSnapshot(),
    db.select().from(userAutomationPreferences).where(eq(userAutomationPreferences.userEmail, user.email)).limit(1),
  ]);
  const preference = preferenceRows[0] ?? {
    userEmail: user.email,
    notificationAreasJson: "[]",
    criticalOnly: false,
    digestFrequency: "immediate",
    quietStart: "",
    quietEnd: "",
    timezoneOffsetMinutes: 0,
    onboardingStep: 0,
    onboardingCompletedAt: "",
    updatedAt: "",
  };
  return {
    runs,
    incidents: incidents.filter((incident) => user.financeAccess || !requiresFinanceAccessForArea(incident.area)),
    periods: periods.map((period) => {
      const requirements = period.requirements.filter((row) => user.financeAccess || !requiresFinanceAccessForArea(row.area));
      const required = requirements.filter((row) => row.required).length;
      const received = requirements.filter((row) => row.status === "received").length;
      return {
        ...period,
        requirements,
        required,
        received,
        completion: required ? Math.round((received / required) * 100) : 0,
      };
    }),
    preferences: {
      ...preference,
      notificationAreas: parseJsonArray(preference.notificationAreasJson),
    },
  };
}

export async function saveAutomationPreferences(input: {
  user: AuthorizedUser;
  notificationAreas?: string[];
  criticalOnly?: boolean;
  digestFrequency?: string;
  quietStart?: string;
  quietEnd?: string;
  timezoneOffsetMinutes?: number;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
}) {
  const allowedDigest = new Set(["immediate", "daily", "weekly", "off"]);
  const db = getDb();
  const current = (await db.select().from(userAutomationPreferences)
    .where(eq(userAutomationPreferences.userEmail, input.user.email)).limit(1))[0];
  const areas = input.notificationAreas === undefined
    ? parseJsonArray(current?.notificationAreasJson ?? "[]")
    : input.notificationAreas.filter((area) => /^[a-z_]{2,30}$/.test(area)).slice(0, 20);
  const requestedDigest = input.digestFrequency ?? current?.digestFrequency ?? "immediate";
  const digestFrequency = allowedDigest.has(requestedDigest) ? requestedDigest : "immediate";
  const quiet = (value: string | undefined) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "") ? value! : "";
  const now = new Date().toISOString();
  const onboardingStep = Math.max(0, Math.min(6, Number(input.onboardingStep ?? current?.onboardingStep ?? 0) || 0));
  const onboardingCompletedAt = input.onboardingCompleted === true
    ? now
    : input.onboardingCompleted === false
      ? ""
      : current?.onboardingCompletedAt ?? "";
  const timezoneOffsetMinutes = Math.max(-840, Math.min(840,
    Math.trunc(input.timezoneOffsetMinutes ?? current?.timezoneOffsetMinutes ?? 0)));
  await db.insert(userAutomationPreferences).values({
    userEmail: input.user.email,
    notificationAreasJson: JSON.stringify(areas),
    criticalOnly: input.criticalOnly ?? current?.criticalOnly ?? false,
    digestFrequency,
    quietStart: input.quietStart === undefined ? current?.quietStart ?? "" : quiet(input.quietStart),
    quietEnd: input.quietEnd === undefined ? current?.quietEnd ?? "" : quiet(input.quietEnd),
    timezoneOffsetMinutes,
    onboardingStep,
    onboardingCompletedAt,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: userAutomationPreferences.userEmail,
    set: {
      notificationAreasJson: JSON.stringify(areas),
      criticalOnly: input.criticalOnly ?? current?.criticalOnly ?? false,
      digestFrequency,
      quietStart: input.quietStart === undefined ? current?.quietStart ?? "" : quiet(input.quietStart),
      quietEnd: input.quietEnd === undefined ? current?.quietEnd ?? "" : quiet(input.quietEnd),
      timezoneOffsetMinutes,
      onboardingStep,
      onboardingCompletedAt,
      updatedAt: now,
    },
  });
}

export async function emitPreferenceDigests(frequency: "daily" | "weekly", now = new Date()) {
  const db = getDb();
  const since = new Date(now.getTime() - (frequency === "daily" ? 24 : 7 * 24) * 60 * 60 * 1000).toISOString();
  const [preferences, users, events] = await Promise.all([
    db.select().from(userAutomationPreferences).where(eq(userAutomationPreferences.digestFrequency, frequency)),
    db.select().from(appUsers).where(and(eq(appUsers.active, true), eq(appUsers.deletedAt, ""))),
    db.select().from(notificationEvents)
      .where(and(sql`${notificationEvents.createdAt} >= ${since}`, ne(notificationEvents.kind, "notification_digest")))
      .orderBy(desc(notificationEvents.createdAt))
      .limit(500),
  ]);
  const periodKey = frequency === "daily"
    ? now.toISOString().slice(0, 10)
    : weekPeriod(now).id;
  const digests: NotificationInput[] = [];
  for (const preference of preferences) {
    const user = users.find((candidate) => candidate.email === preference.userEmail);
    if (!user) continue;
    const selectedAreas = parseJsonArray(preference.notificationAreasJson);
    const visible = events.filter((event) =>
      notificationVisibleToUser(event, {
        email: user.email,
        role: user.role === "admin" ? "admin" : "member",
        area: user.area,
        financeAccess: user.role === "admin" || user.financeAccess,
      }) && (!selectedAreas.length || selectedAreas.includes(event.area)));
    if (!visible.length) continue;
    const critical = visible.filter((event) => /critical|failed|incident|overdue|blocked|verification/i.test(event.kind)).length;
    digests.push({
      kind: "notification_digest",
      area: "direccion",
      audience: `user:${user.email}`,
      actorEmail: "system",
      actorName: "Resumen automático",
      subjectType: "notification_digest",
      subjectId: `${frequency}:${periodKey}:${user.email}`,
      title: frequency === "daily" ? "Resumen diario de Bricket Control" : "Resumen semanal de Bricket Control",
      body: `${visible.length} novedad(es) en tus áreas${critical ? ` · ${critical} requieren atención` : ""}.`,
      view: "resumen",
      payload: { frequency, periodKey, events: visible.slice(0, 20).map((event) => event.id) },
    });
  }
  await emitMissingNotifications(digests);
  if (digests.length) scheduleNotificationDispatch();
  return digests.length;
}

export async function unresolvedIncidentCount() {
  const rows = await getDb().select({ count: sql<number>`count(*)` }).from(automationIncidents)
    .where(inArray(automationIncidents.status, ["open", "retrying"]));
  return Number(rows[0]?.count ?? 0);
}

export async function recordBackupRun(input: {
  idempotencyKey: string;
  status: "passed" | "observed";
  summary: string;
  metrics?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  await getDb().insert(automationRuns).values({
    kind: "backup_restore",
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    summary: input.summary.slice(0, 500),
    metricsJson: JSON.stringify(input.metrics ?? {}),
    actorEmail: "system",
    actorName: "Backup automático",
    startedAt: now,
    completedAt: now,
  }).onConflictDoUpdate({
    target: automationRuns.idempotencyKey,
    set: {
      status: input.status,
      summary: input.summary.slice(0, 500),
      metricsJson: JSON.stringify(input.metrics ?? {}),
      completedAt: now,
    },
  });
}
