import { and, desc, eq, gte } from "drizzle-orm";

import { getDb } from "../db";
import { uploadedFiles, weeklySummarySnapshots } from "../db/schema";
import { readEffectiveLiveData } from "./effective-live-data";
import { materializeSpatialLiveData } from "./spatial-live-data";
import {
  composeWeeklyNotificationBody,
  composeWeeklySummary,
  isoWeekKey,
  weekLabel,
  type WeeklyBuildingRow,
  type ComposedSummary,
} from "./weekly-summary";

export { isoWeekKey, weekLabel };

// Reúne del modelo vivo los datos del resumen semanal y los compone. Se usa en
// dos sitios —la vista previa del endpoint y la emisión automática del aviso—,
// así que vive aquí y no duplicado.

/** Marca de tiempo SQLite (UTC, "YYYY-MM-DD HH:MM:SS") de hace N días. */
function sqliteDaysAgo(days: number, now: Date): string {
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return past.toISOString().replace("T", " ").slice(0, 19);
}

export type GatheredWeeklySummary = {
  summary: ComposedSummary;
  notificationBody: string;
  overallNow: number;
  buildingsNow: Array<{ code: string; now: number }>;
  documentsThisWeek: number;
};

export async function gatherWeeklySummary(now: Date): Promise<GatheredWeeklySummary> {
  const db = getDb();

  // Avance físico: no lleva nada financiero, así que se lee sin ese permiso.
  const live = await readEffectiveLiveData(false);
  const spatial = materializeSpatialLiveData(live.values);
  const overallNow = Math.round(spatial.projectSnapshot.overallProgress * 100) / 100;

  const buildingsNow = spatial.buildings.map((building) => ({
    code: building.shortName,
    name: building.name,
    now: Math.round(building.progress * 100) / 100,
  }));

  const [prevSnapshot] = await db
    .select()
    .from(weeklySummarySnapshots)
    .orderBy(desc(weeklySummarySnapshots.id))
    .limit(1);

  let prevBuildings: Record<string, number> = {};
  let overallPrev: number | null = null;
  if (prevSnapshot) {
    overallPrev = prevSnapshot.overallProgress;
    try {
      prevBuildings = JSON.parse(prevSnapshot.buildingsJson) as Record<string, number>;
    } catch {
      prevBuildings = {};
    }
  }

  const buildings: WeeklyBuildingRow[] = buildingsNow.map((b) => ({
    code: b.code,
    name: b.name,
    now: b.now,
    prev: b.code in prevBuildings ? prevBuildings[b.code] : null,
  }));

  const desde = sqliteDaysAgo(7, now);
  const docs = await db
    .select({ id: uploadedFiles.id })
    .from(uploadedFiles)
    .where(and(gte(uploadedFiles.createdAt, desde), eq(uploadedFiles.deletedAt, "")));
  const documentsThisWeek = docs.length;

  const composerInput = {
    weekLabel: weekLabel(now),
    overallNow,
    overallPrev,
    buildings,
    documentsThisWeek,
  };

  return {
    summary: composeWeeklySummary(composerInput),
    notificationBody: composeWeeklyNotificationBody(composerInput),
    overallNow,
    buildingsNow: buildingsNow.map((b) => ({ code: b.code, now: b.now })),
    documentsThisWeek,
  };
}

/** Guarda la foto de esta semana para poder comparar la que viene. */
export async function recordWeeklySnapshot(data: GatheredWeeklySummary) {
  const db = getDb();
  const buildingsMap: Record<string, number> = {};
  for (const b of data.buildingsNow) buildingsMap[b.code] = b.now;
  await db.insert(weeklySummarySnapshots).values({
    overallProgress: data.overallNow,
    buildingsJson: JSON.stringify(buildingsMap),
    documentsCount: data.documentsThisWeek,
  });
}
