"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building,
  CustomMetric,
  Supplier,
  Unit,
  buildings,
  cubicaciones,
  customMetrics as initialMetrics,
  dataSources,
  monthlyPlan,
  projectSnapshot,
  suppliers as initialSuppliers,
  timeline,
  workPackages,
} from "./demo-data";

type View =
  | "resumen"
  | "planificacion"
  | "edificios"
  | "cronologia"
  | "proveedores"
  | "metricas"
  | "fuentes"
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
  { id: "metricas", label: "Métricas y finanzas", mark: "06" },
  { id: "fuentes", label: "Fuentes y calidad", mark: "07" },
  { id: "agente", label: "Agente IA", mark: "AI" },
];

const statusLabel = {
  terminada: "Terminada",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

function ProgressRing({ value }: { value: number }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${number.format(value)}% ejecutado`}
    >
      <div>
        <strong>{number.format(value)}%</strong>
        <span>avance físico</span>
      </div>
    </div>
  );
}

function Header({ view, onAsk }: { view: View; onAsk: () => void }) {
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
          Corte documental · {projectSnapshot.declaredCutoff}
        </div>
        <button className="button secondary" onClick={onAsk}>
          Preguntar al agente
        </button>
        <button className="avatar" aria-label="Perfil de Dirección">DR</button>
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

function ProgressChart() {
  return (
    <>
      <div className="chart-scroll">
        <div className="chart real-chart">
          {monthlyPlan.map((point, index) => (
            <div className="chart-column" key={`${point.month}-${index}`}>
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
      </div>
      <div className="chart-legend">
        <span><i className="legend plan" />Plan operativo</span>
        <span><i className="legend actual" />Ejecutado real</span>
      </div>
    </>
  );
}

function SitePlan({
  onSelectBuilding,
  onNavigate,
}: {
  onSelectBuilding: (building: Building) => void;
  onNavigate: (view: View) => void;
}) {
  const [selectedUnit, setSelectedUnit] = useState<{ building: Building; unit: Unit } | null>(null);
  const completed = buildings.flatMap((item) => item.units).filter((unit) => unit.status === "terminada").length;
  const active = buildings.flatMap((item) => item.units).filter((unit) => unit.status === "en_curso").length;
  const pending = projectSnapshot.unitCount - completed - active;

  return (
    <section className="panel site-plan-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">PLANO OPERATIVO DE OBRA</span>
          <h3>26 edificios · 156 viviendas</h3>
        </div>
        <div className="plan-legend">
          <span><i className="done" />Superestructura terminada · {completed}</span>
          <span><i className="active" />En curso · {active}</span>
          <span><i className="pending" />Pendiente · {pending}</span>
        </div>
      </div>
      <p className="plan-disclaimer">
        Esquema operativo según la secuencia del MPP; no representa todavía la
        ubicación geográfica real. Adjuntando el plano de implantación se
        sustituirá por la distribución exacta.
      </p>
      <div className="site-plan">
        <div className="urbanism-band urbanism-north">
          <span>URBANISMO · EJECUTADO 18,28%</span>
          <div><i style={{ width: "18.28%" }} /></div>
          <small>Plan 16,18% · +2,10 pp</small>
        </div>
        <div className="site-buildings">
          {buildings.map((building) => (
            <article className="plan-building" key={building.id}>
              <button
                className="plan-building-head"
                onClick={() => {
                  onSelectBuilding(building);
                  onNavigate("edificios");
                }}
              >
                <span>EDIFICIO</span>
                <strong>{building.shortName}</strong>
                <small>{number.format(building.progress)}% frentes</small>
              </button>
              <div className="plan-unit-grid">
                {building.units.map((unit) => (
                  <button
                    key={unit.id}
                    className={`plan-unit ${unit.status}`}
                    title={`${building.name} · Vivienda ${unit.code} · ${unit.progress}% de superestructura`}
                    onClick={() => setSelectedUnit({ building, unit })}
                  >
                    {unit.code.split("-")[1]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="urbanism-core">
          <div><span>Viales y redes</span><strong>18,28%</strong></div>
          <div><span>Áreas exteriores</span><strong>Dato agregado</strong></div>
          <div><span>Plan urbanismo</span><strong>16,18%</strong></div>
        </div>
      </div>
      {selectedUnit && (
        <div className="unit-inspector" role="dialog" aria-modal="true">
          <button className="close-button" onClick={() => setSelectedUnit(null)} aria-label="Cerrar">×</button>
          <div>
            <span className="section-kicker">FICHA DE VIVIENDA</span>
            <h3>Vivienda {selectedUnit.unit.code}</h3>
          </div>
          <div className="unit-inspector-grid">
            <span>Edificio<strong>{selectedUnit.building.shortName}</strong></span>
            <span>Planta<strong>{selectedUnit.unit.floor}</strong></span>
            <span>Superestructura<strong>{selectedUnit.unit.progress}%</strong></span>
            <span>Estado<strong>{statusLabel[selectedUnit.unit.status]}</strong></span>
            <span>Índice del edificio<strong>{number.format(selectedUnit.building.progress)}%</strong></span>
            <span>Fin previsto edificio<strong>{selectedUnit.building.forecastFinish}</strong></span>
          </div>
          <p>
            El avance disponible a nivel vivienda corresponde únicamente a
            superestructura. Los próximos documentos permitirán añadir
            albañilería, instalaciones, acabados, incidencias y responsables.
          </p>
          <button
            className="button primary"
            onClick={() => {
              onSelectBuilding(selectedUnit.building);
              onNavigate("edificios");
              setSelectedUnit(null);
            }}
          >
            Abrir detalle del edificio
          </button>
        </div>
      )}
    </section>
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
            <div className="section-kicker">CORTE 30/06/2026</div>
            <h2>El avance físico está 3,00 puntos por debajo del plan.</h2>
            <p>
              Excel registra 18,23% ejecutado frente a 21,24% previsto. El
              cronograma MPP marca 17% y proyecta el cierre siete días después
              de la línea base.
            </p>
            <div className="project-meta">
              <span>Fin base · 31 may 2027</span>
              <span>Fin previsto · 07 jun 2027</span>
            </div>
          </div>
          <ProgressRing value={projectSnapshot.overallProgress} />
        </article>
        <div className="stat-grid">
          <StatCard eyebrow="Plan operativo" value="21,24%" detail="-3,00 pp de brecha física" tone="warn" />
          <StatCard eyebrow="Cronograma MPP" value="17%" detail="Indicador pendiente de conciliación" tone="warn" />
          <StatCard eyebrow="Alcance residencial" value="26 edificios" detail="156 apartamentos · 6 por edificio" />
          <StatCard eyebrow="Previsión final" value="+7 días" detail="07/06/2027 frente a línea base" tone="danger" />
        </div>
      </section>

      <SitePlan onSelectBuilding={onSelectBuilding} onNavigate={onNavigate} />

      <section className="dashboard-grid">
        <article className="panel schedule-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CURVA DE AVANCE</span>
              <h3>Plan frente a ejecución</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate("planificacion")}>
              Abrir planificación
            </button>
          </div>
          <ProgressChart />
        </article>

        <article className="panel attention-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ATENCIÓN DE DIRECCIÓN</span>
              <h3>3 controles prioritarios</h3>
            </div>
            <span className="count-badge">3</span>
          </div>
          <button className="attention-item" onClick={() => onNavigate("planificacion")}>
            <span className="severity critical">PLAZO</span>
            <strong>Infraestructura proyecta +58 días</strong>
            <small>Fin 07/10/2026 · base 10/08/2026</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("fuentes")}>
            <span className="severity medium">CONCILIAR</span>
            <strong>Excel 18,23% frente a MPP 17%</strong>
            <small>Son indicadores distintos; falta regla formal de conciliación</small>
          </button>
          <button className="attention-item" onClick={() => onNavigate("metricas")}>
            <span className="severity low">VALIDAR</span>
            <strong>Moneda de cubicaciones no identificada</strong>
            <small>No se convierte ni se etiqueta como USD hasta confirmación</small>
          </button>
        </article>
      </section>

    </div>
  );
}

function Planning() {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Avance físico" value="18,23%" detail="Plan 21,24% · Excel" tone="warn" />
        <StatCard eyebrow="Fin previsto" value="07 jun 2027" detail="+7 días naturales frente a base" tone="danger" />
        <StatCard eyebrow="Paquetes" value={`${workPackages.length}`} detail="6 con avance registrado" />
        <StatCard eyebrow="Camino crítico" value="5 paquetes" detail="Marcados como críticos en el MPP" tone="warn" />
      </section>
      <section className="panel schedule-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CURVA S</span>
            <h3>Plan operativo completo</h3>
          </div>
          <span className="data-note">Excel · corte 30/06/2026</span>
        </div>
        <ProgressChart />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CRONOGRAMA MAESTRO</span>
            <h3>Paquetes y desviaciones de fin</h3>
          </div>
          <span className="data-note">MPP · guardado 14/07/2026</span>
        </div>
        <div className="simple-table package-table">
          <div className="table-row table-head">
            <span>Paquete</span><span>Avance</span><span>Fin / línea base</span><span>Desviación</span>
          </div>
          {workPackages.map((item) => (
            <div className="table-row" key={item.name}>
              <strong>{item.name}{item.critical ? " · crítico" : ""}</strong>
              <span>{number.format(item.progress)}%</span>
              <span>{item.finish} / {item.baselineFinish}</span>
              <span className={item.deviationDays >= 14 ? "danger-text" : "warn-text"}>
                +{item.deviationDays} días
              </span>
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
            <strong>{number.format(building.progress)}%</strong>
          </button>
        ))}
      </section>
      <section className="panel building-detail">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DETALLE NORMALIZADO DEL EDIFICIO</span>
            <h3>{selected.name}</h3>
          </div>
          <div className="inline-stats">
            <span><strong>{number.format(selected.progress)}%</strong> índice de frentes</span>
            <span><strong>{selected.forecastFinish}</strong> fin previsto</span>
            <span className={selected.deviationDays > 0 ? "danger-text" : ""}>
              <strong>{selected.deviationDays > 0 ? `+${selected.deviationDays}` : selected.deviationDays}</strong> días
            </span>
          </div>
        </div>
        <p className="section-intro">
          El porcentaje del edificio es el promedio simple de 32 frentes del MPP.
          Las tarjetas de viviendas muestran únicamente el avance de
          superestructura disponible en la fuente.
        </p>
        <div className="filter-row">
          {["todos", "en_curso", "pendiente", "terminada"].map((filter) => (
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
            <article className={`unit-card ${unit.status}`} key={unit.id}>
              <div><strong>{unit.code}</strong><span>Planta {unit.floor}</span></div>
              <b>{unit.progress}%</b>
              <small>{unit.phase}</small>
              <div className="unit-progress"><i style={{ width: `${unit.progress}%` }} /></div>
            </article>
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
          <span className="section-kicker">TRAZABILIDAD DOCUMENTAL</span>
          <h3>Cortes, actualizaciones y fechas de control</h3>
        </div>
        <div className="filter-row compact">
          {["todos", "avance", "hito", "entrega"].map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
              {item === "todos" ? "Todo" : item}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline">
        {visible.map((event) => (
          <article className="timeline-event" key={event.id}>
            <div className={`timeline-marker ${event.type}`} />
            <div className="timeline-date"><strong>{event.date}</strong><span>{event.time}</span></div>
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

function SuppliersView({ suppliers, onAdd }: { suppliers: Supplier[]; onAdd: () => void }) {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Proveedores importados" value={`${suppliers.length}`} detail="No hay catálogo en las fuentes adjuntas" />
        <StatCard eyebrow="Contratos" value="Sin dato" detail="Pendiente de fuente contractual" />
        <StatCard eyebrow="Entregas" value="Sin dato" detail="Pendiente de planificación de suministro" />
        <StatCard eyebrow="Importes" value="Sin dato" detail="No se infiere desde cubicaciones" />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CADENA DE SUMINISTRO</span>
            <h3>Proveedores incorporados al Centro de Control</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Nuevo proveedor</button>
        </div>
        {suppliers.length === 0 ? (
          <div className="empty-state">
            <strong>No se han recibido datos de proveedores.</strong>
            <p>El panel queda preparado para añadir empresas, categorías, contactos, entregas e importes sin inventar registros.</p>
          </div>
        ) : (
          <div className="supplier-grid">
            {suppliers.map((supplier) => (
              <article className="supplier-card" key={supplier.id}>
                <div className="supplier-head">
                  <div className="supplier-logo">{supplier.name.slice(0, 2).toUpperCase()}</div>
                  <div><strong>{supplier.name}</strong><span>{supplier.category}</span></div>
                  <i className={`supplier-status ${supplier.status}`} />
                </div>
                <div className="supplier-details">
                  <span>Contacto<strong>{supplier.contact || "Sin dato"}</strong></span>
                  <span>Próxima entrega<strong>{supplier.nextDelivery || "Sin dato"}</strong></span>
                  <span>Contratado<strong>{supplier.amount || "Sin dato"}</strong></span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricsView({ metrics, onAdd }: { metrics: CustomMetric[]; onAdd: () => void }) {
  return (
    <div className="view-stack">
      <section className="panel metric-library">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">INDICADORES CONFIGURABLES</span>
            <h3>Métricas físicas, temporales y financieras</h3>
          </div>
          <button className="button primary" onClick={onAdd}>Añadir métrica</button>
        </div>
        <p className="section-intro">
          Los importes se mantienen en la moneda original porque el Excel no
          identifica la divisa. No se ha realizado ninguna conversión.
        </p>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.id}>
              <div className="metric-card-head">
                <span>{metric.owner}</span>
                <i className={`trend ${metric.trend}`}>{metric.trend === "up" ? "↗" : metric.trend === "down" ? "↘" : "→"}</i>
              </div>
              <h4>{metric.name}</h4>
              <strong>{metric.value} <small>{metric.unit}</small></strong>
              <div className="metric-target"><span>Referencia {metric.target} {metric.unit}</span></div>
            </article>
          ))}
          <button className="metric-add-card" onClick={onAdd}>
            <span>+</span><strong>Nueva métrica</strong><small>Nombre, unidad, objetivo y responsable</small>
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CUBICACIONES</span>
            <h3>Medición frente a contabilidad</h3>
          </div>
          <span className="data-note">Moneda no indicada en la fuente</span>
        </div>
        <div className="simple-table finance-table">
          <div className="table-row table-head">
            <span>Periodo</span><span>Cubicación</span><span>Contabilidad</span><span>Diferencia</span>
          </div>
          {cubicaciones.map((item) => (
            <div className="table-row" key={item.period}>
              <strong>{item.period}</strong>
              <span>{number.format(item.measured)}</span>
              <span>{number.format(item.accounting)}</span>
              <span>{number.format(item.accounting - item.measured)}</span>
            </div>
          ))}
          <div className="table-row total-row">
            <strong>Total</strong>
            <span>{number.format(projectSnapshot.cubicacionesMeasured)}</span>
            <span>{number.format(projectSnapshot.cubicacionesAccounting)}</span>
            <span>{number.format(projectSnapshot.cubicacionesDifference)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourcesView() {
  return (
    <div className="view-stack">
      <section className="stat-grid wide">
        <StatCard eyebrow="Fuentes integradas" value={`${dataSources.length}`} detail="1 Excel · 1 Microsoft Project" />
        <StatCard eyebrow="Registros MPP" value="2.228" detail="2.195 asignaciones y 22 paquetes" />
        <StatCard eyebrow="Alertas de calidad" value="4" detail="Todas visibles y sin corrección silenciosa" tone="warn" />
        <StatCard eyebrow="Corte declarado" value="30/06/2026" detail="Fecha tomada de los archivos" />
      </section>
      <section className="source-grid">
        {dataSources.map((source) => (
          <article className="panel source-card" key={source.id}>
            <div className="panel-heading">
              <div><span className="section-kicker">{source.kind}</span><h3>{source.file}</h3></div>
              <span className={`source-status ${source.status}`}>{source.status}</span>
            </div>
            <div className="source-meta">
              <span>Corte declarado<strong>{source.declaredCutoff}</strong></span>
              <span>Guardado<strong>{source.savedAt}</strong></span>
              <span>Contenido<strong>{source.records}</strong></span>
            </div>
            <ul className="quality-list">
              {source.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="section-kicker">CRITERIOS DE GOBIERNO DEL DATO</span><h3>Cómo se interpreta este corte</h3></div>
        </div>
        <div className="governance-grid">
          <div><strong>Avance físico</strong><p>Excel es la fuente del 18,23% ejecutado y 21,24% planificado.</p></div>
          <div><strong>Avance de cronograma</strong><p>MPP es la fuente del 17%, fechas, actividades y camino crítico.</p></div>
          <div><strong>Edificios</strong><p>El índice mostrado promedia 32 frentes por edificio; no sustituye una ponderación económica.</p></div>
          <div><strong>Viviendas</strong><p>El porcentaje disponible corresponde sólo a superestructura, no a terminación total.</p></div>
        </div>
      </section>
    </div>
  );
}

function AgentPanel({ expanded, onClose }: { expanded: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Buenos días. Puedo consultar el corte real: avance, desviaciones, 26 edificios, 156 viviendas, paquetes, cubicaciones y calidad de fuentes. ¿Qué necesitas saber?",
      mode: "source-data-engine",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string; mode?: string };
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
        { id: crypto.randomUUID(), role: "assistant", text: "No puedo conectar con los datos ahora. Vuelve a intentarlo en unos segundos." },
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
        <div><strong>ARAYA Copilot</strong><span><i /> Consulta de datos · solo lectura</span></div>
        {!expanded && <button className="close-button" onClick={onClose} aria-label="Cerrar agente">×</button>}
      </div>
      <div className="agent-suggestions">
        {[
          "Resume el corte para Dirección",
          "¿Qué paquete tiene mayor desviación?",
          "¿Qué problemas tienen las fuentes?",
          "¿Cuál es la diferencia de cubicaciones?",
        ].map((suggestion) => (
          <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>
        ))}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <div>{message.text}</div>
            {message.role === "assistant" && (
              <small>{message.mode === "openai-tools" ? "IA + herramientas" : "Motor de datos de fuentes"}</small>
            )}
          </div>
        ))}
        {loading && <div className="message assistant typing">Consultando datos…</div>}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pregunta por cualquier dato del corte…" rows={2} />
        <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar pregunta">↑</button>
      </form>
      <div className="agent-foot">Cada respuesta indica la fuente y el corte usado.</div>
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
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    let saved = false;
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: type, ...payload }),
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
          <div><span className="section-kicker">NUEVO REGISTRO</span><h3>{type === "metric" ? "Añadir métrica" : "Añadir proveedor"}</h3></div>
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
                <label>Unidad<input name="unit" placeholder="%, días, cantidad…" /></label>
                <label>Responsable<input name="owner" placeholder="Producción" /></label>
              </div>
            </>
          ) : (
            <>
              <label>Empresa<input name="name" required placeholder="Nombre del proveedor" /></label>
              <label>Categoría<input name="category" required placeholder="Estructura, instalaciones…" /></label>
              <label>Contacto<input name="contact" placeholder="Nombre y apellidos" /></label>
              <div className="form-grid">
                <label>Próxima entrega<input name="nextDelivery" placeholder="Fecha y hora" /></label>
                <label>Importe contratado<input name="amount" placeholder="Importe y moneda" /></label>
              </div>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
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
        .filter((item) => item.name.toLowerCase().includes(term) || item.shortName === term)
        .map((item) => ({ label: item.name, detail: `${number.format(item.progress)}% índice de frentes`, view: "edificios" as View, building: item })),
      ...supplierRows
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: item.category, view: "proveedores" as View, building: null })),
      ...metrics
        .filter((item) => item.name.toLowerCase().includes(term))
        .map((item) => ({ label: item.name, detail: `${item.value} ${item.unit}`, view: "metricas" as View, building: null })),
    ].slice(0, 8);
  }, [search, supplierRows, metrics]);

  function content() {
    if (view === "resumen") return <Overview onNavigate={setView} onSelectBuilding={setSelectedBuilding} />;
    if (view === "planificacion") return <Planning />;
    if (view === "edificios") return <BuildingsView selected={selectedBuilding} setSelected={setSelectedBuilding} />;
    if (view === "cronologia") return <TimelineView />;
    if (view === "proveedores") return <SuppliersView suppliers={supplierRows} onAdd={() => setModal("supplier")} />;
    if (view === "metricas") return <MetricsView metrics={metrics} onAdd={() => setModal("metric")} />;
    if (view === "fuentes") return <SourcesView />;
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
          <button><b>AR</b><div><strong>ARAYA</strong><small>26 edificios · 156 viviendas</small></div><i>⌄</i></button>
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
              {item.id === "fuentes" && <em>2</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span><i className="live-dot" /> Fuentes integradas</span>
          <small>Último archivo · 14/07/2026 14:39</small>
        </div>
      </aside>

      <main className={`main-area ${agentOpen && view !== "agente" ? "with-agent" : ""}`}>
        <Header view={view} onAsk={() => setAgentOpen(true)} />
        <div className="global-search">
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar edificio, proveedor o métrica…" />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  key={`${result.view}-${result.label}`}
                  onClick={() => {
                    if (result.building) setSelectedBuilding(result.building);
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

      {agentOpen && view !== "agente" && <AgentPanel expanded={false} onClose={() => setAgentOpen(false)} />}

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
