import { and, desc, eq } from "drizzle-orm";
import { monthlyPlan, projectSnapshot } from "../../demo-data";
import { juneReport } from "../../june-report-data";
import { getDb } from "../../../db";
import {
  appUsers,
  controlActionActivity,
  controlActions,
  documentDataProposals,
  liveDataEvents,
  liveDataPoints,
  reportSnapshots,
  uploadedFiles,
} from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import {
  buildControlRoomBaseline,
  buildReportSnapshot,
} from "../../../lib/control-room";
import { isUserArea } from "../../../lib/file-routing";
import { LiveDataMap, materializeLiveRoot } from "../../../lib/live-data";

const ACTION_STATUSES = new Set(["open", "in_progress", "blocked", "completed"]);
const ACTION_SEVERITIES = new Set(["critical", "medium", "low"]);
const RELATED_VIEWS = new Set([
  "resumen",
  "planificacion",
  "implantacion",
  "edificios",
  "viviendas",
  "urbanismo",
  "comercial",
  "metricas",
  "cronologia",
  "proveedores",
  "control",
  "fuentes",
]);

function text(value: unknown, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

function validDate(value: string) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function visibleArea(area: string, financeAccess: boolean) {
  return financeAccess || area !== "finanzas";
}

function parseLiveValues(rows: Array<{ key: string; valueJson: string }>) {
  const values: LiveDataMap = {};
  rows.forEach((row) => {
    try {
      values[row.key] = JSON.parse(row.valueJson);
    } catch {
      // A malformed isolated point must not prevent the control room from loading.
    }
  });
  return values;
}

function publicAction(
  row: typeof controlActions.$inferSelect,
  currentUser: { email: string; role: string },
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    area: row.area,
    relatedView: row.relatedView,
    severity: row.severity,
    status: row.status,
    assigneeEmail: row.assigneeEmail,
    assigneeName: row.assigneeName,
    dueDate: row.dueDate,
    sourceFileId: row.sourceFileId,
    createdByName: row.createdByName,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit:
      currentUser.role === "admin" ||
      currentUser.email === row.createdByEmail ||
      currentUser.email === row.assigneeEmail,
  };
}

function publicReport(row: typeof reportSnapshots.$inferSelect) {
  let snapshot: unknown = null;
  try {
    snapshot = JSON.parse(row.snapshotJson) as unknown;
  } catch {
    // Keep the report metadata available even if one stored snapshot is malformed.
  }
  return {
    id: row.id,
    frequency: row.frequency,
    startDate: row.startDate,
    endDate: row.endDate,
    label: row.label,
    currency: row.currency,
    liveRevision: row.liveRevision,
    cutoff: row.cutoff,
    includesFinance: row.includesFinance,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    snapshot,
  };
}

type ControlRoomUser = {
  email: string;
  displayName: string;
  role: string;
  area: string;
  financeAccess: boolean;
};

