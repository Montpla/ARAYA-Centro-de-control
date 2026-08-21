import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { liveDataEvents, liveDataHistory, uploadedFiles } from "../db/schema";
import {
  LiveDataMap,
  LiveDataValue,
  isFinancialLiveKey,
  redactFinancialFields,
  requiresFinanceAccessForArea,
  requiresFinanceAccessForDocument,
} from "./live-data";

export type PublishedLiveDataRow = {
  historyId: number;
  eventId: number;
  key: string;
  valueJson: string;
  valueType: string;
  area: string;
  sourceFileId: string;
  sourceName: string;
  sourceCurrency: string;
  cutoff: string;
  actorEmail: string;
  actorName: string;
  createdAt: string;
  eventSourceFileId: string;
  eventSourceName: string;
  eventArea: string;
  eventCutoff: string;
  eventChangeCount: number;
  eventMessage: string;
  eventStatus: string;
  eventActorName: string;
  eventCreatedAt: string;
  linkedFileId: string | null;
  linkedFileDeletedAt: string | null;
  linkedFileSupersededByFileId: string | null;
  linkedFileArea: string | null;
  linkedFileDocumentType: string | null;
  eventContainsProtectedHistory?: boolean;
};

export type EffectiveLiveDataPoint = {
  key: string;
  valueJson: string;
  valueType: string;
  area: string;
  sourceFileId: string;
  sourceName: string;
  sourceCurrency: string;
  cutoff: string;
  revision: number;
  updatedByEmail: string;
  updatedByName: string;
  updatedAt: string;
};

export type EffectiveLiveDataEvent = {
  id: number;
  sourceFileId: string;
  sourceName: string;
  area: string;
  cutoff: string;
  changeCount: number;
  message: string;
  actorName: string;
  createdAt: string;
};

export type PublishedLiveDataEventRow = EffectiveLiveDataEvent & {
  status: string;
  linkedFileArea: string | null;
  linkedFileDocumentType: string | null;
  containsProtectedHistory?: boolean;
};

export type EffectiveLiveDataSnapshot = {
  values: LiveDataMap;
  points: EffectiveLiveDataPoint[];
  latestEvent: EffectiveLiveDataEvent | null;
  revision: number;
};

function parseLiveValue(valueJson: string): LiveDataValue | undefined {
  try {
    return JSON.parse(valueJson) as LiveDataValue;
  } catch {
    return undefined;
  }
}

function sourceIsActive(row: PublishedLiveDataRow) {
  // Historical/manual revisions may carry a legacy source identifier without a
  // managed uploaded_files row. Only a managed, soft-deleted source is inactive.
  if (!row.sourceFileId || !row.linkedFileId) return true;
  return row.linkedFileId === row.sourceFileId &&
    row.linkedFileDeletedAt === "" &&
    (row.linkedFileSupersededByFileId ?? "") === "";
}

function fileIsProtected(row: PublishedLiveDataRow) {
  return requiresFinanceAccessForDocument(row.linkedFileArea, row.linkedFileDocumentType);
}

function historyRowClassifiesEventAsProtected(row: Pick<
  PublishedLiveDataRow,
  "key" | "area" | "linkedFileArea" | "linkedFileDocumentType"
>) {
  return requiresFinanceAccessForArea(row.area) ||
    isFinancialLiveKey(row.key) ||
    requiresFinanceAccessForDocument(row.linkedFileArea, row.linkedFileDocumentType);
}

function isStrictAncestorPath(ancestor: string, descendant: string) {
  return descendant.startsWith(`${ancestor}.`);
}

