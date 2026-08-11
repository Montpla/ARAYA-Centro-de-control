import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { customMetrics, suppliers } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { scheduleNotificationDispatch } from "../../../lib/notification-dispatch";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const db = getDb();
    const [metricsRows, supplierRows] = await Promise.all([
      auth.user.financeAccess
        ? db.select().from(customMetrics).orderBy(desc(customMetrics.id)).limit(50)
        : Promise.resolve([]),
      db.select().from(suppliers).orderBy(desc(suppliers.id)).limit(50),
    ]);
    const visibleSuppliers = auth.user.financeAccess
      ? supplierRows
      : supplierRows.map((supplier) => ({ ...supplier, amount: undefined }));
    return Response.json({ metrics: metricsRows, suppliers: visibleSuppliers });
  } catch {
    return Response.json({ metrics: [], suppliers: [], demo: true });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const payload = (await request.json()) as Record<string, unknown>;
  const kind = String(payload.kind ?? "");
  const db = getDb();

  if (kind === "metric") {
    if (!auth.user.financeAccess) {
      return Response.json({ error: "No tienes acceso para modificar indicadores financieros." }, { status: 403 });
    }
    const name = String(payload.name ?? "").trim();
    const value = String(payload.value ?? "").trim();
    if (!name || !value) {
      return Response.json({ error: "Nombre y valor son obligatorios." }, { status: 400 });
    }
    const [row] = await db
      .insert(customMetrics)
      .values({
        name,
        value,
        target: String(payload.target ?? ""),
        unit: String(payload.unit ?? ""),
        owner: String(payload.owner ?? ""),
        trend: String(payload.trend ?? "flat"),
        createdByEmail: auth.user.email,
        createdByName: auth.user.displayName,
      })
      .returning();
    scheduleNotificationDispatch();
    return Response.json({ metric: row }, { status: 201 });
  }

  if (kind === "supplier") {
    const name = String(payload.name ?? "").trim();
    const category = String(payload.category ?? "").trim();
    if (!name || !category) {
      return Response.json({ error: "Nombre y categoría son obligatorios." }, { status: 400 });
    }
    const requestedAmount = String(payload.amount ?? "").trim();
    if (requestedAmount && !auth.user.financeAccess) {
      return Response.json(
        { error: "No tienes acceso para registrar importes de proveedores." },
        { status: 403 },
      );
    }
    const [row] = await db
      .insert(suppliers)
      .values({
        name,
        category,
        contact: String(payload.contact ?? ""),
        status: String(payload.status ?? "revision"),
        score: Number(payload.score ?? 0),
        nextDelivery: String(payload.nextDelivery ?? ""),
        amount: requestedAmount,
        createdByEmail: auth.user.email,
        createdByName: auth.user.displayName,
      })
      .returning();
    scheduleNotificationDispatch();
    const visibleSupplier = auth.user.financeAccess
      ? row
      : { ...row, amount: undefined };
    return Response.json({ supplier: visibleSupplier }, { status: 201 });
  }

  return Response.json({ error: "Tipo de registro no válido." }, { status: 400 });
}

