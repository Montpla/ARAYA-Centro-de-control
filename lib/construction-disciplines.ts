/**
 * Oficios de construcción de los edificios (constructionDisciplines)
 * reconocidos por su nombre, con las variantes con que los escriben la
 * cubicación y el Informe Ejecutivo.
 *
 * Igual que con las disciplinas de urbanismo (lib/urbanism-disciplines.ts), la
 * lista viva no tiene el orden de ningún documento: la lectura asistida del
 * Informe Ejecutivo de octubre escribió los avances por posición y dejó
 * Carpintería al 96,2 % y Herrería al 84,6 % (cifras de otros oficios), hasta
 * que la cubicación los corrigió (issue #266). Por eso toda escritura sobre
 * esta lista se dirige por nombre.
 */
export type ConstructionDisciplineId =
  | "infraestructura"
  | "superestructura"
  | "albanileria"
  | "instalaciones"
  | "pintura"
  | "revestimientos"
  | "miscelaneos"
  | "herreria"
  | "carpinteria";

// La etiqueta es el nombre canónico que ya resuelve la lista viva (ver
// ENTITY_TOKEN_ALIASES en lib/live-data.ts). "Inst." va sin punto: el punto
// separa los segmentos de una clave viva.
const DISCIPLINES: Array<{ id: ConstructionDisciplineId; label: string; pattern: RegExp }> = [
  // "Infraestructura eléctrica" es una disciplina de urbanismo, no este oficio.
  { id: "infraestructura", label: "Infraestructura", pattern: /\binfraestructura\b(?! electrica)/ },
  { id: "superestructura", label: "Superestructura", pattern: /\bsuper ?estructura\b/ },
  { id: "albanileria", label: "Albañilería", pattern: /\balbanileria\b|\bmamposteria\b/ },
  { id: "instalaciones", label: "Inst eléctricas, sanitarias y gas", pattern: /\binst(?:alaciones)?\.? (?:elec|electricas|sanit)/ },
  { id: "pintura", label: "Pintura", pattern: /\bpinturas?\b/ },
  { id: "revestimientos", label: "Revestimientos y cerámica", pattern: /\brevestimientos?\b|\bceramicas?\b/ },
  { id: "miscelaneos", label: "Misceláneos", pattern: /\bmiscelane[oa]s?\b/ },
  { id: "herreria", label: "Herrería", pattern: /\bherreria\b/ },
  { id: "carpinteria", label: "Carpintería", pattern: /\bcarpinteria\b/ },
];

function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Oficios que nombra un texto (un nombre de la lista o una evidencia). */
export function constructionDisciplinesInText(text: string): ConstructionDisciplineId[] {
  const normalized = normalizedText(text);
  return DISCIPLINES.filter((discipline) => discipline.pattern.test(normalized)).map((discipline) => discipline.id);
}

/** El único oficio que nombra un texto, o null si no nombra ninguno o varios. */
export function constructionDisciplineInText(text: string): ConstructionDisciplineId | null {
  const found = constructionDisciplinesInText(text);
  return found.length === 1 ? found[0] : null;
}

export function constructionDisciplineLabel(id: ConstructionDisciplineId) {
  return DISCIPLINES.find((discipline) => discipline.id === id)?.label ?? id;
}
