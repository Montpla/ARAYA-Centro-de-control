import { LiveDataUpdate, LiveDataValue, isLiveDataKey } from "./live-data";
import { buildingCodeFromTaskName, extractProjectXmlUpdates, isProjectXml } from "./project-xml";
import { readXlsxSheets, readZipEntries, rowsToRecords } from "./xlsx-reader";
import { readOfficeTables } from "./ooxml-tables";
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

// Cabeceras con las que la obra rotula sus tablas de avance. No se intenta
// adivinar más allá de esta lista: una columna que no esté aquí se ignora, que
// es preferible a interpretar como avance una columna de otra cosa.
const CABECERAS_EDIFICIO = ["edificio", "edificios", "torre", "bloque", "codigo", "código"];
const CABECERAS_AVANCE = [
  "% avance", "avance", "avance (%)", "% ejecutado", "ejecutado", "avance real",
  "% real", "progreso", "% completado",
];

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
  const { records } = rowsToRecords(filas, [...CABECERAS_EDIFICIO, ...CABECERAS_AVANCE]);
  if (!records.length) return null;

  const columnas = Object.keys(records[0] ?? {});
  const columnaEdificio = columnas.find((columna) => CABECERAS_EDIFICIO.includes(columna));
  const columnaAvance = columnas.find((columna) => CABECERAS_AVANCE.includes(columna));
  if (!columnaEdificio || !columnaAvance) return null;

  const updates: LiveDataUpdate[] = [];
  const warnings: string[] = [];
  let descartadas = 0;
  for (const registro of records.slice(0, 250)) {
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
      area: defaults.area,
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
  for (let indice = 0; indice < Math.min(filas.length, 15); indice += 1) {
    // Las filas vienen indexadas por columna ("A", "B"…), no por posición: se
    // guarda la clave de cada columna, no un número.
    const celdas = Object.entries(filas[indice]);
    const edificio = celdas.find(([, valor]) => CABECERAS_EDIFICIO.includes(normalizarCabecera(valor)));
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
    updates.push({
      key: `buildings.${codigo}.progress`,
      value: buildingProgressFromPhases(phases),
      area: defaults.area,
      cutoff: defaults.cutoff,
      sourceCurrency: defaults.sourceCurrency,
      sourceName: defaults.sourceName,
    });
  }

  if (!updates.length) return null;
  if (descartadas) warnings.push(`${descartadas} filas no nombran un edificio reconocible y se han dejado fuera.`);
  return {
    updates,
    summary: `${updates.length} edificios actualizados desde la tabla de avance por disciplina.`,
    warnings,
  };
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

    const filas = findBuildingProgress(lectura.text, defaults.knownBuildingTokens);
    if (!filas.length) {
      return {
        updates: [],
        summary: lectura.text
          ? "Se leyó el texto del PDF, sin avances por edificio reconocibles."
          : "No se pudo extraer texto de este PDF.",
        warnings: [],
      };
    }

    return {
      updates: filas.map((fila) => ({
        key: `buildings.${fila.code}.progress`,
        value: fila.value,
        area: defaults.area,
        cutoff: defaults.cutoff,
        sourceCurrency: defaults.sourceCurrency,
        sourceName: defaults.sourceName,
      })),
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
    let tablas;
    try {
      tablas = await readOfficeTables(bytes, extension);
    } catch {
      return {
        updates: [],
        summary: "El documento no se pudo abrir.",
        warnings: [`Comprueba que el archivo es un .${extension} moderno y no una versión antigua.`],
      };
    }
    if (!tablas.length) {
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
            updates,
            summary: `${updates.length} datos leídos de una tabla del documento.`,
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

    // Se recorren todas las hojas del libro: el dato que actualiza el panel no
    // siempre está en la primera (un flujo de finanzas suele traer el detalle
    // por categoría delante y el resumen o la matriz detrás). Se devuelve la
    // primera hoja que aporte datos, por orden de fiabilidad dentro de cada una.
    for (const filas of hojas) {
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
            updates,
            summary: `${updates.length} datos leídos directamente de la hoja de cálculo.`,
            warnings,
          };
        }
      }

      const tabla = extractSheetProgress(filas, defaults);
      if (tabla) return tabla;

      // Una hoja con la matriz de la cubicación (edificio por fila, oficio por
      // columna) también se lee sola.
      const matriz = extractMatrixProgress(filas, defaults);
      if (matriz) return matriz;
    }

    return {
      updates: [],
      summary: "No se reconoció ninguna tabla de datos en la hoja.",
      warnings: [
        "Se esperan columnas de clave y valor, una tabla de edificio y avance, o la matriz de avance por oficio de la cubicación.",
      ],
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
