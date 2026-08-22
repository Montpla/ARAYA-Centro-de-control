"""Genera la guía de actualización mensual: los tres archivos del mes.

Cada mes, el Centro de Control se pone al día con tres archivos: el Informe
Ejecutivo (obra), el Excel de flujo reprogramado (finanzas) y el plan de
Project (cronograma). No hay que tocar cifras a mano: se suben y el panel
publica cada bloque seguro; si detecta una diferencia la aísla en el recibo.
Esta guía dice qué archivo mueve qué, y cómo
comprobar en diez segundos que ha entrado.

Reutiliza la identidad visual de la guía corporativa (mismos colores, fuentes y
retículas) importando sus utilidades, para que todas se lean como parte de la
misma familia.

    python scripts/generate_monthly_update_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_actualizacion_mensual_araya.pdf`` y se
copia a ``historical/data-center/guias/`` para que el Centro de datos lo sirva y
el despliegue lo suba a R2 automáticamente.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from reportlab.lib.colors import Color, white
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
    text_width,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "output" / "pdf" / "guia_actualizacion_mensual_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-actualizacion-mensual-araya.pdf"

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
    c.setFont(font_name("Display-Bold"), 33)
    c.drawString(MARGIN_X, PAGE_H - 218, "Actualización")
    c.drawString(MARGIN_X, PAGE_H - 256, "del mes")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 282, MARGIN_X + 74, PAGE_H - 282)

    draw_wrapped(
        c,
        "Cada mes, el Centro de Control se pone al día con tres archivos. Los "
        "subes y el panel —cifras, colores, gráficas y avisos— se actualiza "
        "solo. Antes de publicar comprueba formato, periodo, moneda y coherencia; "
        "si algo no cuadra, lo explica sin frenar el resto. Esta guía dice cuál mueve qué.",
        MARGIN_X,
        PAGE_H - 312,
        CONTENT_W * 0.66,
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
        "Tres archivos y el mes queda cerrado, sin tocar una sola cifra.",
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
        "Informe Ejecutivo (obra) · Excel de flujo (finanzas) · plan de Project "
        "guardado como XML (cronograma). El orden da igual.",
        MARGIN_X + 22,
        box_y + 40,
        CONTENT_W - 44,
        size=9.4,
        leading=13,
        color=MUTED,
    )

    c.setFillColor(CREAM)
    c.setFont(font_name("Body"), 8)
    c.drawString(MARGIN_X, 96, "Guía interna para el personal de obra y oficina")
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, 80, "3 páginas  ·  3 minutos de lectura")


def draw_archivo(
    c: canvas.Canvas,
    numero: str,
    titulo: str,
    formato: str,
    cuerpo: str,
    mueve: list[str],
    x: float,
    y: float,
    alto: float,
    acento: Color,
    pale: Color,
) -> None:
    rounded_rect(c, x, y, CONTENT_W, alto, white, LINE, 12)
    c.setFillColor(acento)
    c.roundRect(x, y, 5, alto, 2.5, fill=1, stroke=0)

    c.setFillColor(pale)
    c.circle(x + 34, y + alto - 30, 15, fill=1, stroke=0)
    c.setFillColor(acento)
    c.setFont(font_name("Display-Bold"), 15)
    c.drawCentredString(x + 34, y + alto - 35, numero)

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 14)
    c.drawString(x + 62, y + alto - 30, titulo)

    fmt_w = text_width(formato, "Body-Bold", 7) + 16
    c.setFillColor(pale)
    c.roundRect(PAGE_W - MARGIN_X - 16 - fmt_w, y + alto - 33, fmt_w, 17, 8.5, fill=1, stroke=0)
    c.setFillColor(acento)
    c.setFont(font_name("Body-Bold"), 7)
    c.drawString(PAGE_W - MARGIN_X - 8 - fmt_w, y + alto - 28, formato)

    after = draw_wrapped(
        c,
        cuerpo,
        x + 62,
        y + alto - 52,
        CONTENT_W - 62 - 22,
        size=9,
        leading=12.4,
        color=MUTED,
    )
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(x + 62, after - 2, "ACTUALIZA:")
    draw_wrapped(
        c,
        "  " + "  ·  ".join(mueve),
        x + 62 + text_width("ACTUALIZA:", "Body-Bold", 7.4),
        after - 2,
        CONTENT_W - 62 - 22 - text_width("ACTUALIZA:", "Body-Bold", 7.4),
        size=8.6,
        leading=11,
        color=INK,
    )


def page_archivos(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Los tres archivos")
    y = draw_section_title(
        c,
        "CADA MES",
        "Los tres archivos del mes",
        "Cada uno alimenta una parte del panel. Se suben desde Cargar archivo, "
        "en cualquier orden.",
    )

    y -= 18
    archivos = [
        (
            "1",
            "Informe Ejecutivo",
            ".pptx",
            "El PowerPoint del corte. De su tabla de avance por edificio y oficio "
            "(la cubicación) sale el avance físico de cada edificio y apartamento.",
            ["Avance por edificio", "Global", "Edificios en marcha", "Curva S"],
            118,
            ORANGE,
            RED_PALE,
        ),
        (
            "2",
            "Excel de flujo reprogramado",
            ".xlsx",
            "El libro de finanzas de la Fase I. De su hoja de comparación mensual "
            "sale el flujo real de cada mes (Urbanismo, Edificios y total).",
            ["Flujo mensual de finanzas", "Real vs. presupuesto"],
            110,
            SAGE,
            SAGE_PALE,
        ),
        (
            "3",
            "Plan de Project",
            ".xml",
            "El plan del cronograma. XML entra directamente. También puedes "
            "subir el .mpp: queda guardado y se convierte automáticamente a XML.",
            ["% de cronograma", "Fecha de fin", "Avance del plan por edificio"],
            118,
            NAVY,
            BLUE_PALE,
        ),
    ]
    for numero, titulo, formato, cuerpo, mueve, alto, acento, pale in archivos:
        y -= alto
        draw_archivo(c, numero, titulo, formato, cuerpo, mueve, MARGIN_X, y, alto, acento, pale)
        y -= 12

    y -= 6
    rounded_rect(c, MARGIN_X, y - 74, CONTENT_W, 74, PALE, PALE, 12, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "PUBLICACIÓN AUTOMÁTICA CON CONTROL")
    draw_wrapped(
        c,
        "Cada bloque cuadrado entra solo. Finanzas valida ecuaciones, moneda, "
        "corte y fuente; cualquier bloque dudoso queda aislado con diagnóstico. "
        "La revisión publicada se comprueba de nuevo en todas sus pantallas.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )


def page_comprobar(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Comprobar y avisos")
    y = draw_section_title(
        c,
        "EN DIEZ SEGUNDOS",
        "Comprobar que el mes ha entrado",
        "Al terminar cada subida, el mensaje dice cuántos datos se actualizaron. "
        "Si quieres verlo en el panel, mira estas tres cosas.",
    )

    y -= 16
    y = draw_bullets(
        c,
        [
            "El corte cambia a la fecha del mes nuevo (arriba, en el resumen del "
            "proyecto).",
            "El avance físico y la Curva S se mueven; los colores del plano "
            "cambian en los edificios que avanzaron.",
            "En finanzas, la barra del mes nuevo aparece como “Real” en "
            "el flujo reprogramado.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9.2,
        leading=12.8,
        color=MUTED,
    )

    y -= 14
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Un dato no entra: qué mirar")
    y -= 20
    y = draw_wrapped(
        c,
        "Si una cifra concreta no cambia, casi siempre es porque el dato no "
        "nombra su edificio, o porque es el mismo valor que ya había (no hay "
        "nada que mover). El original siempre se guarda, con tu nombre y la "
        "fecha; nunca se pierde. El detalle está en la guía de formatos.",
        MARGIN_X,
        y,
        CONTENT_W,
        size=9.2,
        leading=13,
        color=MUTED,
    )

    y -= 20
    rounded_rect(c, MARGIN_X, y - 78, CONTENT_W, 78, BLUE_PALE, BLUE_PALE, 12, 0)
    c.setFillColor(NAVY)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "Y AVISA AL MÓVIL")
    draw_wrapped(
        c,
        "Cuando el mes entra, a quien tenga los avisos activados le llega una "
        "notificación al móvil con la novedad. Así la oficina se entera sin "
        "tener que estar mirando el panel.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )
    y -= 78

    y -= 24
    rounded_rect(c, MARGIN_X, y - 74, CONTENT_W, 74, SAGE_PALE, SAGE_PALE, 12, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI SÓLO TE QUEDAS CON UNA COSA")
    draw_wrapped(
        c,
        "Subes los tres archivos y lees su recibo: publicados, aislados y vistas "
        "comprobadas. No vuelvas a subir el original si algo queda observado; "
        "abre el diagnóstico del expediente.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2)
    c.line(MARGIN_X, BOTTOM + 34, MARGIN_X + 60, BOTTOM + 34)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 8.2)
    c.drawString(
        MARGIN_X,
        BOTTOM + 16,
        "¿Dudas con un archivo del mes? Pregunta al administrador del Centro de Control.",
    )


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Guía de actualización mensual - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Los tres archivos que actualizan el panel cada mes")
    c.setKeywords("Bricket Control, ARAYA, actualización mensual, informe, flujo, Project")

    pages = [cover, page_archivos, page_comprobar]
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
