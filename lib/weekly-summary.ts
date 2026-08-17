/**
 * Compone el resumen semanal de obra que se envía por correo.
 *
 * Es una función pura: recibe los números ya calculados y devuelve el asunto,
 * el texto y el HTML del correo. Toda la fontanería —leer la base, comparar con
 * la semana pasada, enviar— vive fuera; aquí sólo se decide qué se cuenta y
 * cómo, para poder probarlo sin base de datos ni servidor.
 *
 * El tono es el de un compañero que te pone al día, no el de un informe: cifras
 * redondeadas, la variación de la semana por delante, y nada de tecnicismos.
 */

export type WeeklyBuildingRow = {
  code: string;
  name: string;
  now: number;
  prev: number | null;
};

export type WeeklySummaryInput = {
  /** "del 11 al 17 de agosto de 2026" */
  weekLabel: string;
  overallNow: number;
  overallPrev: number | null;
  buildings: WeeklyBuildingRow[];
  documentsThisWeek: number;
};

export type ComposedSummary = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Umbral por debajo del cual una variación se considera "sin cambio". Medio
 * punto: por debajo de eso es ruido de redondeo del plan, no obra de la semana,
 * y sacarlo en "lo que más se movió" sólo distrae.
 */
const CAMBIO_MINIMO = 0.5;

