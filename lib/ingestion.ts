import { LiveDataUpdate, LiveDataValue, isLiveDataKey } from "./live-data";
import { buildingCodeFromTaskName, extractProjectXmlUpdates, isProjectXml } from "./project-xml";
import { readXlsxSheets, readZipEntries, rowsToRecords } from "./xlsx-reader";
import { readOfficeTables, readPptxSlideShapes } from "./ooxml-tables";
import { findBuildingProgress, readPdfText } from "./pdf-text";
import {
  PHASE_WEIGHTS,
  buildingProgressFromPhases,
  type PhaseId,
  type PhaseProgress,
} from "./progress-model";

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
  /**
   * Edificios que el propio documento declara como alcance de un avance.
   * La ruta de carga usa esta lista como comprobacion de completitud: una
   * cubicacion no puede quedar como "sincronizada" si nombra TH-76/TH-77 pero
   * no genero ningun dato vivo para ellos.
   */
  expectedBuildingCodes?: string[];
};

export type ArchiveAiDocument = {
  bytes: ArrayBuffer;
  fileName: string;
  extension: string;
  mimeType: string;
};

const archiveAiMime: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
};

/** Documentos narrativos/visuales de un ZIP que deben pasar por lectura IA. */
export async function archiveDocumentsForAI(bytes: ArrayBuffer, maxDocuments = 5): Promise<ArchiveAiDocument[]> {
  const allowed = new Set(Object.keys(archiveAiMime));
  const entries = await readZipEntries(bytes, (name) => {
    const normalized = name.toLowerCase();
    if (normalized.endsWith("/") || normalized.startsWith("__macosx/") || normalized.includes("/.")) return false;
    const extension = normalized.slice(normalized.lastIndexOf(".") + 1);
    return allowed.has(extension);
  }, {
    maxEntries: 200,
    maxSelectedEntries: 20,
    maxEntryUncompressedBytes: 25 * 1024 * 1024,
    maxTotalUncompressedBytes: 50 * 1024 * 1024,
    maxCompressionRatio: 200,
  });
  return entries.slice(0, Math.max(1, Math.min(8, maxDocuments))).map((entry) => {
    const fileName = entry.name.split("/").pop() || entry.name;
    const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    return {
      bytes: entry.data.slice().buffer,
      fileName,
      extension,
      mimeType: archiveAiMime[extension] ?? "application/octet-stream",
    };
  });
}

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
  // El .xlsx se lee celda a celda, sin IA, así que su rótulo ya no puede
  // prometer una lectura "asistida": lo que hay en la celda es lo que entra.
  // El .xls antiguo sí sigue dependiendo de la interpretación.
  if (extension === "xlsx") {
    return { id: "hoja_directa", label: "Hoja de cálculo leída directamente" };
  }
  if (extension === "xls") {
    return { id: "importador_tabular", label: "Importador tabular asistido (.xls antiguo)" };
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
  // De Word y PowerPoint se leen las tablas sin interpretación; su texto
  // corrido sigue pasando por la lectura asistida, porque una frase no es un
  // dato estructurado por bien que se lea.
  if (extension === "docx" || extension === "pptx") {
    return { id: "tablas_directas", label: "Tablas leídas directamente · el texto se interpreta" };
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
  // Finanzas no implica revisión por sí sola: el contrato vivo decide dato a
  // dato. Solo una contradicción, una moneda ambigua o una clave incompatible
  // debe llegar al validador humano.
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

/** Procedencia que acompaña a cada dato leído: de dónde sale y a qué corte. */
type ExtractionDefaults = {
  area: string;
  cutoff: string;
  sourceCurrency: "DOP" | "USD";
  sourceName: string;
};

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

// Cabeceras con las que la obra rotula sus tablas de avance. No se intenta
// adivinar más allá de esta lista: una columna que no esté aquí se ignora, que
// es preferible a interpretar como avance una columna de otra cosa.
const CABECERAS_EDIFICIO = [
  "edificio", "edificios", "edif", "edif.", "ed.", "torre", "bloque", "codigo", "código", "th",
];
const CABECERAS_AVANCE = [
  "% avance", "avance", "avance (%)", "% ejecutado", "ejecutado", "avance real",
  "% real", "progreso", "% completado", "% de avance", "porcentaje de avance",
  "avance fisico", "avance físico", "avance fisico acumulado", "avance físico acumulado",
  "avance fisico ejecutado", "avance físico ejecutado", "avance acumulado", "% avance acumulado",
];

function esCabeceraEdificio(valor: string) {
  const cabecera = normalizarCabecera(valor).replace(/\s+/g, " ");
  return CABECERAS_EDIFICIO.some((candidate) => normalizarCabecera(candidate) === cabecera) ||
    /^(?:n[º°o.]?\s*)?(?:edif(?:icio)?s?|ed\.?|torres?|bloques?|th)\.?$/.test(cabecera);
}

function esCabeceraAvance(valor: string) {
  const cabecera = normalizarCabecera(valor).replace(/\s+/g, " ");
  return CABECERAS_AVANCE.some((candidate) => normalizarCabecera(candidate) === cabecera) ||
    /^(?:%\s*)?(?:porcentaje\s+(?:de\s+)?)?(?:avance|progreso|ejecutado|completado)(?:\s+(?:fisico|real|de obra|ejecutado|acumulado))*\s*(?:\(%\)|%)?$/.test(cabecera);
}

function buildingCodesFromText(
  text: string,
  knownBuildingTokens?: Set<string>,
) {
  const codes = new Set<string>();
  const add = (raw: string) => {
    const token = raw.replace(/^0+(?=\d)/, "");
    if (!token || (knownBuildingTokens && !knownBuildingTokens.has(token))) return;
    codes.add(`TH-${token.padStart(2, "0")}`);
  };
  const normalized = normalizarCabecera(text);
  const pattern = /\b(?:th|edificios?|edif\.?|ed\.?|torres?|bloques?)\s*(?:n[º°o.]?\s*)?[-#:]?\s*(\d{1,3})(?:\s*(?:y|e|&|\/|-)\s*(?:th\s*[-#:]?\s*)?(\d{1,3}))?/g;
  for (const match of normalized.matchAll(pattern)) {
    add(match[1]);
    if (match[2]) add(match[2]);
  }
  return [...codes];
}

function detectedBuildingProgressScope(
  filas: Array<Record<string, string>>,
  knownBuildingTokens?: Set<string>,
) {
  // El alcance se declara en la caratula o el titulo ("Edificios 76 y 77"),
  // no en cualquier aparicion posterior de un codigo. Unir toda la hoja hacia
  // que el inventario historico de apartamentos TH-01...TH-77 se interpretara
  // como alcance de la cubicacion y dejara el expediente falsamente incompleto.
  // Se examinan las primeras filas una a una y solo se acepta una declaracion
  // que nombre de forma conjunta dos o mas edificios.
  const codes = new Set<string>();
  for (const row of filas.slice(0, 40)) {
    const values = Object.values(row).filter((value) => value.trim());
    const candidates = [...values, values.join(" ")];
    for (const candidate of candidates) {
      const normalized = normalizarCabecera(candidate);
      if (!/\b(?:edificios?|edif\.?|ed\.?|torres?|bloques?|th)\b/.test(normalized)) continue;
      const found = buildingCodesFromText(candidate, knownBuildingTokens);
      if (found.length < 2) continue;
      for (const code of found) codes.add(code);
    }
    if (codes.size >= 2) break;
  }
  return [...codes];
}

function numeroDeCelda(valor: string) {
  const limpio = valor.replace(/%/g, "").trim().replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Lee una tabla de avance por edificio de una hoja corriente.
 *
 * Es el caso que de verdad ahorra trabajo: la oficina mantiene su Excel con una
 * columna de edificio y otra de porcentaje, y hasta ahora ese archivo sólo se
 * podía interpretar con IA. Aquí se lee tal cual, y sólo se acepta lo que es
 * inequívoco: la fila tiene que nombrar un edificio reconocible y traer un
 * número entre 0 y 100.
 */
function extractSheetProgress(
  filas: Array<Record<string, string>>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string; knownBuildingTokens?: Set<string> },
): StructuredExtraction | null {
  // Una cubicacion real puede llevar una caratula extensa. Se buscan hasta 100
  // filas con contenido y se conservan las letras de columna del XML; asi
  // funcionan tambien "EDIF." y "Avance fisico acumulado", que antes no
  // coincidían con la lista exacta y dejaban el libro sin datos.
  let headerIndex = -1;
  let columnaEdificio = "";
  let columnaAvance = "";
  for (let index = 0; index < Math.min(filas.length, 100); index += 1) {
    const cells = Object.entries(filas[index]);
    const building = cells.find(([, value]) => esCabeceraEdificio(value));
    const progress = cells.find(([, value]) => esCabeceraAvance(value));
    if (!building || !progress || building[0] === progress[0]) continue;
    headerIndex = index;
    columnaEdificio = building[0];
    columnaAvance = progress[0];
    break;
  }
  if (headerIndex < 0) return null;

  const updates: LiveDataUpdate[] = [];
  const warnings: string[] = [];
  let descartadas = 0;
  for (const registro of filas.slice(headerIndex + 1, headerIndex + 1 + 250)) {
    const etiqueta = registro[columnaEdificio] ?? "";
    const codigo = buildingCodeFromTaskName(etiqueta) ||
      (/^\s*(?:th[\s-]*)?(\d{1,3})\s*$/i.test(etiqueta)
        ? `TH-${etiqueta.replace(/\D/g, "").padStart(2, "0")}`
        : "");
    const valor = numeroDeCelda(registro[columnaAvance] ?? "");
    if (!codigo || valor === null || valor < 0 || valor > 100) {
      if (etiqueta) descartadas += 1;
      continue;
    }
    if (defaults.knownBuildingTokens && !defaults.knownBuildingTokens.has(codigo.replace(/^TH-/i, "").replace(/^0+(?=\d)/, ""))) {
      descartadas += 1;
      continue;
    }
    updates.push({
      key: `buildings.${codigo}.progress`,
      value: valor,
      area: "obra",
      cutoff: defaults.cutoff,
      sourceCurrency: defaults.sourceCurrency,
      sourceName: defaults.sourceName,
    });
  }

  if (!updates.length) return null;
  if (descartadas) warnings.push(`${descartadas} filas no nombran un edificio reconocible y se han dejado fuera.`);
  return {
    updates,
    summary: `${updates.length} edificios actualizados desde la tabla de la hoja de cálculo.`,
    warnings,
    expectedBuildingCodes: updates.map((update) => update.key.split(".")[1]),
  };
}

function normalizarCabecera(valor: string) {
  return valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * A qué fase del panel pertenece una columna de disciplina de la cubicación.
 *
 * El informe mensual mide por oficio (infraestructura, superestructura,
 * albañilería, instalaciones, y un puñado de oficios de acabado); el panel
 * trabaja con cinco fases. Este es el único sitio donde se traduce un oficio a
 * su fase, y devuelve null para lo que no es una disciplina de obra, de modo
 * que una columna de fecha o de estado no se confunde con avance.
 *
 * El orden importa: "infraestructura" contiene "estructura", así que la obra
 * común se comprueba antes que la superestructura.
 */
function faseDeDisciplina(cabecera: string): PhaseId | null {
  const c = normalizarCabecera(cabecera);
  if (!c) return null;
  if (/(infraest|cimentac|fundac|platea|obra comun|\bcomun\b)/.test(c)) return "comun";
  if (/(superestr|estructura|encofrad|hormigon)/.test(c)) return "superestructura";
  if (/(albanil|mamposter)/.test(c)) return "albanileria";
  if (/(instalac|instal\b)/.test(c)) return "instalaciones";
  if (/(acabado|pintura|revest|ceramic|herrer|carpint|ventana|vidrio|aluminio|sanitar|misc|estucad|zocalo|\bpiso|plafon|mampara|panel solar|texturiz|remate)/.test(c)) {
    return "acabados";
  }
  return null;
}

/**
 * Lee una tabla de avance por edificio y por oficio (la matriz de la cubicación
 * mensual): una fila por edificio y una columna por disciplina.
 *
 * Es el formato del Informe Ejecutivo y de la cubicación que la obra emite cada
 * mes, y hasta ahora no se leía solo porque no tiene una única columna de
 * "avance", sino una por oficio. Aquí se traduce cada oficio a su fase, los
 * oficios de acabado se promedian en una sola cifra de acabados, y de las cinco
 * fases sale el avance del edificio con los mismos pesos que usa el panel
 * (lib/progress-model.ts). Así el mismo informe que ya se sube cada mes
 * actualiza las cifras y colores de todos los edificios sin tocar nada a mano.
 */
function extractMatrixProgress(
  filas: Array<Record<string, string>>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string; knownBuildingTokens?: Set<string> },
): StructuredExtraction | null {
  // La cabecera es la primera fila con una columna de edificio y al menos dos
  // columnas que son disciplinas reconocibles. Exigir dos evita que una tabla
  // de fechas ("Edificio | Fin plan | Estado") se tome por una de avance.
  let cabeceraIndice = -1;
  let columnaEdificio = "";
  let disciplinas: Array<{ columna: string; fase: PhaseId }> = [];
  for (let indice = 0; indice < Math.min(filas.length, 100); indice += 1) {
    // Las filas vienen indexadas por columna ("A", "B"…), no por posición: se
    // guarda la clave de cada columna, no un número.
    const celdas = Object.entries(filas[indice]);
    const edificio = celdas.find(([, valor]) => esCabeceraEdificio(valor));
    if (!edificio) continue;
    const cols: Array<{ columna: string; fase: PhaseId }> = [];
    for (const [columna, valor] of celdas) {
      if (columna === edificio[0]) continue;
      const fase = faseDeDisciplina(valor);
      if (fase) cols.push({ columna, fase });
    }
    if (cols.length >= 2) {
      cabeceraIndice = indice;
      columnaEdificio = edificio[0];
      disciplinas = cols;
      break;
    }
  }
  if (cabeceraIndice < 0) return null;

  const updates: LiveDataUpdate[] = [];
  const warnings: string[] = [];
  let descartadas = 0;
  for (const registro of filas.slice(cabeceraIndice + 1, cabeceraIndice + 1 + 250)) {
    const etiqueta = registro[columnaEdificio] ?? "";
    const codigo = buildingCodeFromTaskName(etiqueta) ||
      (/^\s*(?:th[\s-]*)?(\d{1,3})\s*$/i.test(etiqueta)
        ? `TH-${etiqueta.replace(/\D/g, "").padStart(2, "0")}`
        : "");
    if (!codigo) {
      if (etiqueta.trim()) descartadas += 1;
      continue;
    }
    if (defaults.knownBuildingTokens && !defaults.knownBuildingTokens.has(codigo.replace(/^TH-/i, "").replace(/^0+(?=\d)/, ""))) {
      descartadas += 1;
      continue;
    }
    // Los acabados llegan repartidos en varias columnas (pintura, revestimientos,
    // herrería…), así que se agrupan por fase y se promedian dentro de cada una.
    const porFase = new Map<PhaseId, number[]>();
    for (const { columna, fase } of disciplinas) {
      const valor = numeroDeCelda(registro[columna] ?? "");
      if (valor === null || valor < 0 || valor > 100) continue;
      const lista = porFase.get(fase) ?? [];
      lista.push(valor);
      porFase.set(fase, lista);
    }
    const phases: PhaseProgress[] = [];
    for (const definicion of PHASE_WEIGHTS) {
      const valores = porFase.get(definicion.id);
      if (!valores || !valores.length) continue;
      phases.push({
        id: definicion.id,
        name: definicion.name,
        progress: valores.reduce((suma, valor) => suma + valor, 0) / valores.length,
      });
    }
    if (!phases.length) {
      descartadas += 1;
      continue;
    }
    const baseUpdate = {
      area: "obra",
      cutoff: defaults.cutoff,
      sourceCurrency: defaults.sourceCurrency,
      sourceName: defaults.sourceName,
    } as const;
    updates.push({
      key: `buildings.${codigo}.progress`,
      value: buildingProgressFromPhases(phases),
      ...baseUpdate,
    });
    // No se sustituye el array completo: cada fase se publica por su posicion
    // estable. Asi una cubicacion parcial conserva las fases que no midio y el
    // detalle del edificio puede colorearse con la disciplina realmente leida.
    for (const phase of phases) {
      const phaseIndex = PHASE_WEIGHTS.findIndex((definition) => definition.id === phase.id);
      if (phaseIndex < 0) continue;
      updates.push({
        key: `buildings.${codigo}.phases.${phaseIndex}.progress`,
        value: phase.progress,
        ...baseUpdate,
      });
    }
  }

  if (!updates.length) return null;
  if (descartadas) warnings.push(`${descartadas} filas no nombran un edificio reconocible y se han dejado fuera.`);
  const buildingCodes = [...new Set(
    updates.map((update) => update.key.match(/^buildings\.([^.]+)\./)?.[1]).filter(Boolean) as string[],
  )];
  return {
    updates,
    summary: `${buildingCodes.length} edificios y sus fases actualizados desde la tabla de avance por disciplina.`,
    warnings,
    expectedBuildingCodes: buildingCodes,
  };
}

/**
 * Lee la tabla resumen de la hoja CARATULA de una cubicacion contractual.
 *
 * Su forma real es "Capitulo | Monto RD$ | En el periodo | % | Anterior
 * acumulado | % | Actual acumulado | %". El ultimo porcentaje es el avance
 * fisico acumulado que debe colorear cada edificio; no es una tabla ordinaria
 * de "Edificio / Avance" y por eso antes se archivaba sin tocar el plano.
 */
function extractCubicacionCoverProgress(
  filas: Array<Record<string, string>>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string; knownBuildingTokens?: Set<string> },
): StructuredExtraction | null {
  let headerIndex = -1;
  let buildingColumn = "";
  let budgetColumn = "";
  let accumulatedColumn = "";
  let progressColumn = "";

  for (let index = 0; index < Math.min(filas.length, 100); index += 1) {
    const cells = Object.entries(filas[index]);
    const chapterIndex = cells.findIndex(([, value]) => /^(?:capitulo|capítulo)$/.test(normalizarCabecera(value)));
    const accumulatedIndex = cells.findIndex(([, value]) => /^actual\s+acumulado\.?$/.test(normalizarCabecera(value)));
    if (chapterIndex < 0 || accumulatedIndex < 0) continue;
    const percentAfterAccumulated = cells.findIndex(
      ([, value], cellIndex) => cellIndex > accumulatedIndex && /^%|porcentaje$/.test(normalizarCabecera(value)),
    );
    if (percentAfterAccumulated < 0) continue;
    const budgetIndex = cells.findIndex(([, value]) => /^monto\b|presupuesto/.test(normalizarCabecera(value)));
    headerIndex = index;
    buildingColumn = cells[chapterIndex][0];
    accumulatedColumn = cells[accumulatedIndex][0];
    progressColumn = cells[percentAfterAccumulated][0];
    budgetColumn = budgetIndex >= 0 ? cells[budgetIndex][0] : "";
    break;
  }
  if (headerIndex < 0) return null;

  const updates: LiveDataUpdate[] = [];
  const buildingCodes: string[] = [];
  let totalBudget = 0;
  let totalAccumulated = 0;
  let measuredRows = 0;
  let declaredOverall: number | null = null;
  const baseUpdate = {
    area: "obra",
    cutoff: defaults.cutoff,
    sourceCurrency: defaults.sourceCurrency,
    sourceName: defaults.sourceName,
  } as const;

  for (const row of filas.slice(headerIndex + 1, headerIndex + 1 + 100)) {
    const label = row[buildingColumn] ?? "";
    const normalizedLabel = normalizarCabecera(label);
    const code = buildingCodeFromTaskName(label);
    const rawProgress = numeroDeCelda(row[progressColumn] ?? "");
    if (rawProgress === null || rawProgress < 0) continue;
    const progress = rawProgress <= 1 ? rawProgress * 100 : rawProgress;
    if (progress > 100) continue;
    const budget = budgetColumn ? numeroDeCelda(row[budgetColumn] ?? "") : null;
    const accumulated = numeroDeCelda(row[accumulatedColumn] ?? "");
    const hasAmounts = budget !== null && accumulated !== null && budget > 0 && accumulated >= 0;

    // En algunos libros la celda de URBANISMO es una formula externa cuyo
    // texto cacheado no llega al lector, pero siempre es la primera fila
    // economica del resumen, antes del primer edificio. Esa posicion estable
    // permite conservarla sin confundir un subtotal posterior con Urbanismo.
    const isUrbanism = /^urbanismo\b/.test(normalizedLabel) ||
      (!buildingCodes.length && !code && hasAmounts);
    if (!code && !isUrbanism) {
      // La fila TOTAL viene inmediatamente despues del ultimo edificio y deja
      // vacio Capitulo. Su porcentaje declarado incluye Urbanismo y evita que
      // una formula de texto ausente lo saque del ponderado.
      if (buildingCodes.length >= 2 && !label.trim() && hasAmounts && declaredOverall === null) {
        declaredOverall = progress;
      }
      continue;
    }
    if (code && defaults.knownBuildingTokens && !defaults.knownBuildingTokens.has(
      code.replace(/^TH-/i, "").replace(/^0+(?=\d)/, ""),
    )) continue;

    if (code) {
      updates.push({ key: `buildings.${code}.progress`, value: progress, ...baseUpdate });
      buildingCodes.push(code);
    } else {
      updates.push({ key: "urbanismAreas.0.progress", value: progress, ...baseUpdate });
    }

    if (hasAmounts) {
      totalBudget += budget;
      totalAccumulated += accumulated;
      measuredRows += 1;
    }
  }
  if (!buildingCodes.length) return null;

  // El total fisico es el acumulado ponderado por el presupuesto de cada
  // capitulo (urbanismo + edificios), la misma formula de la fila TOTAL del
  // libro. Nunca se promedian porcentajes simples entre edificios.
  const overallProgress = declaredOverall ??
    (measuredRows > 0 && totalBudget > 0 ? (totalAccumulated / totalBudget) * 100 : null);
  if (overallProgress !== null) {
    updates.push({
      key: "projectSnapshot.overallProgress",
      value: Math.round(overallProgress * 100) / 100,
      ...baseUpdate,
    });
  }

  return {
    updates,
    summary: `${buildingCodes.length} edificios, urbanismo y avance fisico total actualizados desde la caratula de la cubicacion.`,
    warnings: [],
    expectedBuildingCodes: [...new Set(buildingCodes)],
  };
}

/**
 * Lee una cifra de avance que pertenece al alcance completo de una
 * cubicacion, por ejemplo "Edificios 76 y 77" + "Avance fisico ejecutado
 * 4,25 %". Solo se usa cuando no existe una tabla individual por edificio y la
 * etiqueta del porcentaje es inequivoca; una cantidad o un total economico no
 * puede entrar por esta via.
 */
function extractScopedBuildingProgress(
  filas: Array<Record<string, string>>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string; knownBuildingTokens?: Set<string> },
): StructuredExtraction | null {
  const codes = detectedBuildingProgressScope(filas, defaults.knownBuildingTokens);
  if (!codes.length) return null;

  let progress: number | null = null;
  for (let rowIndex = 0; rowIndex < filas.length && progress === null; rowIndex += 1) {
    const values = Object.values(filas[rowIndex]);
    for (let cellIndex = 0; cellIndex < values.length; cellIndex += 1) {
      const label = values[cellIndex];
      const normalized = normalizarCabecera(label);
      if (!/\bavance\s+(?:fisico|real|de obra|ejecutado|acumulado)|\bporcentaje\s+de\s+avance|%\s*avance/.test(normalized)) {
        continue;
      }

      const inline = label.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
      if (inline) {
        progress = numeroDeCelda(inline[1]);
        break;
      }

      const candidates = [
        ...values.slice(cellIndex + 1),
        ...Object.values(filas[rowIndex + 1] ?? {}),
      ];
      for (const candidate of candidates) {
        const parsed = numeroDeCelda(candidate);
        if (parsed === null || parsed < 0) continue;
        // Si la etiqueta declara porcentaje, Excel guarda con frecuencia 22%
        // como 0,22. Fuera de una etiqueta porcentual no se aplica esta regla.
        const value = parsed > 0 && parsed <= 1 && /%|porcentaje/.test(normalized)
          ? parsed * 100
          : parsed;
        if (value <= 100) {
          progress = Math.round(value * 100) / 100;
          break;
        }
      }
    }
  }
  if (progress === null || progress < 0 || progress > 100) return null;

  return {
    updates: codes.map((code) => ({
      key: `buildings.${code}.progress`,
      value: progress,
      area: "obra",
      cutoff: defaults.cutoff,
      sourceCurrency: defaults.sourceCurrency,
      sourceName: defaults.sourceName,
    })),
    summary: `${codes.length} edificios actualizados desde el avance fisico explicito de la cubicacion.`,
    warnings: [],
    expectedBuildingCodes: codes,
  };
}

// La línea temporal del flujo reprogramado, en el mismo orden que
// reprogrammedFlowMonths (app/reprogrammed-flow-data.ts). El flujo se actualiza
// por índice de esa lista, así que este orden es el contrato: cada etiqueta de
// mes del Excel se traduce a su posición aquí. Es una línea fija del proyecto.
const FLOW_MONTH_ORDER = [
  "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26", "jul-26",
  "ago-26", "sep-26", "oct-26", "nov-26", "dic-26", "ene-27", "feb-27", "mar-27",
  "abr-27", "may-27", "jun-27", "jul-27",
];

/** "Dic-25", "Jul-26"… → "dic-25", "jul-26"; devuelve "" si no es un mes. */
function mesDeFlujo(valor: string): string {
  const limpio = normalizarCabecera(valor).replace(/\s+/g, "");
  return FLOW_MONTH_ORDER.includes(limpio) ? limpio : "";
}

/** Importe con separadores de miles y coma o punto decimal → número. */
function importeDeCelda(valor: string): number | null {
  const limpio = valor.replace(/[^\d,.\-]/g, "");
  if (!limpio) return null;
  // Se quita el separador de miles y se deja el punto decimal.
  const normalizado = limpio.includes(",") && limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio.replace(/,/g, "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Lee la tabla de flujo mensual del Excel de finanzas (hoja "Comparación
 * Mensual") y actualiza el flujo reprogramado del panel mes a mes.
 *
 * Es la parte que cambia de verdad cada mes: cuando un mes cierra, su importe
 * real entra. Se reconoce por una columna de mes y columnas de "real" de
 * Urbanismo, Edificios y Total; cada fila se traduce a su posición en la línea
 * temporal del flujo (FLOW_MONTH_ORDER) y se publican los importes de ese mes.
 * No toca los totales por ámbito ni la auditoría, que se revisan aparte.
 */
function extractReprogrammedFlowUpdates(
  hojas: Array<Array<Record<string, string>>>,
  defaults: { area: string; cutoff: string; sourceCurrency: "DOP" | "USD"; sourceName: string },
): StructuredExtraction | null {
  for (const filas of hojas) {
    let cabeceraIndice = -1;
    let colMes = "";
    let colTotalReal = "";
    let colUrbReal = "";
    let colEdiReal = "";
    let colTotalPresup = "";
    for (let indice = 0; indice < Math.min(filas.length, 15); indice += 1) {
      const celdas = Object.entries(filas[indice]);
      const mes = celdas.find(([, v]) => normalizarCabecera(v) === "mes");
      if (!mes) continue;
      const busca = (pred: (c: string) => boolean) => celdas.find(([, v]) => pred(normalizarCabecera(v)))?.[0] ?? "";
      colTotalReal = busca((c) => c.includes("total") && c.includes("real"));
      colUrbReal = busca((c) => c.includes("urb") && c.includes("real"));
      colEdiReal = busca((c) => c.includes("edi") && c.includes("real"));
      colTotalPresup = busca((c) => c.includes("total") && (c.includes("presup") || c.includes("presupuest")));
      if (colTotalReal && colUrbReal && colEdiReal) {
        cabeceraIndice = indice;
        colMes = mes[0];
        break;
      }
    }
    if (cabeceraIndice < 0) continue;

    const updates: LiveDataUpdate[] = [];
    let meses = 0;
    for (const registro of filas.slice(cabeceraIndice + 1, cabeceraIndice + 1 + 30)) {
      const mes = mesDeFlujo(registro[colMes] ?? "");
      if (!mes) continue;
      const indice = FLOW_MONTH_ORDER.indexOf(mes);
      const totalReal = importeDeCelda(registro[colTotalReal] ?? "");
      const urbReal = importeDeCelda(registro[colUrbReal] ?? "");
      const ediReal = importeDeCelda(registro[colEdiReal] ?? "");
      // Un mes sin su real total no se toca: mejor no mover nada que publicar a medias.
      if (totalReal === null || urbReal === null || ediReal === null) continue;
      const totalPresup = colTotalPresup ? importeDeCelda(registro[colTotalPresup] ?? "") : null;
      const base = {
        area: defaults.area,
        cutoff: defaults.cutoff,
        sourceCurrency: defaults.sourceCurrency,
        sourceName: defaults.sourceName,
      };
      updates.push({ key: `reprogrammedFlowMonths.${indice}.status`, value: "actual", ...base });
      updates.push({ key: `reprogrammedFlowMonths.${indice}.currentDop`, value: totalReal, ...base });
      updates.push({ key: `reprogrammedFlowMonths.${indice}.urbanismDop`, value: urbReal, ...base });
      updates.push({ key: `reprogrammedFlowMonths.${indice}.buildingsDop`, value: ediReal, ...base });
      if (totalPresup !== null) {
        updates.push({ key: `reprogrammedFlowMonths.${indice}.originalDop`, value: totalPresup, ...base });
        updates.push({ key: `reprogrammedFlowMonths.${indice}.varianceDop`, value: Math.round((totalPresup - totalReal) * 100) / 100, ...base });
      }
      meses += 1;
    }

    if (!meses) return null;
    return {
      updates,
      summary: `${meses} meses del flujo reprogramado actualizados desde el Excel de finanzas.`,
      warnings: [],
    };
  }
  return null;
}

// Indicadores y hallazgos de seguridad del informe de obra.
//
// Esta lámina nunca actualizó nada, y no por falta de datos: de un PowerPoint
// sólo se leían las tablas, y aquí no hay ninguna. Cada indicador son tres
// cuadros de texto seguidos —el número, su etiqueta y el matiz—, que es una
// estructura tan buena como una fila de tabla en cuanto se lee agrupada por
// forma. El resultado es que Seguridad y Salud se quedaba congelada mes tras
// mes mientras el informe traía el dato delante.
//
// Se emiten las listas completas (no índice a índice) para que un mes con
// menos hallazgos que el anterior no arrastre los que ya no aplican.
function esNumeroDeIndicador(texto: string) {
  return /^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s*%?$/.test(texto.trim());
}

function esEtiquetaDeIndicador(texto: string) {
  const limpio = texto.trim();
  if (limpio.length < 4 || limpio.length > 70) return false;
  if (esNumeroDeIndicador(limpio)) return false;
  // El pie de página lleva el nombre del fideicomiso y va justo antes del
  // número de diapositiva: sin esto, ese número se colaría como indicador.
  return !/fideicomiso|punta cana/i.test(limpio);
}

export function extractSafetyUpdates(
  laminas: string[][][],
  defaults: ExtractionDefaults,
): LiveDataUpdate[] {
  // El área y el corte tienen que ir en cada dato: la publicación automática
  // exige que coincidan con los del documento, y un dato sin área se queda
  // esperando revisión manual para siempre sin que nada lo explique.
  const marca = {
    area: defaults.area,
    cutoff: defaults.cutoff,
    sourceCurrency: defaults.sourceCurrency,
    sourceName: defaults.sourceName,
  };
  const updates: LiveDataUpdate[] = [];

  for (const formas of laminas) {
    const textoLamina = formas.map((forma) => forma.join(" ")).join(" ");

    if (/segurid/i.test(textoLamina) && /salud/i.test(textoLamina)) {
      const metricas: Array<{ label: string; value: string; detail: string }> = [];
      for (let indice = 0; indice < formas.length && metricas.length < 12; indice += 1) {
        const valor = formas[indice];
        const etiqueta = formas[indice + 1];
        if (valor?.length !== 1 || !esNumeroDeIndicador(valor[0])) continue;
        if (etiqueta?.length !== 1 || !esEtiquetaDeIndicador(etiqueta[0])) continue;
        const posibleDetalle = formas[indice + 2];
        const detalle = posibleDetalle?.length === 1 &&
          !esNumeroDeIndicador(posibleDetalle[0]) &&
          posibleDetalle[0].length <= 80
          ? posibleDetalle[0].trim()
          : "";
        metricas.push({ label: etiqueta[0].trim(), value: valor[0].trim(), detail: detalle });
        indice += detalle ? 2 : 1;
      }
      // Tres indicadores es el mínimo para descartar una coincidencia suelta:
      // la lámina real trae cinco o más.
      if (metricas.length >= 3) {
        updates.push({ key: "safetyMetrics", value: metricas, ...marca });
      }
    }

    for (let indice = 0; indice < formas.length; indice += 1) {
      if (!/actos\s+y\s+condiciones\s+inseguras/i.test(formas[indice].join(" "))) continue;
      const lista = formas[indice + 1];
      if (!lista || lista.length < 2) continue;
      updates.push({
        key: "safetyFindings",
        value: lista.map((linea) => linea.trim()).filter(Boolean).slice(0, 20),
        ...marca,
      });
      break;
    }
  }

  return updates;
}

// Compromisos del contrato de préstamo con IFC.
//
// La matriz de obligaciones estaba escrita a mano en el código: el informe de
// análisis se podía abrir desde el panel, pero cambiarlo no cambiaba nada de lo
// que se veía. Ahora se lee del propio informe.
//
// El PDF titula sus secciones dibujando cada letra por separado ("C o m p r o
// m i s o s"), que es cómo coloca los glifos, y dentro de cada una lista los
// compromisos como "Nombre: qué obliga a hacer". Ambas cosas son reconocibles
// sin interpretar nada.
const IFC_SECCIONES_IGNORADAS = /^(?:introducci|resumen|conclusi)/i;

function esProsa(texto: string) {
  const legibles = texto.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ,.;:%()¿?¡!'"-]/g)?.length ?? 0;
  return texto.length > 0 && legibles / texto.length > 0.92;
}

// Sólo conectores que rara vez terminan una palabra española. "a", "la", "el" y
// "en" quedan fuera a propósito: partían "Favorecida" en "Favorecid a" y
// "Escuela" en "Escue la".
const IFC_CONECTORES = ["del", "de", "las", "los", "por", "para", "con", "y"];

/**
 * Rehace las palabras de un título dibujado letra a letra.
 *
 * El PDF coloca cada glifo por separado y el hueco entre palabras es del mismo
 * carácter que el hueco entre letras, así que al recuperar el texto la
 * separación se pierde: "RequisitosdeInformación". Las mayúsculas marcan dónde
 * empieza cada palabra salvo en los conectores, que van en minúscula y quedan
 * pegados a la anterior; por eso se separan aparte.
 */
function rehacerTitulo(letras: string[]) {
  const junto = letras.join("");
  const trozos = junto.split(/(?=[A-ZÁÉÍÓÚÑ])/).filter(Boolean);
  const palabras: string[] = [];
  for (const trozo of trozos) {
    const conector = IFC_CONECTORES.find((candidato) =>
      trozo.length > candidato.length + 3 && trozo.toLowerCase().endsWith(candidato));
    if (conector) {
      palabras.push(trozo.slice(0, trozo.length - conector.length), conector);
    } else {
      palabras.push(trozo);
    }
  }
  return palabras.join(" ").replace(/\s+/g, " ").trim();
}

// Palabras que sí siguen legítimamente a una "A" suelta, para no pegarlas.
const IFC_TRAS_A_SUELTA = /^(?:partir|trav[eé]s|pesar|fin|favor|cambio|cargo|medida|nivel|efectos|corto|largo|mediano|continuaci[oó]n|prop[oó]sito)$/i;

/**
 * Une la primera letra cuando el PDF la separa por ajuste de espaciado.
 *
 * El documento dibuja "T ransacciones" y "A viso": la primera letra va en su
 * propia orden de dibujo para afinar el hueco, y al recuperar el texto queda
 * suelta. Sólo se corrige al principio de un compromiso, y no cuando la letra
 * es una "A" que de verdad funciona como preposición.
 */
function unirLetraSuelta(texto: string) {
  return texto.replace(/^([A-ZÁÉÍÓÚÑ]) ([a-záéíóúñ]{2,})/, (completo, letra: string, resto: string) =>
    letra === "A" && IFC_TRAS_A_SUELTA.test(resto) ? completo : `${letra}${resto}`);
}

export function extractIfcCommitments(texto: string, defaults: ExtractionDefaults): LiveDataUpdate[] {
  const plano = texto.replace(/\s+/g, " ");
  if (!/IFC/.test(plano)) return [];

  // Un título es una tirada larga de piezas de una sola letra. Se busca por
  // piezas y no por caracteres: buscando por caracteres, la tirada se comía la
  // primera letra del párrafo siguiente ("Compromisos Afirmativos E" dejaba
  // "xistencia" fuera del primer compromiso).
  const piezas = plano.split(" ");
  const secciones: Array<{ title: string; desde: number; hasta: number }> = [];
  let indice = 0;
  while (indice < piezas.length) {
    if ([...piezas[indice]].length !== 1 || !/\p{L}/u.test(piezas[indice])) {
      indice += 1;
      continue;
    }
    let fin = indice;
    while (fin < piezas.length && [...piezas[fin]].length === 1 && /\p{L}/u.test(piezas[fin])) fin += 1;
    if (fin - indice >= 6) {
      secciones.push({ title: rehacerTitulo(piezas.slice(indice, fin)), desde: fin, hasta: piezas.length });
    }
    indice = fin;
  }
  if (secciones.length < 2) return [];
  secciones.forEach((seccion, posicion) => {
    const siguiente = secciones[posicion + 1];
    if (siguiente) seccion.hasta = siguiente.desde - [...siguiente.title.replace(/ /g, "")].length;
  });

  const grupos: Array<{ title: string; items: string[] }> = [];
  for (const seccion of secciones) {
    if (IFC_SECCIONES_IGNORADAS.test(seccion.title)) continue;
    const cuerpo = piezas.slice(seccion.desde, seccion.hasta).join(" ").trim();
    if (!cuerpo) continue;

    // Forma preferida: "Nombre del compromiso: qué obliga a hacer."
    const etiquetados = [...cuerpo.matchAll(/([A-ZÁÉÍÓÚÑ][^:.]{2,70}):\s*([^:]*?\.)(?=\s+[A-ZÁÉÍÓÚÑ]|\s*$)/g)]
      .map((item) => `${unirLetraSuelta(item[1].trim())}: ${item[2].trim()}`);
    const items = (etiquetados.length >= 2
      ? etiquetados
      : (cuerpo.match(/[^.]+\./g) ?? []).map((frase) => unirLetraSuelta(frase.trim())))
      .filter((item) => item.length >= 20 && item.length <= 300 && esProsa(item))
      .slice(0, 15);

    if (items.length) grupos.push({ title: seccion.title, items });
  }

  // Con un solo grupo no hay matriz que valga: casi seguro se ha reconocido
  // algo que no era un título.
  if (grupos.length < 2) return [];
  return [{
    key: "ifcComplianceGroups",
    value: grupos.slice(0, 10),
    area: defaults.area,
    cutoff: defaults.cutoff,
    sourceCurrency: defaults.sourceCurrency,
    sourceName: defaults.sourceName,
  }];
}

// Informe de ventas mensual.
//
// Es un PowerPoint de prosa —"de los 172 clientes, 106 al día, 42 pendientes y
// 24 vencidos"—, no una tabla ni cuadros de indicadores, así que la IA leía los
// titulares (cobranza, contratos) pero se dejaba el detalle (mix de producto,
// reservas por fase) y esos gráficos no se movían. El informe llega con las
// mismas frases cada mes, y sobre esas frases fijas se puede leer de forma
// determinista: entonces la IA ya no hace falta para ventas y todo se actualiza.
function numeroVentas(texto: string | undefined): number | null {
  if (!texto) return null;
  // Quita espacios dentro del número ("64,810 .00") y separadores de millar.
  const limpio = texto.replace(/\s+/g, "").replace(/,/g, "");
  const valor = Number.parseFloat(limpio);
  return Number.isFinite(valor) ? valor : null;
}

function decimalVentas(texto: string | undefined): number | null {
  if (!texto) return null;
  const limpio = texto.replace(/\s+/g, "");
  // En esta lámina los ritmos son decimales de una cifra ("4,9" o "4.9").
  // No se reutiliza numeroVentas porque allí la coma representa millares en
  // importes como "64,810.00".
  if (/^\d+,\d{1,2}$/.test(limpio)) return Number.parseFloat(limpio.replace(",", "."));
  const valor = Number.parseFloat(limpio.replace(/,/g, ""));
  return Number.isFinite(valor) ? valor : null;
}

function primerNumero(texto: string, patron: RegExp): number | null {
  return numeroVentas(texto.match(patron)?.[1]);
}

export function extractSalesReport(textoLaminas: string, defaults: ExtractionDefaults): LiveDataUpdate[] {
  const t = textoLaminas.replace(/\s+/g, " ");
  // Guarda: sólo actúa sobre el informe de ventas, no sobre cualquier PPTX.
  if (!/informe de ventas/i.test(t) && !/estatus de cobranza/i.test(t)) return [];

  const marca = {
    area: defaults.area,
    cutoff: defaults.cutoff,
    sourceCurrency: defaults.sourceCurrency,
    sourceName: defaults.sourceName,
  };
  const updates: LiveDataUpdate[] = [];
  const anota = (key: string, valor: number | string | null) => {
    if (valor !== null && valor !== "") updates.push({ key, value: valor, ...marca });
  };

  // Reservas y fases.
  anota("juneReport.sales.reservations", primerNumero(t, /(\d+)\s+Reservadas/i));
  anota("juneReport.sales.averageMonthly", primerNumero(t, /Reservadas\s+([\d.,]+)\s+por\s+Mes/i));
  const activas = t.match(/(\d+)\s+Activas\s+([\d.,]+)\s+por\s+Mes/i);
  anota("juneReport.sales.active", numeroVentas(activas?.[1]));
  anota("juneReport.sales.activeAverageMonthly", numeroVentas(activas?.[2]));
  const faseUno = t.match(/(\d+)\s+Activas\s*-\s*(\d+)%\s+Fase\s+I\b/i);
  anota("juneReport.sales.phaseOneActive", numeroVentas(faseUno?.[1]));
  anota("juneReport.sales.phaseOneSales", numeroVentas(faseUno?.[2]));
  anota("juneReport.sales.phaseTwoActive", primerNumero(t, /(\d+)\s+Activas\s*-\s*\d+%\s+Fase\s+II/i));
  anota("juneReport.sales.withdrawn", primerNumero(t, /(\d+)\s+Desistidas\s*[–-]/i));

  // Ritmo mensual por modelo. La lámina usa cuatro nombres fijos y separa el
  // modelo con un guion del valor ("Balcony – 6.3 Unidades / Mes"). Se guarda
  // dentro del informe comercial para que el panel y las siguientes cargas
  // compartan exactamente el mismo contrato vivo.
  for (const model of ["Balcony", "Garden", "Sunset", "Flex"] as const) {
    const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = t.match(new RegExp(`${escaped}\\s*[–—-]\\s*([\\d.,]+)\\s*Unidades?\\s*\\/?\\s*Mes`, "i"));
    anota(
      `juneReport.sales.reservationsByModel.${model}`,
      decimalVentas(match?.[1]),
    );
  }

  // Depuración y vinculación (pipeline de contratos).
  anota("juneReport.contracts.reviewed", primerNumero(t, /(\d+)\s+Unidades\s+Depuradas/i));
  anota("juneReport.contracts.pendingReview", primerNumero(t, /(\d+)\s+Unidades\s+por\s+Depurar/i));
  anota("juneReport.contracts.linked", primerNumero(t, /(\d+)\s+unidades\s+vinculadas/i));
  anota("juneReport.contracts.linking", primerNumero(t, /(\d+)\s+en\s+proceso\s+de\s+vinculaci/i));
  anota("juneReport.contracts.signing", primerNumero(t, /(\d+)\s+en\s+proceso\s+de\s+firma/i));
  anota("juneReport.contracts.inReview", primerNumero(t, /(\d+)\s+cliente[s]?\s+en\s+proceso\s+de\s+depuraci/i));
  anota("juneReport.contracts.awaitingDocuments", primerNumero(t, /(\d+)\s+clientes\s+a\s+la\s+espera\s+de\s+documentos/i));

  // Cobranza.
  anota("juneReport.collections.contracts", primerNumero(t, /De\s+los\s+(\d+)\s+clientes\s+con\s+contratos/i));
  anota("juneReport.collections.current", primerNumero(t, /(\d+)\s+clientes\s+al\s+d[ií]a/i));
  anota("juneReport.collections.installmentsPending", primerNumero(t, /(\d+)\s+clientes\s+con\s+cuotas\s+pendientes/i));
  anota("juneReport.collections.overdue", primerNumero(t, /(\d+)\s+clientes\s+con\s+cuotas\s+vencidas/i));
  anota("juneReport.collections.overdueUsd", primerNumero(t, /Monto\s+Total\s+Vencido\s+US\$?\s*([\d.,\s]+?)\s+Estatus/i));
  const corte = t.match(/con\s+contratos\s+al\s+(\d{2}\/\d{2})\s*\/?\s*(\d{4})/i);
  if (corte) anota("juneReport.collections.cutoff", `${corte[1]}/${corte[2]}`);
  // Dos indicadores que el informe declara con una frase, no en una tabla: el
  // techo de morosidad ("la morosidad no supera el 1%") y el recaudo logrado
  // frente a lo proyectado ("recaudo de más del 92% de lo proyectado"). Antes se
  // quedaban como "propuesta de sección nueva" sin llegar al panel.
  anota("juneReport.collections.arrearsMaxPercent", primerNumero(t, /morosidad\s+no\s+supera\s+el\s+([\d.,]+)\s*%/i));
  anota("juneReport.collections.collectedVsProjectedPercent", primerNumero(t, /recaudo\s+(?:de\s+)?m[aá]s\s+del\s+([\d.,]+)\s*%\s+de\s+lo\s+proyectado/i));

  // Mix de producto: sólo el valor (reservas activas por modelo), por nombre;
  // el resolver lo traduce a posición y no toca los demás campos.
  const mix = t.match(/\((\d+)\s+Garden,\s*(\d+)\s+Sunset\s+y\s+(\d+)\s+Balcony/i);
  if (mix) {
    anota("salesModels.Garden.value", numeroVentas(mix[1]));
    anota("salesModels.Sunset.value", numeroVentas(mix[2]));
    anota("salesModels.Balcony Flex.value", numeroVentas(mix[3]));
  }

  // Metas de recaudación por fase (la sección que ya se modeló).
  const metaUno = t.match(/FASE\s+I\s+US\s*\$?\s*(\d+)\s*\.?\s*(\d+)?\s*M/i);
  const metaDos = t.match(/FASE\s+II\s+US\s*\$?\s*(\d+)\s*\.?\s*(\d+)?\s*M/i);
  const millones = (m: RegExpMatchArray | null) =>
    m ? Math.round((Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0)) * 1_000_000) : null;
  if (metaUno || metaDos) {
    anota("collectionTargets.Fase I.targetUsd", millones(metaUno));
    anota("collectionTargets.Fase II.targetUsd", millones(metaDos));
  }

  return updates;
}

function resumenDeSeguridad(updates: LiveDataUpdate[]) {
  const partes: string[] = [];
  const metricas = updates.find((update) => update.key === "safetyMetrics");
  const hallazgos = updates.find((update) => update.key === "safetyFindings");
  if (Array.isArray(metricas?.value)) partes.push(`${metricas.value.length} indicadores de seguridad`);
  if (Array.isArray(hallazgos?.value)) partes.push(`${hallazgos.value.length} hallazgos de campo`);
  return `${partes.join(" y ")} leídos del informe de obra.`;
}

export async function extractStructuredUpdates(
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
): Promise<StructuredExtraction> {
  if (!["csv", "json", "xml", "xlsx", "docx", "pptx", "zip", "pdf"].includes(extension)) {
    return {
      updates: [],
      summary: "El original está catalogado. Falta ejecutar el importador específico del formato.",
      warnings: [],
    };
  }
  // Un PDF no guarda tablas: guarda instrucciones de dibujo, así que su
  // estructura no se puede reconstruir con garantías. Lo que sí se puede es
  // recuperar el texto y buscar en él parejas inequívocas de edificio y
  // porcentaje. Si no aparece ninguna, el documento sigue su camino hacia la
  // lectura con IA, que es la herramienta adecuada para el texto corrido.
  if (extension === "pdf") {
    let lectura;
    try {
      lectura = await readPdfText(bytes);
    } catch {
      return { updates: [], summary: "El PDF no se pudo abrir para leer su texto.", warnings: [] };
    }

    if (lectura.scanned) {
      return {
        updates: [],
        summary: "El PDF es un escaneo: no contiene texto, sino la imagen de un documento.",
        warnings: ["Se interpretará con lectura asistida, que es lo que sirve para una imagen."],
      };
    }

    const compromisos = extractIfcCommitments(lectura.text, defaults);
    const filas = findBuildingProgress(lectura.text, defaults.knownBuildingTokens);
    if (!filas.length) {
      if (compromisos.length) {
        const grupos = compromisos[0].value;
        return {
          updates: compromisos,
          summary: `Matriz de obligaciones IFC actualizada (${Array.isArray(grupos) ? grupos.length : 0} bloques).`,
          warnings: [],
        };
      }
      return {
        updates: [],
        summary: lectura.text
          ? "Se leyó el texto del PDF, sin avances por edificio reconocibles."
          : "No se pudo extraer texto de este PDF.",
        warnings: [],
      };
    }

    return {
      updates: [
        ...filas.map((fila) => ({
          key: `buildings.${fila.code}.progress`,
          value: fila.value,
          area: defaults.area,
          cutoff: defaults.cutoff,
          sourceCurrency: defaults.sourceCurrency,
          sourceName: defaults.sourceName,
        })),
        ...compromisos,
      ],
      summary: `${filas.length} edificios actualizados desde el texto del PDF.`,
      warnings: [],
    };
  }

  // Un ZIP se abre y se procesa lo que lleve dentro. Es habitual que el corte
  // mensual llegue como carpeta comprimida con varios archivos, y hasta ahora
  // el conjunto se archivaba entero sin mirarlo.
  //
  // Se recorren por orden de fiabilidad —primero lo que se lee sin
  // interpretación— y se devuelve el primero que aporte datos. Se procesa uno y
  // no todos a propósito: dos archivos del mismo ZIP pueden contradecirse, y
  // publicar los dos dejaría el resultado a merced del orden de compresión.
  if (extension === "zip") {
    const PRIORIDAD = ["csv", "json", "xml", "xlsx", "docx", "pptx"];
    let entradas;
    try {
      entradas = await readZipEntries(bytes, (name) => {
        const limpio = name.toLowerCase();
        // Se ignoran las carpetas y los restos que mete macOS al comprimir.
        if (limpio.endsWith("/") || limpio.startsWith("__macosx/") || limpio.includes("/.")) return false;
        return PRIORIDAD.some((ext) => limpio.endsWith(`.${ext}`));
      }, {
        maxEntries: 200,
        maxSelectedEntries: 40,
        maxEntryUncompressedBytes: 25 * 1024 * 1024,
        maxTotalUncompressedBytes: 50 * 1024 * 1024,
        maxCompressionRatio: 200,
      });
    } catch {
      return {
        updates: [],
        summary: "El archivo comprimido no se pudo abrir.",
        warnings: ["Comprueba que es un .zip y que no está dañado ni protegido con contraseña."],
      };
    }

    if (!entradas.length) {
      return {
        updates: [],
        summary: "El comprimido no contiene ningún archivo que se pueda leer.",
        warnings: [`Dentro se buscan ${PRIORIDAD.join(", ")}. Los demás se conservan, pero sus datos no entran.`],
      };
    }

    const ordenadas = [...entradas].sort((izquierda, derecha) => {
      const posicion = (nombre: string) =>
        PRIORIDAD.findIndex((ext) => nombre.toLowerCase().endsWith(`.${ext}`));
      return posicion(izquierda.name) - posicion(derecha.name);
    });

    const avisos: string[] = [];
    for (const entrada of ordenadas) {
      const interna = entrada.name.slice(entrada.name.lastIndexOf(".") + 1).toLowerCase();
      const copia = entrada.data.slice().buffer;
      const resultado = await extractStructuredUpdates(copia, interna, {
        ...defaults,
        sourceName: `${defaults.sourceName} › ${entrada.name}`,
      });
      if (resultado.updates.length) {
        return {
          updates: resultado.updates,
          summary: `${resultado.summary} (desde ${entrada.name}, dentro del comprimido)`,
          warnings: resultado.warnings,
        };
      }
      if (resultado.warnings.length) avisos.push(`${entrada.name}: ${resultado.warnings[0]}`);
    }

    return {
      updates: [],
      summary: `Se abrieron ${entradas.length} archivos del comprimido, sin datos aplicables.`,
      warnings: avisos.slice(0, 3),
    };
  }

  // Word y PowerPoint comparten envoltorio con Excel: un ZIP con XML. De ellos
  // se leen sólo las TABLAS, que es donde hay estructura de verdad; el texto
  // corrido de un informe sigue necesitando interpretación, porque "el edificio
  // 14 va por el 60%" no es un dato estructurado por bien que se lea.
  if (extension === "docx" || extension === "pptx") {
    // Los indicadores de seguridad viven en cuadros de texto, no en tablas, así
    // que se leen aparte y se suman a lo que encuentren las tablas: un mismo
    // informe trae la cubicación en tabla y la seguridad en cuadros, y antes
    // sólo podía aplicarse una de las dos cosas.
    let seguridad: LiveDataUpdate[] = [];
    let ventas: LiveDataUpdate[] = [];
    if (extension === "pptx") {
      try {
        const laminas = await readPptxSlideShapes(bytes);
        seguridad = extractSafetyUpdates(laminas, defaults);
        // El informe de ventas es prosa: se lee del texto de todas las láminas
        // con patrones anclados a sus frases fijas.
        const texto = laminas.map((formas) => formas.map((forma) => forma.join(" ")).join(" ")).join(" ");
        ventas = extractSalesReport(texto, defaults);
      } catch {
        // Sin formas legibles se sigue con las tablas.
      }
    }
    const noTabulares = [...seguridad, ...ventas];
    let tablas;
    try {
      tablas = await readOfficeTables(bytes, extension);
    } catch {
      return {
        updates: noTabulares,
        summary: noTabulares.length
          ? "No se pudieron leer las tablas, pero sí el texto (seguridad o ventas)."
          : "El documento no se pudo abrir.",
        warnings: [`Comprueba que el archivo es un .${extension} moderno y no una versión antigua.`],
      };
    }
    if (!tablas.length) {
      if (noTabulares.length) {
        return {
          updates: noTabulares,
          summary: resumenDeSeguridad(noTabulares),
          warnings: [],
        };
      }
      return {
        updates: [],
        summary: "El documento no contiene ninguna tabla.",
        warnings: ["Sólo se leen las tablas; el texto corrido se interpreta aparte."],
      };
    }
    for (const filas of tablas) {
      const porClave = rowsToRecords(filas, ["clave", "key", "campo"]);
      if (porClave.records.length) {
        const warnings: string[] = [];
        const updates: LiveDataUpdate[] = [];
        for (const registro of porClave.records.slice(0, 250)) {
          const normalizado = normalizeUpdate(registro, defaults);
          if (normalizado.warning) warnings.push(normalizado.warning);
          if (normalizado.update) updates.push(normalizado.update);
        }
        if (updates.length) {
          return {
            updates: [...updates, ...noTabulares],
            summary: `${updates.length} datos leídos de una tabla del documento` +
              (noTabulares.length ? `, más ${resumenDeSeguridad(noTabulares)}` : "") + ".",
            warnings,
          };
        }
      }
      const tabla = extractSheetProgress(filas, defaults);
      if (tabla) return tabla;
      // La cubicación mensual llega como matriz (un edificio por fila, un oficio
      // por columna): el Informe Ejecutivo la trae así. Es el formato que se
      // subía cada mes sin que actualizara nada.
      const matriz = extractMatrixProgress(filas, defaults);
      if (matriz) return matriz;
    }
    if (noTabulares.length) {
      return {
        updates: noTabulares,
        summary: resumenDeSeguridad(noTabulares),
        warnings: [],
      };
    }
    return {
      updates: [],
      summary: `Se leyeron ${tablas.length} tablas, pero ninguna tiene una forma reconocible.`,
      warnings: [
        "Se esperan columnas de clave y valor, una tabla de edificio y avance, o la matriz de avance por oficio de la cubicación.",
      ],
    };
  }

  // Una hoja de cálculo se lee celda a celda, sin IA de por medio. Es lo que
  // permite subir el Excel tal y como lo trabaja la oficina —sin convertirlo a
  // CSV ni a XML— y que lo escrito en la celda sea exactamente lo que se
  // publica. Se admiten dos formas, porque son las dos que llegan de verdad:
  // la plantilla de clave y valor, y la tabla de avance con sus cabeceras.
  if (extension === "xlsx") {
    let hojas;
    try {
      hojas = await readXlsxSheets(bytes);
    } catch {
      return {
        updates: [],
        summary: "La hoja de cálculo no se pudo abrir.",
        warnings: ["Comprueba que el archivo es un .xlsx (Excel moderno) y no un .xls antiguo."],
      };
    }

    // Se recorren TODAS las hojas y se unen sus datos. Una cubicación real
    // separa carátula, relación ejecutada y avance por edificios; devolver la
    // primera coincidencia dejaba sin leer justo las hojas posteriores.
    const results: StructuredExtraction[] = [];
    const expectedBuildingCodes = new Set<string>();
    for (const filas of hojas) {
      for (const code of detectedBuildingProgressScope(filas, defaults.knownBuildingTokens)) {
        expectedBuildingCodes.add(code);
      }
      const porClave = rowsToRecords(filas, ["clave", "key", "campo"]);
      if (porClave.records.length) {
        const warnings: string[] = [];
        const updates: LiveDataUpdate[] = [];
        for (const registro of porClave.records.slice(0, 250)) {
          const normalizado = normalizeUpdate(registro, defaults);
          if (normalizado.warning) warnings.push(normalizado.warning);
          if (normalizado.update) updates.push(normalizado.update);
        }
        if (updates.length) {
          results.push({
            updates,
            summary: `${updates.length} datos leídos directamente de la hoja de cálculo.`,
            warnings,
          });
          continue;
        }
      }

      const caratula = extractCubicacionCoverProgress(filas, defaults);
      if (caratula) {
        results.push(caratula);
        for (const code of caratula.expectedBuildingCodes ?? []) expectedBuildingCodes.add(code);
        continue;
      }

      const tabla = extractSheetProgress(filas, defaults);
      if (tabla) {
        results.push(tabla);
        for (const code of tabla.expectedBuildingCodes ?? []) expectedBuildingCodes.add(code);
        continue;
      }

      // Una hoja con la matriz de la cubicación (edificio por fila, oficio por
      // columna) también se lee sola.
      const matriz = extractMatrixProgress(filas, defaults);
      if (matriz) {
        results.push(matriz);
        for (const code of matriz.expectedBuildingCodes ?? []) expectedBuildingCodes.add(code);
        continue;
      }

      const scoped = extractScopedBuildingProgress(filas, defaults);
      if (scoped) {
        results.push(scoped);
        for (const code of scoped.expectedBuildingCodes ?? []) expectedBuildingCodes.add(code);
      }
    }

    // El Excel de finanzas: su flujo mensual actualiza el flujo reprogramado del
    // panel. Se prueba sobre el libro entero porque la tabla suele ir en una
    // hoja posterior a los detalles.
    const flujo = extractReprogrammedFlowUpdates(hojas, defaults);
    if (flujo) results.push(flujo);

    if (results.length) {
      // La primera lectura fiable de una clave manda; las hojas de resumen
      // suelen repetir el mismo dato que el detalle y no deben publicarlo dos
      // veces ni convertir el orden de hojas en una fuente de contradicciones.
      const byKey = new Map<string, LiveDataUpdate>();
      for (const result of results) {
        for (const update of result.updates) {
          if (!byKey.has(update.key)) byKey.set(update.key, update);
        }
      }
      return {
        updates: [...byKey.values()],
        summary: results.map((result) => result.summary).filter(Boolean).join(" "),
        warnings: [...new Set(results.flatMap((result) => result.warnings))],
        expectedBuildingCodes: [...expectedBuildingCodes],
      };
    }

    return {
      updates: [],
      summary: "No se reconoció ninguna tabla de datos en la hoja.",
      warnings: [
        "Se esperan columnas de clave y valor, una tabla de edificio y avance, la matriz de avance por oficio, o el flujo mensual de finanzas.",
      ],
      expectedBuildingCodes: [...expectedBuildingCodes],
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
    const plan = extractProjectXmlUpdates(text, defaults.knownBuildingTokens, defaults.sourceName);
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
