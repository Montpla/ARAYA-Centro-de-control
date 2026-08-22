export const uploadAreas = [
  { id: "auto", label: "Clasificación automática" },
  { id: "direccion", label: "Dirección" },
  { id: "planificacion", label: "Planificación y cronograma" },
  { id: "obra", label: "Obra y edificaciones" },
  { id: "urbanismo", label: "Urbanismo" },
  { id: "comercial", label: "Ventas y cobranza" },
  { id: "finanzas", label: "Finanzas y administración" },
  { id: "compras", label: "Compras y proveedores" },
  { id: "seguridad", label: "Seguridad" },
  { id: "legal", label: "Legal y permisos" },
  { id: "diseno", label: "Diseño y planos" },
  { id: "sin_clasificar", label: "Pendiente de clasificar" },
] as const;

export type UploadArea = (typeof uploadAreas)[number]["id"];
export type ClassifiedArea = Exclude<UploadArea, "auto">;

export const areaLabels = Object.fromEntries(uploadAreas.map((area) => [area.id, area.label])) as Record<UploadArea, string>;

export const userAreas = uploadAreas.filter(
  (area) => area.id !== "auto" && area.id !== "sin_clasificar",
) as Array<{ id: Exclude<ClassifiedArea, "sin_clasificar">; label: string }>;

export type UserArea = (typeof userAreas)[number]["id"];

export function isUserArea(value: string): value is UserArea {
  return userAreas.some((area) => area.id === value);
}

export const uploadStatusLabels: Record<string, string> = {
  recibido: "Recibido",
  pendiente_revision: "Pendiente de validación",
  integrado: "Integrado",
  observado: "Observado",
  rechazado: "Rechazado",
  historico: "Histórico sustituido",
};

export const documentTypeLabels: Record<string, string> = {
  clasificacion_pendiente: "Clasificación confidencial en curso",
  estado_financiero: "Estado financiero",
  avance_obra: "Avance de obra",
  cronograma: "Cronograma y planificación",
  ventas_cobranza: "Ventas y cobranza",
  proveedores_compras: "Proveedores y compras",
  plano_diseno: "Plano y diseño",
  urbanismo: "Urbanismo",
  seguridad_permisos: "Seguridad y permisos",
  evidencia_fotografica: "Evidencia fotográfica",
  documento_general: "Documento general",
};

export const reviewStatusLabels: Record<string, string> = {
  pendiente_extraccion: "Pendiente de extracción",
  listo_revision: "Listo para validar",
  cambios_solicitados: "Cambios solicitados",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  superado: "Superado por una fuente posterior",
};