function num(value: number): string {
  return value
    .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function signo(delta: number): string {
  const redondeado = Math.round(delta * 10) / 10;
  if (redondeado > 0) return `+${num(redondeado)}`;
  return num(redondeado);
}

type Movimiento = { row: WeeklyBuildingRow; delta: number };

function clasificar(buildings: WeeklyBuildingRow[]) {
  const subieron: Movimiento[] = [];
  const parados: WeeklyBuildingRow[] = [];
  for (const row of buildings) {
    if (row.prev === null) continue;
    const delta = row.now - row.prev;
    if (delta > CAMBIO_MINIMO) {
      subieron.push({ row, delta });
    } else if (Math.abs(delta) <= CAMBIO_MINIMO && row.now > 0 && row.now < 100) {
      // En obra pero sin moverse esta semana. Los que están a 0 (aún no
      // empezados) o al 100 (terminados) no son "parados", así que fuera.
      parados.push(row);
    }
  }
  subieron.sort((a, b) => b.delta - a.delta);
  return { subieron, parados };
}

/** "TH-07" a partir de un código "7" o "TH-07" indistintamente. */
function etiqueta(row: WeeklyBuildingRow): string {
  const codigo = row.code.replace(/^TH-?/i, "");
  return /^\d+$/.test(codigo) ? `TH-${codigo.padStart(2, "0")}` : row.code;
}

export function composeWeeklySummary(input: WeeklySummaryInput): ComposedSummary {
  const { subieron, parados } = clasificar(input.buildings);
  const esPrimero = input.overallPrev === null;
  const deltaGlobal = esPrimero ? 0 : input.overallNow - (input.overallPrev ?? 0);

  const variacionGlobal = esPrimero
    ? "Es el primer resumen, así que todavía no hay semana anterior con la que comparar. A partir del próximo verás lo que ha avanzado cada edificio."
    : Math.abs(deltaGlobal) <= CAMBIO_MINIMO
      ? "Esta semana el avance global se ha mantenido igual."
      : `Esta semana el proyecto ha avanzado ${signo(deltaGlobal)} puntos.`;

  // --- Texto plano (el que se lee si el correo no muestra formato) ----------
  const lineas: string[] = [];
  lineas.push(`Resumen de la semana · ARAYA (${input.weekLabel})`);
  lineas.push("");
  lineas.push(`El proyecto va al ${num(input.overallNow)}%.`);
  lineas.push(variacionGlobal);
  lineas.push("");

  if (subieron.length) {
    lineas.push("Lo que más se movió esta semana:");
    for (const { row, delta } of subieron.slice(0, 6)) {
      lineas.push(`  • ${etiqueta(row)}: ${num(row.now)}% (${signo(delta)})`);
    }
    lineas.push("");
  } else if (!esPrimero) {
    lineas.push("Ningún edificio ha cambiado su avance esta semana.");
    lineas.push("");
  }

  if (parados.length) {
    lineas.push("En obra pero sin avance esta semana:");
    lineas.push(`  ${parados.map(etiqueta).join(", ")}`);
    lineas.push("");
  }

  if (input.documentsThisWeek > 0) {
    const plural = input.documentsThisWeek === 1 ? "documento" : "documentos";
    lineas.push(`Se subieron ${input.documentsThisWeek} ${plural} al Centro de Control esta semana.`);
    lineas.push("");
  }

  lineas.push("Entra al Centro de Control para verlo con detalle.");
  const text = lineas.join("\n");

  // --- HTML (versión con formato) -------------------------------------------
  const filasHtml = subieron
    .slice(0, 6)
    .map(
      ({ row, delta }) =>
        `<tr><td style="padding:4px 0;color:#1a1d1a;font-weight:600;">${etiqueta(row)}</td>` +
        `<td style="padding:4px 0;text-align:right;color:#1a1d1a;">${num(row.now)}%</td>` +
        `<td style="padding:4px 0 4px 14px;text-align:right;color:#2f5d50;font-weight:600;">${signo(delta)}</td></tr>`,
    )
    .join("");

  const bloqueMovimiento = subieron.length
    ? `<p style="margin:20px 0 6px;font-weight:700;color:#1a1d1a;">Lo que más se movió</p>
       <table style="width:100%;border-collapse:collapse;font-size:15px;">${filasHtml}</table>`
    : esPrimero
      ? ""
      : `<p style="margin:20px 0 6px;color:#5c625b;">Ningún edificio ha cambiado su avance esta semana.</p>`;

  const bloqueParados = parados.length
    ? `<p style="margin:18px 0 4px;font-weight:700;color:#1a1d1a;">En obra pero sin avance</p>
       <p style="margin:0;color:#5c625b;font-size:15px;">${parados.map(etiqueta).join(" · ")}</p>`
    : "";

  const bloqueDocs = input.documentsThisWeek > 0
    ? `<p style="margin:18px 0 0;color:#5c625b;font-size:15px;">Se subieron <b>${input.documentsThisWeek}</b> ${
        input.documentsThisWeek === 1 ? "documento" : "documentos"
      } esta semana.</p>`
    : "";

  const html = `<div style="margin:0;padding:24px;background:#f7f7f4;font-family:Arial,Helvetica,sans-serif;color:#1a1d1a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dedfd9;">
    <div style="background:#142033;padding:22px 24px;">
      <div style="color:#83baa7;font-size:12px;letter-spacing:.12em;font-weight:700;">ARAYA · CENTRO DE CONTROL</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">Resumen de la semana</div>
      <div style="color:#c9c2b6;font-size:13px;margin-top:2px;">${input.weekLabel}</div>
    </div>
    <div style="padding:24px;">
      <div style="font-size:34px;font-weight:800;color:#142033;line-height:1;">${num(input.overallNow)}<span style="font-size:20px;">%</span></div>
      <p style="margin:8px 0 0;color:#5c625b;font-size:15px;">${variacionGlobal}</p>
      ${bloqueMovimiento}
      ${bloqueParados}
      ${bloqueDocs}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #dedfd9;color:#868c84;font-size:12px;">
      Este resumen se envía solo cada semana a las personas dadas de alta en el Centro de Control.
    </div>
  </div>
</div>`;

  const asuntoVariacion = esPrimero || Math.abs(deltaGlobal) <= CAMBIO_MINIMO
    ? ""
    : ` (${signo(deltaGlobal)} pts)`;
  const subject = `ARAYA · Resumen de la semana — ${num(input.overallNow)}%${asuntoVariacion}`;

  return { subject, text, html };
}
