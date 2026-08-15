#!/usr/bin/env python3
"""Genera las hojas .xlsx que usan las pruebas del lector de Excel.

Se construyen a mano, con la misma estructura que escribe Excel —ZIP con
sharedStrings y sheet1—, para poder fijar los casos que importan: un membrete
encima de la cabecera, celdas vacias a medio rellenar y una fila que no nombra
ningun edificio. Ejecutar tras cambiar los casos:

    python3 scripts/generar-fixtures-xlsx.py
"""
import zipfile
from pathlib import Path

SALIDA = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def celda(ref, valor, compartidas):
    if isinstance(valor, (int, float)):
        return f'<c r="{ref}"><v>{valor}</v></c>'
    if valor not in compartidas:
        compartidas[valor] = len(compartidas)
    return f'<c r="{ref}" t="s"><v>{compartidas[valor]}</v></c>'


def construir(ruta, filas):
    compartidas = {}
    cuerpo = []
    for i, fila in enumerate(filas, start=1):
        celdas = "".join(
            celda(f"{chr(65 + j)}{i}", v, compartidas)
            for j, v in enumerate(fila)
            if v is not None and v != ""
        )
        cuerpo.append(f'<row r="{i}">{celdas}</row>')
    hoja = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(cuerpo)}</sheetData></worksheet>'
    )
    orden = sorted(compartidas.items(), key=lambda kv: kv[1])
    sst = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(orden)}" uniqueCount="{len(orden)}">'
        + "".join(
            f'<si><t>{t.replace("&", "&amp;").replace("<", "&lt;")}</t></si>'
            for t, _ in orden
        )
        + "</sst>"
    )
    tipos = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-'
        'officedocument.spreadsheetml.sheet.main+xml"/></Types>'
    )
    libro = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", tipos)
        z.writestr("xl/workbook.xml", libro)
        z.writestr("xl/sharedStrings.xml", sst)
        z.writestr("xl/worksheets/sheet1.xml", hoja)
    print(f"{ruta.name}: {len(filas)} filas")


SALIDA.mkdir(parents=True, exist_ok=True)

# Plantilla de clave y valor, con el membrete que suele llevar encima y una
# fila sin rellenar que no debe tocar el dato existente.
construir(SALIDA / "plantilla-avance.xlsx", [
    ["ARAYA - avance de obra", "", "", ""],
    ["corte 31/07/2026", "", "", ""],
    ["clave", "valor", "descripcion", "valor actual"],
    ["buildings.TH-14.progress", 62.5, "TH-14 - avance ejecutado (%)", 3.1],
    ["buildings.TH-03.progress", "", "TH-03 - avance ejecutado (%)", 40.6],
    ["buildings.TH-07.progress", 21, "TH-07 - avance ejecutado (%)", 12.2],
])

# Tabla tal y como la mantiene la oficina, sin claves tecnicas.
construir(SALIDA / "tabla-obra.xlsx", [
    ["Informe mensual de avance", "", ""],
    ["", "", ""],
    ["Edificio", "% Avance", "Observaciones"],
    ["TH-14", 62.5, "Estructura terminada"],
    ["TH-03", 44, "En albanileria"],
    ["Zona comun", 10, "No es un edificio"],
])
