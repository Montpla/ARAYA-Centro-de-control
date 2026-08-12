import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionUserFromToken } from "../lib/session";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

// El nombre "ChatGPT" en estas funciones es histórico (venía del inicio de
// sesión externo de Sites, que ya no está disponible fuera de esa
// plataforma). Se conserva el nombre para no tener que tocar cada punto de
// la app que ya llama a requireChatGPTUser/getChatGPTUser — lo único que
// cambió es de dónde sale la identidad: antes de cabeceras inyectadas por
// Sites, ahora de una sesión propia verificada por PIN.
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return sessionUserFromToken(token);
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  if (process.env.LOCAL_DEMO_MODE === "true") {
    return {
      displayName: "Usuario Demo",
      email: "demo@araya.local",
      fullName: "Usuario Demo",
    };
  }
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}
