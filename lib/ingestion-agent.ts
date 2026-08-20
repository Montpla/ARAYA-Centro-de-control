import "server-only";

import type { LiveDataUpdate } from "./live-data";

export const INGESTION_AGENT_PROMPT_VERSION = "araya-ingestion-agent-2026-08-20-v1";
export const INGESTION_AGENT_SCHEMA_VERSION = "live-v1";

export type DocumentTemplateHint = {
  id: string;
  fingerprint: string;
  namePattern: string;
  extension: string;
  area: string;
  documentType: string;
  mappingJson: string;
  visualizationJson: string;
  promptVersion: string;
  successCount: number;
  confidence: number;
};

export type IngestionAgentTrace = {
  name: string;
  ok: boolean;
  iteration: number;
  durationMs: number;
  summary: string;
};

export type DynamicVisualization = "kpi" | "bars" | "line" | "table" | "list";

export type DynamicSectionConfig = {
  visualization: DynamicVisualization;
  unit: string;
  series: Array<{ label: string; value: number }>;
};

export type IngestionValidation = {
  safe: boolean;
  issues: string[];
  checkedKeys: number;
  percentageKeys: number;
  conflictingKeys: string[];
};

function canonicalText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Stable family name for monthly/weekly document variants.
 *
 * Numbers and common Spanish/English month names are intentionally replaced:
 * Cubicación 8 (julio 2026) and Cubicación 9 (agosto 2026) should retrieve the
 * same proven mapping, while the extension, area and document type still keep
 * unrelated files apart.
 */
export function documentTemplateNamePattern(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return canonicalText(withoutExtension)
    .replace(/\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/g, "{mes}")
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/g, "{mes}")
    .replace(/\b\d{1,4}\b/g, "{n}")
    .replace(/[^a-z0-9{}]+/g, "-")
    .replace(/(?:-\{n\}){2,}/g, "-{n}")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "documento";
}

export async function documentTemplateFingerprint(input: {
  fileName: string;
  extension: string;
  area: string;
  documentType: string;
}) {
  const namePattern = documentTemplateNamePattern(input.fileName);
  const material = [
    input.extension.trim().toLowerCase(),
    input.area.trim().toLowerCase(),
    input.documentType.trim().toLowerCase(),
    namePattern,
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { fingerprint, namePattern };
}

export function templateMappingFromUpdates(updates: Array<{
  key: string;
  area?: string;
  sourceCurrency?: string;
  valueType?: string;
}>) {
  const seen = new Set<string>();
  return updates.flatMap((update) => {
    if (!update.key || seen.has(update.key)) return [];
    seen.add(update.key);
    return [{
      key: update.key,
      area: update.area ?? "",
      sourceCurrency: update.sourceCurrency ?? "",
      valueType: update.valueType ?? "",
    }];
  });
}

function numberFromDisplay(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s/g, "").replace(/%$/, "");
  if (!compact) return null;
  const decimalComma = /^-?\d{1,3}(?:\.\d{3})*,\d+$/.test(compact);
  const normalized = decimalComma
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueRows(value: unknown): Array<{ label: string; raw: unknown }> {
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const row = item as Record<string, unknown>;
        const label = row.label ?? row.name ?? row.month ?? row.date ?? row.period ?? `Dato ${index + 1}`;
        const raw = row.value ?? row.amount ?? row.progress ?? row.actual ?? row.total ?? item;
        return { label: String(label), raw };
      }
      return { label: `Dato ${index + 1}`, raw: item };
    });
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 80)
      .map(([label, raw]) => ({ label, raw }));
  }
  return [{ label: "Valor", raw: value }];
}

export function deriveDynamicSectionConfig(valueJson: string): DynamicSectionConfig {
  let value: unknown = null;
  try {
    value = JSON.parse(valueJson) as unknown;
  } catch {
    return { visualization: "list", unit: "", series: [] };
  }
  const rows = valueRows(value);
  const numeric = rows.flatMap((row) => {
    const parsed = numberFromDisplay(row.raw);
    return parsed === null ? [] : [{ label: row.label.slice(0, 120), value: parsed }];
  });
  const stringified = JSON.stringify(value);
  const unit = /%/.test(stringified)
    ? "%"
    : /(?:US\$|USD|d[oó]lar)/i.test(stringified)
      ? "USD"
      : /(?:RD\$|DOP|peso)/i.test(stringified)
        ? "DOP"
        : "";
  if (numeric.length === 1 && rows.length === 1) {
    return { visualization: "kpi", unit, series: numeric };
  }
  if (numeric.length >= 2 && numeric.length === rows.length) {
    const looksChronological = rows.every((row) =>
      /(?:\b20\d{2}\b|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|week|semana)/i.test(row.label));
    return {
      visualization: looksChronological ? "line" : "bars",
      unit,
      series: numeric,
    };
  }
  if (Array.isArray(value) && value.some((item) => item && typeof item === "object")) {
    return { visualization: "table", unit, series: numeric };
  }
  return { visualization: "list", unit, series: numeric };
}

function percentageKey(key: string) {
  return /(?:percent|percentage|progress|porcentaje|avance|completion|occupancy|monthlyPlan\.(?:planned|actual))/i.test(key);
}

/** Independent deterministic guardrail run after model extraction. */
export function reconcileIngestionUpdates(updates: Array<Pick<LiveDataUpdate, "key" | "value">>): IngestionValidation {
  const issues: string[] = [];
  const conflictingKeys = new Set<string>();
  const values = new Map<string, string>();
  let percentageKeys = 0;

  for (const update of updates) {
    const serialized = JSON.stringify(update.value);
    const previous = values.get(update.key);
    if (previous !== undefined && previous !== serialized) {
      conflictingKeys.add(update.key);
    } else {
      values.set(update.key, serialized);
    }
    if (percentageKey(update.key)) {
      percentageKeys += 1;
      if (typeof update.value === "number" && (
        !Number.isFinite(update.value) || update.value < 0 || update.value > 100
      )) issues.push(`${update.key}: porcentaje fuera de 0-100.`);
    }
  }

  const keys = [...values.keys()].sort();
  for (let index = 0; index < keys.length; index += 1) {
    for (let nested = index + 1; nested < keys.length; nested += 1) {
      if (keys[nested].startsWith(`${keys[index]}.`)) {
        conflictingKeys.add(keys[index]);
        conflictingKeys.add(keys[nested]);
      }
    }
  }
  if (conflictingKeys.size) {
    issues.push(`Hay rutas duplicadas o solapadas: ${[...conflictingKeys].slice(0, 12).join(", ")}.`);
  }
  return {
    safe: issues.length === 0,
    issues,
    checkedKeys: updates.length,
    percentageKeys,
    conflictingKeys: [...conflictingKeys],
  };
}

export function safeTemplateMapping(mappingJson: string) {
  try {
    const parsed = JSON.parse(mappingJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 250).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      return typeof row.key === "string" ? [{
        key: row.key.slice(0, 300),
        area: typeof row.area === "string" ? row.area.slice(0, 80) : "",
        valueType: typeof row.valueType === "string" ? row.valueType.slice(0, 40) : "",
      }] : [];
    });
  } catch {
    return [];
  }
}
