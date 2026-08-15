/**
 * Lector del XML de Microsoft Project (MSPDI).
 *
 * Los `.mpp` son un formato binario cerrado: no hay forma de abrirlos desde el
 * servidor sin un conversor de pago —MPXJ es Java y Aspose.Tasks es una API por
 * suscripción—, así que durante meses el corte mensual de obra se subía en un
 * formato que la aplicación archivaba sin leer.
 *
 * Project, en cambio, guarda de forma nativa en XML (Archivo → Guardar como →
 * XML). Ese formato es abierto, está documentado por Microsoft y trae
 * `PercentComplete` por tarea, así que basta con leerlo. Conserva además toda
 * la estructura del plan —nombres, porcentajes, fechas, jerarquía—, mientras
 * que un Excel exportado depende de qué columnas eligiera quien lo generó.
 *
 * El parseo se hace a mano y no con una librería: el módulo corre en un Worker,
 * sólo se necesitan cuatro campos de cada `<Task>`, y no compensa arrastrar una
 * dependencia de parseo XML completa para eso.
 */

export type ProjectTask = {
  name: string;
  percentComplete: number | null;
  start: string;
  finish: string;
  outlineLevel: number | null;
  summary: boolean;
};

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codigo = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : match;
    }
    if (entity.startsWith("#")) {
      const codigo = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : match;
    }
    return XML_ENTITIES[entity] ?? match;
  });
}

function firstTag(block: string, tag: string) {
  // Sin banderas globales y anclado al primer cierre: dentro de una tarea
  // pueden anidarse bloques con nombres de etiqueta repetidos.
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]).trim() : "";
}

/** Distingue un MSPDI de cualquier otro XML antes de intentar interpretarlo. */
export function isProjectXml(text: string) {
  return /<Project[\s>][\s\S]{0,400}schemas\.microsoft\.com\/project/i.test(text) ||
    /xmlns\s*=\s*["']http:\/\/schemas\.microsoft\.com\/project["']/i.test(text);
}

export function readProjectTasks(text: string, maxTasks = 5_000): ProjectTask[] {
  const tareas: ProjectTask[] = [];
  const bloques = text.matchAll(/<Task>([\s\S]*?)<\/Task>/g);
  for (const bloque of bloques) {
    if (tareas.length >= maxTasks) break;
    const cuerpo = bloque[1];
    const name = firstTag(cuerpo, "Name");
    if (!name) continue;
    const porcentaje = firstTag(cuerpo, "PercentComplete");
    const nivel = firstTag(cuerpo, "OutlineLevel");
    const numero = Number(porcentaje);
    tareas.push({
      name,
      percentComplete: porcentaje !== "" && Number.isFinite(numero) ? numero : null,
      start: firstTag(cuerpo, "Start"),
      finish: firstTag(cuerpo, "Finish"),
      outlineLevel: nivel !== "" && Number.isFinite(Number(nivel)) ? Number(nivel) : null,
      // Las tareas resumen agregan a sus hijas; su porcentaje es un cálculo de
      // Project, no un dato medido en obra.
      summary: firstTag(cuerpo, "Summary") === "1",
    });
  }
  return tareas;
}

/**
 * Extrae el código de edificio que nombra una tarea del plan.
 *
 * Los planes de obra rotulan las tareas de muchas formas ("TH-14 Estructura",
 * "EDIFICIO 14", "Ed. 14 · albañilería"), así que se busca el patrón conocido y
 * se descarta todo lo demás. Es deliberadamente estricto: una tarea que sólo
 * contenga un número suelto ("Fase 14") no nombra a ningún edificio, y
 * adivinarlo metería el avance en el edificio equivocado — el mismo error que
 * costó meses detectar.
 */
export function buildingCodeFromTaskName(name: string) {
  const match = name.match(/\b(?:th|edificio|edif\.?|ed\.?)\s*[-–—]?\s*(\d{1,3})\b/i);
  return match ? `TH-${match[1].padStart(2, "0")}` : "";
}

// Los códigos que produce buildingCodeFromTaskName son siempre "TH-" y
// dígitos, así que basta con quedarse con el número sin ceros de relleno para
// compararlos con los edificios que existen. Se hace aquí, y no llamando a la
// normalización general, para que este módulo no dependa del modelo de datos:
// así se puede leer un plan de Project sin arrastrar medio sistema detrás.
function numeroDeCodigo(codigo: string) {
  return codigo.replace(/^TH-/i, "").replace(/^0+(?=\d)/, "");
}

export type ProjectXmlExtraction = {
  updates: Array<{ key: string; value: number }>;
  warnings: string[];
  summary: string;
  taskCount: number;
};

/**
 * Convierte un plan de Project en avances por edificio.
 *
 * Cuando varias tareas nombran al mismo edificio se toma la media de sus
 * porcentajes, que es lo que representa el avance del edificio en un plan por
 * capítulos. Las tareas resumen quedan fuera para no contar dos veces lo mismo.
 */
export function extractProjectXmlUpdates(text: string, conocidos?: Set<string>): ProjectXmlExtraction {
  const tareas = readProjectTasks(text);
  if (!tareas.length) {
    return {
      updates: [],
      taskCount: 0,
      summary: "El XML de Project no contiene tareas legibles.",
      warnings: ["Comprueba que el archivo se guardó desde Project con Archivo → Guardar como → XML."],
    };
  }

  const porEdificio = new Map<string, number[]>();
  let sinCodigo = 0;
  for (const tarea of tareas) {
    if (tarea.summary || tarea.percentComplete === null) continue;
    const codigo = buildingCodeFromTaskName(tarea.name);
    if (!codigo) {
      sinCodigo += 1;
      continue;
    }
    if (conocidos && !conocidos.has(numeroDeCodigo(codigo))) {
      sinCodigo += 1;
      continue;
    }
    const lista = porEdificio.get(codigo) ?? [];
    lista.push(Math.max(0, Math.min(100, tarea.percentComplete)));
    porEdificio.set(codigo, lista);
  }

  const updates = [...porEdificio.entries()]
    .map(([codigo, valores]) => ({
      key: `buildings.${codigo}.progress`,
      value: Math.round((valores.reduce((total, valor) => total + valor, 0) / valores.length) * 100) / 100,
    }))
    .sort((izquierda, derecha) => izquierda.key.localeCompare(derecha.key));

  const warnings: string[] = [];
  if (!updates.length) {
    warnings.push(
      `Se leyeron ${tareas.length} tareas, pero ninguna nombra un edificio reconocible (se esperan nombres tipo "TH-14" o "Edificio 14").`,
    );
  } else if (sinCodigo) {
    warnings.push(`${sinCodigo} tareas no nombran ningún edificio y se han dejado fuera.`);
  }

  return {
    updates,
    taskCount: tareas.length,
    warnings,
    summary: updates.length
      ? `${updates.length} edificios actualizados desde ${tareas.length} tareas del plan de Project.`
      : `Plan de Project leído (${tareas.length} tareas), sin avances aplicables.`,
  };
}
