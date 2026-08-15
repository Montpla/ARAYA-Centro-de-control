import { LiveDataUpdate, LiveDataValue, isLiveDataKey } from "./live-data";
import { extractProjectXmlUpdates, isProjectXml } from "./project-xml";

export type DocumentAnalysis = {
  documentType: string;
  documentTypeLabel: string;
  detectedPeriod: string;
  extractionMode: string;
  extractionModeLabel: string;
  confidence: number;
  reviewReasons: string[];
  summary: string;
};

type StructuredExtraction = {
  updates: LiveDataUpdate[];
  summary: string;
  warnings: string[];
};

const monthNumbers: Record<string, string> = {
  ene: "01",
  enero: "01",
  feb: "02",
  febrero: "02",
  mar: "03",
  marzo: "03",
  abr: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  jun: "06",
  junio: "06",
  jul: "07",
  julio: "07",
  ago: "08",
  agosto: "08",
  sep: "09",
  sept: "09",
  septiembre: "09",
  oct: "10",
  octubre: "10",
  nov: "11",
  noviembre: "11",
  dic: "12",
  diciembre: "12",
};

const documentRules = [
  {
    id: "estado_financiero",
    label: "Estado financiero",
    keywords: ["balance", "estado de resultados", "comprobacion", "fideicomiso", "flujo", "financiero", "finanzas"],
  },
  {
    id: "avance_obra",
    label: "Avance de obra",
    keywords: ["avance", "obra", "cubicacion", "produccion", "superestructura", "albanileria", "hormigon"],
  },
  {
    id: "cronograma",
    label: "Cronograma y planificación",
    keywords: ["cronograma", "planificacion", "programacion", "mpp", "project", "linea base", "curva s"],
  },
  {
    id: "ventas_cobranza",
    label: "Ventas y cobranza",
    keywords: ["venta", "reserva", "cliente", "cobranza", "morosidad", "desistimiento", "contrato"],
  },
  {
    id: "proveedores_compras",
    label: "Proveedores y compras",
    keywords: ["proveedor", "compra", "cotizacion", "comparativo", "suministro", "pedido", "orden de compra"],
  },
  {
    id: "plano_diseno",
    label: "Plano y diseño",
    keywords: ["plano", "implantacion", "dwg", "autocad", "arquitectura", "diseno", "render"],
  },
  {
    id: "urbanismo",
    label: "Urbanismo",
    keywords: ["urbanismo", "vial", "paisajismo", "jardineria", "infraestructura", "alcantarillado", "aparcamiento"],
  },
  {
    id: "seguridad_permisos",
    label: "Seguridad y permisos",
    keywords: ["seguridad", "accidente", "inspeccion", "incidente", "permiso", "licencia", "confotur", "mived"],
  },
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectPeriod(value: string, declaredCutoff: string) {
  if (declaredCutoff.trim()) return declaredCutoff.trim().slice(0, 40);
  const normalized = normalize(value);
  const isoDate = normalized.match(/(?:^|\D)(20\d{2})[./_-](0?[1-9]|1[0-2])[./_-]([0-2]?\d|3[01])(?:\D|$)/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }
  const fullDate = normalized.match(/(?:^|\D)(\d{1,2})[./_-](\d{1,2})[./_-](20\d{2})(?:\D|$)/);
  if (fullDate) {
    return `${fullDate[3]}-${fullDate[2].padStart(2, "0")}-${fullDate[1].padStart(2, "0")}`;
  }
  const isoMonth = normalized.match(/(?:^|\D)(20\d{2})[./_-](0?[1-9]|1[0-2])(?:\D|$)/);
  if (isoMonth) return `${isoMonth[1]}-${isoMonth[2].padStart(2, "0")}`;
  const monthYear = normalized.match(
    /\b(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|sept|sep|octubre|oct|noviembre|nov|diciembre|dic)[\s._/-]*(20\d{2}|\d{2})\b/,
  );
  if (monthYear) {
    const year = monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2];
    return `${year}-${monthNumbers[monthYear[1]]}`;
  }
  return "";
}

