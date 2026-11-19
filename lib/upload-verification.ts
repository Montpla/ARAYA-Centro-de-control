// Comprobación de una carga recién procesada: ¿entró bien en el Centro de
// Control o hay algo que revisar? La lanza GitHub Actions
// (.github/workflows/verificar-carga.yml) en cuanto se sube un archivo, para
// que nadie tenga que estar mirando el panel para saber si la carga salió bien.
//
// Es una función pura: recibe lo que ya está en la base de datos y devuelve el
// veredicto. Nunca incluye importes: sólo nombres de clave, motivos y
// porcentajes de avance.

export type VerificationSeverity = "ok" | "aviso" | "anomalia";
export type VerificationVerdict = "pendiente" | "ok" | "aviso" | "anomalia";

export type VerificationCheck = {
  id: string;
  severity: VerificationSeverity;
  detail: string;
};

export type VerificationInput = {
  file: {
    originalName: string;
    extension: string;
    processingStage: string;
    status: string;
    reviewStatus: string;
    requiresReview: boolean;
    lastProcessingError: string;
    detectedPeriod: string;
    derivedFromFileId: string;
    supersededByFileId: string;
    deletedAt: string;
    publicationRevision: number | null;
    createdAt: string;
  };
  run: { status: string; proposedCount: number; publishedCount: number; error: string } | null;
  // Mensajes de las entradas "datos_descartados" de file_activity, con el
  // formato "N por <motivo>: clave, clave · N por <motivo>: …".
  discardMessages: string[];
  pendingProposals: number;
  // Claves de avance (porcentajes) que esta carga dejó más bajas que el valor
  // anterior publicado por otro archivo.
  regressions: Array<{ key: string; before: number; after: number; beforeSource?: string }>;
  now?: Date;
};

export type VerificationResult = {
  verdict: VerificationVerdict;
  checks: VerificationCheck[];
  summary: string;
};

// Motivos de descarte que son el comportamiento correcto, no una pérdida: un
// documento más antiguo no debe pisar el dato vigente.
const BENIGN_DISCARD_REASONS = ["su corte es anterior al ya publicado"];

// Etapas en las que la carga aún se está procesando.
const IN_PROGRESS_STAGES = new Set(["recibido", "extraccion_en_curso", "en_cola", "procesando"]);

// Un descenso menor que esto es redondeo, no un retroceso.
const REGRESSION_TOLERANCE_POINTS = 1;
// Un descenso mayor que esto casi nunca es una corrección: suele ser un dato
// leído con otra base o de otra columna.
const REGRESSION_ANOMALY_POINTS = 15;

