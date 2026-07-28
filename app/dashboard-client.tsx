"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building,
  CustomMetric,
  Supplier,
  buildings,
  customMetrics as initialMetrics,
  monthlyPlan,
  suppliers as initialSuppliers,
  timeline,
} from "./demo-data";

type View =
  | "resumen"
  | "planificacion"
  | "edificios"
  | "cronologia"
  | "proveedores"
  | "metricas"
  | "agente";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  mode?: string;
};

const navItems: Array<{ id: View; label: string; mark: string }> = [
  { id: "resumen", label: "Resumen ejecutivo", mark: "01" },
  { id: "planificacion", label: "Planificación", mark: "02" },
  { id: "edificios", label: "Edificios y viviendas", mark: "03" },
  { id: "cronologia", label: "Cronología", mark: "04" },
  { id: "proveedores", label: "Proveedores", mark: "05" },
  { id: "metricas", label: "Métricas", mark: "06" },
  { id: "agente", label: "Agente IA", mark: "AI" },
];

const statusLabel = {
  terminada: "Terminada",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

function ProgressRing({ value }: { value: number }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${value}% completado`}
    >
      <div>
        <strong>{value}%</strong>
        <span>ejecutado</span>
      </div>
    </div>
  );
}

function Header({
  view,
  onAsk,
}: {
  view: View;
  onAsk: () => void;
}) {
  const label = navItems.find((item) => item.id === view)?.label;
  return (
    <header className="topbar">
      <div>
        <div className="crumb">ARAYA / CENTRO DE CONTROL</div>
        <h1>{label}</h1>
      </div>
      <div className="top-actions">
        <div className="live-state">
          <span className="live-dot" />
          Datos demo · actualizado 11:42
        </div>
        <button className="button secondary" onClick={onAsk}>
          Preguntar al agente
        </button>
        <button className="avatar" aria-label="Perfil de Dirección">
          DR
        </button>
      </div>
    </header>
  );
}

function StatCard({
  eyebrow,
  value,
  detail,
  tone = "neutral",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warn" | "danger" | "good";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Overview({
  onNavigate,
  onSelectBuilding,
}: {
  onNavigate: (view: View) => void;
  onSelectBuilding: (building: Building) => void;
}) {
  return (
    <div className="view-stack">
      <section className="hero-grid">
        <article className="project-pulse panel">
          <div>
            <div className="section-kicker">ESTADO GENERAL</div>
            <h2>La obra avanza, pero el Edificio B exige intervención.</h2>
            <p>
              El avance real está 4 puntos por debajo del plan. Carpintería y
              coordinación de instalaciones concentran el riesgo inmediato.
            </p>
            <div className="project-meta">
              <span>Inicio · 12 feb 2026</span>
              <span>Entrega objetivo · 30 abr 2027</span>
            </div>
          </div>
          <ProgressRing value={55} />
        </article>
        <div className="stat-grid">
          <StatCard eyebrow="Plan previsto" value="59%" detail="-4 pp de desviación" tone="warn" />
          <StatCard eyebrow="Desviación plazo" value="+8 días" detail="Mayor foco: Edificio B" tone="danger" />
          <StatCard eyebrow="Presupuesto" value="47,2%" detail="4,82 M € certificados" />
          <StatCard eyebrow="Incidencias" value="11" detail="2 críticas · 4 vencidas" tone="warn" />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel schedule-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CURVA DE AVANCE</span>
              <h3>Plan frente a ejecución</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate("planificacion")}>
              Ver planificación
            </button>
          </div>
          <div className="chart">
            {monthlyPlan.map((point) => (
              <div className="chart-column" key={point.month}>
                <div className="bars">
                  <span className="bar plan" style={{ height: `${point.planned}%` }} />
                  <span
                    className={`bar actual ${point.actual === null ? "future" : ""}`}
                    style={{ height: `${point.actual ?? point.planned}%` }}
                  />
                </div>
                <small>{point.month}</small>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><i className="legend plan" />Plan</span>
            <span><i className="legend actual" />Ejecutado</span>
          </div>
        </article>

        <article className="panel attention-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ATENCIÓN HOY</span>
              <h3>3 asuntos requieren decisión</h3>
            </div>
            <span className="count-badge">3</span>
          </div>
          <button className="attention-item" onClick={() => onNavigate("proveedores")}>
            <span className="severity critical">CRÍTICO</span>
            <strong>Carpintería exterior reprogramada</strong>
            <small>Impacto estimado +4 días · Edificio B</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("cronologia")}>
            <span className="severity medium">COORDINAR</span>
            <strong>Interferencia en patinillo técnico</strong>
            <small>Sin responsable de resolución asignado</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("metricas")}>
            <span className="severity low">REVISAR</span>
            <strong>Certificación 280.000 € bajo plan</strong>
            <small>Corte económico de julio</small>
          </button>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">MAPA DE OBRA</span>
            <h3>Edificios y zonas</h3>
          </div>
          <button className="text-button" onClick={() => onNavigate("edificios")}>
            Ver las 48 unidades
          </button>
        </div>
        <div className="building-strip">
          {buildings.map((building) => (
            <button
              key={building.id}
              className="building-summary"
              onClick={() => {
                onSelectBuilding(building);
                onNavigate("edificios");
              }}
            >
              <div className="building-code">{building.shortName}</div>
              <div>
                <strong>{building.name}</strong>
                <span>
                  {building.progress}% ·{" "}
                  {building.deviationDays
                    ? `+${building.deviationDays} días`
                    : "en plazo"}
                </span>
              </div>
              <div className="mini-progress">
                <i style={{ width: `${building.progress}%` }} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Planning() {
  const delayed = buildings.filter((item) => item.deviationDays > 0);
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Avance real" value="55%" detail="Objetivo mensual 59%" tone="warn" />
        <StatCard eyebrow="Fin previsto" value="08 may 2027" detail="+8 días sobre contrato" tone="danger" />
        <StatCard eyebrow="Hitos próximos" value="7" detail="3 durante los próximos 14 días" />
        <StatCard eyebrow="Camino crítico" value="4 tareas" detail="2 sin holgura disponible" tone="warn" />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CRONOGRAMA MAESTRO</span>
            <h3>Fases por edificio</h3>
          </div>
          <span className="data-note">Semana 30 · corte 28/07</span>
        </div>
        <div className="gantt">
          <div className="gantt-head">
            <span>Paquete</span>
            {["Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((month) => (
              <small key={month}>{month}</small>
            ))}
          </div>
          {[
            ["Edificio A · Instalaciones", 5, 45, "good"],
            ["Edificio B · Cerramientos", 2, 56, "danger"],
            ["Edificio C · Estructura", 0, 38, "warn"],
            ["Zonas comunes · Obra civil", 18, 48, "neutral"],
            ["Urbanización exterior", 42, 40, "neutral"],
          ].map(([label, left, width, tone]) => (
            <div className="gantt-row" key={String(label)}>
              <strong>{label}</strong>
              <div className="gantt-track">
                <i
                  className={String(tone)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DESVIACIONES</span>
            <h3>Paquetes fuera de fecha</h3>
          </div>
        </div>
        <div className="simple-table">
          <div className="table-row table-head">
            <span>Área</span><span>Real / plan</span><span>Desviación</span><span>Acción</span>
          </div>
          {delayed.map((item) => (
            <div className="table-row" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.progress}% / {item.planProgress}%</span>
              <span className={item.deviationDays >= 7 ? "danger-text" : "warn-text"}>
                +{item.deviationDays} días
              </span>
              <button className="text-button">Abrir plan de recuperación</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BuildingsView({
  selected,
  setSelected,
}: {
  selected: Building;
  setSelected: (building: Building) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const units = selected.units.filter(
    (unit) => statusFilter === "todos" || unit.status === statusFilter,
  );
  return (
    <div className="view-stack">
      <section className="building-tabs">
        {buildings.map((building) => (
          <button
            key={building.id}
            className={building.id === selected.id ? "active" : ""}
            onClick={() => setSelected(building)}
          >
            <span>{building.shortName}</span>
            <strong>{building.progress}%</strong>
          </button>
        ))}
      </section>
      <section className="panel building-detail">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DETALLE DEL EDIFICIO</span>
            <h3>{selected.name}</h3>
          </div>
          <div className="inline-stats">
            <span><strong>{selected.progress}%</strong> real</span>
            <span><strong>{selected.planProgress}%</strong> plan</span>
            <span className="danger-text"><strong>+{selected.deviationDays}</strong> días</span>
          </div>
        </div>
        <div className="filter-row">
          {["todos", "en_curso", "bloqueada", "pendiente", "terminada"].map((filter) => (
            <button
              key={filter}
              className={statusFilter === filter ? "active" : ""}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === "todos" ? "Todas" : statusLabel[filter as keyof typeof statusLabel]}
            </button>
          ))}
        </div>
        <div className="unit-grid">
          {units.map((unit) => (
            <button className={`unit-card ${unit.status}`} key={unit.id}>
              <div>
                <strong>{unit.code}</strong>
                <span>Planta {unit.floor}</span>
              </div>
              <b>{unit.progress}%</b>
              <small>{unit.phase}</small>
              <div className="unit-progress"><i style={{ width: `${unit.progress}%` }} /></div>
              {unit.deviationDays > 0 && (
                <em>+{unit.deviationDays} días</em>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function TimelineView() {
  const [filter, setFilter] = useState("todos");
  const visible = timeline.filter((event) => filter === "todos" || event.type === filter);
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">TRAZABILIDAD</span>
          <h3>Todo lo que cambia en la obra</h3>
        </div>
        <div className="filter-row compact">
          {["todos", "avance", "hito", "incidencia", "entrega"].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "todos" ? "Todo" : item}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline">
        {visible.map((event) => (
          <article className="timeline-event" key={event.id}>
            <div className={`timeline-marker ${event.type}`} />
            <div className="timeline-date">
              <strong>{event.date}</strong><span>{event.time}</span>
            </div>
            <div className="timeline-copy">
              <span className="event-type">{event.type}</span>
              <h4>{event.title}</h4>
              <p>{event.detail}</p>
              <small>{event.building} · {event.author}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SuppliersView({
  suppliers,
  onAdd,
}: {
  suppliers: Supplier[];
  onAdd: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Proveedores activos" value={`${suppliers.length}`} detail="8 categorías de contratación" />
        <StatCard eyebrow="En plazo" value="78%" detail="3 entregas esta semana" tone="good" />
        <StatCard eyebrow="En riesgo" value="2" detail="1 retraso · 1 en revisión" tone="warn" />
        <StatCard eyebrow="Contratado" value="3,47 M €" detail="62% comprometido" />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CADENA DE SUMINISTRO</span>
            <h3>Proveedores y próximas entregas</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Nuevo proveedor</button>
        </div>
        <div className="supplier-grid">
          {suppliers.map((supplier) => (
            <article className="supplier-card" key={supplier.id}>
              <div className="supplier-head">
                <div className="supplier-logo">{supplier.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{supplier.name}</strong>
                  <span>{supplier.category}</span>
                </div>
                <i className={`supplier-status ${supplier.status}`} />
              </div>
              <div className="supplier-details">
                <span>Contacto<strong>{supplier.contact}</strong></span>
                <span>Próxima entrega<strong>{supplier.nextDelivery}</strong></span>
                <span>Contratado<strong>{supplier.amount}</strong></span>
              </div>
              <div className="supplier-score">
                <span>Rendimiento</span>
                <div><i style={{ width: `${supplier.score}%` }} /></div>
                <strong>{supplier.score}/100</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricsView({
  metrics,
  onAdd,
}: {
  metrics: CustomMetric[];
  onAdd: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="panel metric-library">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">BIBLIOTECA DE INDICADORES</span>
            <h3>Métricas configurables del proyecto</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Añadir métrica</button>
        </div>
        <p className="section-intro">
          Cada área puede incorporar indicadores propios sin cambiar el panel.
          La fuente, frecuencia y responsable quedarán asociados al dato.
        </p>
        <div className="metric-grid">
          {metrics.map((metric) => {
            const numeric = Number(metric.value.replace(",", "."));
            const target = Number(metric.target.replace(",", "."));
            const ratio = Number.isFinite(numeric / target)
              ? Math.min(100, Math.max(4, (numeric / target) * 100))
              : 50;
            return (
              <article className="metric-card" key={metric.id}>
                <div className="metric-card-head">
                  <span>{metric.owner}</span>
                  <i className={`trend ${metric.trend}`}>{metric.trend === "up" ? "↗" : metric.trend === "down" ? "↘" : "→"}</i>
                </div>
                <h4>{metric.name}</h4>
                <strong>{metric.value} <small>{metric.unit}</small></strong>
                <div className="metric-target">
                  <span>Objetivo {metric.target} {metric.unit}</span>
                  <div><i style={{ width: `${ratio}%` }} /></div>
                </div>
              </article>
            );
          })}
          <button className="metric-add-card" onClick={onAdd}>
            <span>+</span>
            <strong>Nueva métrica</strong>
            <small>Nombre, unidad, objetivo y responsable</small>
          </button>
        </div>
      </section>
    </div>
  );
}

function AgentPanel({
  expanded,
  onClose,
}: {
  expanded: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Buenos días. Puedo consultar avance, desviaciones, viviendas, cronología y proveedores. ¿Qué necesitas saber?",
      mode: "demo-data-engine",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
    ]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        mode?: string;
      };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.answer ?? payload.error ?? "No he podido resolver la consulta.",
          mode: payload.mode,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "No puedo conectar con los datos ahora. Vuelve a intentarlo en unos segundos.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <aside className={`agent-panel ${expanded ? "expanded" : ""}`}>
      <div className="agent-header">
        <div className="agent-mark">AI</div>
        <div>
          <strong>ARAYA Copilot</strong>
          <span><i /> Consulta de datos · solo lectura</span>
        </div>
        {!expanded && (
          <button className="close-button" onClick={onClose} aria-label="Cerrar agente">×</button>
        )}
      </div>
      <div className="agent-suggestions">
        {[
          "¿Qué edificio va más retrasado?",
          "¿Qué entregas están en riesgo?",
          "Resume la obra para Dirección",
        ].map((suggestion) => (
          <button key={suggestion} onClick={() => void ask(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <div>{message.text}</div>
            {message.role === "assistant" && (
              <small>{message.mode === "openai-tools" ? "IA + herramientas" : "Motor de datos demo"}</small>
            )}
          </div>
        ))}
        {loading && <div className="message assistant typing">Consultando datos…</div>}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Pregunta por cualquier dato de la obra…"
          rows={2}
        />
        <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar pregunta">↑</button>
      </form>
      <div className="agent-foot">Las respuestas citan el último dato disponible.</div>
    </aside>
  );
}

function RecordModal({
  type,
  onClose,
  onSaveMetric,
  onSaveSupplier,
}: {
  type: "metric" | "supplier";
  onClose: () => void;
  onSaveMetric: (metric: CustomMetric) => void;
  onSaveSupplier: (supplier: Supplier) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const body = { kind: type, ...payload };
    let saved = false;
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        if (type === "metric" && data.metric) onSaveMetric(data.metric);
        if (type === "supplier" && data.supplier) onSaveSupplier(data.supplier);
        saved = true;
      }
    } catch {
      saved = false;
    }
    if (!saved && type === "metric") {
      onSaveMetric({
        id: crypto.randomUUID(),
        name: String(payload.name),
        value: String(payload.value),
        target: String(payload.target),
        unit: String(payload.unit),
        owner: String(payload.owner),
        trend: "flat",
      });
    }
    if (!saved && type === "supplier") {
      onSaveSupplier({
        id: crypto.randomUUID(),
        name: String(payload.name),
        category: String(payload.category),
        contact: String(payload.contact),
        status: "revision",
        score: 80,
        nextDelivery: String(payload.nextDelivery),
        amount: String(payload.amount),
      });
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">NUEVO REGISTRO</span>
            <h3>{type === "metric" ? "Añadir métrica" : "Añadir proveedor"}</h3>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          {type === "metric" ? (
            <>
              <label>Nombre<input name="name" required placeholder="Ej. Consumo de hormigón" /></label>
              <div className="form-grid">
                <label>Valor<input name="value" required placeholder="48" /></label>
                <label>Objetivo<input name="target" required placeholder="52" /></label>
              </div>
              <div className="form-grid">
                <label>Unidad<input name="unit" placeholder="%, días, M €…" /></label>
                <label>Responsable<input name="owner" placeholder="Producción" /></label>
              </div>
            </>
          ) : (
            <>
              <label>Empresa<input name="name" required placeholder="Nombre del proveedor" /></label>
              <label>Categoría<input name="category" required placeholder="Estructura, instalaciones…" /></label>
              <label>Contacto<input name="contact" placeholder="Nombre y apellidos" /></label>
              <div className="form-grid">
                <label>Próxima entrega<input name="nextDelivery" placeholder="05 ago · 08:00" /></label>
                <label>Importe contratado<input name="amount" placeholder="120.000 €" /></label>
              </div>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [view, setView] = useState<View>("resumen");
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]);
  const [metrics, setMetrics] = useState<CustomMetric[]>(initialMetrics);
  const [supplierRows, setSupplierRows] = useState<Supplier[]>(initialSuppliers);
  const [agentOpen, setAgentOpen] = useState(true);
  const [modal, setModal] = useState<"metric" | "supplier" | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.metrics) && data.metrics.length) {
          setMetrics((current) => [...data.metrics, ...current]);
        }
        if (Array.isArray(data.suppliers) && data.suppliers.length) {
          setSupplierRows((current) => [...data.suppliers, ...current]);
        }
      })
      .catch(() => undefined);
  }, []);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return [
      ...buildings
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: `${item.progress}% de avance`, view: "edificios" as View })),
      ...supplierRows
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: item.category, view: "proveedores" as View })),
      ...metrics
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: `${item.value} ${item.unit}`, view: "metricas" as View })),
    ].slice(0, 6);
  }, [search, supplierRows, metrics]);

  function content() {
    if (view === "resumen") {
      return <Overview onNavigate={setView} onSelectBuilding={setSelectedBuilding} />;
    }
    if (view === "planificacion") return <Planning />;
    if (view === "edificios") {
      return <BuildingsView selected={selectedBuilding} setSelected={setSelectedBuilding} />;
    }
    if (view === "cronologia") return <TimelineView />;
    if (view === "proveedores") {
      return <SuppliersView suppliers={supplierRows} onAdd={() => setModal("supplier")} />;
    }
    if (view === "metricas") {
      return <MetricsView metrics={metrics} onAdd={() => setModal("metric")} />;
    }
    return <AgentPanel expanded onClose={() => setView("resumen")} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><strong>BRICKET</strong><span>Centro de Control</span></div>
        </div>
        <div className="project-selector">
          <span>PROYECTO ACTIVO</span>
          <button><b>AR</b><div><strong>ARAYA</strong><small>Obra residencial</small></div><i>⌄</i></button>
        </div>
        <nav>
          <span className="nav-label">NAVEGACIÓN</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                if (item.id === "agente") setAgentOpen(false);
              }}
            >
              <i>{item.mark}</i><span>{item.label}</span>
              {item.id === "agente" && <em>NUEVO</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span><i className="live-dot" /> Sistema operativo</span>
          <small>Última sincronización · 11:42</small>
        </div>
      </aside>

      <main className={`main-area ${agentOpen && view !== "agente" ? "with-agent" : ""}`}>
        <Header view={view} onAsk={() => setAgentOpen(true)} />
        <div className="global-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar edificio, vivienda, proveedor o métrica…"
          />
          <kbd>⌘ K</kbd>
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  key={`${result.view}-${result.label}`}
                  onClick={() => {
                    setView(result.view);
                    setSearch("");
                  }}
                >
                  <strong>{result.label}</strong><span>{result.detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="content">{content()}</div>
      </main>

      {agentOpen && view !== "agente" && (
        <AgentPanel expanded={false} onClose={() => setAgentOpen(false)} />
      )}

      {modal && (
        <RecordModal
          type={modal}
          onClose={() => setModal(null)}
          onSaveMetric={(metric) => setMetrics((current) => [metric, ...current])}
          onSaveSupplier={(supplier) => setSupplierRows((current) => [supplier, ...current])}
        />
      )}
    </div>
  );
}
