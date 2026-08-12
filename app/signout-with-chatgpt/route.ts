import { safeRelativeReturnPath } from "../chatgpt-auth";
import { SESSION_COOKIE, clearSessionCookieHeader, destroySession } from "../../lib/session";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeRelativeReturnPath(url.searchParams.get("return_to") ?? "/");
  const token = readCookie(request, SESSION_COOKIE);
  await destroySession(token);

  const secure = url.protocol === "https:";
  url.pathname = returnTo;
  url.search = "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: returnTo,
      "Set-Cookie": clearSessionCookieHeader(secure),
    },
  });
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
