// Respuesta JSON condicional para los endpoints sondeados cada 5 segundos.
//
// El servidor calcula siempre el payload completo (algunos GET tienen efectos
// deliberados, como el relevo del outbox de push en /api/notifications) y lo
// que se ahorra es la transferencia: si el cliente envía en If-None-Match el
// mismo ETag que produce el payload actual, la respuesta es un 304 sin cuerpo.
// En móvil/tablet en obra eso elimina la re-descarga del JSON íntegro en cada
// ciclo sin cambios, que es el caso abrumadoramente común.
//
// El ETag es débil (W/"…") y se calcula sobre el JSON del payload excluyendo
// las claves volátiles de primer nivel que cambian en cada respuesta aunque
// los datos no cambien (p. ej. refreshedAt). Excluirlas del hash — no del
// cuerpo — mantiene la semántica: cuando sí hay un 200, el cuerpo completo
// viaja con su refreshedAt fresco.

const encoder = new TextEncoder();

async function weakEtag(payload: unknown, volatileKeys: readonly string[]): Promise<string> {
  const omitted = new Set(volatileKeys);
  const serialized = JSON.stringify(payload, function replacer(key, value) {
    if (this === payload && omitted.has(key)) return undefined;
    return value;
  }) ?? "null";
  const digest = await crypto.subtle.digest("SHA-1", encoder.encode(serialized));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `W/"${hex}"`;
}

export async function conditionalJson(
  request: Request,
  payload: unknown,
  options?: { volatile?: readonly string[] },
): Promise<Response> {
  const etag = await weakEtag(payload, options?.volatile ?? []);
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "private, no-store",
        ETag: etag,
      },
    });
  }
  const response = Response.json(payload);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("ETag", etag);
  return response;
}
