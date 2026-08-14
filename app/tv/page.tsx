import { TvClient } from "./tv-client";

export const dynamic = "force-dynamic";

// Modo TV/obra: pantalla siempre encendida para la oficina de obra o la
// central. No usa sesión de usuario: la autoriza un token de dispositivo
// creado por un administrador desde Usuarios y accesos, y /api/tv solo sirve
// el resumen no financiero. El token viaja en la URL una sola vez; el
// cliente lo guarda en sessionStorage y limpia la barra de direcciones.
export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenRaw = params.token;
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  return <TvClient initialToken={token} />;
}