function extractionMode(extension: string) {
  if (extension === "csv" || extension === "json") {
    return { id: "estructurada_automatica", label: "Extracción estructurada automática" };
  }
  // El XML de Project se lee entero y sin interpretación, igual que un CSV.
  if (extension === "xml") {
    return { id: "plan_project", label: "Plan de Microsoft Project (XML)" };
  }
  if (extension === "xls" || extension === "xlsx") {
    return { id: "importador_tabular", label: "Importador tabular asistido" };
  }
  // .mpp, .dwg y .zip se archivan tal cual: ninguna de sus cifras llega al
  // panel. El rótulo anterior ("Importación especializada") daba a entender lo
  // contrario y costó meses de informes de Project subidos con la expectativa
  // razonable de que actualizaran la implantación. El nombre dice ahora lo que
  // el sistema hace de verdad.
  if (extension === "mpp") {
    return { id: "solo_archivo", label: "Solo archivo · guárdalo como XML para que se lea" };
  }
  if (extension === "dwg" || extension === "zip") {
    return { id: "solo_archivo", label: "Solo archivo (sus datos no actualizan el panel)" };
  }
  if (["jpg", "jpeg", "png"].includes(extension)) {
    return { id: "evidencia_visual", label: "Lectura de evidencia visual" };
  }
  return { id: "asistida", label: "Extracción documental asistida" };
}

