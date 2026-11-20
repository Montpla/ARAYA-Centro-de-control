// Comprobación de los originales y de los datos servidos. Nunca imprime valores
// económicos: sólo identidad, contadores y claves que no coincidan.
import { createHash } from "node:crypto";
import { readGanttHtml } from "../lib/gantt-html.ts";
import { ganttSchedules } from "../lib/gantt-data.ts";
import { readXlsxSheets } from "../lib/xlsx-reader.ts";
import { materializeLiveRoot } from "../lib/live-data.ts";
import { reprogrammedFlowMonths, reprogrammedFlowScopes } from "../app/reprogrammed-flow-data.ts";

const originals = [
  ["gantt_31-10- corte Edificaciones.html", "3195e34dcc9dbd59c2cb0f4903a587ee9b27b8b1a55424d641deb695e53e0680"],
  ["Gantt_Urbanismo_Araya_corte-31-oct-2026.html", "8941ef9fa62b90c8ace9c467d38399b2b8933507dd23c4d8745f508bd53ce22e"],
  ["Informe_Ejecutivo_ARAYA_Octubre_Definitivo_v8.pptx", "04d57253ba3a7cd96534d2f5ca3297889ae1989df9cec01304ec666b4d0cdc8a"],
  ["ARAYA_Flujo_I_reprogramado_Oct2026_v4.xlsx", "6bb3efc4ec8ac84a96d3279e868cb4afff3402a1e85467b92f39632a32072ef6"],
];
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const close = (a,b) => typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) < .005;

export async function auditOctoberDocuments({ files, values, Cookie, productionUrl }) {
  const schedules = materializeLiveRoot("ganttSchedules", ganttSchedules, values);
  const months = materializeLiveRoot("reprogrammedFlowMonths", reprogrammedFlowMonths, values);
  const scopes = materializeLiveRoot("reprogrammedFlowScopes", reprogrammedFlowScopes, values);
  let registered = 0;
  for (const [name, expectedHash] of originals) {
    const file = files.filter((entry) => !entry.deletedAt && !entry.supersededByFileId && entry.originalName === name).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if (!file) { console.log(`Documento del lote todavía no registrado: ${name}`); continue; }
    const response = await fetch(`${productionUrl}/api/files?download=${encodeURIComponent(file.id)}`, { headers: { Cookie } });
    if (!response.ok) throw new Error(`No se pudo contrastar el documento ${name} (${response.status}).`);
    const bytes = await response.arrayBuffer();
    const hash = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
    if (expectedHash && hash !== expectedHash) throw new Error(`El original ${name} no coincide con el archivo aportado.`);
    console.log(`Original del lote verificado: ${name} · SHA-256 ${hash}`);
    registered += 1;
    if (/\.html$/i.test(name)) {
      const expected = readGanttHtml(new TextDecoder().decode(bytes), name);
      if (!expected || JSON.stringify(expected.schedule) !== JSON.stringify(schedules[expected.kind])) throw new Error(`El Gantt servido no coincide íntegramente con ${name}.`);
      console.log(`Gantt contrastado: ${expected.schedule.tasks.length} tareas · corte ${expected.schedule.cutoff} · fechas y datos originales coincidentes.`);
    }
    if (/\.xlsx$/i.test(name)) {
      const sheets = await readXlsxSheets(bytes); const expected = new Map(); const forecast = new Map();
      const indexOf = (value) => months.findIndex((month) => normalize(month.month) === normalize(value));
      for (const sheet of sheets) {
        const header = sheet.findIndex((row) => normalize(row.A) === "mes" && normalize(row.K) === "total real");
        if (header >= 0) for (const row of sheet.slice(header+1)) {
          const index = indexOf(row.A); if (index < 0) continue;
          const current = Number(row.K), original = Number(row.J);
          if (![current,original,Number(row.C),Number(row.G)].every(Number.isFinite)) throw new Error("La comparación mensual no contiene los valores numéricos esperados.");
          expected.set(index, { status: "actual", currentDop: current, originalDop: original, urbanismDop: Number(row.C), buildingsDop: Number(row.G), varianceDop: Math.round((original-current)*100)/100 });
        }
        let scope="", active=false;
        for (const row of sheet) {
          if (["urbanismo","edificios"].includes(normalize(row.A))) { scope=normalize(row.A); active=false; }
          if (scope && normalize(row.A)==="mes" && normalize(row.B)==="presupuesto original" && normalize(row.C)==="presupuesto reprogramado") { active=true; continue; }
          if (!active) continue;
          const index=indexOf(row.A); if (index<0 || expected.has(index)) continue;
          const pair=forecast.get(index)??{}; pair[scope]={original:Number(row.B),current:Number(row.C)}; forecast.set(index,pair);
        }
      }
      for (const [index,pair] of forecast) if (pair.urbanismo && pair.edificios && !expected.has(index)) {
        const current=pair.urbanismo.current+pair.edificios.current, original=pair.urbanismo.original+pair.edificios.original;
        expected.set(index,{status:"forecast",currentDop:current,originalDop:original,urbanismDop:pair.urbanismo.current,buildingsDop:pair.edificios.current,varianceDop:current-original});
      }
      const errors=[]; let fields=0;
      for (const [index,row] of expected) for (const [key,value] of Object.entries(row)) {
        const actual=months[index]?.[key];
        if (typeof value==="string" ? actual!==value : !close(actual,value)) errors.push(`reprogrammedFlowMonths.${index}.${key}`); else fields+=1;
      }
      for (const sheet of sheets) {
        const header=sheet.findIndex((row)=>normalize(row.B)==="presupuestado" && normalize(row.C)==="real" && normalize(row.F).includes("anticipos acumulados"));
        if(header<0)continue;
        for(const [label,id] of [["urbanismo","urbanism"],["edificios","buildings"]]){
          const row=sheet.slice(header+1).find((r)=>normalize(r.A).startsWith(label)),live=scopes.find((s)=>s.id===id);
          if(!row||!live){errors.push(`reprogrammedFlowScopes.${id}`);continue;}
          for(const [column,key] of [["B","budgetPeriodDop"],["C","actualPeriodDop"],["D","varianceDop"],["E","varianceRatio"],["F","advancesAccumulatedDop"],["G","actualWithAdvancesDop"]]){
            if(!close(live[key],Number(row[column])))errors.push(`reprogrammedFlowScopes.${id}.${key}`);else fields+=1;
          }
        }
      }
      if(errors.length)throw new Error(`No coinciden estas claves del flujo: ${errors.join(", ")}`);
      console.log(`Flujo contrastado: ${expected.size} meses · ${fields} campos coincidentes · anticipos separados · sin mostrar importes.`);
    }
  }
  console.log(`Originales del lote registrados y contrastados: ${registered} de ${originals.length}.`);
}
