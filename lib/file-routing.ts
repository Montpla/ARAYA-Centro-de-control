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

export const uploadStatusLabels: Record<string, string> = {
  recibido: "Recibido",
  pendiente_revision: "En normalización",
  integrado: "Integrado",
  observado: "Observado",
};

const areaKeywords: Record<Exclude<ClassifiedArea, "sin_clasificar">, string[]> = {
  direccion: ["direccion", "directivo", "comite", "resumen ejecutivo", "consolidado"],
  planificacion: ["cronograma", "planificacion", "programacion", "mpp", "project", "linea base", "curva s"],
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
