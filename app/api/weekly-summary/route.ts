import { requireApiUser } from "../../../lib/access-control";
import { gatherWeeklySummary } from "../../../lib/weekly-summary-data";
import { emitWeeklySummaryIfDue } from "../../../lib/weekly-summary-emit";

export const runtime = "edge";

// El resumen semanal se reparte como aviso al móvil (el mismo sistema que ya
// avisa de revisiones y vencimientos), no por correo: así no hace falta dar de
// alta ningún servicio ni gestionar claves. Sale solo una vez por semana desde
// el sondeo de control-room. Este endpoint es sólo para el administrador:
// previsualizar cómo queda y, si hace falta, forzar un envío de prueba.

// GET: vista previa, sin emitir ni tocar nada.
export async function GET() {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  const data = await gatherWeeklySummary(new Date());
  return Response.json({
    subject: data.summary.subject,
    notificationBody: data.notificationBody,
    text: data.summary.text,
    overallNow: data.overallNow,
  });
}

// POST: fuerza el aviso ahora, para probar sin esperar al lunes. Aunque se
// llame varias veces, la deduplicación por semana evita duplicados salvo que se
// use force.
export async function POST(request: Request) {
  const auth = await requireApiUser({ admin: true });
  if (!auth.user) return auth.response;

  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await emitWeeklySummaryIfDue(new Date(), { force });
  return Response.json(result);
}
