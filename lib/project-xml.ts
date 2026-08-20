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
  durationHours: number;
};

/**
 * Horas de una duración ISO-8601 de Project (`PT16H0M0S`).
 *
 * Se usan como peso al promediar: una tarea de estructura de dos semanas debe
 * pesar más que un remate de un día. Sin este peso, un capítulo con muchas
 * tareas cortas dominaría el avance del edificio aunque represente poca obra.
 */
function durationToHours(value: string): number {
  const match = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return 0;
  const [, horas, minutos, segundos] = match;
  return (Number(horas) || 0) + (Number(minutos) || 0) / 60 + (Number(segundos) || 0) / 3600;
}

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
      durationHours: durationToHours(firstTag(cuerpo, "Duration")),
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
  // El avance es numérico; la fecha de fin se publica como ISO YYYY-MM-DD.
  updates: Array<{ key: string; value: number | string }>;
  warnings: string[];
  summary: string;
  taskCount: number;
};

/**
 * Convierte un plan de Project en avances por edificio.
 *
 * Un plan de obra se organiza por capítulos —INFRAESTRUCTURA, SUPERESTRUCTURA,
 * ALBAÑILERÍA, ACABADOS…— y dentro de cada capítulo aparecen los edificios. Así
 * que el mismo edificio sale muchas veces, una por capítulo, y la mayoría de
 * sus tareas de detalle **no repiten su nombre**: cuelgan de él en la jerarquía.
 *
 * Por eso no basta con promediar las tareas que nombran al edificio (eso
 * ignoraba más de la mitad del plan y daba un número que no cuadraba con nada).
 * Cada tarea de detalle se atribuye al edificio del que cuelga, y el avance del
 * edificio es la media de sus tareas **ponderada por duración**: una estructura
 * de dos semanas pesa más que un remate de un día. Calculado así, la media de
 * todos los edificios reproduce el porcentaje global que el propio Project
 * muestra en la raíz del plan —la señal de que la agregación es fiel y no una
 * aproximación—.
 */
