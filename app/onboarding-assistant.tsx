"use client";

import { useEffect, useState } from "react";

type OnboardingPreference = {
  onboardingStep?: number;
  onboardingCompletedAt?: string;
};

const steps = [
  {
    mark: "01",
    title: "Tu Centro de Control, en una sola pantalla",
    body: "Consulta obra, apartamentos, urbanismo, ventas y documentos desde el menú lateral o inferior. Todo dato publicado conserva fuente, fecha y responsable.",
    tip: "En móvil, pulsa Más para abrir todas las secciones.",
  },
  {
    mark: "02",
    title: "Carga uno o varios archivos",
    body: "Pulsa Cargar archivo y selecciona hasta 20 documentos. También puedes hacer una foto o, si aparece en tu dispositivo, usar Compartir → Bricket Control desde otra aplicación.",
    tip: "No cierres hasta ver el recibo individual de cada archivo.",
  },
  {
    mark: "03",
    title: "El recibo dice exactamente qué ocurrió",
    body: "Cada archivo muestra lo publicado, lo ya vigente y lo aislado. Los documentos correctos siguen procesándose aunque otro del lote falle.",
    tip: "El original siempre queda conservado y puede abrirse sin descargarlo.",
  },
  {
    mark: "04",
    title: "Cierres e incidencias se vigilan solos",
    body: "El Centro de Control comprueba cada noche contratos de datos, cargas detenidas, cierres semanales y mensuales. Una incidencia segura se reintenta y queda trazada.",
    tip: "Las decisiones financieras sensibles siguen requiriendo autoridad y controles contables.",
  },
  {
    mark: "05",
    title: "Configura avisos sin ruido",
    body: "En Centro de datos → Automatización puedes elegir áreas, avisos críticos, horario silencioso o un resumen diario/semanal.",
    tip: "Los avisos permanecen dentro de la app aunque silencies el push.",
  },
  {
    mark: "06",
    title: "Ayuda disponible en todo momento",
    body: "Usa Guías de uso para los pasos diarios y ARAYA Asistente para consultar los datos vivos. La IA no decide ni publica cifras protegidas por su cuenta.",
    tip: "Si eres administrador, revisa Automatización para cerrar periodos y resolver incidencias.",
  },
  {
    mark: "OK",
    title: "Ya puedes empezar",
    body: "Carga el próximo informe con normalidad. El sistema lo clasificará, leerá, contrastará, publicará lo seguro y te devolverá un recibo claro.",
    tip: "Ante cualquier duda, conserva el recibo: es la trazabilidad de la carga.",
  },
] as const;

export function OnboardingAssistant({ role }: { role: string }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/automation-center", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { preferences?: OnboardingPreference };
        if (!response.ok || !active || payload.preferences?.onboardingCompletedAt) return;
        setStep(Math.max(0, Math.min(steps.length - 1, Number(payload.preferences?.onboardingStep ?? 0))));
        setVisible(true);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function persist(nextStep: number, completed: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/automation-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "onboarding", onboardingStep: nextStep, onboardingCompleted: completed }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el progreso.");
      if (completed) setVisible(false);
      else setStep(nextStep);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el progreso.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  const item = steps[step];
  const finalStep = step === steps.length - 1;

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" type="button" aria-label="Cerrar guía por ahora" onClick={() => setVisible(false)}>×</button>
        <div className="onboarding-progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>
          {steps.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}
        </div>
        <div className="onboarding-heading">
          <span>{item.mark}</span>
          <div><small>BIENVENIDA · {role === "admin" ? "ADMINISTRACIÓN" : "EQUIPO ARAYA"}</small><h2 id="onboarding-title">{item.title}</h2></div>
        </div>
        <p className="onboarding-body">{item.body}</p>
        <p className="onboarding-tip"><strong>Consejo</strong>{item.tip}</p>
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          <button type="button" className="button tertiary" disabled={busy} onClick={() => void persist(steps.length - 1, true)}>Omitir guía</button>
          <div>
            {step > 0 && <button type="button" className="button secondary" disabled={busy} onClick={() => void persist(step - 1, false)}>Anterior</button>}
            <button type="button" className="button primary" disabled={busy} onClick={() => void persist(finalStep ? step : step + 1, finalStep)}>
              {busy ? "Guardando…" : finalStep ? "Entrar al Centro de Control" : "Siguiente"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
