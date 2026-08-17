"""Genera la guía breve sobre por qué un archivo cargado no siempre actualiza
las cifras del Centro de Control.

Nace de una pregunta repetida del personal en obra ("subí el archivo y el
programa no cambió nada, ¿está roto?"). La respuesta es que el Centro de
Control solo publica un dato cuando puede demostrar de dónde sale; esta guía
lo explica en el lenguaje de quien sube el archivo, no en el del sistema.

Reutiliza la identidad visual de la guía corporativa (mismos colores, fuentes
y retículas) importando sus utilidades, para que ambos documentos se lean
como parte de la misma familia.

    python scripts/generate_upload_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_carga_de_archivos_araya.pdf`` y se
copia a ``historical/data-center/guias/`` para que el Centro de datos lo
sirva y el despliegue lo suba a R2 automáticamente.
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
    GOLD,
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
    PAPER,
    RED_PALE,
    SAGE,
    SAGE_PALE,
    TOP,
    draw_bullets,
    draw_contain,
    draw_label,
    draw_page_frame,
    draw_section_title,
    draw_small_card,
    draw_wrapped,
    font_name,
    register_fonts,
    rounded_rect,
    text_width,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "output" / "pdf" / "guia_carga_de_archivos_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-carga-de-archivos-araya.pdf"

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
    c.drawString(MARGIN_X, PAGE_H - 218, "Subí un archivo")
    c.drawString(MARGIN_X, PAGE_H - 256, "y el programa no")
    c.drawString(MARGIN_X, PAGE_H - 294, "cambió nada")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 318, MARGIN_X + 74, PAGE_H - 318)

    draw_wrapped(
        c,
        "No está roto. El Centro de Control solo cambia una cifra cuando "
        "puede demostrar de dónde sale. Ya no hay revisión de por medio: se "
        "publica solo. Esta guía explica por qué a veces un dato no entra y "
        "qué puedes hacer para que entre a la primera.",
        MARGIN_X,
        PAGE_H - 348,
        CONTENT_W * 0.66,
        size=11.4,
        leading=17,
        color=CREAM,
    )

    box_y = 150
    rounded_rect(c, MARGIN_X, box_y, CONTENT_W, 132, white, white, 14)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawString(MARGIN_X + 22, box_y + 104, "LO QUE HAY QUE RECORDAR")
    draw_wrapped(
        c,
        "Tu archivo nunca se pierde. Se guarda siempre, con tu nombre y la "
        "fecha, desde el segundo en que lo subes.",
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
        "Lo que a veces espera no es el archivo: son las cifras que hay "
        "dentro. Y espera por un motivo concreto que puedes comprobar.",
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
    c.drawString(MARGIN_X, 80, "4 páginas  ·  5 minutos de lectura")


def page_recorrido(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Qué pasa al subir")
    y = draw_section_title(
        c,
        "EL RECORRIDO",
        "Tres pasos, no uno",
        "Subir el archivo es el primero de tres. Los otros dos ocurren solos, en segundos.",
    )

    step_h = 112
    gap = 16
    steps = [
        (
            "1",
            "Se guarda",
            "Ocurre siempre, con cualquier formato. El archivo queda "
            "archivado con tu nombre, el área y la fecha. Nadie lo puede "
            "perder ni sobrescribir. Hasta aquí llega todo lo que subes.",
            SAGE,
        ),
        (
            "2",
            "Se lee",
            "El programa abre el documento y busca dentro las cifras que "
            "reconoce: avance, plazos, edificios, urbanismo, facturas. "
            "Cada cifra que encuentra tiene que venir con su página, tabla "
            "o celda exacta; si no puede señalar de dónde la sacó, la "
            "descarta.",
            NAVY,
        ),
        (
            "3",
            "Se publica",
            "Si las cifras pasan las comprobaciones, entran solas y todas "
            "las pantallas las muestran en menos de 5 segundos. Si alguna "
            "no las pasa, queda esperando el visto bueno de un "
            "administrador.",
            ORANGE,
        ),
    ]
    for number, title, body, accent in steps:
        y -= step_h
        rounded_rect(c, MARGIN_X, y, CONTENT_W, step_h, white, LINE, 12)
        c.setFillColor(accent)
        c.roundRect(MARGIN_X + 16, y + step_h - 42, 30, 26, 12, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_name("Body-Bold"), 12)
        c.drawCentredString(MARGIN_X + 31, y + step_h - 34, number)
        c.setFillColor(INK)
        c.setFont(font_name("Display-Bold"), 13.5)
        c.drawString(MARGIN_X + 58, y + step_h - 33, title)
        draw_wrapped(
            c,
            body,
            MARGIN_X + 58,
            y + step_h - 52,
            CONTENT_W - 78,
            size=9,
            leading=12.4,
            color=MUTED,
        )
        y -= gap

    y -= 12
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Qué formatos puede leer")
    y -= 22

    col_w = (CONTENT_W - 14) / 2
    box_h = 132
    rounded_rect(c, MARGIN_X, y - box_h, col_w, box_h, SAGE_PALE, SAGE_PALE, 12)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.6)
    c.drawString(MARGIN_X + 16, y - 22, "SÍ SE LEEN")
    draw_bullets(
        c,
        [
            "Excel (.xlsx, .xls) y CSV",
            "PDF y Word",
            "PowerPoint y XML de Project",
            "Carpetas comprimidas ZIP",
            "Fotos (.jpg, .png)",
        ],
        MARGIN_X + 14,
        y - 42,
        col_w - 28,
        size=8.6,
        leading=11.4,
        gap=2.5,
    )

    x2 = MARGIN_X + col_w + 14
    rounded_rect(c, x2, y - box_h, col_w, box_h, RED_PALE, RED_PALE, 12)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.6)
    c.drawString(x2 + 16, y - 22, "SOLO SE ARCHIVAN")
    draw_bullets(
        c,
        [
            "Planos DWG",
            "Cronogramas MPP (Project)",
        ],
        x2 + 14,
        y - 42,
        col_w - 28,
        size=8.6,
        leading=11.4,
        gap=2.5,
    )
    draw_wrapped(
        c,
        "Se guardan y se pueden descargar, pero el programa no lee cifras "
        "dentro de ellos. El .mpp tiene dos salidas: la guía de formatos las "
        "explica.",
        x2 + 14,
        y - box_h + 34,
        col_w - 28,
        size=7.8,
        leading=10,
        color=MUTED,
    )


def page_reglas(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Para que entre a la primera")
    y = draw_section_title(
        c,
        "LAS SEIS COMPROBACIONES",
        "Por qué a veces no entra un dato",
        "El programa publica solo, sin revisión, si se cumplen las seis. Si falla una, guarda el archivo y deja ese dato fuera; los demás entran igual.",
    )

    cards = [
        (
            "1",
            "El dato tiene que existir en el programa",
            "El Centro de Control sabe actualizar una lista concreta de "
            "conceptos: avance físico, plan mensual, edificios, "
            "apartamentos, urbanismo, facturas, anticipos. Si tu archivo "
            "trae algo que no está en esa lista, no lo inventa: lo aparta "
            "y avisa al administrador para que decida si merece un sitio "
            "nuevo. Es la causa más frecuente de todas.",
            ORANGE,
        ),
        (
            "2",
            "La cifra tiene que estar escrita",
            "El programa no deduce ni estima. Si el número no aparece tal "
            "cual en una celda, una tabla o una línea del documento, no lo "
            "publica. Un texto que dice \"vamos bien de plazo\" no es una "
            "cifra; un 22,71% en una celda, sí.",
            NAVY,
        ),
        (
            "3",
            "Tiene que leerse con claridad",
            "En una foto: enfocada, derecha y con el número legible. En un "
            "Excel: celdas normales, sin notas sueltas ni errores de "
            "fórmula (#REF!, #N/A). Si el programa duda de lo que está "
            "leyendo, prefiere esperar antes que arriesgarse.",
            SAGE,
        ),
        (
            "4",
            "Di a qué fecha corresponde",
            "Al subir el archivo, rellena la fecha de corte. Sin ella, el "
            "programa no sabe si tu dato es más nuevo o más viejo que el "
            "que ya está en pantalla, y no se atreve a sustituirlo. Es el "
            "campo que más se deja en blanco.",
            GOLD,
        ),
        (
            "5",
            "Elige bien el área",
            "Obra, urbanismo, finanzas, comercial, compras, seguridad. Si "
            "el archivo queda sin clasificar, se guarda pero no publica "
            "nada. Un momento eligiendo el área correcta ahorra el viaje "
            "de vuelta.",
            NAVY,
        ),
        (
            "6",
            "Las cifras de dinero piden permiso",
            "Presupuesto, costes, facturas, cobros y ventas solo los puede "
            "publicar quien tenga el permiso de Finanzas. Si no lo tienes, "
            "el archivo se guarda igual y un administrador lo aprueba.",
            ORANGE_DARK,
        ),
    ]

    col_w = (CONTENT_W - 14) / 2
    card_h = 158
    for index, (number, title, body, accent) in enumerate(cards):
        col = index % 2
        row = index // 2
        x = MARGIN_X + col * (col_w + 14)
        card_y = y - (row + 1) * card_h - row * 14
        rounded_rect(c, x, card_y, col_w, card_h, white, LINE, 11)
        c.setFillColor(accent)
        c.roundRect(x + 13, card_y + card_h - 34, 26, 20, 9.5, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_name("Body-Bold"), 8.4)
        c.drawCentredString(x + 26, card_y + card_h - 28, number)
        c.setFillColor(INK)
        c.setFont(font_name("Body-Bold"), 9.8)
        title_lines = draw_wrapped(
            c,
            title,
            x + 46,
            card_y + card_h - 27,
            col_w - 60,
            font="Body-Bold",
            size=9.8,
            leading=12,
            color=INK,
        )
        draw_wrapped(
            c,
            body,
            x + 14,
            min(title_lines, card_y + card_h - 50) - 4,
            col_w - 28,
            size=8.2,
            leading=11,
            color=MUTED,
        )


def page_comprobar(c: canvas.Canvas) -> None:
    draw_page_frame(c, 4, "Cómo comprobarlo")
    y = draw_section_title(
        c,
        "DESPUÉS DE SUBIR",
        "Cómo saber qué pasó",
        "No hace falta preguntar a nadie: el propio programa lo dice en tres sitios.",
    )

    checks = [
        (
            "01",
            "El mensaje al subir",
            "Justo al terminar la carga aparece el resultado: cuántos datos "
            "entraron y cuántos quedaron esperando.",
        ),
        (
            "02",
            "Centro de datos",
            "Abre la bandeja y filtra por Por validar, Integrados u "
            "Observados. Cada archivo indica en qué fase se quedó.",
        ),
        (
            "03",
            "El punto de color",
            "Junto a cada indicador: verde si el dato es del mes en curso, "
            "ámbar si falta un cierre, rojo si lleva dos o más sin "
            "actualizarse.",
        ),
    ]
    card_w = (CONTENT_W - 24) / 3
    for index, (number, title, body) in enumerate(checks):
        x = MARGIN_X + index * (card_w + 12)
        draw_small_card(c, x, y - 132, card_w, 132, number, title, body)

    y -= 132 + 38

    rounded_rect(c, MARGIN_X, y - 168, CONTENT_W, 168, BLUE_PALE, BLUE_PALE, 13)
    c.setFillColor(NAVY)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawString(MARGIN_X + 22, y - 26, "SI TU ARCHIVO SIGUE EN ESPERA")
    draw_wrapped(
        c,
        "No lo vuelvas a subir",
        MARGIN_X + 22,
        y - 50,
        CONTENT_W - 44,
        font="Display-Bold",
        size=15,
        leading=19,
        color=INK,
    )
    draw_wrapped(
        c,
        "Subirlo otra vez no cambia nada: el programa detecta que es el mismo "
        "documento y no lo duplica. Lo que hay que hacer es avisar a un "
        "administrador para que revise las cifras y les dé el visto bueno. "
        "En cuanto lo haga, todas las pantallas se actualizan solas en menos "
        "de cinco segundos, sin que nadie tenga que recargar nada.",
        MARGIN_X + 22,
        y - 78,
        CONTENT_W - 44,
        size=9.2,
        leading=13,
        color=INK,
    )

    y -= 168 + 34
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Por qué el programa es así de exigente")
    y -= 20
    draw_wrapped(
        c,
        "Las cifras de este panel se usan para decidir pagos, plazos y "
        "compras. Un número mal leído de un PDF podría cambiar el avance de "
        "toda la obra y nadie lo notaría hasta la próxima reunión. Por eso el "
        "programa prefiere quedarse corto y preguntar, antes que publicar "
        "algo que luego haya que desmentir. Cuando un dato aparece en "
        "pantalla, es porque se puede señalar el documento, la página y la "
        "celda de donde salió.",
        MARGIN_X,
        y,
        CONTENT_W,
        size=9.4,
        leading=13.4,
        color=MUTED,
    )

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2)
    c.line(MARGIN_X, BOTTOM + 34, MARGIN_X + 60, BOTTOM + 34)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 8.2)
    c.drawString(
        MARGIN_X,
        BOTTOM + 16,
        "¿Dudas con un archivo concreto? Pregunta al administrador del Centro de Control.",
    )


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Guía de carga de archivos - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Por qué un archivo cargado no siempre actualiza las cifras")
    c.setKeywords("Bricket Control, ARAYA, carga de archivos, obra, datos")

    pages = [cover, page_recorrido, page_reglas, page_comprobar]
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