export function analyzeDocument(input: {
  fileName: string;
  description?: string;
  extension: string;
  declaredCutoff?: string;
  area: string;
  classificationConfidence: number;
}) {
  const haystack = normalize(`${input.fileName} ${input.description ?? ""}`);
  const scored = documentRules
    .map((rule) => ({
      ...rule,
      matches: rule.keywords.filter((keyword) => haystack.includes(keyword)).length,
    }))
    .sort((a, b) => b.matches - a.matches);
  const best = scored[0];
  const fallbackType =
    input.extension === "dwg" ? { id: "plano_diseno", label: "Plano y diseño" } :
      ["jpg", "jpeg", "png"].includes(input.extension) ? { id: "evidencia_fotografica", label: "Evidencia fotográfica" } :
        input.extension === "mpp" ? { id: "cronograma", label: "Cronograma y planificación" } :
          { id: "documento_general", label: "Documento general" };
  const selected = best && best.matches > 0 ? best : fallbackType;
  const detectedPeriod = detectPeriod(`${input.fileName} ${input.description ?? ""}`, input.declaredCutoff ?? "");
  const mode = extractionMode(input.extension);
  const reviewReasons: string[] = [];
  if (input.classificationConfidence < 0.75) reviewReasons.push("El área sugerida necesita confirmación.");
  if (!detectedPeriod) reviewReasons.push("No se ha identificado un periodo o fecha de corte.");
  if (input.area === "finanzas") reviewReasons.push("Las cifras financieras requieren aprobación humana.");
  if (["avance_obra", "cronograma", "urbanismo"].includes(selected.id)) {
    reviewReasons.push("Puede modificar indicadores operativos, cronograma o geometría del proyecto.");
  }
  if (mode.id !== "estructurada_automatica") {
    reviewReasons.push("El formato necesita un importador o una lectura asistida antes de publicar datos.");
  }
  const confidence = Math.min(
    0.98,
    Math.max(0.35, (best?.matches ?? 0) > 0 ? 0.68 + Math.min(0.24, ((best?.matches ?? 1) - 1) * 0.08) : 0.48),
  );
  return {
    documentType: selected.id,
    documentTypeLabel: selected.label,
    detectedPeriod,
    extractionMode: mode.id,
    extractionModeLabel: mode.label,
    confidence,
    reviewReasons,
    summary: `${selected.label} · ${mode.label}${detectedPeriod ? ` · periodo ${detectedPeriod}` : " · periodo pendiente"}.`,
  } satisfies DocumentAnalysis;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\"") {
      if (quoted && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseValue(raw: unknown): LiveDataValue {
  if (typeof raw !== "string") return raw as LiveDataValue;
  const value = raw.trim();
  if (!value) return "";
  try {
    return JSON.parse(value) as LiveDataValue;
  } catch {
    if (/^-?\d+(?:[.,]\d+)?$/.test(value)) return Number(value.replace(",", "."));
    if (/^(si|sí|true)$/i.test(value)) return true;
    if (/^(no|false)$/i.test(value)) return false;
    return value;
  }
}

function normalizeUpdate(
  candidate: Record<string, unknown>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string },
) {
  const key = String(candidate.key ?? candidate.clave ?? candidate.campo ?? "").trim();
  if (!isLiveDataKey(key)) return { warning: `La clave ${key || "(vacía)"} no pertenece al modelo vivo de ARAYA.` };
  const rawValue = candidate.value ?? candidate.valor ?? candidate.dato;
  if (rawValue === undefined) return { warning: `La clave ${key} no contiene un valor.` };
  // Una celda en blanco significa "este dato no lo toco", nunca "ponlo a
  // vacío". Sin esto, subir una plantilla con tres filas rellenas publicaba
  // cadenas vacías en todas las demás y borraba los avances reales: en un CSV
  // la celda vacía llega como "" y no como undefined, así que no la frenaba el
  // control de arriba. Para publicar una cadena vacía a propósito hay que
  // escribir "" de forma explícita, que JSON.parse sí distingue.
  if (typeof rawValue === "string" && !rawValue.trim()) return {};
  return {
    update: {
      key,
      value: parseValue(rawValue),
      area: String(candidate.area ?? defaults.area).slice(0, 80),
      cutoff: String(candidate.cutoff ?? candidate.corte ?? defaults.cutoff).slice(0, 40),
      sourceCurrency: String(candidate.sourceCurrency ?? candidate.moneda ?? defaults.sourceCurrency).toUpperCase() === "USD" ? "USD" as const : "DOP" as const,
      sourceName: defaults.sourceName,
    } satisfies LiveDataUpdate,
  };
}

export function extractStructuredUpdates(
  bytes: ArrayBuffer,
  extension: string,
  defaults: {
    area: string;
    cutoff: string;
    sourceCurrency: "DOP" | "USD";
    sourceName: string;
    // Los edificios que existen ahora mismo, para no dar de alta uno inventado
    // a partir de una tarea mal rotulada del plan.
    knownBuildingTokens?: Set<string>;
  },
): StructuredExtraction {
  if (extension !== "csv" && extension !== "json" && extension !== "xml") {
    return {
      updates: [],
      summary: "El original está catalogado. Falta ejecutar el importador específico del formato.",
      warnings: [],
    };
  }
  const text = new TextDecoder("utf-8").decode(bytes);

  // El XML de Project entra por su propio lector: no son pares clave/valor sino
  // un plan de obra entero, del que se derivan los avances por edificio. Es la
  // via para los cortes mensuales que antes llegaban en .mpp y se archivaban
  // sin leer, porque ese formato binario no se puede abrir sin un conversor de
  // pago.
  if (extension === "xml") {
    if (!isProjectXml(text)) {
      return {
        updates: [],
        summary: "El XML no es un plan de Microsoft Project.",
        warnings: ["Sólo se interpretan los XML guardados desde Project con Archivo → Guardar como → XML."],
      };
    }
    const plan = extractProjectXmlUpdates(text, defaults.knownBuildingTokens);
    return {
      updates: plan.updates.map((update) => ({
        key: update.key,
        value: update.value,
        area: defaults.area,
        cutoff: defaults.cutoff,
        sourceCurrency: defaults.sourceCurrency,
        sourceName: defaults.sourceName,
      })),
      summary: plan.summary,
      warnings: plan.warnings,
    };
  }

  let candidates: Record<string, unknown>[] = [];
  try {
    if (extension === "json") {
      const payload = JSON.parse(text) as unknown;
      const raw = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { updates?: unknown[] }).updates)
          ? (payload as { updates: unknown[] }).updates
          : [];
      candidates = raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    } else {
      const rows = parseCsv(text);
      const headers = (rows.shift() ?? []).map(normalize);
      candidates = rows.map((values) =>
        Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
      );
    }
  } catch {
    return {
      updates: [],
      summary: "El archivo estructurado no se pudo interpretar de forma segura.",
      warnings: ["Comprueba que el CSV o JSON tenga las columnas key/clave y value/valor."],
    };
  }
  const warnings: string[] = [];
  const updates: LiveDataUpdate[] = [];
  candidates.slice(0, 250).forEach((candidate) => {
    const normalized = normalizeUpdate(candidate, defaults);
    if (normalized.warning) warnings.push(normalized.warning);
    if (normalized.update) updates.push(normalized.update);
  });
  return {
    updates,
    summary: updates.length
      ? `${updates.length} cambios estructurados extraídos y preparados para contraste.`
      : "No se encontraron cambios compatibles con el contrato vivo.",
    warnings,
  };
}
