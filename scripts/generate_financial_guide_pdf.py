"""Genera la guía breve para entregar y validar información financiera.

    python scripts/generate_financial_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_financiera_araya.pdf`` y se copia a
``historical/data-center/guias/`` para que el Centro de datos lo sirva.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from reportlab.lib.colors import white
from reportlab.pdfgen import canvas

from generate_staff_guide_pdf import (
    BLUE_PALE,
    BOTTOM,
    CREAM,
    INK,
    LINE,
    MARGIN_X,
    MUTED,
    NAVY,
    ORANGE,
    ORANGE_DARK,
    PAGE_H,
    PAGE_W,
    PALE,
    RED_PALE,
    SAGE,
    SAGE_PALE,
    draw_bullets,
    draw_contain,
    draw_page_frame,
    draw_section_title,
    draw_wrapped,
    font_name,
    register_fonts,
    rounded_rect,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "output" / "pdf" / "guia_financiera_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-financiera-araya.pdf"
CONTENT_W = PAGE_W - 2 * MARGIN_X


def cover(c: canvas.Canvas) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(ORANGE)
    c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)

    logo = PUBLIC / "bricket-mark.png"
    if logo.exists():
        draw_contain(c, logo, MARGIN_X, PAGE_H - 132, 66, 66)

    c.setFillColor(ORANGE)
    c.setFont(font_name("Body-Bold"), 8.4)
    c.drawString(MARGIN_X, PAGE_H - 168, "ARAYA PUNTA CANA  |  GRUPO BRICKET")

    c.setFillColor(white)
    c.setFont(font_name("Display-Bold"), 31)
    c.drawString(MARGIN_X, PAGE_H - 218, "Datos financieros")
    c.drawString(MARGIN_X, PAGE_H - 256, "sin bloqueos innecesarios")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 282, MARGIN_X + 74, PAGE_H - 282)

    draw_wrapped(
        c,
        "Cómo entregar balances, resultados, cuentas por pagar y flujos; qué "
        "comprueba el Centro de Control; y cómo leer el recibo sin volver a "
        "subir un original que ya está protegido.",
        MARGIN_X,
        PAGE_H - 312,
        CONTENT_W * 0.72,
        size=11.4,
        leading=17,
        color=CREAM,
    )

    box_y = 150
    rounded_rect(c, MARGIN_X, box_y, CONTENT_W, 132, white, white, 14)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawString(MARGIN_X + 22, box_y + 104, "LA REGLA CORTA")
    draw_wrapped(
        c,
        "Sube una vez. Lee el recibo. Corrige sólo lo aislado.",
        MARGIN_X + 22,
        box_y + 82,
        CONTENT_W - 44,
        font="Display-Bold",
        size=13.5,
        leading=18,
        color=INK,
    )
    draw_wrapped(
        c,
        "Un descuadre no bloquea el archivo entero. Los grupos seguros se "
        "publican y la parte dudosa queda señalada con su diferencia y fuente.",
        MARGIN_X + 22,
        box_y + 40,
        CONTENT_W - 44,
        size=9.4,
        leading=13,
        color=MUTED,
    )

    c.setFillColor(CREAM)
    c.setFont(font_name("Body"), 8)
    c.drawString(MARGIN_X, 96, "Guía interna para administración, finanzas y dirección")
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, 80, "3 páginas  ·  edición 22.08.2026")


def draw_role(c: canvas.Canvas, x: float, y: float, width: float, title: str, body: str, accent, fill) -> None:
    rounded_rect(c, x, y, width, 108, fill, fill, 12, 0)
    c.setFillColor(accent)
    c.rect(x + 15, y + 82, 30, 3, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(x + 15, y + 61, title)
    draw_wrapped(c, body, x + 15, y + 43, width - 30, size=8.3, leading=11.2, color=MUTED)


def page_entrega(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Entrega y recibo")
    y = draw_section_title(
        c,
        "PERMISOS SEPARADOS",
        "Entregar no significa poder consultar",
        "El administrador decide tres permisos distintos. Así el equipo puede "
        "aportar documentos sin abrir cifras que no le corresponden.",
    )
    y -= 132
    gap = 11
    width = (CONTENT_W - 2 * gap) / 3
    roles = [
        ("Entregar", "Sube documentos financieros y recibe el estado de su procesamiento.", ORANGE, RED_PALE),
        ("Consultar", "Abre Finanzas, sus documentos, cifras, informes y gráficos.", NAVY, BLUE_PALE),
        ("Validar", "Resuelve datos aislados y aprueba publicaciones financieras protegidas.", SAGE, SAGE_PALE),
    ]
    for index, role in enumerate(roles):
        draw_role(c, MARGIN_X + index * (width + gap), y, width, *role)

    y -= 34
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 16)
    c.drawString(MARGIN_X, y, "Qué ocurre al subir")
    y -= 24
    y = draw_bullets(
        c,
        [
            "El original se guarda primero, con persona, fecha, moneda y corte.",
            "El lector directo extrae lo conocido. La IA sólo completa huecos que no cubre el lector.",
            "Se comprueban estructura, ecuaciones, moneda, periodo y autoridad de la fuente.",
            "Cada grupo seguro se publica. Un grupo descuadrado queda aislado sin frenar el resto.",
            "La revisión se relee y se contrasta en todas las pantallas afectadas.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9,
        leading=12.5,
        color=MUTED,
    )

    y -= 20
    rounded_rect(c, MARGIN_X, y - 118, CONTENT_W, 118, PALE, PALE, 12, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.5)
    c.drawString(MARGIN_X + 18, y - 25, "EL RECIBO ES LA RESPUESTA")
    draw_wrapped(
        c,
        "Muestra publicados, sin cambios, aislados, controles contables, "
        "decisiones de autoridad, conversiones monetarias, cifra anterior y "
        "nueva, pantallas afectadas y comprobación posterior. Si el expediente "
        "está observado, ábrelo: no vuelvas a subir el mismo archivo.",
        MARGIN_X + 18,
        y - 45,
        CONTENT_W - 36,
        size=9,
        leading=12.5,
        color=INK,
    )


def draw_check(c: canvas.Canvas, y: float, title: str, formula: str, body: str, accent, fill) -> float:
    height = 75
    rounded_rect(c, MARGIN_X, y - height, CONTENT_W, height, white, LINE, 11)
    c.setFillColor(accent)
    c.roundRect(MARGIN_X, y - height, 5, height, 2.5, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(font_name("Body-Bold"), 9.5)
    c.drawString(MARGIN_X + 18, y - 24, title)
    c.setFillColor(fill)
    c.roundRect(MARGIN_X + 206, y - 34, 204, 20, 8, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawCentredString(MARGIN_X + 308, y - 27, formula)
    draw_wrapped(c, body, MARGIN_X + 18, y - 47, CONTENT_W - 36, size=8.2, leading=10.7, color=MUTED)
    return y - height - 10


def page_controles(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Controles financieros")
    y = draw_section_title(
        c,
        "CONTROL AUTOMÁTICO",
        "Qué se comprueba antes de publicar",
        "Las tolerancias monetarias evitan falsos avisos por redondeo. Una "
        "diferencia real queda cuantificada en el expediente.",
    )
    y -= 14
    y = draw_check(c, y, "Balance fiduciario", "ACTIVO = PASIVO + PATRIMONIO", "También comprueba patrimonio bruto más resultado del periodo.", NAVY, BLUE_PALE)
    y = draw_check(c, y, "Resultados", "INGRESOS - GASTOS = RESULTADO", "Se aplica por separado al mes y al acumulado.", SAGE, SAGE_PALE)
    y = draw_check(c, y, "Balance de comprobación", "DÉBITO = CRÉDITO · DIFERENCIA = 0", "Impide publicar un balance de sumas y saldos descuadrado.", ORANGE, RED_PALE)
    y = draw_check(c, y, "Flujo mensual", "TOTAL = URBANISMO + EDIFICIOS", "Cada mes se valida de forma independiente; sólo se aísla el mes incorrecto.", NAVY, BLUE_PALE)

    y -= 8
    rounded_rect(c, MARGIN_X, y - 102, CONTENT_W, 102, SAGE_PALE, SAGE_PALE, 12, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.5)
    c.drawString(MARGIN_X + 18, y - 25, "MONEDA Y FUENTE")
    draw_wrapped(
        c,
        "Indica DOP o USD al cargar. El sistema conserva el valor original, "
        "normaliza cada clave a su moneda canónica y registra el tipo aplicado. "
        "Para el mismo corte, prevalece la fuente con mayor autoridad; un corte "
        "anterior nunca sustituye al vigente.",
        MARGIN_X + 18,
        y - 45,
        CONTENT_W - 36,
        size=8.9,
        leading=12.2,
        color=INK,
    )

    y -= 122
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Plantillas recomendadas")
    y -= 20
    draw_wrapped(
        c,
        "Centro de datos → Descargar plantilla mensual: Balance fideicomiso, "
        "Resultados fideicomiso y Flujo mensual. Rellena sólo la columna valor; "
        "las filas vacías no borran nada.",
        MARGIN_X,
        y,
        CONTENT_W,
        size=9,
        leading=12.5,
        color=MUTED,
    )

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2)
    c.line(MARGIN_X, BOTTOM + 34, MARGIN_X + 60, BOTTOM + 34)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 8.2)
    c.drawString(MARGIN_X, BOTTOM + 16, "Ante una incidencia, comparte el número de revisión; nunca envíes cifras por fuera del expediente.")


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Guía financiera - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Entrega, validación y publicación de información financiera")
    c.setKeywords("Bricket Control, ARAYA, finanzas, balance, flujo, recibo")
    pages = [cover, page_entrega, page_controles]
    for index, page in enumerate(pages):
        page(c)
        if index < len(pages) - 1:
            c.showPage()
    c.save()
    PUBLISHED.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUTPUT, PUBLISHED)
    return OUTPUT


if __name__ == "__main__":
    path = build_pdf()
    print(path)