async function controlRoomPayload(auth: ControlRoomUser) {
  const db = getDb();
  const [
    fileRows,
    proposalRows,
    actionRows,
    activityRows,
    reportRows,
    liveRows,
    eventRows,
  ] = await Promise.all([
    db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt)),
    db.select().from(documentDataProposals).orderBy(desc(documentDataProposals.createdAt)),
    db.select().from(controlActions).orderBy(desc(controlActions.updatedAt)).limit(150),
    db
      .select({
        id: controlActionActivity.id,
        actionId: controlActionActivity.actionId,
        eventType: controlActionActivity.eventType,
        message: controlActionActivity.message,
        actorName: controlActionActivity.actorName,
        createdAt: controlActionActivity.createdAt,
        actionTitle: controlActions.title,
        area: controlActions.area,
      })
      .from(controlActionActivity)
      .leftJoin(controlActions, eq(controlActionActivity.actionId, controlActions.id))
      .orderBy(desc(controlActionActivity.id))
      .limit(100),
    db.select().from(reportSnapshots).orderBy(desc(reportSnapshots.createdAt)).limit(50),
    db.select().from(liveDataPoints),
    db.select().from(liveDataEvents).orderBy(desc(liveDataEvents.id)).limit(1),
  ]);
  const files = fileRows.filter((row) => visibleArea(row.area, auth.financeAccess));
  const fileIds = new Set(files.map((row) => row.id));
  const proposals = proposalRows.filter((row) => fileIds.has(row.fileId));
  const actions = actionRows.filter((row) => visibleArea(row.area, auth.financeAccess));
  const reports = reportRows.filter((row) => auth.financeAccess || !row.includesFinance);
  const livePoints = liveRows.filter((row) => visibleArea(row.area, auth.financeAccess));
  const liveValues = parseLiveValues(liveRows);
  const assigneeRows =
    auth.role === "admin"
      ? await db
          .select({
            email: appUsers.email,
            displayName: appUsers.displayName,
            area: appUsers.area,
            financeAccess: appUsers.financeAccess,
          })
          .from(appUsers)
          .where(eq(appUsers.active, true))
          .orderBy(appUsers.displayName)
      : [];
  const currentProject = materializeLiveRoot(
    "projectSnapshot",
    projectSnapshot,
    liveValues,
  );
  const currentPlan = materializeLiveRoot("monthlyPlan", monthlyPlan, liveValues);
  const baseline = buildControlRoomBaseline(
    auth.financeAccess,
    currentProject,
    currentPlan,
  );
  const areaSet = new Set([
    ...files.map((row) => row.area),
    ...livePoints.map((row) => row.area),
  ]);
  const areas = [...areaSet]
    .sort()
    .map((area) => ({
      area,
      files: files.filter((row) => row.area === area).length,
      integratedFiles: files.filter(
        (row) => row.area === area && row.reviewStatus === "aprobado",
      ).length,
      pendingFiles: files.filter(
        (row) =>
          row.area === area &&
          !["aprobado", "rechazado"].includes(row.reviewStatus),
      ).length,
      livePoints: livePoints.filter((row) => row.area === area).length,
      lastCutoff:
        livePoints
          .filter((row) => row.area === area && row.cutoff)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
          ?.cutoff ?? "",
    }));
  const approvedFiles = files.filter((row) => row.reviewStatus === "aprobado").length;
  const pendingFiles = files.filter(
    (row) => !["aprobado", "rechazado"].includes(row.reviewStatus),
  ).length;
  const discrepancyCount = files.reduce(
    (total, row) => total + row.discrepancyCount,
    0,
  );
  const pendingProposals = proposals.filter((row) => row.status === "pendiente").length;
  const dossierScore = files.length
    ? Math.round((approvedFiles / files.length) * 100)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    currentUser: {
      email: auth.email,
      role: auth.role,
      financeAccess: auth.financeAccess,
    },
    assignees: assigneeRows.map((row) => ({
      email: row.email,
      displayName: row.displayName || row.email,
      area: row.area,
      financeAccess: row.financeAccess,
    })),
    documents: {
      total: files.length,
      approved: approvedFiles,
      pending: pendingFiles,
      observed: files.filter((row) => row.reviewStatus === "cambios_solicitados").length,
      rejected: files.filter((row) => row.reviewStatus === "rechazado").length,
      discrepancies: discrepancyCount,
      pendingProposals,
      dossierScore,
      lastUploadAt: files[0]?.createdAt ?? "",
      areas,
    },
    live: {
      revision: eventRows[0]?.id ?? 0,
      pointCount: livePoints.length,
      lastPublishedAt: eventRows[0]?.createdAt ?? "",
      latestSource: eventRows[0]?.sourceName ?? "",
      refreshIntervalMs: 5_000,
    },
    ...baseline,
    actions: actions.map((row) => publicAction(row, auth)),
    actionSummary: {
      total: actions.length,
      open: actions.filter((row) => row.status === "open").length,
      inProgress: actions.filter((row) => row.status === "in_progress").length,
      blocked: actions.filter((row) => row.status === "blocked").length,
      completed: actions.filter((row) => row.status === "completed").length,
      overdue: actions.filter(
        (row) =>
          row.status !== "completed" &&
          row.dueDate &&
          row.dueDate < new Date().toISOString().slice(0, 10),
      ).length,
    },
    actionActivity: activityRows
      .filter((row) => visibleArea(row.area ?? "", auth.financeAccess))
      .slice(0, 40),
    reports: reports.map(publicReport),
  };
}

