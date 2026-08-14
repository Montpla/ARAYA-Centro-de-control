import { and, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { controlRoomAlertCandidates, scheduleBusinessAlerts } from "../../../lib/business-alerts";
import { conditionalJson } from "../../../lib/conditional-json";
import {
  cxpAging,
  financialProjection,
  juneReport,
  payablesReconciliation,
  salesLocations,
  salesModels,
} from "../../june-report-data";
import {
  antonelyAdvances,
  antonelyBalanceLines,
  antonelyCostAccounts,
  antonelyDetailTotals,
  antonelyPayableCategories,
} from "../../antonely-finance-data";
import { fiduciaryBalanceSections, fiduciaryStatementSummary } from "../../fiduciary-statements-data";
import {
  liveAntonelyDetailTotals,
  liveFiduciaryStatementSummary,
  liveJuneReportFinance,
  livePayablesReconciliation,
} from "../../../lib/live-derivations";
import { getDb } from "../../../db";
import {
  appUsers,
  controlActionActivity,
  controlActions,
  documentDataProposals,
  reportSnapshots,
  uploadedFiles,
} from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import {
  buildControlRoomBaseline,
  buildReportSnapshot,
} from "../../../lib/control-room";
import { isUserArea } from "../../../lib/file-routing";
import {
  financeProtectedAreaValues,
  financeProtectedDocumentTypeValues,
  materializeLiveRoot,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "../../../lib/live-data";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { scheduleNotificationDispatch } from "../../../lib/notification-dispatch";
import { materializeSpatialLiveData } from "../../../lib/spatial-live-data";

const REPORT_TYPES = new Set(["global", "obra_seguridad", "finanzas", "ventas"]);
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
  return financeAccess || !requiresFinanceAccessForArea(area);
}

function visibleFile(
  row: Pick<typeof uploadedFiles.$inferSelect, "area" | "documentType">,
  financeAccess: boolean,
) {
  return financeAccess || !requiresFinanceAccessForDocument(row.area, row.documentType);
}

function visibleFileSql(financeAccess: boolean) {
  return financeAccess
    ? sql`1 = 1`
    : and(
        notInArray(uploadedFiles.area, financeProtectedAreaValues()),
        notInArray(uploadedFiles.documentType, financeProtectedDocumentTypeValues()),
      );
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

function publicReport(row: typeof reportSnapshots.$inferSelect, canAccessFinance = true) {
  let snapshot: unknown = null;
  try {
    snapshot = JSON.parse(row.snapshotJson) as unknown;
    if (!canAccessFinance && snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
      const redacted = { ...(snapshot as Record<string, unknown>) };
      redacted.finance = null;
      redacted.commercial = null;
      snapshot = redacted;
    }
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
    reportType: row.reportType,
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
  const activeVisibleFiles = and(
    eq(uploadedFiles.deletedAt, ""),
    visibleFileSql(auth.financeAccess),
  );
  const [
    fileAreaRows,
    pendingProposalRows,
    actionRows,
    activityRows,
    reportRows,
    live,
  ] = await Promise.all([
    db
      .select({
        area: uploadedFiles.area,
        files: sql<number>`count(*)`,
        integratedFiles: sql<number>`coalesce(sum(case when ${uploadedFiles.reviewStatus} = 'aprobado' then 1 else 0 end), 0)`,
        pendingFiles: sql<number>`coalesce(sum(case when ${uploadedFiles.reviewStatus} not in ('aprobado', 'rechazado') then 1 else 0 end), 0)`,
        observedFiles: sql<number>`coalesce(sum(case when ${uploadedFiles.reviewStatus} = 'cambios_solicitados' then 1 else 0 end), 0)`,
        rejectedFiles: sql<number>`coalesce(sum(case when ${uploadedFiles.reviewStatus} = 'rechazado' then 1 else 0 end), 0)`,
        discrepancies: sql<number>`coalesce(sum(${uploadedFiles.discrepancyCount}), 0)`,
        lastUploadAt: sql<string>`coalesce(max(${uploadedFiles.createdAt}), '')`,
      })
      .from(uploadedFiles)
      .where(activeVisibleFiles)
      .groupBy(uploadedFiles.area),
    db
      .select({ count: sql<number>`count(*)` })
      .from(documentDataProposals)
      .innerJoin(uploadedFiles, eq(documentDataProposals.fileId, uploadedFiles.id))
      .where(and(
        activeVisibleFiles,
        eq(documentDataProposals.status, "pendiente"),
        eq(documentDataProposals.generation, uploadedFiles.proposalGeneration),
      )),
    db
      .select()
      .from(controlActions)
      .where(auth.financeAccess
        ? sql`1 = 1`
        : notInArray(controlActions.area, financeProtectedAreaValues()))
      .orderBy(desc(controlActions.updatedAt))
      .limit(150),
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
      .where(auth.financeAccess
        ? sql`1 = 1`
        : or(
            isNull(controlActions.area),
            notInArray(controlActions.area, financeProtectedAreaValues()),
          ))
      .orderBy(desc(controlActionActivity.id))
      .limit(100),
    db
      .select()
      .from(reportSnapshots)
      .where(auth.financeAccess ? sql`1 = 1` : eq(reportSnapshots.includesFinance, false))
      .orderBy(desc(reportSnapshots.createdAt))
      .limit(50),
    readEffectiveLiveData(auth.financeAccess),
  ]);
  const actions = actionRows;
  const reports = reportRows;
  const livePoints = live.points;
  const liveValues = live.values;
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
  const spatial = materializeSpatialLiveData(liveValues);
  const currentProject = spatial.projectSnapshot;
  const currentPlan = spatial.monthlyPlan;
  const baseline = buildControlRoomBaseline(
    auth.financeAccess,
    currentProject,
    currentPlan,
  );
  const normalizedFileAreas = fileAreaRows.map((row) => ({
    area: row.area,
    files: Number(row.files),
    integratedFiles: Number(row.integratedFiles),
    pendingFiles: Number(row.pendingFiles),
    observedFiles: Number(row.observedFiles),
    rejectedFiles: Number(row.rejectedFiles),
    discrepancies: Number(row.discrepancies),
    lastUploadAt: row.lastUploadAt,
  }));
  const fileAreas = new Map(normalizedFileAreas.map((row) => [row.area, row]));
  const liveAreas = new Map<string, { count: number; lastCutoff: string; updatedAt: string }>();
  livePoints.forEach((point) => {
    const current = liveAreas.get(point.area) ?? { count: 0, lastCutoff: "", updatedAt: "" };
    current.count += 1;
    if (point.cutoff && point.updatedAt >= current.updatedAt) {
      current.lastCutoff = point.cutoff;
      current.updatedAt = point.updatedAt;
    }
    liveAreas.set(point.area, current);
  });
  const areaSet = new Set([...fileAreas.keys(), ...liveAreas.keys()]);
  const areas = [...areaSet]
    .sort()
    .map((area) => {
      const documents = fileAreas.get(area);
      const points = liveAreas.get(area);
      return {
        area,
        files: documents?.files ?? 0,
        integratedFiles: documents?.integratedFiles ?? 0,
        pendingFiles: documents?.pendingFiles ?? 0,
        livePoints: points?.count ?? 0,
        lastCutoff: points?.lastCutoff ?? "",
      };
    });
  const documentTotals = normalizedFileAreas.reduce((totals, row) => ({
    total: totals.total + row.files,
    approved: totals.approved + row.integratedFiles,
    pending: totals.pending + row.pendingFiles,
    observed: totals.observed + row.observedFiles,
    rejected: totals.rejected + row.rejectedFiles,
    discrepancies: totals.discrepancies + row.discrepancies,
    lastUploadAt: row.lastUploadAt > totals.lastUploadAt ? row.lastUploadAt : totals.lastUploadAt,
  }), {
    total: 0,
    approved: 0,
    pending: 0,
    observed: 0,
    rejected: 0,
    discrepancies: 0,
    lastUploadAt: "",
  });
  const pendingProposals = Number(pendingProposalRows[0]?.count ?? 0);
  const dossierScore = documentTotals.total
    ? Math.round((documentTotals.approved / documentTotals.total) * 100)
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
      total: documentTotals.total,
      approved: documentTotals.approved,
      pending: documentTotals.pending,
      observed: documentTotals.observed,
      rejected: documentTotals.rejected,
      discrepancies: documentTotals.discrepancies,
      pendingProposals,
      dossierScore,
      lastUploadAt: documentTotals.lastUploadAt,
      areas,
    },
    live: {
      revision: live.revision,
      pointCount: livePoints.length,
      lastPublishedAt: live.latestEvent?.createdAt ?? "",
      latestSource: live.latestEvent?.sourceName ?? "",
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
    reports: reports.map((row) => publicReport(row, auth.financeAccess)),
  };
}

export async function GET(request: Request) {
  const authResult = await requireApiUser();
  if (!authResult.user) return authResult.response;
  const payload = await controlRoomPayload(authResult.user);
  // Avisos de negocio derivados del estado recién calculado (desviación
  // física sobre umbral, acciones vencidas); idempotentes, en segundo plano.
  scheduleBusinessAlerts(controlRoomAlertCandidates(payload));
  return conditionalJson(request, payload);
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
    if (requiresFinanceAccessForArea(area) && !auth.financeAccess) {
      return Response.json(
        { error: "No tienes acceso para crear acciones financieras o comerciales." },
        { status: 403 },
      );
    }
    if (["metricas", "comercial"].includes(relatedView) && !auth.financeAccess) {
      return Response.json(
        { error: "No tienes acceso a la vista financiera o comercial solicitada." },
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
      if (requiresFinanceAccessForArea(area) && !assignee[0].financeAccess) {
        return Response.json(
          { error: "La persona asignada no tiene acceso financiero y comercial." },
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
      if (!source[0] || !visibleFile(source[0], auth.financeAccess)) {
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
    scheduleNotificationDispatch();
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
      scheduleNotificationDispatch();
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
        notificationNonce: crypto.randomUUID(),
        notificationActorEmail: auth.email,
        notificationActorName: auth.displayName,
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
    scheduleNotificationDispatch();
    return Response.json({ action: publicAction(updated, auth) });
  }

  if (operation === "create_report") {
    const reportType = REPORT_TYPES.has(text(payload.reportType, 20))
      ? text(payload.reportType, 20)
      : "global";
    // Obra y Seguridad no toca cifras financieras ni comerciales, así que no
    // exige acceso financiero para crearse. Los demás tipos sí, igual que el
    // informe global siempre exigió.
    if (reportType !== "obra_seguridad" && !auth.financeAccess) {
      return Response.json(
        {
          error: reportType === "global"
            ? "La creación del informe completo requiere acceso financiero."
            : "Este tipo de informe requiere acceso financiero.",
        },
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
    const live = await readEffectiveLiveData(auth.financeAccess);
    const values = live.values;
    const spatial = materializeSpatialLiveData(values);
    const currentProject = spatial.projectSnapshot;
    const currentPlan = spatial.monthlyPlan;
    // Antonely (detalle) alimenta cxpDop/advancesPendingDop/balance de
    // juneReport.finance en vivo; ver liveJuneReportFinance en
    // june-report-data.ts. Sin esto, el informe archivaba los mismos
    // totales congelados que ya se corrigieron en el tablero y el agente.
    const currentAntonelyAdvances = materializeLiveRoot("antonelyAdvances", antonelyAdvances, values);
    const currentAntonelyCostAccounts = materializeLiveRoot("antonelyCostAccounts", antonelyCostAccounts, values);
    const currentAntonelyPayableCategories = materializeLiveRoot("antonelyPayableCategories", antonelyPayableCategories, values);
    const currentAntonelyBalanceLines = materializeLiveRoot("antonelyBalanceLines", antonelyBalanceLines, values);
    const currentAntonelyDetailTotals = liveAntonelyDetailTotals(
      materializeLiveRoot("antonelyDetailTotals", antonelyDetailTotals, values),
      {
        advances: currentAntonelyAdvances,
        costAccounts: currentAntonelyCostAccounts,
        payableCategories: currentAntonelyPayableCategories,
        balanceLines: currentAntonelyBalanceLines,
      },
    );
    const currentFinancialProjection = materializeLiveRoot("financialProjection", financialProjection, values);
    const currentJuneReport = liveJuneReportFinance(
      materializeLiveRoot("juneReport", juneReport, values),
      currentAntonelyDetailTotals,
      currentAntonelyBalanceLines,
      currentFinancialProjection,
    );
    const currentCxpAging = materializeLiveRoot("cxpAging", cxpAging, values);
    const currentPayablesReconciliation: readonly (typeof payablesReconciliation)[number][] = livePayablesReconciliation(
      materializeLiveRoot("payablesReconciliation", payablesReconciliation, values),
      currentAntonelyDetailTotals.payablesTotalDop,
    );
    const currentFiduciaryBalanceSections = materializeLiveRoot("fiduciaryBalanceSections", fiduciaryBalanceSections, values);
    const currentFiduciaryStatementSummary = liveFiduciaryStatementSummary(
      materializeLiveRoot("fiduciaryStatementSummary", fiduciaryStatementSummary, values),
      currentFiduciaryBalanceSections,
    );
    const currentSalesModels = materializeLiveRoot("salesModels", salesModels, values);
    const currentSalesLocations = materializeLiveRoot("salesLocations", salesLocations, values);
    const liveRevision = live.revision;
    const snapshot = buildReportSnapshot(
      auth.financeAccess,
      currentProject,
      currentPlan,
      liveRevision,
      currentJuneReport,
      {
        cxpAging: currentCxpAging,
        payablesReconciliation: currentPayablesReconciliation,
        fiduciaryBalance: currentFiduciaryStatementSummary.balance,
        antonelyDetailTotals: currentAntonelyDetailTotals,
        salesModels: currentSalesModels,
        salesLocations: currentSalesLocations,
      },
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
        reportType,
        requestKey,
        createdByEmail: auth.email,
        createdByName: auth.displayName,
        createdAt: now,
      })
      .returning();
    scheduleNotificationDispatch();
    return Response.json(
      {
        report: publicReport(report),
      },
      { status: 201 },
    );
  }

  return Response.json({ error: "Operación no válida." }, { status: 400 });
}
