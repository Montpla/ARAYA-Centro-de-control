import { antonelyPayableVendorsAll } from "./antonely-finance-data";

export const PAYABLE_SOURCE_NAME = "Datos para Informe Jun-26.xlsx";
export const PAYABLE_SOURCE_SHEET = "Cuentas por Pagar Jun-26";
export const PAYABLE_SOURCE_URL = "/data-center/junio-2026/datos-para-informe-jun-26.xlsx";
export const PAYABLE_CUTOFF = "2026-06-30";

export type PayableInvoiceLine = {
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  reference: string | null;
  category: string;
  amountDop: number;
  agingIndex: number;
  sourceRow: number;
  documentUrl: string | null;
};

type PayableSourceTuple = readonly [
  vendorIndex: number,
  invoiceDate: string,
  dueDate: string,
  reference: string | null,
  category: string,
  amountDop: number,
  agingIndex: number,
  sourceRow: number,
];

const payableSourceRows = [
  [40, "2026-05-22", "2026-05-22", "E310002285181", "1-4-1 Urbanismo", 14180, 2, 9],
  [38, "2026-06-08", "2026-06-20", "B0100000004", "1-4-1 Urbanismo", 14580, 1, 10],
  [5, "2026-06-13", "2026-07-13", "E310000989574", "1-4-1 Urbanismo", 4120, 0, 11],
  [5, "2026-06-15", "2026-07-15", "E310000989869", "1-4-1 Urbanismo", 14500.5, 0, 12],
  [15, "2026-06-16", "2026-06-26", "B0100000111", "1-4-1 Urbanismo", 173355.6, 1, 13],
  [15, "2026-06-16", "2026-06-26", "B0100000113", "1-4-1 Urbanismo", 111980, 1, 14],
  [1, "2026-06-18", "2026-06-26", "B0100000161", "1-4-1 Urbanismo", 1862967.11, 1, 15],
  [0, "2026-06-02", "2026-07-02", "E310000000590", "1-4-1 Urbanismo", 58796, 0, 16],
  [12, "2026-06-08", "2026-07-08", "E310000273424", "1-4-1 Urbanismo", 485, 0, 17],
  [12, "2026-06-09", "2026-07-09", "E310000273448", "1-4-1 Urbanismo", 24705, 0, 18],
  [12, "2026-06-10", "2026-07-10", "E310000273450", "1-4-1 Urbanismo", 8652.51, 0, 19],
  [0, "2026-06-15", "2026-07-15", "E310000000632", "1-4-1 Urbanismo", 48833.31, 0, 20],
  [5, "2026-06-18", "2026-07-18", "E310000991806", "1-4-1 Urbanismo", 35, 0, 21],
  [5, "2026-06-18", "2026-07-17", "E310000991646", "1-4-1 Urbanismo", 13861, 0, 22],
  [31, "2026-06-24", "2026-07-24", "E310000026687", "1-4-1 Urbanismo", 40324.68, 0, 23],
  [5, "2026-06-26", "2026-07-26", "E310001389213", "1-4-1 Urbanismo", 17834, 0, 24],
  [5, "2026-06-29", "2026-07-29", "E310001390031", "1-4-1 Urbanismo", 330.36, 0, 25],
  [2, "2026-06-12", "2026-06-12", "E310000000003", "1-7 Indirectos de Obra", 806796.06, 1, 29],
  [0, "2026-06-02", "2026-07-02", "E310000000590", "1-5-1 Edificaciones", 2070805.54, 0, 33],
  [12, "2026-06-08", "2026-07-08", "E310000273424", "1-5-1 Edificaciones", 5045.3, 0, 34],
  [12, "2026-06-09", "2026-07-09", "E310000273448", "1-5-1 Edificaciones", 1730, 0, 35],
  [12, "2026-06-10", "2026-07-10", "E310000273450", "1-5-1 Edificaciones", 599.44, 0, 36],
  [0, "2026-06-15", "2026-07-15", "E310000000632", "1-5-1 Edificaciones", 588820.28, 0, 37],
  [5, "2026-06-18", "2026-07-18", "E310000991806", "1-5-1 Edificaciones", 396019.76, 0, 38],
  [5, "2026-06-18", "2026-07-17", "E310000991646", "1-5-1 Edificaciones", 62403.76, 0, 39],
  [31, "2026-06-24", "2026-07-24", "E310000026687", "1-5-1 Edificaciones", 25488, 0, 40],
  [5, "2026-06-26", "2026-07-26", "E310001389213", "1-5-1 Edificaciones", 5434.49, 0, 41],
  [5, "2026-06-29", "2026-07-29", "E310001390031", "1-5-1 Edificaciones", 3696, 0, 42],
  [5, "2026-06-12", "2026-07-11", "E310000989046", "1-5-1 Edificaciones", 15289, 0, 43],
  [19, "2026-02-25", "2026-03-27", "E310000013333", "1-5-1 Edificaciones", 49.4, 4, 44],
  [12, "2026-05-26", "2026-06-25", "E310000273292", "1-5-1 Edificaciones", 47200, 1, 45],
  [12, "2026-05-29", "2026-06-28", "E310000373345", "1-5-1 Edificaciones", 16249.17, 1, 46],
  [12, "2026-06-03", "2026-07-03", "E310000273381", "1-5-1 Edificaciones", 37500.4, 0, 47],
  [12, "2026-06-03", "2026-07-03", "E310000273379", "1-5-1 Edificaciones", 86580.05, 0, 48],
  [11, "2026-06-03", "2026-07-03", "B0100000213", "1-5-1 Edificaciones", 287209.23, 0, 49],
  [0, "2026-06-05", "2026-07-05", "E310000000601", "1-5-1 Edificaciones", 542620.88, 0, 50],
  [0, "2026-06-05", "2026-07-05", "E310000000604", "1-5-1 Edificaciones", 325572.53, 0, 51],
  [5, "2026-06-09", "2026-07-09", "E310000987739", "1-5-1 Edificaciones", 22761, 0, 52],
  [12, "2026-06-09", "2026-07-09", "E310000273441", "1-5-1 Edificaciones", 19300.5, 0, 53],
  [0, "2026-06-10", "2026-07-10", "E310000000623", "1-5-1 Edificaciones", 570931.53, 0, 54],
  [0, "2026-06-10", "2026-07-10", "E310000000622", "1-5-1 Edificaciones", 326563.11, 0, 55],
  [14, "2026-06-11", "2026-06-11", "B0100000422", "1-5-1 Edificaciones", 125606.28, 1, 56],
  [14, "2026-06-11", "2026-06-11", "B0100000424", "1-5-1 Edificaciones", 33317.35, 1, 57],
  [5, "2026-06-13", "2026-07-13", "E310000989651", "1-5-1 Edificaciones", 122940, 0, 58],
  [14, "2026-06-13", "2026-06-13", "B0100000427", "1-5-1 Edificaciones", 32295.88, 1, 59],
  [14, "2026-06-13", "2026-06-13", "B0100000428", "1-5-1 Edificaciones", 50133.96, 1, 60],
  [12, "2026-06-13", "2026-07-13", "E310000273508", "1-5-1 Edificaciones", 7249.92, 0, 61],
  [0, "2026-06-15", "2026-07-15", "E310000000636", "1-5-1 Edificaciones", 61339.75, 0, 62],
  [12, "2026-06-15", "2026-07-15", "E310000273514", "1-5-1 Edificaciones", 64621.14, 0, 63],
  [41, "2026-06-16", "2026-07-16", "E310000039186", "1-5-1 Edificaciones", 2125.07, 0, 64],
  [11, "2026-06-17", "2026-07-17", "B0100000214", "1-5-1 Edificaciones", 152775.81, 0, 65],
  [5, "2026-06-18", "2026-07-17", "E310000991649", "1-5-1 Edificaciones", 517.8, 0, 66],
  [16, "2026-06-18", "2026-07-17", "E310000184761", "1-5-1 Edificaciones", 262723.22, 0, 67],
  [5, "2026-06-19", "2026-07-19", "E310000992369", "1-5-1 Edificaciones", 46824, 0, 68],
  [20, "2026-06-19", "2026-06-30", "E310000000038", "1-5-1 Edificaciones", 129800, 1, 69],
  [0, "2026-06-22", "2026-07-22", "E310000000646", "1-5-1 Edificaciones", 194443.61, 0, 70],
  [0, "2026-06-22", "2026-07-22", "E310000000645", "1-5-1 Edificaciones", 577531.74, 0, 71],
  [6, "2026-06-22", "2026-07-07", "E310000016534", "1-5-1 Edificaciones", 715000, 0, 72],
  [19, "2026-06-22", "2026-07-22", "E310000017814", "1-5-1 Edificaciones", 146911.49, 0, 73],
  [2, "2026-06-22", "2026-06-26", "E310000000004", "1-5-1 Edificaciones", 645239.26, 1, 74],
  [21, "2026-06-23", "2026-07-23", "B0100000651", "1-5-1 Edificaciones", 124100, 0, 75],
  [5, "2026-06-24", "2026-07-24", "E310000994496", "1-5-1 Edificaciones", 43560, 0, 76],
  [35, "2026-06-24", "2026-06-26", "E310000003525", "1-5-1 Edificaciones", 34220, 1, 77],
  [36, "2026-06-29", "2026-07-10", "B0100005325", "1-5-1 Edificaciones", 33100, 0, 78],
  [5, "2026-06-30", "2026-07-30", "E310001390422", "1-5-1 Edificaciones", 15115, 0, 79],
  [17, "2026-06-30", "2026-07-30", "B0100006074", "1-7-4 Vigilancia", 90246.4, 0, 83],
  [9, "2026-06-30", "2026-06-30", "E310000000007", "1-9-1 Inspeccion Tecnica", 506964.3, 1, 87],
  [3, "2026-06-01", "2026-07-03", "B0100001086", "2-2-1 Comisiones por Venta", 704746.92, 0, 91],
  [7, "2026-06-08", "2026-06-26", "E310000000102", "2-2-1 Comisiones por Venta", 581828.5, 1, 92],
  [4, "2026-06-09", "2026-06-26", "B0100000253", "2-2-1 Comisiones por Venta", 468623.25, 1, 93],
  [4, "2026-06-10", "2026-06-26", "B0100000254", "2-2-1 Comisiones por Venta", 609683.23, 1, 94],
  [3, "2026-06-18", "2026-07-03", "B0100001111", "2-2-1 Comisiones por Venta", 628777.8, 0, 95],
  [8, "2026-06-22", "2026-07-10", "B0100000038", "2-2-1 Comisiones por Venta", 530812.67, 0, 96],
  [10, "2026-06-23", "2026-07-10", "B0100000809", "2-2-1 Comisiones por Venta", 486750, 0, 97],
  [17, "2026-05-31", "2026-06-30", "B0100006021", "2-2-4 Gastos Operativos Oficina de ventas", 70233.6, 1, 101],
  [14, "2026-06-11", "2026-06-11", "B0100000423", "2-2-4 Gastos Operativos Oficina de ventas", 26928.31, 1, 102],
  [14, "2026-06-13", "2026-06-13", "B0100000426", "2-2-4 Gastos Operativos Oficina de ventas", 22554.28, 1, 103],
  [39, "2026-06-16", "2026-07-16", "B0100002968", "2-2-4 Gastos Operativos Oficina de ventas", 14560.34, 0, 104],
  [17, "2026-06-30", "2026-07-30", "B0100006080", "2-2-4 Gastos Operativos Oficina de ventas", 67968, 0, 105],
  [13, "2026-06-26", "2026-06-26", "E310000001063", "2-3-2 Debida Diligencia/Desvinculacion-Fiduciaria", 293802.58, 1, 109],
  [42, "2025-10-17", "2025-10-17", null, "2-4-2 Inversion Inicial Promocion y Mercadeo", -14760.54, 5, 113],
  [25, "2026-06-01", "2026-06-18", "REDES SOCIALES MAY-26", "2-4-3 Medios Digitales (Campana y Redes Sociales)", 99358.92, 1, 117],
  [29, "2026-06-01", "2026-06-30", "B0100000107", "2-4-4 Community Management", 70800, 1, 121],
  [27, "2026-06-02", "2026-07-02", "E310000000179", "2-4-4 Community Management", 94400, 0, 122],
  [32, "2026-06-05", "2026-07-03", "B0100000023", "2-4-4 Community Management", 65000, 0, 123],
  [30, "2026-06-11", "2026-07-11", "B0100000071", "2-4-4 Community Management", 69797, 0, 124],
  [28, "2026-06-09", "2026-07-09", "E310000004239", "2-4-5 Vallas Publicitarias", 88269.5, 0, 128],
  [34, "2026-06-10", "2026-07-10", "B0100002566", "2-4-5 Vallas Publicitarias", 21240, 0, 129],
  [34, "2026-06-10", "2026-07-10", "B0100002567", "2-4-5 Vallas Publicitarias", 21240, 0, 130],
  [23, "2026-06-15", "2026-07-15", "E310000005301", "2-4-5 Vallas Publicitarias", 101960, 0, 131],
  [37, "2026-05-15", "2026-05-15", "B0100043093", "2-4-7 Feria y Eventos Publicitarios", 31860, 2, 135],
  [18, "2026-06-22", "2026-06-22", "E310000000116", "2-4-7 Feria y Eventos Publicitarios", 207262.07, 1, 136],
  [22, "2026-03-31", "2026-03-31", "B0100001142", "3-1-1 Permisos Legales y Preliminares", 111300.56, 4, 140],
  [24, "2026-05-21", "2026-05-21", "B0100000531", "3-1-1 Permisos Legales y Preliminares", 101730.75, 2, 141],
  [26, "2026-06-19", "2026-06-26", "B0100000108", "3-1-1 Permisos Legales y Preliminares", 98333.33, 1, 142],
  [33, "2026-06-18", "2026-06-18", "Desistimiento Unidad 27-202.", "Desistimientos por Pagar", 59566.36, 1, 146],
] as const satisfies readonly PayableSourceTuple[];

