export type UrbanismMapArea = {
  id: string;
  progress: number | null;
  status: string;
  source: string;
  pendingFields?: string[];
};

export type UrbanismReportArea = {
  name: string;
  progress: number | null;
};

const reportAliasesByMapArea: Record<string, string[]> = {
  "urban-roads": ["vialidad", "viales", "viales y circulacion"],
  "urban-landscape": ["paisajismo", "paisajismo y areas verdes"],
};

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Une el inventario espacial del plano con el desglose del informe de
 * urbanismo. Son porcentajes acumulados: entre dos representaciones del mismo
 * concepto conserva el mayor avance conocido. Así, un cero de plantilla o de
 * una ficha espacial antigua no puede ocultar un avance positivo ya publicado,
 * mientras que una medición espacial posterior y superior sí progresa.
 *
 * Una corrección que reduzca un acumulado debe publicarse sobre ambas claves
 * equivalentes; no se interpreta automáticamente como una regresión de obra.
 */
/**
 * Urbanismo general es un acumulado consolidado que también declara el
 * Informe Ejecutivo (projectSnapshot.urbanismProgress). Con el mismo criterio
 * de mayor avance conocido, un informe más reciente no puede quedar oculto por
 * una ficha espacial publicada meses antes.
 */
export function reconcileGeneralUrbanism<T extends UrbanismMapArea>(
  areas: readonly T[],
  declaredProgress: number | null | undefined,
): T[] {
  if (typeof declaredProgress !== "number" || !Number.isFinite(declaredProgress)) return [...areas];
  return areas.map((area) => {
    if (area.id !== "urban-general") return area;
    if (typeof area.progress === "number" && area.progress >= declaredProgress) return area;
    return {
      ...area,
      progress: declaredProgress,
      status: "integrado",
      source: "Informe Ejecutivo · avance de urbanismo declarado",
      pendingFields: area.pendingFields?.filter((field) => normalizedName(field) !== "avance"),
    };
  });
}

export function deriveUrbanismMapAreas<T extends UrbanismMapArea>(
  areas: readonly T[],
  reportAreas: readonly UrbanismReportArea[],
): T[] {
  const reportsByName = new Map(
    reportAreas.map((area) => [normalizedName(area.name), area]),
  );

  return areas.map((area) => {
    const aliases = reportAliasesByMapArea[area.id] ?? [];
    const report = aliases
      .map((alias) => reportsByName.get(alias))
      .find((candidate) => typeof candidate?.progress === "number");
    if (!report || report.progress === null) return area;
    const spatialProgress = typeof area.progress === "number" ? area.progress : null;
    if (spatialProgress !== null && spatialProgress >= report.progress) return area;

    return {
      ...area,
      progress: report.progress,
      status: "integrado",
      source: `Informe de avance de urbanismo · ${report.name}`,
      pendingFields: area.pendingFields?.filter((field) =>
        normalizedName(field) !== "avance"),
    };
  });
}