export async function GET() {
  const authResult = await requireApiUser();
  if (!authResult.user) return authResult.response;
  const payload = await controlRoomPayload(authResult.user);
  const response = Response.json(payload);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request) {
  const authResult = await requireApiUser();
  if (!authResult.user) return authResult.response;
  const auth = authResult.user;
  const payload = (await request.json()) as Record<string, unknown>;
  const operation = text(payload.operation, 50);
  const requestKey = text(payload.requestKey, 120);
  if (!requestKey) {
    return Response.json(
      { error: "La operación necesita un identificador idempotente." },
      { status: 400 },
    );
  }
  const db = getDb();
  const now = new Date().toISOString();

  if (operation === "create_action") {
    const existing = await db
      .select()
      .from(controlActions)
      .where(eq(controlActions.requestKey, requestKey))
      .limit(1);
    if (existing[0]) {
      return Response.json({ action: publicAction(existing[0], auth), duplicate: true });
    }
    const title = text(payload.title, 180);
    const description = text(payload.description, 1200);
    const requestedArea = text(payload.area, 40);
    const area = isUserArea(requestedArea) ? requestedArea : auth.area;
    const relatedView = RELATED_VIEWS.has(text(payload.relatedView, 40))
      ? text(payload.relatedView, 40)
      : "resumen";
    const severity = ACTION_SEVERITIES.has(text(payload.severity, 20))
      ? text(payload.severity, 20)
      : "medium";
    const dueDate = text(payload.dueDate, 10);
    if (!title || !validDate(dueDate)) {
      return Response.json(
        { error: "Indica un título y una fecha válida." },
        { status: 400 },
      );
    }
    if (area === "finanzas" && !auth.financeAccess) {
      return Response.json(
        { error: "No tienes acceso para crear acciones financieras." },
        { status: 403 },
      );
    }
    let assigneeEmail = text(payload.assigneeEmail, 180).toLowerCase();
    let assigneeName = text(payload.assigneeName, 180);
    if (auth.role !== "admin" || !assigneeEmail) {
      assigneeEmail = auth.email;
      assigneeName = auth.displayName;
    } else {
      const assignee = await db
        .select()
        .from(appUsers)
        .where(and(eq(appUsers.email, assigneeEmail), eq(appUsers.active, true)))
        .limit(1);
      if (!assignee[0]) {
        return Response.json(
          { error: "La persona asignada no es un usuario activo." },
          { status: 400 },
        );
      }
      assigneeName = assignee[0].displayName || assignee[0].email;
    }
    const sourceFileId = text(payload.sourceFileId, 120);
    if (sourceFileId) {
      const source = await db
        .select()
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, sourceFileId))
        .limit(1);
      if (!source[0] || !visibleArea(source[0].area, auth.financeAccess)) {
        return Response.json(
          { error: "El documento de origen no está disponible." },
          { status: 400 },
        );
      }
    }
    const [row] = await db
      .insert(controlActions)
      .values({
        id: crypto.randomUUID(),
        title,
        description,
        area,
        relatedView,
        severity,
        status: "open",
        assigneeEmail,
        assigneeName,
        dueDate,
        sourceFileId,
        requestKey,
        createdByEmail: auth.email,
        createdByName: auth.displayName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await db.insert(controlActionActivity).values({
      actionId: row.id,
      eventType: "created",
      message: description || title,
      requestKey: `${requestKey}:created`,
      actorEmail: auth.email,
      actorName: auth.displayName,
      createdAt: now,
    });
    return Response.json({ action: publicAction(row, auth) }, { status: 201 });
  }

  if (operation === "update_action" || operation === "comment_action") {
    const actionId = text(payload.actionId, 120);
    const rows = await db
      .select()
      .from(controlActions)
      .where(eq(controlActions.id, actionId))
      .limit(1);
    const action = rows[0];
    if (!action || !visibleArea(action.area, auth.financeAccess)) {
      return Response.json({ error: "Acción no encontrada." }, { status: 404 });
    }
    const canEdit =
      auth.role === "admin" ||
      auth.email === action.createdByEmail ||
      auth.email === action.assigneeEmail;
    if (!canEdit) {
      return Response.json(
        { error: "No tienes permiso para modificar esta acción." },
        { status: 403 },
      );
    }
    const duplicateActivity = await db
      .select()
      .from(controlActionActivity)
      .where(eq(controlActionActivity.requestKey, requestKey))
      .limit(1);
    if (duplicateActivity[0]) {
      return Response.json({ action: publicAction(action, auth), duplicate: true });
    }
    if (operation === "comment_action") {
      const message = text(payload.message, 1000);
      if (!message) {
        return Response.json({ error: "Escribe un comentario." }, { status: 400 });
      }
      await db.insert(controlActionActivity).values({
        actionId,
        eventType: "comment",
        message,
        requestKey,
        actorEmail: auth.email,
        actorName: auth.displayName,
        createdAt: now,
      });
      await db
        .update(controlActions)
        .set({ updatedAt: now })
        .where(eq(controlActions.id, actionId));
      return Response.json({ message: "Comentario registrado." }, { status: 201 });
    }
    const status = text(payload.status, 30);
    if (!ACTION_STATUSES.has(status)) {
      return Response.json({ error: "Estado no válido." }, { status: 400 });
    }
    const [updated] = await db
      .update(controlActions)
      .set({
        status,
        completedAt: status === "completed" ? now : "",
        updatedAt: now,
      })
      .where(eq(controlActions.id, actionId))
      .returning();
    await db.insert(controlActionActivity).values({
      actionId,
      eventType: "status_changed",
      message: `Estado actualizado a ${status}.`,
      requestKey,
      actorEmail: auth.email,
      actorName: auth.displayName,
      createdAt: now,
    });
    return Response.json({ action: publicAction(updated, auth) });
  }

  if (operation === "create_report") {
    if (!auth.financeAccess) {
      return Response.json(
        { error: "La creación del informe completo requiere acceso financiero." },
        { status: 403 },
      );
    }
    const existing = await db
      .select()
      .from(reportSnapshots)
      .where(eq(reportSnapshots.requestKey, requestKey))
      .limit(1);
    if (existing[0]) {
      return Response.json({ report: publicReport(existing[0]), duplicate: true });
    }
    const frequency = text(payload.frequency, 20);
    const startDate = text(payload.startDate, 10);
    const endDate = text(payload.endDate, 10);
    const label = text(payload.label, 160);
    const currency = text(payload.currency, 3) === "DOP" ? "DOP" : "USD";
    if (
      !["weekly", "monthly"].includes(frequency) ||
      !startDate ||
      !endDate ||
      !validDate(startDate) ||
      !validDate(endDate) ||
      startDate > endDate ||
      !label
    ) {
      return Response.json(
        { error: "El periodo del informe no es válido." },
        { status: 400 },
      );
    }
    const [liveRows, eventRows] = await Promise.all([
      db.select().from(liveDataPoints),
      db.select().from(liveDataEvents).orderBy(desc(liveDataEvents.id)).limit(1),
    ]);
    const values = parseLiveValues(liveRows);
    const currentProject = materializeLiveRoot(
      "projectSnapshot",
      projectSnapshot,
      values,
    );
    const currentPlan = materializeLiveRoot("monthlyPlan", monthlyPlan, values);
    const currentJuneReport = materializeLiveRoot("juneReport", juneReport, values);
    const liveRevision = eventRows[0]?.id ?? 0;
    const snapshot = buildReportSnapshot(
      auth.financeAccess,
      currentProject,
      currentPlan,
      liveRevision,
      currentJuneReport,
    );
    const [report] = await db
      .insert(reportSnapshots)
      .values({
        id: crypto.randomUUID(),
        frequency,
        startDate,
        endDate,
        label,
        currency,
        liveRevision,
        cutoff: currentProject.declaredCutoff,
        snapshotJson: JSON.stringify(snapshot),
        includesFinance: auth.financeAccess,
        requestKey,
        createdByEmail: auth.email,
        createdByName: auth.displayName,
        createdAt: now,
      })
      .returning();
    return Response.json(
      {
        report: publicReport(report),
      },
      { status: 201 },
    );
  }

  return Response.json({ error: "Operación no válida." }, { status: 400 });
}
