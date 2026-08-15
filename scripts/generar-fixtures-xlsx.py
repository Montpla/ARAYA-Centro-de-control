#!/usr/bin/env python3
"""Genera los documentos de Office que usan las pruebas de lectura directa.

Se construyen a mano, con la misma estructura que escribe Excel —ZIP con
sharedStrings y sheet1—, para poder fijar los casos que importan: un membrete
encima de la cabecera, celdas vacias a medio rellenar y una fila que no nombra
ningun edificio. Ejecutar tras cambiar los casos:

    python3 scripts/generar-fixtures-xlsx.py
"""
import zipfile
import zlib
from pathlib import Path

SALIDA = Path(__file__).resolve().parent.parent / "tests" / "fixtures"

# Los ZIP guardan la fecha de cada entrada, asi que regenerar sin mas cambiaba
# todos los bytes aunque el contenido fuese identico. Eso convertia cualquier
# rebase en un conflicto binario imposible de resolver a mano. Con una fecha
# fija, regenerar sin tocar los casos no produce ningun cambio.
FECHA_FIJA = (2026, 1, 1, 0, 0, 0)


def anadir(z, nombre, datos):
    entrada = zipfile.ZipInfo(nombre, date_time=FECHA_FIJA)
    entrada.compress_type = zipfile.ZIP_DEFLATED
    entrada.external_attr = 0o644 << 16
    z.writestr(entrada, datos)



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
        anadir(z, "[Content_Types].xml", tipos)
        anadir(z, "xl/workbook.xml", libro)
        anadir(z, "xl/sharedStrings.xml", sst)
        anadir(z, "xl/worksheets/sheet1.xml", hoja)
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


# --- Word y PowerPoint -------------------------------------------------------
# Comparten envoltorio con Excel (ZIP con XML), asi que sus tablas se leen con
# el mismo mecanismo. El informe en Word trae ademas una celda troceada en dos
# fragmentos, que es como Word guarda el texto cuando cambia el formato.

DOCX_CON_TABLA = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Informe mensual de avance - julio 2026</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>Edificio</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>% Avance</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>TH-</w:t></w:r><w:r><w:t>14</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>62,5</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>TH-03</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>44</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>Zona comun</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl></w:body></w:document>"""

DOCX_SIN_TABLA = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Acta de reunion de obra. El edificio 14 avanza segun lo previsto.</w:t></w:r></w:p>
</w:body></w:document>"""


def docx(ruta, documento):
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        anadir(z, "word/document.xml", documento)
    print(f"{ruta.name}")


def diapositiva(filas):
    tr = "".join(
        "<a:tr>" + "".join(
            f"<a:tc><a:txBody><a:p><a:r><a:t>{c}</a:t></a:r></a:p></a:txBody></a:tc>"
            for c in fila
        ) + "</a:tr>"
        for fila in filas
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f"<p:cSld><p:spTree><a:tbl>{tr}</a:tbl></p:spTree></p:cSld></p:sld>"
    )


docx(SALIDA / "informe-obra.docx", DOCX_CON_TABLA)
docx(SALIDA / "sin-tablas.docx", DOCX_SIN_TABLA)

with zipfile.ZipFile(SALIDA / "comite-obra.pptx", "w", zipfile.ZIP_DEFLATED) as z:
    anadir(z, "ppt/slides/slide1.xml", diapositiva([["Portada"], ["Comite de obra"]]))
    anadir(z, "ppt/slides/slide2.xml", diapositiva([["Edificio", "% Avance"], ["TH-14", "62,5"], ["TH-07", "21"]]))
print("comite-obra.pptx")


# --- Comprimidos y PDF -------------------------------------------------------
#
# Un ZIP de obra real no llega limpio: trae la carpeta oculta que mete macOS al
# comprimir y algun archivo suelto que no son datos. Ambos entran aqui a
# proposito, porque lo que se prueba es que se ignoren.

with zipfile.ZipFile(SALIDA / "corte-mensual.zip", "w", zipfile.ZIP_DEFLATED) as z:
    anadir(z, "__MACOSX/._basura", b"\x00\x01")
    anadir(z, "notas.txt", "esto no se lee")
    anadir(
        z,
        "avance/avance-julio.csv",
        "clave,valor,descripcion\n"
        "buildings.TH-14.progress,62.5,TH-14\n"
        "buildings.TH-07.progress,21,TH-07\n",
    )
print("corte-mensual.zip")


def pdf(ruta, flujo):
    """Escribe el PDF minimo que necesita el lector: un flujo Flate y poco mas.

    No es un PDF completo —no lleva catalogo de paginas ni fuentes—, pero si
    tiene lo unico que el lector mira: `stream ... endstream` con los datos
    comprimidos dentro. Fabricarlo asi mantiene la prueba legible y sin
    depender de ninguna libreria de generacion.
    """
    comprimido = zlib.compress(flujo)
    cuerpo = (
        b"%PDF-1.4\n1 0 obj\n<< /Length "
        + str(len(comprimido)).encode()
        + b" /Filter /FlateDecode >>\nstream\n"
        + comprimido
        + b"\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
    )
    ruta.write_bytes(cuerpo)
    print(ruta.name)


# La ultima linea nombra una zona comun sin codigo de edificio: no debe salir
# ninguna cifra de ella.
pdf(
    SALIDA / "informe-avance.pdf",
    b"BT /F1 12 Tf 72 720 Td (Informe de avance - julio 2026) Tj ET\n"
    b"BT /F1 12 Tf 72 700 Td (TH-14 estructura 62,5 %) Tj ET\n"
    b"BT /F1 12 Tf 72 680 Td (TH-07 albanileria 21 %) Tj ET\n"
    b"BT /F1 12 Tf 72 660 Td (Zona comun 10 %) Tj ET",
)

# Un escaneo es una fotografia: hay flujo, pero dentro no hay una sola cadena
# de texto. Se imita con bytes en blanco.
pdf(SALIDA / "escaneado.pdf", b"\x00" * 512)
