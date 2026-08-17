import { and, desc, eq, gte } from "drizzle-orm";

import { requireApiUser } from "../../../lib/access-control";
import { getDb } from "../../../db";
import { appUsers, uploadedFiles, weeklySummarySnapshots } from "../../../db/schema";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { materializeSpatialLiveData } from "../../../lib/spatial-live-data";
import { sendSummaryEmail, validRecipients } from "../../../lib/email-resend";
import {
  composeWeeklySummary,
  type WeeklyBuildingRow,
} from "../../../lib/weekly-summary";

export const runtime = "edge";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "del 11 al 17 de agosto de 2026", cubriendo los últimos siete días. */
function weekLabel(now: Date): string {
  const fin = now;
  const inicio = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const mismoMes = inicio.getUTCMonth() === fin.getUTCMonth();
  const d1 = inicio.getUTCDate();
  const d2 = fin.getUTCDate();
  const m1 = MESES[inicio.getUTCMonth()];
  const m2 = MESES[fin.getUTCMonth()];
  const anio = fin.getUTCFullYear();
  return mismoMes
    ? `del ${d1} al ${d2} de ${m2} de ${anio}`
    : `del ${d1} de ${m1} al ${d2} de ${m2} de ${anio}`;
}

/** Marca de tiempo SQLite (UTC, "YYYY-MM-DD HH:MM:SS") de hace N días. */
function sqliteDaysAgo(days: number, now: Date): string {
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return past.toISOString().replace("T", " ").slice(0, 19);
}

type GatheredSummary = Awaited<ReturnType<typeof gatherSummary>>;

async function gatherSummary(now: Date) {
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

  const usuarios = await db
    .select({ email: appUsers.email })
    .from(appUsers)
    .where(and(eq(appUsers.active, true), eq(appUsers.deletedAt, "")));
  const recipients = validRecipients(usuarios.map((u) => u.email));

  const summary = composeWeeklySummary({
    weekLabel: weekLabel(now),
    overallNow,
    overallPrev,
    buildings,
    documentsThisWeek,
  });

  return {
    summary,
    recipients,
    overallNow,
    buildingsNow,
    documentsThisWeek,
  };
}

async function storeSnapshot(data: GatheredSummary) {
  const db = getDb();
  const buildingsMap: Record<string, number> = {};
  for (const b of data.buildingsNow) buildingsMap[b.code] = b.now;
  await db.insert(weeklySummarySnapshots).values({
    overallProgress: data.overallNow,
    buildingsJson: JSON.stringify(buildingsMap),
    documentsCount: data.documentsThisWeek,
  });
}

// GET: vista previa para un administrador, sin enviar ni guardar nada. Permite
// ver exactamente cómo quedará el correo antes de que salga solo.
export async function GET() {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  const data = await gatherSummary(new Date());
  return Response.json({
    subject: data.summary.subject,
    text: data.summary.text,
    html: data.summary.html,
    recipients: data.recipients.length,
    overallNow: data.overallNow,
  });
}

// POST: lo llama el envío automático semanal (GitHub Actions) con el secreto
// compartido. Compone, envía a los correos dados de alta y guarda la instantánea
// para poder comparar la semana que viene. Con ?dryRun=1 hace todo menos enviar
// y guardar, para probar sin gastar un envío ni ensuciar el histórico.
export async function POST(request: Request) {
  const secret = process.env.SUMMARY_SECRET ?? "";
  const provided = request.headers.get("x-summary-secret") ?? "";
  if (!secret || provided !== secret) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const data = await gatherSummary(new Date());

  if (dryRun) {
    return Response.json({
      dryRun: true,
      subject: data.summary.subject,
      recipients: data.recipients.length,
      overallNow: data.overallNow,
      preview: data.summary.text,
    });
  }

  const result = await sendSummaryEmail(
    { apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.SUMMARY_FROM ?? "" },
    {
      recipients: data.recipients,
      subject: data.summary.subject,
      html: data.summary.html,
      text: data.summary.text,
    },
  );

  // La instantánea se guarda aunque el correo no salga: el objetivo es medir la
  // semana, y eso no depende de que el envío haya funcionado. Si guardáramos
  // sólo al enviar, un fallo de correo dejaría la comparación de la semana
  // siguiente desalineada.
  await storeSnapshot(data);

  return Response.json({
    sent: result.sent,
    recipients: data.recipients.length,
    overallNow: data.overallNow,
    skipped: result.skipped,
    error: result.error,
    subject: data.summary.subject,
  });
}