export const antonelyPayableInvoiceLines: PayableInvoiceLine[] = payableSourceRows.map((row) => ({
  vendorName: antonelyPayableVendorsAll[row[0]].name,
  invoiceDate: row[1],
  dueDate: row[2],
  reference: row[3],
  category: row[4],
  amountDop: row[5],
  agingIndex: row[6],
  sourceRow: row[7],
  documentUrl: null,
}));

export type PayableInvoice = {
  id: string;
  vendorName: string;
  reference: string | null;
  invoiceDate: string;
  dueDate: string;
  amountDop: number;
  agingIndex: number;
  allocations: Array<{
    category: string;
    amountDop: number;
    sourceRow: number;
  }>;
  documentUrl: string | null;
};

export type PayableVendor = {
  name: string;
  amountDop: number;
  invoiceCount: number;
  sourceLineCount: number;
  documentCount: number;
  oldestAgingIndex: number;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePayableInvoiceLines(value: unknown): PayableInvoiceLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const vendorIndex = Number(row.vendorIndex);
    const vendorName =
      cleanText(row.vendorName) ||
      (Number.isInteger(vendorIndex) ? antonelyPayableVendorsAll[vendorIndex]?.name : "");
    const amountDop = Number(row.amountDop);
    const sourceRow = Number(row.sourceRow);
    const agingIndex = Math.max(0, Math.min(5, Number(row.agingIndex) || 0));
    if (!vendorName || !Number.isFinite(amountDop)) return [];
    return [{
      vendorName,
      invoiceDate: cleanText(row.invoiceDate),
      dueDate: cleanText(row.dueDate),
      reference: cleanText(row.reference) || null,
      category: cleanText(row.category) || "Sin categoría",
      amountDop,
      agingIndex,
      sourceRow: Number.isFinite(sourceRow) ? sourceRow : index + 1,
      documentUrl: cleanText(row.documentUrl) || null,
    }];
  });
}

