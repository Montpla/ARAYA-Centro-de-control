import { safeRelativeReturnPath } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Correo o PIN incorrecto.",
  locked: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  missing: "Introduce tu correo y tu PIN.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnToRaw = params.return_to;
  const returnTo = safeRelativeReturnPath(
    typeof returnToRaw === "string" ? returnToRaw : "/",
  );
  const errorRaw = params.error;
  const errorCode = typeof errorRaw === "string" ? errorRaw : "";
  const errorMessage = ERROR_MESSAGES[errorCode] ?? "";

  return (
    <main className="access-screen">
      <section className="access-card">
        <img src="/bricket-mark.png" alt="" />
        <span>GRUPO BRICKET · CENTRO DE CONTROL</span>
        <h1>Inicia sesión</h1>
        <p>Introduce el correo y el PIN que te dio tu administrador.</p>
        {errorMessage ? (
          <p role="alert" style={{ color: "#c0392b", fontWeight: 600 }}>
            {errorMessage}
          </p>
        ) : null}
        <form method="POST" action="/api/auth/login" style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
          <input type="hidden" name="return_to" value={returnTo} />
          <label style={{ display: "grid", gap: "0.25rem", textAlign: "left" }}>
            <span>Correo</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", textAlign: "left" }}>
            <span>PIN</span>
            <input
              type="password"
              name="pin"
              inputMode="numeric"
              autoComplete="current-password"
              required
              minLength={4}
              maxLength={10}
            />
          </label>
          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
