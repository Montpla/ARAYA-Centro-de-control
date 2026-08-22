"""Genera la guía de avisos: cómo recibir las notificaciones en el móvil y el
ordenador.

Es la quinta guía del personal. Las otras explican el programa, la carga de
archivos y el envío del plan; ésta responde la pregunta que llega en cuanto se
activan los avisos automáticos: «¿qué tengo que hacer yo para que me lleguen al
teléfono, como los de WhatsApp?».

La respuesta cabe en dos gestos —dar permiso una vez y, en iPhone, instalar la
app—, así que la guía es corta y va directa a esos dos pasos. El motivo de que
en iPhone haga falta instalarla es de Apple, no del Centro de Control, y se
explica para que nadie lo lea como un fallo.

Reutiliza la identidad visual de la guía corporativa (mismos colores, fuentes y
retículas) importando sus utilidades, para que todas se lean como parte de la
misma familia.

    python scripts/generate_notifications_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_avisos_araya.pdf`` y se copia a
``historical/data-center/guias/`` para que el Centro de datos lo sirva y el
despliegue lo suba a R2 automáticamente.
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
OUTPUT = ROOT / "output" / "pdf" / "guia_avisos_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-avisos-araya.pdf"

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
    c.drawString(MARGIN_X, PAGE_H - 218, "Avisos en el móvil")
    c.drawString(MARGIN_X, PAGE_H - 256, "y el ordenador")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 282, MARGIN_X + 74, PAGE_H - 282)

    draw_wrapped(
        c,
        "El Centro de Control puede avisarte cuando hay novedades —una revisión "
        "nueva, un documento, una comprobación fallida, un vencimiento o una conexión— con un globo en el teléfono o el "
        "ordenador, aunque no lo tengas abierto. Esta guía dice qué hacer para "
        "empezar a recibirlos.",
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
        "Das permiso una vez y ya te llegan solos.",
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
        "En iPhone y iPad hay un paso más: instalar la app en la pantalla de "
        "inicio. Es cosa de Apple, y está en la página 3.",
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


def draw_step(
    c: canvas.Canvas,
    number: str,
    title: str,
    body: str,
    x: float,
    y: float,
    height: float,
    accent: Color,
    pale: Color,
) -> None:
    """Una tarjeta de paso numerado: el número en un círculo a la izquierda."""
    rounded_rect(c, x, y, CONTENT_W, height, white, LINE, 12)
    c.setFillColor(accent)
    c.roundRect(x, y, 5, height, 2.5, fill=1, stroke=0)

    c.setFillColor(pale)
    c.circle(x + 34, y + height - 30, 15, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont(font_name("Display-Bold"), 15)
    c.drawCentredString(x + 34, y + height - 35, number)

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 14)
    c.drawString(x + 62, y + height - 32, title)
    draw_wrapped(
        c,
        body,
        x + 62,
        y + height - 54,
        CONTENT_W - 62 - 24,
        size=9.2,
        leading=12.8,
        color=MUTED,
    )


def page_activar(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Cómo activarlos")
    y = draw_section_title(
        c,
        "UNA SOLA VEZ",
        "Activar los avisos",
        "Dos gestos y ya está. El segundo sólo hace falta en iPhone y iPad; en "
        "Android y ordenador no.",
    )

    y -= 20
    pasos = [
        (
            "1",
            "Abre los avisos y da permiso",
            "Entra al Centro de Control, abre el apartado de avisos (la "
            "campana) y pulsa «Activar notificaciones». El teléfono o el "
            "navegador preguntará si permites los avisos: dale a Permitir. "
            "Eso es todo lo que tiene que hacer cada persona.",
            96,
            ORANGE,
            RED_PALE,
        ),
        (
            "2",
            "Comprueba que ha quedado activo",
            "En ese mismo apartado, el estado pasa a «Activadas · ACTIVO». "
            "Puedes pulsar «Enviar aviso de prueba» para ver un globo de "
            "ejemplo. Si aparece, ya está todo listo.",
            88,
            SAGE,
            SAGE_PALE,
        ),
        (
            "3",
            "En iPhone o iPad, instala la app antes",
            "Apple sólo deja llegar avisos si la app está instalada en la "
            "pantalla de inicio. Ábrela en Safari, toca el botón de compartir "
            "y elige «Añadir a inicio». Luego haces el paso 1 desde esa app. "
            "En Android y ordenador este paso no hace falta.",
            100,
            NAVY,
            BLUE_PALE,
        ),
    ]
    for number, title, body, height, accent, pale in pasos:
        y -= height
        draw_step(c, number, title, body, MARGIN_X, y, height, accent, pale)
        y -= 14

    y -= 6
    rounded_rect(c, MARGIN_X, y - 82, CONTENT_W, 82, PALE, PALE, 12, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "QUÉ ESPERAR DESPUÉS")
    draw_wrapped(
        c,
        "A partir de ese momento, los avisos llegan solos como un globo del "
        "sistema —igual que WhatsApp— aunque tengas el Centro de Control "
        "cerrado. No hace falta volver a activar nada ni entrar a mirar.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )


def page_dudas(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Dispositivos y dudas")
    y = draw_section_title(
        c,
        "DÓNDE FUNCIONA",
        "Cada aparato, qué necesita",
        "Los avisos funcionan en todos los sitios habituales; sólo el iPhone "
        "pide instalar la app primero.",
    )

    y -= 16
    filas = [
        ("Ordenador", "Chrome, Edge, Firefox…", "Directo, sin instalar nada.", SAGE, SAGE_PALE),
        ("Android", "Móvil o tablet", "Directo, sin instalar nada.", SAGE, SAGE_PALE),
        (
            "iPhone / iPad",
            "Safari",
            "Hay que añadir la app a la pantalla de inicio primero. Es una "
            "condición de Apple, no del Centro de Control.",
            NAVY,
            BLUE_PALE,
        ),
    ]
    for dispositivo, contexto, nota, accent, pale in filas:
        alto = 58
        y -= alto
        rounded_rect(c, MARGIN_X, y, CONTENT_W, alto, white, LINE, 12)
        c.setFillColor(accent)
        c.roundRect(MARGIN_X, y, 5, alto, 2.5, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(font_name("Display-Bold"), 13)
        c.drawString(MARGIN_X + 20, y + alto - 26, dispositivo)
        c.setFillColor(MUTED)
        c.setFont(font_name("Body"), 8)
        c.drawString(MARGIN_X + 20, y + alto - 42, contexto)
        draw_wrapped(
            c,
            nota,
            MARGIN_X + 200,
            y + alto - 24,
            CONTENT_W - 200 - 20,
            size=9,
            leading=12,
            color=INK,
        )
        y -= 12

    y -= 8
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Preguntas frecuentes")
    y -= 22
    y = draw_bullets(
        c,
        [
            "No me llega nada: comprueba que pulsaste «Permitir». Si dijiste "
            "que no, el navegador guarda esa respuesta; hay que volver a "
            "darle permiso a los avisos del sitio desde los ajustes del "
            "navegador o del teléfono.",
            "Activarlo en el móvil no lo activa en el ordenador: cada "
            "aparato da su permiso por separado. Repite el paso 1 en cada "
            "uno donde quieras recibirlos.",
            "Los avisos no llevan cifras económicas ni nada confidencial: "
            "sólo dicen que hay novedades. El detalle se ve al entrar, con "
            "los permisos de cada persona.",
            "Si una comprobación posterior falla, Finanzas y administración "
            "reciben un aviso con la revisión afectada; el original sigue "
            "guardado y no hace falta subirlo otra vez.",
            "Si dejas de querer avisos, se desactivan desde los ajustes del "
            "navegador o del teléfono, cuando quieras.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9,
        leading=12.4,
        color=MUTED,
    )

    y -= 16
    rounded_rect(c, MARGIN_X, y - 82, CONTENT_W, 82, SAGE_PALE, SAGE_PALE, 12, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI SÓLO TE QUEDAS CON UNA COSA")
    draw_wrapped(
        c,
        "Pulsa una vez «Activar notificaciones» y dale a Permitir. En iPhone, "
        "instala antes la app en la pantalla de inicio. Con eso, los avisos "
        "empiezan a llegarte solos al móvil y al ordenador.",
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
        "¿No consigues activarlos? Escribe al administrador del Centro de Control.",
    )


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Guía de avisos - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Cómo recibir las notificaciones en el móvil y el ordenador")
    c.setKeywords("Bricket Control, ARAYA, avisos, notificaciones, móvil, obra")

    pages = [cover, page_activar, page_dudas]
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