export function buildPayablesDataset(
  lines: PayableInvoiceLine[] = antonelyPayableInvoiceLines,
  metadata: {
    cutoff?: string;
    sourceName?: string;
    sourceSheet?: string;
    sourceUrl?: string;
    updatedAt?: string;
  } = {},
) {
  const invoiceMap = new Map<string, PayableInvoice>();

  lines.forEach((line) => {
    const referenceKey = line.reference || `fila-${line.sourceRow}`;
    const key = [line.vendorName, line.invoiceDate, line.dueDate, referenceKey].join("::");
    const existing = invoiceMap.get(key);
    if (existing) {
      existing.amountDop += line.amountDop;
      existing.agingIndex = Math.max(existing.agingIndex, line.agingIndex);
      existing.documentUrl ||= line.documentUrl;
      existing.allocations.push({
        category: line.category,
        amountDop: line.amountDop,
        sourceRow: line.sourceRow,
      });
      return;
    }
    invoiceMap.set(key, {
      id: `${line.vendorName}-${referenceKey}-${line.invoiceDate}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      vendorName: line.vendorName,
      reference: line.reference,
      invoiceDate: line.invoiceDate,
      dueDate: line.dueDate,
      amountDop: line.amountDop,
      agingIndex: line.agingIndex,
      allocations: [{
        category: line.category,
        amountDop: line.amountDop,
        sourceRow: line.sourceRow,
      }],
      documentUrl: line.documentUrl,
    });
  });

  const invoices = [...invoiceMap.values()].sort((left, right) =>
    right.agingIndex - left.agingIndex ||
    left.dueDate.localeCompare(right.dueDate) ||
    right.amountDop - left.amountDop
  );
  const vendors = [...new Set(lines.map((line) => line.vendorName))].map((name) => {
    const vendorLines = lines.filter((line) => line.vendorName === name);
    const vendorInvoices = invoices.filter((invoice) => invoice.vendorName === name);
    return {
      name,
      amountDop: vendorLines.reduce((sum, line) => sum + line.amountDop, 0),
      invoiceCount: vendorInvoices.length,
      sourceLineCount: vendorLines.length,
      documentCount: vendorInvoices.filter((invoice) => Boolean(invoice.documentUrl)).length,
      oldestAgingIndex: vendorLines.reduce((oldest, line) => Math.max(oldest, line.agingIndex), 0),
    };
  }).sort((left, right) => right.amountDop - left.amountDop);

  return {
    cutoff: metadata.cutoff || PAYABLE_CUTOFF,
    sourceName: metadata.sourceName || PAYABLE_SOURCE_NAME,
    sourceSheet: metadata.sourceSheet || PAYABLE_SOURCE_SHEET,
    sourceUrl: metadata.sourceUrl || PAYABLE_SOURCE_URL,
    updatedAt: metadata.updatedAt || null,
    sourceLineCount: lines.length,
    invoiceCount: invoices.length,
    vendorCount: vendors.length,
    totalDop: lines.reduce((sum, line) => sum + line.amountDop, 0),
    vendors,
    invoices,
  };
}
