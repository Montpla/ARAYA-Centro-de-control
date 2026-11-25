import type { ProvenanceEntry } from "./data-freshness";

// Texto que dice con qué reporte de Seguridad trabaja el panel. La oficina lo
// pidió: al subir un reporte necesita saber si es el que manda o si el panel
// sigue con otro (por ejemplo, porque el que subió es de una semana anterior
// o es el mismo archivo que ya estaba registrado).

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function isoDay(value?: string) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? { year: match[1], month: Number(match[2]), day: match[3] } : null;
}

export function describeSafetySource(entry?: ProvenanceEntry) {
  const sourceName = String(entry?.sourceName ?? "").trim();
  const cutoff = isoDay(entry?.cutoff);
  const updated = isoDay(entry?.updatedAt);
  const cutoffLabel = cutoff ? `${cutoff.day}/${String(cutoff.month).padStart(2, "0")}/${cutoff.year}` : "";
  const periodLabel = cutoff ? `${MONTHS[cutoff.month - 1]} ${cutoff.year}` : "";
  const updatedLabel = updated ? `${updated.day}/${String(updated.month).padStart(2, "0")}/${updated.year}` : "";
  const sentence = sourceName
    ? `Indicadores del reporte «${sourceName}»${cutoffLabel ? `, corte ${cutoffLabel}` : ""}${updatedLabel ? `, publicado el ${updatedLabel}` : ""}. Un reporte de una semana anterior o el mismo archivo subido otra vez no cambian estas cifras.`
    : "Todavía no se ha publicado ningún reporte semanal de Seguridad.";
  return { sourceName, cutoffLabel, periodLabel, updatedLabel, sentence };
}
