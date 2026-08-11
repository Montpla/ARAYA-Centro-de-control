"use client";

import dynamic from "next/dynamic";
import type { DashboardUser } from "./dashboard-client";
import type { DashboardBootstrapData } from "../lib/dashboard-bootstrap-types";

const ClientDashboard = dynamic(
  () => import("./dashboard-client").then((module) => module.DashboardClient),
  {
    ssr: false,
    loading: () => (
      <main className="access-screen">
        <section className="access-card">
          <img src="/bricket-mark.png" alt="" />
          <span>GRUPO BRICKET · CENTRO DE CONTROL</span>
          <h1>Preparando tu espacio de trabajo…</h1>
        </section>
      </main>
    ),
  },
);

export function DashboardShell({
  currentUser,
  bootstrap,
}: {
  currentUser: DashboardUser;
  bootstrap: DashboardBootstrapData;
}) {
  return <ClientDashboard currentUser={currentUser} bootstrap={bootstrap} />;
}
