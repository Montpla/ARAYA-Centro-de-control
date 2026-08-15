import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appUsers, uploadAgentTokens } from "../db/schema";
import { AuthorizedUser, publicUser } from "./access-control";

/**
 * Autenticación de los tokens de carga automática.
 *
 * Existen para que el corte mensual de obra llegue solo, sin que nadie tenga
 * que iniciar sesión y subirlo a mano. Eso significa que un secreto vive fuera
 * del navegador —en el equipo de la oficina, dentro de una macro—, así que el
 * diseño asume que puede filtrarse y limita el daño:
 *
 * - **Sólo se guarda el hash.** Igual que las sesiones y los tokens de TV: el
 *   token en claro se enseña una vez al crearlo y no vuelve a existir en la
 *   base de datos, así que ni un volcado completo lo revela.
 * - **Caduca y se revoca.** Los dos controles son inmediatos y no dependen de
 *   que nadie cambie nada en el equipo de la oficina.
 * - **No es un usuario ni tiene permisos propios.** Hereda los de quien lo
 *   emitió, y se comprueban en cada uso: si esa persona se desactiva o pierde
 *   el acceso financiero, el token deja de servir en el acto. Un token robado
 *   nunca puede más que la persona a la que pertenece.
 * - **Sólo sirve para cargar.** No abre el panel, no lee datos y no consulta el
 *   registro documental; el único endpoint que lo acepta recibe archivos.
 * - **Deja rastro.** Cada uso actualiza la fecha y el contador, así que un uso
 *   inesperado se ve, y la carga queda atribuida a una persona con nombre y
 *   apellidos en la auditoría, igual que si la hubiera hecho a mano.
 */

const TOKEN_PREFIX = "araya_up_";

export function isUploadAgentToken(value: string) {
  return value.startsWith(TOKEN_PREFIX);
}

/** Hash del token tal y como se guarda. Nunca se almacena el valor en claro. */
export async function hashUploadAgentToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Genera un token nuevo. Se devuelve en claro una sola vez, al crearlo. */
export function generateUploadAgentToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const cuerpo = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${TOKEN_PREFIX}${cuerpo}`;
}

export type UploadAgentIdentity = {
  tokenId: number;
  label: string;
  user: AuthorizedUser;
};

/**
 * Resuelve el token a la persona a la que se atribuyen sus cargas, o devuelve
 * null si no sirve. Se comprueba en este orden —existencia, revocación,
 * caducidad y estado del usuario— para que un token válido de alguien
 * desactivado no llegue a escribir.
 */
export async function resolveUploadAgentToken(token: string): Promise<UploadAgentIdentity | null> {
  if (!isUploadAgentToken(token)) return null;
  const db = getDb();
  const tokenHash = await hashUploadAgentToken(token);

  const [row] = await db
    .select()
    .from(uploadAgentTokens)
    .where(eq(uploadAgentTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  // Se exige además que no esté borrado: el borrado es lógico, así que un
  // usuario eliminado sigue teniendo su fila y sin esta comprobación su token
  // seguiría escribiendo.
  const [user] = await db
    .select()
    .from(appUsers)
    .where(and(
      eq(appUsers.email, row.ownerEmail),
      eq(appUsers.active, true),
      eq(appUsers.deletedAt, ""),
    ))
    .limit(1);
  if (!user) return null;

  // El sello de uso se escribe aunque después falle la carga: lo que interesa
  // registrar es que el token se ha empleado, no si el archivo era válido.
  await db
    .update(uploadAgentTokens)
    .set({
      lastUsedAt: new Date().toISOString(),
      useCount: sql`${uploadAgentTokens.useCount} + 1`,
    })
    .where(eq(uploadAgentTokens.id, row.id))
    .catch(() => undefined);

  // Se devuelve la misma identidad que construye una sesión, con la regla de
  // acceso financiero incluida: el token no puede acabar con permisos distintos
  // a los de su responsable por haber tomado otro camino.
  return { tokenId: row.id, label: row.label, user: publicUser(user) };
}

/**
 * Extrae el token de la cabecera de autorización.
 *
 * Se acepta tanto `Bearer <token>` como el token pelado porque las macros de
 * Office y los scripts sencillos suelen enviarlo sin prefijo, y rechazar por
 * eso daría un fallo difícil de diagnosticar desde el otro lado.
 */
export function readUploadAgentToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const valor = header.replace(/^Bearer\s+/i, "").trim();
  if (valor && isUploadAgentToken(valor)) return valor;
  const alterno = request.headers.get("x-araya-upload-token")?.trim() ?? "";
  return isUploadAgentToken(alterno) ? alterno : "";
}