function normalizedCutoff(row: Pick<PublishedLiveDataRow, "cutoff" | "eventCutoff">) {
  const raw = row.cutoff || row.eventCutoff;
  const match = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3] ?? "01"}`;
}

/**
 * A later upload is not necessarily a later business period. Reprocessing an
 * old weekly report used to overwrite Safety week 4 simply because its event
 * id was larger. The source cutoff is the primary ordering key; publication
 * order only resolves corrections of the same period (or legacy undated rows).
 */
function compareEffectiveRevision(left: PublishedLiveDataRow, right: PublishedLiveDataRow) {
  const leftCutoff = normalizedCutoff(left);
  const rightCutoff = normalizedCutoff(right);
  if (leftCutoff !== rightCutoff) return leftCutoff > rightCutoff ? 1 : -1;
  if (left.eventId !== right.eventId) return left.eventId > right.eventId ? 1 : -1;
  if (left.historyId !== right.historyId) return left.historyId > right.historyId ? 1 : -1;
  return 0;
}

function isNewerRevision(left: PublishedLiveDataRow, right: PublishedLiveDataRow) {
  return compareEffectiveRevision(left, right) > 0;
}

function publicEvent(row: PublishedLiveDataRow, changeCount?: number): EffectiveLiveDataEvent {
  return {
    id: row.eventId,
    sourceFileId: row.eventSourceFileId,
    sourceName: row.eventSourceName,
    area: row.eventArea,
    cutoff: row.eventCutoff,
    changeCount: changeCount ?? row.eventChangeCount,
    message: row.eventMessage,
    actorName: row.eventActorName,
    createdAt: row.eventCreatedAt,
  };
}

export function selectLatestVisiblePublishedEvent(
  events: PublishedLiveDataEventRow[],
  financeAccess: boolean,
) {
  const row = events
    .filter((event) => event.status === "published")
    .sort((left, right) => right.id - left.id)
    .find((event) => financeAccess || !(
      requiresFinanceAccessForArea(event.area) ||
      requiresFinanceAccessForDocument(event.linkedFileArea, event.linkedFileDocumentType) ||
      event.containsProtectedHistory === true
    ));
  if (!row) return null;
  return {
    id: row.id,
    sourceFileId: row.sourceFileId,
    sourceName: row.sourceName,
    area: row.area,
    cutoff: row.cutoff,
    changeCount: row.changeCount,
    message: row.message,
    actorName: row.actorName,
    createdAt: row.createdAt,
  } satisfies EffectiveLiveDataEvent;
}

/**
 * Materializes the current dashboard state from immutable, published history.
 * The mutable live_data_points table is only a write-through cache and is never
 * trusted by readers, so a failed publication or a file delete/restore cannot
 * leave a partially visible dashboard.
 */
export function deriveEffectiveLiveDataSnapshot(
  inputRows: PublishedLiveDataRow[],
  financeAccess: boolean,
): EffectiveLiveDataSnapshot {
  const publishedRows = inputRows
    .filter((row) => row.eventStatus === "published")
    .sort((left, right) => compareEffectiveRevision(right, left));
  const exactWinnerByKey = new Map<string, PublishedLiveDataRow>();
  const eventProtected = new Map<number, boolean>();

  for (const row of publishedRows) {
    if (
      row.eventContainsProtectedHistory === true ||
      requiresFinanceAccessForArea(row.eventArea) ||
      requiresFinanceAccessForArea(row.area) ||
      isFinancialLiveKey(row.key) ||
      fileIsProtected(row)
    ) {
      eventProtected.set(row.eventId, true);
    }
    if (!exactWinnerByKey.has(row.key) && sourceIsActive(row)) {
      exactWinnerByKey.set(row.key, row);
    }
  }

  // A complete root/branch replaces every older child below it. A newer child
  // remains an intentional patch over an older root and is materialized after
  // that root by materializeLiveRoot().
  const exactWinners = [...exactWinnerByKey.values()];
  const effectiveByKey = new Map(
    exactWinners
      .filter((candidate) => !exactWinners.some((possibleAncestor) =>
        isStrictAncestorPath(possibleAncestor.key, candidate.key) &&
        isNewerRevision(possibleAncestor, candidate)))
      .map((row) => [row.key, row]),
  );

  const values: LiveDataMap = {};
  const points: EffectiveLiveDataPoint[] = [];
  const visibleRows: PublishedLiveDataRow[] = [];

  for (const row of effectiveByKey.values()) {
    if (!financeAccess && requiresFinanceAccessForArea(row.area)) continue;
    const parsed = parseLiveValue(row.valueJson);
    if (parsed === undefined) continue;
    const visibleValue = financeAccess ? parsed : redactFinancialFields(row.key, parsed);
    if (visibleValue === undefined) continue;

    const protectedProvenance = !financeAccess && (
      eventProtected.get(row.eventId) === true || fileIsProtected(row)
    );
    values[row.key] = visibleValue;
    points.push({
      key: row.key,
      valueJson: JSON.stringify(visibleValue),
      valueType: row.valueType,
      area: row.area,
      sourceFileId: protectedProvenance ? "" : row.sourceFileId,
      sourceName: protectedProvenance ? "Actualizacion protegida" : row.sourceName,
      sourceCurrency: row.sourceCurrency,
      cutoff: row.cutoff,
      revision: row.eventId,
      updatedByEmail: protectedProvenance ? "" : row.actorEmail,
      updatedByName: protectedProvenance ? "Usuario autorizado" : row.actorName,
      updatedAt: row.createdAt,
    });
    visibleRows.push(row);
  }

  visibleRows.sort((left, right) => right.eventId - left.eventId || right.historyId - left.historyId);
  const latestRow = visibleRows[0];
  let latestEvent: EffectiveLiveDataEvent | null = null;
  if (latestRow) {
    const visibleChangeCount = visibleRows.filter((row) => row.eventId === latestRow.eventId).length;
    latestEvent = publicEvent(latestRow, visibleChangeCount);
    if (!financeAccess && eventProtected.get(latestRow.eventId)) {
      latestEvent = {
        ...latestEvent,
        sourceFileId: "",
        sourceName: "Actualizacion protegida",
        area: latestRow.area,
        message: `${visibleChangeCount} datos autorizados actualizados en el Centro de Control.`,
        actorName: "Usuario autorizado",
      };
    }
  }

  return {
    values,
    points,
    latestEvent,
    revision: latestEvent?.id ?? 0,
  };
}

export function sanitizePublishedHistoryRows(
  inputRows: PublishedLiveDataRow[],
  financeAccess: boolean,
) {
  const protectedEventIds = new Set<number>();
  for (const row of inputRows) {
    if (row.eventStatus === "published" && (
      row.eventContainsProtectedHistory === true ||
      historyRowClassifiesEventAsProtected(row)
    )) protectedEventIds.add(row.eventId);
  }
  return inputRows
    .filter((row) => row.eventStatus === "published")
    .sort((left, right) => right.historyId - left.historyId)
    .flatMap((row) => {
      if (!financeAccess && (
        requiresFinanceAccessForArea(row.eventArea) ||
        requiresFinanceAccessForArea(row.area)
      )) return [];
      const parsed = parseLiveValue(row.valueJson);
      if (parsed === undefined) return [];
      const visibleValue = financeAccess ? parsed : redactFinancialFields(row.key, parsed);
      if (visibleValue === undefined) return [];
      const protectedProvenance = !financeAccess && (
        protectedEventIds.has(row.eventId) || fileIsProtected(row)
      );
      return [{
        ...row,
        valueJson: JSON.stringify(visibleValue),
        sourceFileId: protectedProvenance ? "" : row.sourceFileId,
        sourceName: protectedProvenance ? "Actualizacion protegida" : row.sourceName,
        actorEmail: protectedProvenance ? "" : row.actorEmail,
        actorName: protectedProvenance ? "Usuario autorizado" : row.actorName,
        eventSourceFileId: protectedProvenance ? "" : row.eventSourceFileId,
        eventSourceName: protectedProvenance ? "Actualizacion protegida" : row.eventSourceName,
        eventMessage: protectedProvenance
          ? "Datos autorizados actualizados en el Centro de Control."
          : row.eventMessage,
        eventActorName: protectedProvenance ? "Usuario autorizado" : row.eventActorName,
        linkedFileArea: protectedProvenance ? null : row.linkedFileArea,
        linkedFileDocumentType: protectedProvenance ? null : row.linkedFileDocumentType,
      }];
    });
}

async function readProtectedEventIds(eventIds: number[]) {
  const uniqueIds = [...new Set(eventIds)];
  if (!uniqueIds.length) return new Set<number>();
  const db = getDb();
  const protectedIds = new Set<number>();
  for (let offset = 0; offset < uniqueIds.length; offset += 80) {
    const classifiers = await db
      .select({
        eventId: liveDataHistory.eventId,
        key: liveDataHistory.key,
        area: liveDataHistory.area,
        linkedFileArea: uploadedFiles.area,
        linkedFileDocumentType: uploadedFiles.documentType,
      })
      .from(liveDataHistory)
      .leftJoin(uploadedFiles, eq(liveDataHistory.sourceFileId, uploadedFiles.id))
      .where(inArray(liveDataHistory.eventId, uniqueIds.slice(offset, offset + 80)));
    for (const classifier of classifiers) {
      if (historyRowClassifiesEventAsProtected(classifier)) {
        protectedIds.add(classifier.eventId);
      }
    }
  }
  return protectedIds;
}

async function annotateProtectedEventHistory(rows: PublishedLiveDataRow[]) {
  const protectedIds = await readProtectedEventIds(rows.map((row) => row.eventId));
  return rows.map((row) => ({
    ...row,
    eventContainsProtectedHistory: protectedIds.has(row.eventId),
  }));
}

async function readEffectivePublishedRows() {
  const db = getDb();
  // Rank inside D1 so the five-second poll transfers only one eligible winner
  // per key; immutable history may grow indefinitely without growing payloads.
  const rows = await db.all<PublishedLiveDataRow>(sql`
    WITH eligible AS (
      SELECT
        h.id AS historyId,
        h.event_id AS eventId,
        h.key AS key,
        h.value_json AS valueJson,
        h.value_type AS valueType,
        h.area AS area,
        h.source_file_id AS sourceFileId,
        h.source_name AS sourceName,
        h.source_currency AS sourceCurrency,
        h.cutoff AS cutoff,
        h.actor_email AS actorEmail,
        h.actor_name AS actorName,
        h.created_at AS createdAt,
        e.source_file_id AS eventSourceFileId,
        e.source_name AS eventSourceName,
        e.area AS eventArea,
        e.cutoff AS eventCutoff,
        e.change_count AS eventChangeCount,
        e.message AS eventMessage,
        e.status AS eventStatus,
        e.actor_name AS eventActorName,
        e.created_at AS eventCreatedAt,
        f.id AS linkedFileId,
        f.deleted_at AS linkedFileDeletedAt,
        f.superseded_by_file_id AS linkedFileSupersededByFileId,
        f.area AS linkedFileArea,
        f.document_type AS linkedFileDocumentType,
        ROW_NUMBER() OVER (
          PARTITION BY h.key
          ORDER BY
            CASE
              WHEN COALESCE(NULLIF(h.cutoff, ''), NULLIF(e.cutoff, '')) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
                THEN substr(COALESCE(NULLIF(h.cutoff, ''), e.cutoff), 1, 10)
              WHEN COALESCE(NULLIF(h.cutoff, ''), NULLIF(e.cutoff, '')) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
                THEN COALESCE(NULLIF(h.cutoff, ''), e.cutoff) || '-01'
              ELSE ''
            END DESC,
            e.id DESC,
            h.id DESC
        ) AS winnerRank
      FROM live_data_history h
      INNER JOIN live_data_events e ON e.id = h.event_id
      LEFT JOIN uploaded_files f ON f.id = h.source_file_id
      WHERE e.status = 'published'
        AND (
          h.source_file_id = ''
          OR f.id IS NULL
          OR (f.deleted_at = '' AND f.superseded_by_file_id = '')
        )
    )
    SELECT
      historyId,
      eventId,
      key,
      valueJson,
      valueType,
      area,
      sourceFileId,
      sourceName,
      sourceCurrency,
      cutoff,
      actorEmail,
      actorName,
      createdAt,
      eventSourceFileId,
      eventSourceName,
      eventArea,
      eventCutoff,
      eventChangeCount,
      eventMessage,
      eventStatus,
      eventActorName,
      eventCreatedAt,
      linkedFileId,
      linkedFileDeletedAt,
      linkedFileSupersededByFileId,
      linkedFileArea,
      linkedFileDocumentType
    FROM eligible
    WHERE winnerRank = 1
    ORDER BY historyId DESC
  `);
  return annotateProtectedEventHistory(rows);
}

export async function readPublishedLiveDataRows(limit = 200) {
  const db = getDb();
  const rows = await db
    .select({
      historyId: liveDataHistory.id,
      eventId: liveDataHistory.eventId,
      key: liveDataHistory.key,
      valueJson: liveDataHistory.valueJson,
      valueType: liveDataHistory.valueType,
      area: liveDataHistory.area,
      sourceFileId: liveDataHistory.sourceFileId,
      sourceName: liveDataHistory.sourceName,
      sourceCurrency: liveDataHistory.sourceCurrency,
      cutoff: liveDataHistory.cutoff,
      actorEmail: liveDataHistory.actorEmail,
      actorName: liveDataHistory.actorName,
      createdAt: liveDataHistory.createdAt,
      eventSourceFileId: liveDataEvents.sourceFileId,
      eventSourceName: liveDataEvents.sourceName,
      eventArea: liveDataEvents.area,
      eventCutoff: liveDataEvents.cutoff,
      eventChangeCount: liveDataEvents.changeCount,
      eventMessage: liveDataEvents.message,
      eventStatus: liveDataEvents.status,
      eventActorName: liveDataEvents.actorName,
      eventCreatedAt: liveDataEvents.createdAt,
      linkedFileId: uploadedFiles.id,
      linkedFileDeletedAt: uploadedFiles.deletedAt,
      linkedFileSupersededByFileId: uploadedFiles.supersededByFileId,
      linkedFileArea: uploadedFiles.area,
      linkedFileDocumentType: uploadedFiles.documentType,
    })
    .from(liveDataHistory)
    .innerJoin(liveDataEvents, eq(liveDataHistory.eventId, liveDataEvents.id))
    .leftJoin(uploadedFiles, eq(liveDataHistory.sourceFileId, uploadedFiles.id))
    .where(eq(liveDataEvents.status, "published"))
    .orderBy(desc(liveDataHistory.id))
    .limit(Math.max(1, Math.min(limit, 1_000)));
  return annotateProtectedEventHistory(rows);
}

async function readLatestPublishedEvents() {
  const db = getDb();
  const events = await db
    .select({
      id: liveDataEvents.id,
      sourceFileId: liveDataEvents.sourceFileId,
      sourceName: liveDataEvents.sourceName,
      area: liveDataEvents.area,
      cutoff: liveDataEvents.cutoff,
      changeCount: liveDataEvents.changeCount,
      message: liveDataEvents.message,
      actorName: liveDataEvents.actorName,
      createdAt: liveDataEvents.createdAt,
      status: liveDataEvents.status,
      linkedFileArea: uploadedFiles.area,
      linkedFileDocumentType: uploadedFiles.documentType,
    })
    .from(liveDataEvents)
    .leftJoin(uploadedFiles, eq(liveDataEvents.sourceFileId, uploadedFiles.id))
    .where(eq(liveDataEvents.status, "published"))
    .orderBy(desc(liveDataEvents.id))
    .limit(100);
  if (!events.length) return [];
  const protectedEventIds = await readProtectedEventIds(events.map((event) => event.id));
  return events.map((event) => ({
    ...event,
    containsProtectedHistory: protectedEventIds.has(event.id),
  }));
}

export async function readEffectiveLiveData(financeAccess: boolean) {
  const [rows, events] = await Promise.all([
    readEffectivePublishedRows(),
    readLatestPublishedEvents(),
  ]);
  const snapshot = deriveEffectiveLiveDataSnapshot(rows, financeAccess);
  const latestEvent = selectLatestVisiblePublishedEvent(events, financeAccess) ?? snapshot.latestEvent;
  return {
    ...snapshot,
    latestEvent,
    revision: latestEvent?.id ?? 0,
  };
}

export async function readPublishedLiveDataHistory(financeAccess: boolean) {
  const rows = await readPublishedLiveDataRows(1_000);
  return sanitizePublishedHistoryRows(rows, financeAccess);
}