const areaKeywords: Record<Exclude<ClassifiedArea, "sin_clasificar">, string[]> = {
  direccion: ["direccion", "directivo", "comite", "resumen ejecutivo", "consolidado"],
  planificacion: ["cronograma", "planificacion", "programacion", "mpp", "project", "linea base", "curva s", "graficos araya", "plan operativo"],
  obra: ["obra", "edificio", "apartamento", "vivienda", "avance", "cubicacion", "superestructura", "hormigon", "encofrado"],
  urbanismo: ["urbanismo", "vial", "paisajismo", "jardineria", "infraestructura", "alcantarillado"],
  comercial: ["venta", "reserva", "cliente", "cobranza", "morosidad", "comercial", "desistimiento"],
  finanzas: ["finanza", "financiero", "costos", "costes", "cuentas por pagar", "cxp", "balance", "flujo", "anticipo", "datos para informe"],
  compras: ["compras", "proveedor", "suministro", "pedido", "orden de compra", "cotizacion"],
  seguridad: ["seguridad", "accidente", "inspeccion", "epp", "hallazgo", "incidente"],
  legal: ["legal", "permiso", "confotur", "contrato", "titulo", "mived", "licencia"],
  diseno: ["plano", "implantacion", "dwg", "autocad", "arquitectura", "diseno", "render"],
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isUploadArea(value: string): value is UploadArea {
  return uploadAreas.some((area) => area.id === value);
}

export function classifyUpload(input: {
  fileName: string;
  description?: string;
  declaredArea?: string;
}) {
  const declaredArea = input.declaredArea && isUploadArea(input.declaredArea) ? input.declaredArea : "auto";
  if (declaredArea !== "auto") {
    return {
      area: declaredArea,
      confidence: declaredArea === "sin_clasificar" ? 0 : 1,
      reason: declaredArea === "sin_clasificar" ? "El usuario dejó el destino pendiente." : "Área indicada por el usuario.",
    };
  }

  const haystack = normalized(`${input.fileName} ${input.description ?? ""}`);
  const scores = Object.entries(areaKeywords)
    .map(([area, keywords]) => ({
      area: area as Exclude<ClassifiedArea, "sin_clasificar">,
      matches: keywords.filter((keyword) => haystack.includes(keyword)).length,
    }))
    .sort((a, b) => b.matches - a.matches);
  const best = scores[0];
  if (!best || best.matches === 0) {
    return {
      area: "sin_clasificar" as const,
      confidence: 0,
      reason: "No hay palabras suficientes para asignar el archivo de forma segura.",
    };
  }

  const confidence = Math.min(0.96, 0.62 + (best.matches - 1) * 0.12);
  return {
    area: best.area,
    confidence,
    reason: `Clasificación automática por ${best.matches} coincidencia${best.matches === 1 ? "" : "s"} en el nombre o la descripción.`,
  };
}

const contentRootAreas: Record<string, Exclude<ClassifiedArea, "sin_clasificar">> = {
  buildings: "obra",
  constructionDisciplines: "obra",
  structuralDelay: "obra",
  workPackages: "obra",
  projectCertifications: "obra",
  monthlyPlan: "planificacion",
  timeline: "planificacion",
  urbanismAreas: "urbanismo",
  urbanismReportAreas: "urbanismo",
  delayedUrbanismStarts: "urbanismo",
  safetyMetrics: "seguridad",
  safetyFindings: "seguridad",
  safetyFindingTracking: "seguridad",
  safetyWeeklySeries: "seguridad",
  permits: "legal",
  supplierComparisons: "compras",
  supplierDirectory: "compras",
  procurementMonthlySchedule: "compras",
  procurementPackages: "compras",
  arrearsBreakdown: "comercial",
  collectionTargets: "comercial",
  commercialPartners: "comercial",
  salesLocations: "comercial",
  salesModels: "comercial",
  advances: "finanzas",
  antonelyAdvances: "finanzas",
  antonelyBalanceLines: "finanzas",
  antonelyCostAccounts: "finanzas",
  antonelyDetailTotals: "finanzas",
  antonelyFinanceSource: "finanzas",
  antonelyPayableCategories: "finanzas",
  antonelyPayableInvoiceLines: "finanzas",
  antonelyPayableVendorsAll: "finanzas",
  costBreakdown: "finanzas",
  cubicaciones: "finanzas",
  cubicacionCaratula: "finanzas",
  cxpAging: "finanzas",
  cxpCategories: "finanzas",
  financialProjection: "finanzas",
  financingProcesses: "finanzas",
  fiduciaryBalanceSections: "finanzas",
  fiduciaryManagementReconciliation: "finanzas",
  fiduciaryStatementQualityIssues: "finanzas",
  fiduciaryStatementSummary: "finanzas",
  ifcComplianceGroups: "finanzas",
  ifcComplianceTracking: "finanzas",
  monthlyDeviationLines: "finanzas",
  payablesReconciliation: "finanzas",
  reprogrammedFlowAudit: "finanzas",
  reprogrammedFlowMonths: "finanzas",
  reprogrammedFlowQualityIssues: "finanzas",
  reprogrammedFlowScopes: "finanzas",
  typeABudgetChapters: "finanzas",
};

const contentDocumentAreas: Record<string, Exclude<ClassifiedArea, "sin_clasificar">> = {
  avance_obra: "obra",
  cronograma: "planificacion",
  ventas_cobranza: "comercial",
  estado_financiero: "finanzas",
  proveedores_compras: "compras",
  plano_diseno: "diseno",
  urbanismo: "urbanismo",
};

/**
 * Segunda clasificación, basada en lo que los lectores encontraron de verdad.
 * Una selección expresa del usuario se conserva; el contenido corrige sólo la
 * clasificación automática o pendiente. Finanzas y Comercial también pasan
 * después por la frontera de privacidad del servidor.
 */
export function inferUploadAreaFromContent(input: {
  initialArea: ClassifiedArea;
  initialConfidence: number;
  documentType: string;
  updateKeys: string[];
  suggestedAreas?: string[];
}) {
  if (input.initialArea !== "sin_clasificar" && input.initialConfidence >= 1) {
    return {
      area: input.initialArea,
      confidence: input.initialConfidence,
      reason: "Área indicada expresamente por el usuario.",
      changed: false,
    } as const;
  }

  const votes = new Map<Exclude<ClassifiedArea, "sin_clasificar">, number>();
  const addVote = (area: Exclude<ClassifiedArea, "sin_clasificar">, weight: number) =>
    votes.set(area, (votes.get(area) ?? 0) + weight);

  const documentArea = contentDocumentAreas[input.documentType];
  if (documentArea) addVote(documentArea, 4);
  for (const key of input.updateKeys) {
    const area = contentRootAreas[key.split(".", 1)[0]];
    if (area) addVote(area, 3);
  }
  for (const suggestedArea of input.suggestedAreas ?? []) {
    const normalizedArea = suggestedArea.trim().toLowerCase();
    if (isUploadArea(normalizedArea) && normalizedArea !== "auto" && normalizedArea !== "sin_clasificar") {
      addVote(normalizedArea, 2);
    }
  }
  if (input.initialArea !== "sin_clasificar") addVote(input.initialArea, 1);

  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const best = ranked[0];
  if (!best || (ranked[1] && ranked[1][1] === best[1])) {
    return {
      area: input.initialArea,
      confidence: input.initialConfidence,
      reason: best
        ? "El contenido mezcla varias áreas con el mismo peso; se conserva la clasificación inicial."
        : "El contenido no aporta señales suficientes para cambiar el área.",
      changed: false,
    } as const;
  }

  const [area, score] = best;
  return {
    area,
    confidence: Math.min(0.99, 0.91 + Math.max(0, score - 3) * 0.01),
    reason: `Clasificación automática por contenido: el lector encontró ${score} punto${score === 1 ? "" : "s"} de evidencia de ${areaLabels[area]}.`,
    changed: area !== input.initialArea,
  } as const;
}

export function safeFileName(fileName: string) {
  const lastSegment = fileName.split(/[\\/]/).pop() || "archivo";
  const dot = lastSegment.lastIndexOf(".");
  const base = dot > 0 ? lastSegment.slice(0, dot) : lastSegment;
  const extension = dot > 0 ? lastSegment.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const safeBase = normalized(base)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "archivo";
  return `${safeBase}${extension.slice(0, 12)}`;
}
