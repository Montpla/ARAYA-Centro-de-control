import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { fileActivity, liveDataHistory, uploadedFiles } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { isFinancialLiveKey } from "../../../lib/live-data";

export const runtime = "edge";

function valuePreview(valueJson: string) {
  try {
    const value = JSON.parse(valueJson);
    if (Array.isArray(value)) return `${value.length} registros`;
    if (value && typeof value === "object") return `${Object.keys(value).length} campos`;
    if (typeof value === "string") return value.slice(0, 90);
    if (value === null) return "Sin valor";
    return String(value);
  } catch {
    return "Valor registrado";
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const db = getDb();
  const [changeRows, activityRows] = await Promise.all([
    db.select().from(liveDataHistory).orderBy(desc(liveDataHistory.id)).limit(80),
    db
      .select({
        id: fileActivity.id,
        fileId: fileActivity.fileId,
        fileName: uploadedFiles.originalName,
        area: uploadedFiles.area,
        eventType: fileActivity.eventType,
        message: fileActivity.message,
        actorName: fileActivity.actorName,
        createdAt: fileActivity.createdAt,
      })
      .from(fileActivity)
      .leftJoin(uploadedFiles, eq(fileActivity.fileId, uploadedFiles.id))
      .orderBy(desc(fileActivity.id))
      .limit(80),
  ]);

  const changes = changeRows
    .filter((row) => auth.user?.financeAccess || !isFinancialLiveKey(row.key))
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      revision: row.eventId,
      key: row.key,
      area: row.area,
      sourceName: row.sourceName,
      cutoff: row.cutoff,
      actorName: row.actorName,
      createdAt: row.createdAt,
      valuePreview: valuePreview(row.valueJson),
    }));
  const activity = activityRows
    .filter((row) => auth.user?.financeAccess || row.area !== "finanzas")
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      fileId: row.fileId,
      fileName: row.fileName || row.fileId,
      eventType: row.eventType,
      message: row.message,
      actorName: row.actorName,
      createdAt: row.createdAt,
    }));

  const response = Response.json({
    changes,
    activity,
    refreshedAt: new Date().toISOString(),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
