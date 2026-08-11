import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { uploadedFiles } from "../../../../db/schema";
import { requireApiUser } from "../../../../lib/access-control";
import {
  FileLifecycleAction,
  applyFileLifecycle,
} from "../../../../lib/file-lifecycle";
import { requiresFinanceAccessForDocument } from "../../../../lib/live-data";

export const runtime = "edge";

type LifecyclePayload = {
  action?: FileLifecycleAction;
  fileId?: string;
  reason?: string;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let payload: LifecyclePayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no contiene un JSON válido." }, { status: 400 });
  }

  const fileId = String(payload.fileId ?? "").trim().slice(0, 80);
  const action = payload.action;
  const reason = String(payload.reason ?? "").trim().slice(0, 1_000);
  if (!fileId || (action !== "delete" && action !== "restore")) {
    return Response.json({ error: "Indica un archivo y una acción delete o restore." }, { status: 400 });
  }

  const [file] = await getDb()
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);
  if (!file) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });

  const isUploader = normalizedEmail(file.uploaderEmail) === normalizedEmail(auth.user.email);
  if (auth.user.role !== "admin" && !isUploader) {
    return Response.json(
      { error: "Solo un administrador o la persona que subió el archivo puede gestionarlo." },
      { status: 403 },
    );
  }
  const protectedFile = requiresFinanceAccessForDocument(file.area, file.documentType);
  if (protectedFile && !auth.user.financeAccess) {
    return Response.json({ error: "No tienes acceso a Finanzas ni Ventas y cobranza." }, { status: 403 });
  }

  try {
    const result = await applyFileLifecycle({
      action,
      actor: auth.user,
      file,
      reason,
    });
    const restored = action === "restore";
    return Response.json({
      revision: result.revision,
      affectedKeys: result.affectedKeys,
      deletedAt: result.deletedAt,
      idempotent: result.idempotent,
      message: result.idempotent
        ? `El archivo ya estaba ${restored ? "activo" : "retirado"}; no se duplicó la operación.`
        : `Archivo ${restored ? "restaurado" : "retirado"} y datos vivos recomputados.`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el ciclo del archivo." },
      { status: 500 },
    );
  }
}
