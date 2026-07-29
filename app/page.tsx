import { DashboardClient } from "./dashboard-client";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";
import { resolveAuthorizedUser } from "../lib/access-control";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await requireChatGPTUser("/");
  const currentUser = await resolveAuthorizedUser(identity);

  if (!currentUser) {
    return (
      <main className="access-screen">
        <section className="access-card">
          <img src="/bricket-mark.png" alt="" />
          <span>GRUPO BRICKET · ACCESO CONTROLADO</span>
          <h1>Tu identidad está verificada, pero aún no tienes acceso.</h1>
          <p>
            Solicita al administrador que autorice <strong>{identity.email}</strong>.
            El acceso puede habilitarse o retirarse desde la gestión de usuarios.
          </p>
          <a href={chatGPTSignOutPath("/")}>Cerrar sesión</a>
        </section>
      </main>
    );
  }

  return <DashboardClient currentUser={currentUser} />;
}

