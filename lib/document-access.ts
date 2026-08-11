const financeOnlyDocuments = new Set([
  "/data-center/junio-2026/informe-junio-2026-araya.xlsx",
  "/data-center/junio-2026/datos-para-informe-jun-26.xlsx",
  "/data-center/junio-2026/lamina-flujo-mayo-2026.pptx",
  "/data-center/julio-2026/comparativo-presupuesto-edificio-tipo-a.xls",
  "/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf",
  "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30.xlsx",
  "/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30-copia.xlsx",
  "/data-center/julio-2026/desviacion-mensual-junio-2026.xlsx",
  "/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx",
]);

const financeDocumentPathPattern =
  /(?:^|[-/])(finanzas?|financiero|fideicomiso|balance|resultados?|flujo|cxp|presupuesto|desviacion|prestamo|ifc|antonely)(?:[-./]|$)/i;

export function requiresFinanceDocumentAccess(pathname: string) {
  const normalizedPath = pathname.toLowerCase();
  return (
    financeDocumentPathPattern.test(normalizedPath) ||
    financeOnlyDocuments.has(normalizedPath)
  );
}
