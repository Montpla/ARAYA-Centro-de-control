// Selección de archivos a reprocesar. Separada del script para poder probarla.

const PROCESABLES = new Set(["pptx", "docx", "pdf", "xlsx", "xls", "csv", "xml", "zip", "json"]);

// Con FILE_ID exacto el filtro por nombre no se aplica: el id ya identifica el
// expediente y el filtro por defecto («jul») lo descartaría sin motivo.
export function filtroEfectivo(fileId, filtro) {
  return String(fileId ?? "").trim() ? "" : String(filtro ?? "jul").toLowerCase();
}

export function seleccionarObjetivo(files, { fileId = "", filtro = "jul", formatos = [] } = {}) {
  const id = String(fileId ?? "").trim();
  const texto = filtroEfectivo(id, filtro);
  const permitidos = formatos.length ? new Set(formatos) : PROCESABLES;
  return files.filter((f) => {
    const ext = String(f.extension).toLowerCase();
    return !f.deletedAt &&
      !f.supersededByFileId &&
      (!id || f.id === id) &&
      f.originalName.toLowerCase().includes(texto) &&
      PROCESABLES.has(ext) &&
      permitidos.has(ext);
  });
}