export function extractProjectXmlUpdates(
  text: string,
  conocidos?: Set<string>,
  sourceName = "",
): ProjectXmlExtraction {
  const tareas = readProjectTasks(text);
  if (!tareas.length) {
    return {
      updates: [],
      taskCount: 0,
      summary: "El XML de Project no contiene tareas legibles.",
      warnings: ["Comprueba que el archivo se guardó desde Project con Archivo → Guardar como → XML."],
    };
  }

  // Cada tarea hereda el edificio del ancestro más cercano que lo nombre. La
  // pila guarda, por nivel de esquema, el edificio vigente; al bajar de nivel
  // se descartan los ancestros que ya no aplican.
  const porNivel = new Map<number, string>();
  const acumulado = new Map<string, { suma: number; peso: number }>();
  let leaves = 0;
  let sinEdificio = 0;
  // Avance del cronograma completo: media de TODAS las hojas del plan ponderada
  // por duración (no solo las que cuelgan de un edificio; también urbanismo,
  // zonas comunes, etc.). Es el "% de cronograma" que Project muestra en la raíz
  // y que, hasta ahora, estaba escrito a mano en el panel.
  let cronoSuma = 0;
  let cronoPeso = 0;
  // Fecha de fin del proyecto: la más tardía de todas las tareas. Las fechas ISM
  // ("2027-06-07T17:00:00") se comparan como texto igual que en el tiempo.
  let finMax = "";

  for (const tarea of tareas) {
    const nivel = tarea.outlineLevel ?? 0;
    for (const clave of [...porNivel.keys()]) {
      if (clave >= nivel) porNivel.delete(clave);
    }
    const propio = buildingCodeFromTaskName(tarea.name);
    const heredado = [...porNivel.entries()].sort((a, b) => a[0] - b[0]).pop()?.[1];
    const edificio = propio || heredado || "";
    if (edificio) porNivel.set(nivel, edificio);

    if (tarea.finish && tarea.finish > finMax) finMax = tarea.finish;

    // Sólo las hojas con avance cuentan: los resúmenes agregan a sus hijas y
    // sumarlos contaría la misma obra dos veces.
    if (tarea.summary || tarea.percentComplete === null) continue;
    leaves += 1;
    // Peso por duración; una hoja sin duración cuenta como una unidad, para no
    // desaparecer del promedio de un edificio que sólo tenga tareas así.
    const peso = tarea.durationHours > 0 ? tarea.durationHours : 1;
    const valor = Math.max(0, Math.min(100, tarea.percentComplete));
    // El cronograma global suma todas las hojas, tengan edificio o no.
    cronoSuma += valor * peso;
    cronoPeso += peso;
    if (!edificio || (conocidos && !conocidos.has(numeroDeCodigo(edificio)))) {
      sinEdificio += 1;
      continue;
    }
    const previo = acumulado.get(edificio) ?? { suma: 0, peso: 0 };
    previo.suma += valor * peso;
    previo.peso += peso;
    acumulado.set(edificio, previo);
  }

  const updates: Array<{ key: string; value: number | string }> = [...acumulado.entries()]
    .filter(([, { peso }]) => peso > 0)
    .map(([codigo, { suma, peso }]) => ({
      key: `buildings.${codigo}.progress`,
      value: Math.round((suma / peso) * 100) / 100,
    }))
    .sort((izquierda, derecha) => izquierda.key.localeCompare(derecha.key));

  // Nº de edificios actualizados, antes de añadir el dato de cronograma: el
  // aviso y el resumen cuentan edificios, no el % global del plan.
  const edificioUpdates = updates.length;

  // Un MPP parcial (urbanismo, flujo o una fase aislada) puede tener su propio
  // 5%, fecha final y cientos de tareas, pero esos valores NO son los del plan
  // maestro de ARAYA. El error del 20/08 vino exactamente de un archivo llamado
  // "Urbanismo fase I...": sustituyó el 22,37% global por su 5,08% interno.
  //
  // La actualización global sólo se admite cuando el nombre identifica el plan
  // maestro/general o cuando el XML cubre al menos diez edificios conocidos.
  // Las llamadas antiguas sin sourceName conservan el comportamiento previo.
  const nombreNormalizado = sourceName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const parecePlanParcial = /\b(?:urbanismo|flujo|fase\s+[ivx]+)\b/.test(nombreNormalizado);
  const parecePlanMaestro = /\b(?:cronograma|plan)\s+(?:maestro|general)\b/.test(nombreNormalizado) ||
    /\baraya\b[\s\S]*\b\d+\s+edificios\b/.test(nombreNormalizado);
  const permiteDatosGlobales = !sourceName ||
    (!parecePlanParcial && (parecePlanMaestro || edificioUpdates >= 10));

  const warnings: string[] = [];

  // El avance del cronograma sale del propio plan, no de un número a mano: se
  // publica junto a los edificios para que el KPI "Cronograma MPP" se actualice
  // solo con cada plan que se suba.
  if (permiteDatosGlobales && cronoPeso > 0) {
    updates.push({
      key: "projectSnapshot.scheduleProgress",
      value: Math.round((cronoSuma / cronoPeso) * 100) / 100,
    });
  }

  // Fin del proyecto: la fecha más tardía del plan. Los datos vivos se guardan
  // en ISO, que es el contrato común de todas las fechas; la interfaz se ocupa
  // de presentarla como DD/MM/YYYY. Antes se publicaba ya formateada para la
  // pantalla y el contrato la rechazaba: por eso la conversión real del MPP
  // extrajo 28 datos, pero sólo 27 llegaron a producción.
  const finIso = finMax.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (permiteDatosGlobales && finIso) {
    updates.push({
      key: "projectSnapshot.forecastFinish",
      value: `${finIso[1]}-${finIso[2]}-${finIso[3]}`,
    });
  }

  if (!permiteDatosGlobales) {
    warnings.push(
      "El archivo es un plan parcial: se conservan el avance y la fecha final del cronograma maestro.",
    );
  }
  if (!edificioUpdates) {
    warnings.push(
      `Se leyeron ${tareas.length} tareas, pero ninguna cuelga de un edificio reconocible (se esperan nombres tipo "TH-14" o "Edificio 14").`,
    );
  } else if (sinEdificio) {
    warnings.push(`${sinEdificio} de ${leaves} tareas de detalle no cuelgan de ningún edificio y se han dejado fuera.`);
  }

  return {
    updates,
    taskCount: tareas.length,
    warnings,
    summary: edificioUpdates
      ? `${edificioUpdates} edificios actualizados desde ${tareas.length} tareas del plan de Project, ponderadas por duración.`
      : `Plan de Project leído (${tareas.length} tareas), sin avances aplicables.`,
  };
}
