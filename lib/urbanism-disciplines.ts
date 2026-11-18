/**
 * Disciplinas del informe de urbanismo (urbanismReportAreas) reconocidas por
 * su nombre, con las variantes con que las escriben los distintos documentos.
 *
 * La lista viva no tiene el orden de la plantilla del código ni el de cada
 * informe: el Informe Ejecutivo de julio la reemplazó con otro orden y otras
 * grafías ("SISTEMA ESPECIALES", "INSTALACIONES DE GAS"). Dos veces se publicó
 * un avance por posición y acabó en la disciplina de al lado (revisiones 100 y
 * 111). Por eso toda escritura sobre esta lista se dirige por nombre.
 */
export type UrbanismDisciplineId =
  | "movimiento-tierra"
  | "hidrosanitarias"
  | "sistemas-especiales"
  | "infraestructura-electrica"
  | "telecomunicaciones"
  | "gas"
  | "vialidad"
  | "paisajismo"
  | "elementos-urbanos"
  | "obras-exteriores";

const DISCIPLINES: Array<{ id: UrbanismDisciplineId; label: string; pattern: RegExp }> = [
  { id: "movimiento-tierra", label: "MOVIMIENTO DE TIERRA", pattern: /\bmovimientos? de tierras?\b/ },
  { id: "hidrosanitarias", label: "HIDROSANITARIAS", pattern: /\bhidro ?sanitari[ao]s?\b/ },
  { id: "sistemas-especiales", label: "SISTEMAS ESPECIALES", pattern: /\bsist(?:emas?|\.)? especiales\b/ },
  { id: "infraestructura-electrica", label: "INFRAESTRUCTURA ELECTRICA", pattern: /\binfraestructura electrica\b|\belectrificacion\b/ },
  { id: "telecomunicaciones", label: "INSTALACIONES TELECOMUNICACIONES", pattern: /\btelecomunicaciones\b/ },
  { id: "gas", label: "INSTALACIONES DE GAS", pattern: /\binstalaciones de gas\b|\bgas\b/ },
  { id: "vialidad", label: "VIALIDAD", pattern: /\bvialidad\b/ },
  { id: "paisajismo", label: "PAISAJISMO", pattern: /\bpaisajismo\b/ },
  { id: "elementos-urbanos", label: "ELEMENTOS URBANOS", pattern: /\belementos urbanos\b/ },
  { id: "obras-exteriores", label: "OBRAS EXTERIORES", pattern: /\bobras exterio(?:r)?es\b/ },
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

/** Disciplinas que nombra un texto (un nombre de la lista o una evidencia). */
export function urbanismDisciplinesInText(text: string): UrbanismDisciplineId[] {
  const normalized = normalizedText(text);
  return DISCIPLINES.filter((discipline) => discipline.pattern.test(normalized)).map((discipline) => discipline.id);
}

/** La única disciplina que nombra un texto, o null si no nombra ninguna o varias. */
export function urbanismDisciplineInText(text: string): UrbanismDisciplineId | null {
  const found = urbanismDisciplinesInText(text);
  return found.length === 1 ? found[0] : null;
}

export function urbanismDisciplineLabel(id: UrbanismDisciplineId) {
  return DISCIPLINES.find((discipline) => discipline.id === id)?.label ?? id;
}

/**
 * Posición en la lista viva de la disciplina que nombra `name`, o -1 si no
 * está, si el nombre no designa una disciplina conocida, o si la designan dos
 * entradas (un nombre que señala a dos no señala a ninguna).
 */
export function findUrbanismDisciplineIndex(
  areas: ReadonlyArray<{ name?: unknown } | null | undefined>,
  name: string,
) {
  const wanted = urbanismDisciplineInText(name);
  if (!wanted) return -1;
  let found = -1;
  for (let index = 0; index < areas.length; index += 1) {
    const candidate = areas[index]?.name;
    if (typeof candidate !== "string" || urbanismDisciplineInText(candidate) !== wanted) continue;
    if (found >= 0) return -1;
    found = index;
  }
  return found;
}