export function parseDiscardMessage(message: string) {
  return message.split(" · ").map((part) => {
    const match = part.match(/^(\d+) por (.+?): (.*)$/);
    if (!match) return null;
    return {
      count: Number(match[1]),
      reason: match[2].trim(),
      keys: match[3].replace(/ …$/, "").split(",").map((key) => key.trim()).filter(Boolean),
    };
  }).filter((item): item is { count: number; reason: string; keys: string[] } => item !== null);
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function evaluateUploadVerification(input: VerificationInput): VerificationResult {
  const { file, run } = input;
  const now = input.now ?? new Date();
  const checks: VerificationCheck[] = [];

  if (file.deletedAt) {
    return { verdict: "ok", checks: [{ id: "eliminado", severity: "ok", detail: "El archivo se eliminó; no hay nada que comprobar." }], summary: "Archivo eliminado." };
  }
  if (file.supersededByFileId) {
    return { verdict: "ok", checks: [{ id: "sustituido", severity: "ok", detail: "El archivo quedó sustituido por otra versión, que se comprueba por su cuenta." }], summary: "Sustituido por otra versión." };
  }
  if (IN_PROGRESS_STAGES.has(file.processingStage) || run?.status === "running") {
    return { verdict: "pendiente", checks: [{ id: "en_proceso", severity: "ok", detail: `Todavía en proceso (etapa ${file.processingStage}).` }], summary: "Todavía se está procesando." };
  }

  if (run?.status === "failed" || (file.lastProcessingError && file.processingStage !== "sincronizado")) {
    checks.push({
      id: "fallo_tecnico",
      severity: "anomalia",
      detail: `La lectura falló: ${(run?.error || file.lastProcessingError || "sin detalle").slice(0, 240)}`,
    });
  }

  if (file.requiresReview || input.pendingProposals > 0) {
    checks.push({
      id: "revision_manual",
      severity: "anomalia",
      detail: input.pendingProposals > 0
        ? `Quedaron ${input.pendingProposals} dato(s) esperando revisión manual en vez de publicarse solos.`
        : "El archivo quedó marcado como pendiente de revisión manual.",
    });
  }

  const suspicious = input.discardMessages.flatMap(parseDiscardMessage)
    .filter((item) => !BENIGN_DISCARD_REASONS.includes(item.reason));
  for (const item of suspicious) {
    checks.push({
      id: "descarte_sospechoso",
      severity: "anomalia",
      detail: `${item.count} dato(s) descartado(s) por «${item.reason}»: ${item.keys.slice(0, 8).join(", ")}${item.keys.length > 8 ? " …" : ""}`,
    });
  }

  if (run?.status === "no_data") {
    checks.push({
      id: "sin_datos",
      severity: "aviso",
      detail: "No se extrajo ningún dato del archivo. Es normal en fotos o documentos sin tablas; si traía cifras, hay que revisar el lector.",
    });
  }

  const period = String(file.detectedPeriod ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period) && period > isoDay(now)) {
    checks.push({ id: "corte_futuro", severity: "anomalia", detail: `La fecha de corte detectada (${period}) es posterior a hoy.` });
  } else if (!period && run && run.publishedCount > 0) {
    checks.push({ id: "sin_corte", severity: "aviso", detail: "Se publicaron datos sin fecha de corte detectada." });
  }

  for (const item of input.regressions) {
    const drop = item.before - item.after;
    if (drop <= REGRESSION_TOLERANCE_POINTS) continue;
    // Decisión del negocio: el avance físico lo mandan la cubicación y los
    // edificios. Si una cubicación corrige a la baja un valor que puso otra
    // fuente (p. ej. un informe ejecutivo que colocó cifras en la fila
    // equivocada), es una corrección esperada, no un fallo de lectura.
    const authorityCorrection = isCubicacion(file.originalName) &&
      item.beforeSource !== undefined && !isCubicacion(item.beforeSource);
    checks.push({
      id: "retroceso",
      severity: drop > REGRESSION_ANOMALY_POINTS && !authorityCorrection ? "anomalia" : "aviso",
      detail: authorityCorrection
        ? `${item.key} baja de ${round(item.before)}% (${item.beforeSource}) a ${round(item.after)}%: la cubicación corrige un valor de otra fuente.`
        : `${item.key} baja de ${round(item.before)}% a ${round(item.after)}%. Puede ser una corrección legítima o una lectura equivocada.`,
    });
  }

  const published = file.publicationRevision !== null && file.publicationRevision !== undefined;
  if (!checks.length) {
    checks.push({
      id: "integrado",
      severity: "ok",
      detail: published
        ? `Datos publicados en la revisión ${file.publicationRevision}${run ? ` (${run.publishedCount} de ${run.proposedCount} propuestos; el resto ya coincidía o era más antiguo)` : ""}.`
        : "Procesado: sus datos ya coincidían con el Centro de Control o eran más antiguos que los vigentes.",
    });
  }

  const verdict: VerificationVerdict = checks.some((check) => check.severity === "anomalia")
    ? "anomalia"
    : checks.some((check) => check.severity === "aviso") ? "aviso" : "ok";
  const problems = checks.filter((check) => check.severity !== "ok").length;
  const summary = verdict === "ok"
    ? checks[0].detail
    : `${problems} punto(s) a revisar: ${checks.filter((check) => check.severity !== "ok").map((check) => check.id).join(", ")}.`;
  return { verdict, checks, summary };
}

function isCubicacion(name: string) {
  return /cubicaci[oó]n/i.test(String(name ?? ""));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

// Claves cuyo valor es un porcentaje de avance físico: son las únicas cuyo
// valor se compara (y se puede mostrar) al buscar retrocesos.
export const PROGRESS_KEY = /^(buildings\.\d+\.progress|projectSnapshot\.(overallProgress|urbanismProgress|activeBuildingsProgress)|urbanismAreas\.\d+\.progress|urbanismReportAreas\.\d+\.progress|constructionDisciplines\.\d+\.progress|monthlyPlan\.\d+\.actual)$/;

/**
 * Las cargas que no se leen directamente (un .mpp, un DWG, un .xls antiguo o
 * un PDF demasiado pesado) se verifican a través del archivo derivado que
 * generan, que entra como carga nueva y dispara su propia verificación.
 */
export function uploadNeedsVerification(input: {
  extension: string;
  derivedFromFileId: string;
  sizeBytes: number;
  largePdfBytes: number;
}) {
  if (input.derivedFromFileId) return true;
  const extension = input.extension.toLowerCase();
  if (["mpp", "dwg", "xls"].includes(extension)) return false;
  if (extension === "pdf" && input.sizeBytes > input.largePdfBytes) return false;
  return true;
}
