#!/usr/bin/env python3
# El lector ligero de PDF (lib/pdf-text.ts) sólo recupera la cabecera del
# reporte semanal de seguridad más reciente (31 ago-5 sep); la tabla de
# datos usa una codificación de fuente que no descifra. Este script usa
# PyMuPDF (mucho más completo) sobre el mismo PDF, ya descargado por
# scripts/leer-pdf-seguridad-semana1.mjs, para intentar leer la tabla real.
# Se retira tras corregir safetyMetrics.
import fitz

doc = fitz.open("seguridad-semana1.pdf")
print(f"Páginas: {doc.page_count}")
for i, page in enumerate(doc):
    print(f"\n=== Página {i + 1}: texto ===")
    print(page.get_text())
    print(f"=== Página {i + 1}: tablas detectadas ===")
    try:
        tablas = page.find_tables()
        for j, tabla in enumerate(tablas):
            print(f"-- Tabla {j + 1} --")
            for fila in tabla.extract():
                print(fila)
    except Exception as e:
        print(f"(sin tablas: {e})")
