"""Genera la guía mensual de fuentes, prioridad y comprobación del corte.

Cada corte reúne cubicación, Excel de flujo, curva, cronogramas e informe.
No hay que tocar cifras a mano: se suben los originales y el panel
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
    GUIDE_EDITION,
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
    draw_reference_page,
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
        "Cada corte reúne fuentes de obra, finanzas y planificación. El panel "
        "publica los datos seguros respetando periodo, alcance y prioridad. "
        "Esta guía explica qué documento alimenta cada vista y cómo comprobarlo.",
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
        "Primero, fuente y corte. Después, comprobación del panel.",
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
        "La cubicación manda en el avance físico. Los Excel de curva y flujo "
        "conservan su prioridad; cronogramas e informe completan sus ámbitos.",
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
    c.drawString(MARGIN_X, 80, "4 páginas  ·  edición " + GUIDE_EDITION)


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
        x + 67 + text_width("ACTUALIZA:", "Body-Bold", 7.4),
        after - 2,
        CONTENT_W - 67 - 22 - text_width("ACTUALIZA:", "Body-Bold", 7.4),
        size=8.6,
        leading=11,
        color=INK,
    )


def page_archivos(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Fuentes que mandan")
    y = draw_section_title(
        c,
        "CADA MES",
        "Las fuentes del corte",
        "Sube los originales desde Cargar archivo. Un documento complementario "
        "no sustituye una fuente de mayor prioridad del mismo periodo.",
    )

    y -= 18
    archivos = [
        (
            "1",
            "Cubicación del corte",
            ".xlsx",
            "Fuente prioritaria del avance físico por edificio y oficio, del "
            "conjunto y de urbanismo. Sus desgloses no son mediciones por apartamento.",
            ["Avance por edificio", "Oficios", "Urbanismo", "Ejecutado de Curva S"],
            118,
            ORANGE,
            RED_PALE,
        ),
        (
            "2",
            "Excel de flujo reprogramado",
            ".xlsx",
            "Compara meses reales y previsiones de Urbanismo, Edificios y total. "
            "La reprogramación completa los meses futuros; los anticipos se separan del gasto mensual.",
            ["Flujo mensual de finanzas", "Real vs. presupuesto"],
            110,
            SAGE,
            SAGE_PALE,
        ),
        (
            "3",
            "Curva S en Excel",
            ".xlsx",
            "El maestro de gráficos fija el plan operativo. El Excel de curva "
            "reprogramada aporta su comparación y sus series por alcance, sin cambiar el ejecutado certificado.",
            ["Curva S", "Plan operativo", "Detalle reprogramado"],
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


def page_complementos(c: canvas.Canvas) -> None:
    draw_reference_page(c, 3, "Cronogramas e informe",
        "Cada documento mantiene su alcance. Una fecha parcial o un porcentaje de tarea no son el avance certificado de todo el proyecto.", [
        ("Plan de Project", "Sube XML directamente o el MPP para su conversión automática. Aporta cronograma, fases y fechas cuando existen en el plan. Un corte anterior o una fuente de menor prioridad no pisa el avance certificado vigente."),
        ("Gantt HTML de edificaciones y urbanismo", "Los dos Gantt se consultan en Planificación: filtra tareas y compara fechas vigentes con la línea base. Conservan materiales, recursos y dependencias. El HTML no se ejecuta; sólo se lee su bloque de datos compatible."),
        ("Informe Ejecutivo", "Conserva tablas, comentarios y evidencias del corte. Seguridad mensual aparece como bloque propio, separado de la foto y serie semanales. Si el informe difiere de la cubicación o del Excel prioritario, se conserva esa fuente verificada."),
    ], "Porcentajes de apartamentos derivados del edificio/Project no equivalen a mediciones individuales.")


def page_comprobar(c: canvas.Canvas) -> None:
    draw_page_frame(c, 4, "Comprobar y avisos")
    y = draw_section_title(
        c,
        "TRAS EL PROCESAMIENTO",
        "Comprobar el corte",
        "Al terminar cada subida, el mensaje dice cuántos datos se actualizaron. "
        "Si quieres verlo en el panel, mira estas tres cosas.",
    )

    y -= 16
    y = draw_bullets(
        c,
        [
            "Comprueba la fecha del documento, la revisión y el resultado del recibo. Subir un archivo no cierra automáticamente el periodo.",
            "Revisa Planificación y los colores del plano. En la comprobación del 19/11/2026, 26 edificios tenían avance publicado y otros 51 conservaban valores iniciales, no mediciones certificadas.",
            "En Finanzas distingue Real y previsión. Comprueba el alcance de los anticipos y abre el Excel vigente desde el flujo.",
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
        "Sin cambios puede significar que el valor ya coincidía, que el corte "
        "es anterior o que manda otra fuente. Lee el motivo: no fuerces una "
        "subida de porcentaje. Si queda algo aislado, abre su diagnóstico y "
        "conserva el original; el detalle está en la guía de formatos.",
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
        "Sube las fuentes del corte y lee su recibo: publicados, aislados y vistas "
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
    c.setSubject("Fuentes, prioridades y comprobación de la actualización mensual")
    c.setKeywords("Bricket Control, ARAYA, actualización mensual, informe, flujo, Project")

    pages = [cover, page_archivos, page_complementos, page_comprobar]
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
