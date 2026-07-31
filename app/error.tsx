"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="route-error-screen">
      <section className="app-recovery" role="alert">
        <span>BRICKET CONTROL · RECUPERACIÓN</span>
        <h2>No se ha podido abrir esta pantalla.</h2>
        <p>La información continúa protegida. Reintenta la vista o vuelve a cargar el Centro de Control.</p>
        <div>
          <button className="button primary" type="button" onClick={reset}>Reintentar</button>
          <button className="button secondary" type="button" onClick={() => window.location.assign("/")}>Volver al inicio</button>
        </div>
      </section>
    </main>
  );
}
