"""Genera la guía de instalación del envío automático desde Microsoft Project.

Es la cuarta guía del personal y la más técnica, pero va dirigida a una sola
persona: quien lleva la planificación en Project. Explica cómo dejar que el
plan de obra se envíe solo al Centro de Control cada vez que se guarda, sin
volver a exportar ni subir nada a mano.

El macro vive dentro de Project, en el equipo donde se edita el plan, así que
—a diferencia de la web— no se despliega desde el Centro de Control: se instala
una vez en ese ordenador. El token, en cambio, es central: se genera y se
revoca desde el panel de administración.

Reutiliza la identidad visual de la guía corporativa (mismos colores, fuentes
y retículas) importando sus utilidades, para que las cuatro se lean como parte
de la misma familia.

    python scripts/generate_macro_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_envio_project_araya.pdf`` y se copia a
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
    SAGE,
    SAGE_PALE,
    TOP,
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
OUTPUT = ROOT / "output" / "pdf" / "guia_envio_project_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-envio-project-araya.pdf"

CONTENT_W = PAGE_W - 2 * MARGIN_X


def mono(c: canvas.Canvas, texto: str, x: float, y: float, ancho: float, pale: Color = PALE) -> float:
    """Caja para lo que hay que teclear o pulsar literalmente."""
    alto = 24
    rounded_rect(c, x, y - alto, ancho, alto, pale, pale, 7)
    c.setFillColor(INK)
    c.setFont(font_name("Body-Bold"), 8.6)
    c.drawString(x + 10, y - 16, texto)
    return y - alto


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
    c.setFont(font_name("Display-Bold"), 32)
    c.drawString(MARGIN_X, PAGE_H - 216, "El plan de Project")
    c.drawString(MARGIN_X, PAGE_H - 252, "se envía solo")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 278, MARGIN_X + 74, PAGE_H - 278)

    draw_wrapped(
        c,
        "Con esto, cada vez que guardas el plan en Microsoft Project, el avance "
        "de la obra llega solo al Centro de Control. Sin exportar a mano, sin "
        "subir archivos, sin entrar en la aplicación.",
        MARGIN_X,
        PAGE_H - 308,
        CONTENT_W * 0.66,
        size=11.4,
        leading=17,
        color=CREAM,
    )

    box_y = 150
    rounded_rect(c, MARGIN_X, box_y, CONTENT_W, 132, white, white, 14)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawString(MARGIN_X + 22, box_y + 104, "PARA QUIÉN ES ESTA GUÍA")
    draw_wrapped(
        c,
        "Sólo para el equipo que edita el plan en Project. Se instala una vez.",
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
        "El resto de la oficina no instala nada: siguen usando la web igual que "
        "siempre. El macro vive dentro de Project, en un solo ordenador.",
        MARGIN_X + 22,
        box_y + 40,
        CONTENT_W - 44,
        size=9.4,
        leading=13,
        color=MUTED,
    )

    c.setFillColor(CREAM)
    c.setFont(font_name("Body"), 8)
    c.drawString(MARGIN_X, 96, "Guía interna para el planificador de obra")
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X, 80, "4 páginas  ·  10 minutos, una sola vez")


def page_antes(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Antes de empezar")
    y = draw_section_title(
        c,
        "LO QUE NECESITAS",
        "Dos cosas antes de empezar",
        "Diez minutos y esto a mano. La instalación se hace una sola vez.",
    )

    y -= 14
    items = [
        (
            "El archivo del macro",
            "araya-project-autoenvio.bas",
            "Te lo pasa el administrador del Centro de Control. Es un archivo de "
            "texto pequeño; guárdalo en el escritorio, lo vas a importar en "
            "Project en un momento.",
            SAGE, SAGE_PALE,
        ),
        (
            "El token de carga",
            "araya_up_…",
            "También te lo da el administrador, desde Usuarios y accesos → "
            "Cargas automáticas. Es una credencial: identifica a este equipo y "
            "se puede revocar si hace falta. No lo compartas por correo.",
            NAVY, BLUE_PALE,
        ),
    ]
    for titulo, codigo, cuerpo, acento, pale in items:
        alto = 104
        y -= alto
        rounded_rect(c, MARGIN_X, y, CONTENT_W, alto, white, LINE, 12)
        c.setFillColor(acento)
        c.roundRect(MARGIN_X, y, 5, alto, 2.5, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(font_name("Display-Bold"), 14)
        c.drawString(MARGIN_X + 20, y + alto - 30, titulo)
        codigo_w = text_width(codigo, "Body-Bold", 8.6) + 20
        rounded_rect(c, MARGIN_X + 20, y + alto - 58, codigo_w, 20, pale, pale, 7)
        c.setFillColor(acento)
        c.setFont(font_name("Body-Bold"), 8.6)
        c.drawString(MARGIN_X + 30, y + alto - 51, codigo)
        draw_wrapped(c, cuerpo, MARGIN_X + 20, y + alto - 74, CONTENT_W - 40, size=9, leading=12.2, color=MUTED)
        y -= 14

    y -= 8
    rounded_rect(c, MARGIN_X, y - 92, CONTENT_W, 92, PALE, PALE, 12, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "POR QUÉ NO SE INSTALA SOLO DESDE EL CENTRO DE CONTROL")
    draw_wrapped(
        c,
        "El Centro de Control es una web: se actualiza sola para todos. El macro, "
        "en cambio, es código que vive dentro de Microsoft Project, en el disco "
        "de este ordenador, y Project no permite instalarlo desde fuera. Por eso "
        "se monta aquí una vez. Lo que sí es central es el token: quien administra "
        "lo controla y lo revoca sin tocar este equipo.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )


def draw_step(c: canvas.Canvas, y: float, numero: str, titulo: str, alto: float) -> float:
    top = y - alto
    rounded_rect(c, MARGIN_X, top, CONTENT_W, alto, white, LINE, 12)
    c.setFillColor(ORANGE)
    c.roundRect(MARGIN_X + 16, top + alto - 38, 28, 24, 11, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 12)
    c.drawCentredString(MARGIN_X + 30, top + alto - 31, numero)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X + 56, top + alto - 26, titulo)
    return top


def page_instalar(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Instalación")
    y = draw_section_title(
        c,
        "PASO A PASO",
        "Instalar el macro",
        "Cinco pasos dentro de Project. Se hace una vez y queda para siempre.",
    )

    y -= 14

    top = draw_step(c, y, "1", "Abre el editor de macros", 84)
    draw_wrapped(c, "En Project, pestaña Vista → Macros → Visual Basic. O directamente:",
                 MARGIN_X + 56, top + 42, CONTENT_W - 76, size=9, leading=12, color=MUTED)
    mono(c, "Alt + F11", MARGIN_X + 56, top + 30, 90)
    y = top - 12

    top = draw_step(c, y, "2", "Importa el archivo del macro", 62)
    draw_wrapped(c, "En el editor, menú Archivo → Importar archivo… y elige araya-project-autoenvio.bas.",
                 MARGIN_X + 56, top + 22, CONTENT_W - 76, size=9, leading=12, color=MUTED)
    y = top - 12

    top = draw_step(c, y, "3", "Pega tu token", 92)
    draw_wrapped(c, "Haz doble clic en el módulo importado (ArayaAutoenvio) y busca esta línea. "
                    "Sustituye el texto de ejemplo por tu token:",
                 MARGIN_X + 56, top + 50, CONTENT_W - 76, size=9, leading=12, color=MUTED)
    mono(c, 'ARAYA_TOKEN = "araya_up_…"', MARGIN_X + 56, top + 32, CONTENT_W - 76)
    y = top - 12

    top = draw_step(c, y, "4", "Activa el envío al guardar", 104)
    draw_wrapped(c, "En el panel de la izquierda, doble clic en «ThisProject» (dentro de tu "
                    "proyecto) y pega estas líneas:",
                 MARGIN_X + 56, top + 62, CONTENT_W - 76, size=9, leading=12, color=MUTED)
    rounded_rect(c, MARGIN_X + 56, top + 10, CONTENT_W - 76, 40, PALE, PALE, 7)
    c.setFillColor(INK)
    c.setFont(font_name("Body-Bold"), 7.6)
    c.drawString(MARGIN_X + 66, top + 37, "Private Sub Project_BeforeSave(ByVal pj As Project)")
    c.drawString(MARGIN_X + 66, top + 25, "    On Error Resume Next: EnviarPlanAlCentroDeControl")
    c.drawString(MARGIN_X + 66, top + 13, "End Sub")
    y = top - 12

    top = draw_step(c, y, "5", "Guarda el proyecto", 62)
    draw_wrapped(c, "El primer guardado te confirmará el resultado. A partir de ahí, cada guardado envía el plan solo.",
                 MARGIN_X + 56, top + 22, CONTENT_W - 76, size=9, leading=12, color=MUTED)


def page_despues(c: canvas.Canvas) -> None:
    draw_page_frame(c, 4, "Ya está funcionando")
    y = draw_section_title(
        c,
        "COMPROBAR Y MANTENER",
        "Ya está funcionando",
        "Cómo saber que llega, qué pasa si falla la red y cómo se corta el acceso.",
    )

    y -= 16
    y = draw_bullets(
        c,
        [
            "Comprueba que llega: guarda el plan y mira el Centro de Control. En "
            "menos de cinco segundos los avances de los edificios se actualizan.",
            "Si un día falla la red o el servidor, el guardado del proyecto no se "
            "ve afectado: se pierde ese envío, no tu trabajo. El siguiente guardado "
            "vuelve a intentarlo.",
            "Puedes enviarlo también a mano en cualquier momento, sin guardar, "
            "desde Vista → Macros → EnviarPlanAlCentroDeControl.",
            "Si molesta el aviso en cada guardado, se puede poner en silencio "
            "(ARAYA_AVISAR = False); los avisos seguirán en el propio Centro de Control.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9.2,
        leading=12.6,
        color=MUTED,
    )

    y -= 14
    rounded_rect(c, MARGIN_X, y - 88, CONTENT_W, 88, BLUE_PALE, BLUE_PALE, 12, 0)
    c.setFillColor(NAVY)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI ESTE EQUIPO CAMBIA DE MANOS O SE PIERDE")
    draw_wrapped(
        c,
        "El token identifica a este ordenador. Si se pierde o deja de usarse, el "
        "administrador lo revoca desde Usuarios y accesos → Cargas automáticas y "
        "deja de funcionar al instante, sin que haya que tocar la máquina. Los "
        "demás equipos con su propio token siguen funcionando.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )
    y -= 88

    y -= 22
    rounded_rect(c, MARGIN_X, y - 74, CONTENT_W, 74, SAGE_PALE, SAGE_PALE, 12, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI ALGÚN DÍA NO PUEDES INSTALARLO")
    draw_wrapped(
        c,
        "El mismo resultado se consigue a mano: Archivo → Guardar como → XML y "
        "subir ese archivo al Centro de Control. El macro sólo quita ese paso.",
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
    c.drawString(MARGIN_X, BOTTOM + 16, "¿Dudas con la instalación? Pregunta al administrador del Centro de Control.")


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Envío automático desde Microsoft Project - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Cómo instalar el envío automático del plan de obra desde Project")
    c.setKeywords("Bricket Control, ARAYA, Project, macro, envío automático, obra")

    pages = [cover, page_antes, page_instalar, page_despues]
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
