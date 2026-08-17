"""Generate the concise corporate staff guide for Bricket Control.

The document is intentionally static and versioned with the application. Run:

    python scripts/generate_staff_guide_pdf.py

The PDF is written to ``output/pdf/guia_corporativa_bricket_control_personal_obra.pdf``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "output" / "pdf" / "guia_corporativa_bricket_control_personal_obra.pdf"
APP_URL = "https://araya-centro-control.grupobricket.workers.dev/"

PAGE_W, PAGE_H = A4
MARGIN_X = 42
TOP = PAGE_H - 42
BOTTOM = 42

ORANGE = HexColor("#F05A2A")
ORANGE_DARK = HexColor("#B94727")
INK = HexColor("#262621")
NAVY = HexColor("#142E4D")
CREAM = HexColor("#F5F1EA")
PAPER = HexColor("#FCFBF8")
MUTED = HexColor("#6F716F")
PALE = HexColor("#ECE8E0")
LINE = HexColor("#DAD5CB")
SAGE = HexColor("#557565")
SAGE_PALE = HexColor("#E5EEE8")
GOLD = HexColor("#B58B3E")
BLUE_PALE = HexColor("#E7EEF5")
RED_PALE = HexColor("#F6E7E2")


def register_fonts() -> None:
    """Register a restrained editorial font pairing with safe fallbacks."""

    candidates = {
        "Body": [
            Path(r"C:\Windows\Fonts\ArialNova.ttf"),
            Path(r"C:\Windows\Fonts\arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ],
        "Body-Bold": [
            Path(r"C:\Windows\Fonts\ArialNova-Bold.ttf"),
            Path(r"C:\Windows\Fonts\arialbd.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ],
        "Display": [
            Path(r"C:\Windows\Fonts\GeorgiaPro-Regular.ttf"),
            Path(r"C:\Windows\Fonts\georgia.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        ],
        "Display-Bold": [
            Path(r"C:\Windows\Fonts\GeorgiaPro-Bold.ttf"),
            Path(r"C:\Windows\Fonts\georgiab.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
        ],
    }
    fallbacks = {
        "Body": "Helvetica",
        "Body-Bold": "Helvetica-Bold",
        "Display": "Times-Roman",
        "Display-Bold": "Times-Bold",
    }
    for name, paths in candidates.items():
        for path in paths:
            if path.exists():
                pdfmetrics.registerFont(TTFont(name, str(path)))
                break
        else:
            # ReportLab's built-in font names cannot be registered as TTFont.
            # The aliases are resolved through font_name().
            _FONT_FALLBACKS[name] = fallbacks[name]


_FONT_FALLBACKS: dict[str, str] = {}


def font_name(name: str) -> str:
    return _FONT_FALLBACKS.get(name, name)


def rounded_rect(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill: Color = white,
    stroke: Color = LINE,
    radius: float = 12,
    width: float = 0.8,
) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(width)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font_name(font), size)


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    paragraphs = text.split("\n")
    lines: list[str] = []
    for paragraph in paragraphs:
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split()
        current = ""
        for word in words:
            trial = word if not current else f"{current} {word}"
            if text_width(trial, font, size) <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def draw_wrapped(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    font: str = "Body",
    size: float = 9.2,
    leading: float = 13,
    color: Color = INK,
    max_lines: int | None = None,
) -> float:
    lines = wrap_lines(text, font, size, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font_name(font), size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(
    c: canvas.Canvas,
    items: Iterable[str],
    x: float,
    y: float,
    max_width: float,
    font: str = "Body",
    size: float = 8.9,
    leading: float = 12.2,
    gap: float = 4.5,
    color: Color = INK,
) -> float:
    for item in items:
        lines = wrap_lines(item, font, size, max_width - 15)
        c.setFillColor(ORANGE)
        c.circle(x + 3.5, y + 2.6, 2.1, fill=1, stroke=0)
        c.setFillColor(color)
        c.setFont(font_name(font), size)
        line_y = y
        for line in lines:
            c.drawString(x + 14, line_y, line)
            line_y -= leading
        y = line_y - gap
    return y


def draw_section_title(
    c: canvas.Canvas,
    eyebrow: str,
    title: str,
    subtitle: str,
) -> float:
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.8)
    c.drawString(MARGIN_X, TOP - 28, eyebrow.upper())
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 25)
    c.drawString(MARGIN_X, TOP - 60, title)
    return draw_wrapped(
        c,
        subtitle,
        MARGIN_X,
        TOP - 82,
        PAGE_W - 2 * MARGIN_X,
        size=9.2,
        leading=12,
        color=MUTED,
    )


def draw_page_frame(c: canvas.Canvas, page_no: int, section: str) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN_X, PAGE_H - 31, PAGE_W - MARGIN_X, PAGE_H - 31)
    c.setFillColor(ORANGE)
    c.rect(MARGIN_X, PAGE_H - 24, 9, 9, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body-Bold"), 7.1)
    c.drawString(MARGIN_X + 15, PAGE_H - 23, "BRICKET CONTROL")
    section_width = text_width(section.upper(), "Body", 7.1)
    c.setFont(font_name("Body"), 7.1)
    c.drawString(PAGE_W - MARGIN_X - section_width, PAGE_H - 23, section.upper())
    c.setStrokeColor(LINE)
    c.line(MARGIN_X, 29, PAGE_W - MARGIN_X, 29)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 6.8)
    c.drawString(MARGIN_X, 17, "ARAYA PUNTA CANA | GRUPO BRICKET | GUIA INTERNA")
    number = f"{page_no:02d}"
    c.setFont(font_name("Body-Bold"), 7.2)
    c.drawString(PAGE_W - MARGIN_X - text_width(number, "Body-Bold", 7.2), 17, number)


def draw_contain(
    c: canvas.Canvas,
    image_path: Path,
    x: float,
    y: float,
    w: float,
    h: float,
    pad: float = 0,
) -> None:
    image = ImageReader(str(image_path))
    iw, ih = image.getSize()
    scale = min((w - 2 * pad) / iw, (h - 2 * pad) / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(
        image,
        x + (w - dw) / 2,
        y + (h - dh) / 2,
        dw,
        dh,
        preserveAspectRatio=True,
        mask="auto",
    )


def draw_qr(c: canvas.Canvas, url: str, x: float, y: float, size: float) -> None:
    widget = qr.QrCodeWidget(url)
    bounds = widget.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def draw_label(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    fill: Color = NAVY,
    color: Color = white,
) -> float:
    w = text_width(text.upper(), "Body-Bold", 7.2) + 18
    c.setFillColor(fill)
    c.roundRect(x, y - 4, w, 19, 9.5, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(font_name("Body-Bold"), 7.2)
    c.drawString(x + 9, y + 2, text.upper())
    return w


def draw_small_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    number: str,
    title: str,
    body: str,
    accent: Color = ORANGE,
) -> None:
    rounded_rect(c, x, y, w, h, white, LINE, 10)
    c.setFillColor(accent)
    c.roundRect(x + 12, y + h - 30, 24, 18, 9, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 7.2)
    c.drawCentredString(x + 24, y + h - 24, number)
    c.setFillColor(INK)
    c.setFont(font_name("Body-Bold"), 10)
    c.drawString(x + 44, y + h - 25, title)
    draw_wrapped(c, body, x + 13, y + h - 46, w - 26, size=8.1, leading=10.5, color=MUTED)


def cover_page(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(ORANGE)
    c.rect(0, 0, 18, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.roundRect(PAGE_W - 194, 0, 194, PAGE_H, 0, fill=1, stroke=0)
    # Subtle architectural rhythm.
    c.saveState()
    c.setStrokeColor(HexColor("#274663"))
    c.setLineWidth(0.7)
    for i in range(13):
        c.line(PAGE_W - 176 + i * 14, 0, PAGE_W - 106 + i * 14, PAGE_H)
    c.restoreState()

    rounded_rect(c, 43, PAGE_H - 132, 308, 74, white, white, 12, 0)
    draw_contain(c, PUBLIC / "bricket-mark.png", 55, PAGE_H - 120, 50, 50)
    draw_contain(c, PUBLIC / "araya-wordmark.jpg", 120, PAGE_H - 120, 215, 50)

    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 8)
    c.drawString(44, 626, "GUIA CORPORATIVA | PERSONAL DE OBRA")
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 37)
    c.drawString(43, 572, "Bricket")
    c.drawString(43, 526, "Control")
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 13)
    c.drawString(45, 490, "Centro de Control ARAYA")
    draw_wrapped(
        c,
        "Funciones esenciales, uso diario e instalación en móvil, tablet y ordenador.",
        45,
        451,
        305,
        size=11,
        leading=16,
        color=INK,
    )

    rounded_rect(c, 44, 258, 303, 136, white, LINE, 13)
    draw_label(c, "Una sola fuente de trabajo", 61, 360, ORANGE)
    draw_bullets(
        c,
        [
            "Consulta avance, planos, apartamentos, proveedores, informes y documentos.",
            "Carga evidencias desde archivos o desde la cámara del dispositivo.",
            "Trabaja con permisos, trazabilidad y actualización cada 5 segundos.",
        ],
        61,
        335,
        268,
        size=8.8,
        leading=11.4,
        gap=4,
    )

    rounded_rect(c, PAGE_W - 168, 321, 110, 110, white, white, 9, 0)
    draw_qr(c, APP_URL, PAGE_W - 159, 330, 92)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 9)
    c.drawCentredString(PAGE_W - 113, 309, "ABRIR BRICKET CONTROL")
    c.setFont(font_name("Body"), 7.1)
    c.drawCentredString(PAGE_W - 113, 294, "Escanea con la cámara")

    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 7.5)
    c.drawString(44, 68, "EDICIÓN 11.08.2026")
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 7.2)
    c.drawRightString(PAGE_W - 37, 32, "USO INTERNO | ARAYA PUNTA CANA")
    c.linkURL(APP_URL, (PAGE_W - 170, 285, PAGE_W - 56, 432), relative=0)


def page_start(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Acceso y navegación")
    draw_section_title(
        c,
        "01 | Primer acceso",
        "Empezar en 3 minutos",
        "El administrador habilita cada usuario, su área y sus permisos. No compartas el acceso ni uses la cuenta de otra persona.",
    )

    y = 638
    w = (PAGE_W - 2 * MARGIN_X - 14) / 2
    rounded_rect(c, MARGIN_X, y - 166, w, 166, SAGE_PALE, SAGE_PALE, 12, 0)
    draw_label(c, "Acceso", MARGIN_X + 15, y - 28, SAGE)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 16)
    c.drawString(MARGIN_X + 15, y - 58, "Antes de entrar")
    draw_bullets(
        c,
        [
            "Abre el enlace facilitado por el administrador.",
            "Identifícate con tu cuenta autorizada.",
            "Comprueba tu nombre, área y proyecto activo: ARAYA.",
            "Finanzas solo aparece con permiso específico.",
        ],
        MARGIN_X + 15,
        y - 82,
        w - 30,
        size=8.5,
        leading=10.7,
        gap=3,
    )

    x2 = MARGIN_X + w + 14
    rounded_rect(c, x2, y - 166, w, 166, BLUE_PALE, BLUE_PALE, 12, 0)
    draw_label(c, "Controles globales", x2 + 15, y - 28, NAVY)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 16)
    c.drawString(x2 + 15, y - 58, "Siempre a mano")
    draw_bullets(
        c,
        [
            "Selector ARAYA / proyecto de demostración.",
            "Moneda USD o DOP para todas las cifras económicas.",
            "Buscador global, campana de avisos y foto de usuario.",
            "Crear informe, cargar archivo y consultar al Agente IA.",
        ],
        x2 + 15,
        y - 82,
        w - 30,
        size=8.5,
        leading=10.7,
        gap=3,
    )

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 17)
    c.drawString(MARGIN_X, 440, "Mapa de navegación")
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 8.3)
    c.drawString(MARGIN_X, 422, "En móvil y tablet: Inicio, Plano, Apartamentos, Datos y Más.")

    nav = [
        ("01", "Resumen ejecutivo"),
        ("02", "Planificación"),
        ("03", "Implantación general"),
        ("04", "Edificios"),
        ("05", "Apartamentos"),
        ("06", "Urbanismo"),
        ("07", "Ventas y cobranza"),
        ("08", "Finanzas"),
        ("09", "Cronología"),
        ("10", "Proveedores"),
        ("11", "Seguridad y permisos"),
        ("12", "Centro de datos"),
        ("AI", "Agente IA"),
        ("AD", "Usuarios y accesos"),
    ]
    card_w = (PAGE_W - 2 * MARGIN_X - 12) / 2
    row_h = 34
    start_y = 383
    for index, (code, label) in enumerate(nav):
        col = index % 2
        row = index // 2
        x = MARGIN_X + col * (card_w + 12)
        y0 = start_y - row * 39
        rounded_rect(c, x, y0, card_w, row_h, white, LINE, 8)
        c.setFillColor(ORANGE if code not in ("AI", "AD") else NAVY)
        c.roundRect(x + 8, y0 + 7, 28, 20, 7, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_name("Body-Bold"), 7.2)
        c.drawCentredString(x + 22, y0 + 13, code)
        c.setFillColor(INK)
        c.setFont(font_name("Body-Bold"), 8.3)
        c.drawString(x + 45, y0 + 12, label)


def page_core(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "Obra y planificación")
    draw_section_title(
        c,
        "02 | Seguimiento visual",
        "La obra, del conjunto al detalle",
        "Las métricas y fichas se actualizan con cada revisión validada. El plano y la Curva S son controles operativos, no imágenes estáticas.",
    )

    left = MARGIN_X
    card_w = 305
    card_h = 78
    cards = [
        (
            "01",
            "Resumen ejecutivo",
            "Prioridades, desviaciones, calidad del dato, acciones, informes y estado general según el área del usuario.",
        ),
        (
            "02",
            "Planificación",
            "Curva S, avance físico, plan contra ejecutado, paquetes desviados, ruta crítica y previsión de finalización.",
        ),
        (
            "03",
            "Implantación general",
            "Plano visual o técnico, zoom, pantalla completa y puntos interactivos de edificios, apartamentos y urbanismo.",
        ),
        (
            "04",
            "Edificios",
            "Ficha conjunta, avance, apartamentos incluidos, incidencias, responsables, evidencia y última actualización.",
        ),
        (
            "05",
            "Apartamentos",
            "Estado por color, porcentaje, superestructura, albañilería, instalaciones, acabados y datos pendientes.",
        ),
        (
            "06",
            "Urbanismo",
            "Viales, paisajismo, aparcamientos, acceso y equipamientos con situación y avance documentado.",
        ),
    ]
    start_y = 656
    for index, (number, title, body) in enumerate(cards):
        y = start_y - index * (card_h + 8) - card_h
        draw_small_card(c, left, y, card_w, card_h, number, title, body)

    preview_x = 365
    preview_y = 282
    preview_w = PAGE_W - MARGIN_X - preview_x
    preview_h = 374
    rounded_rect(c, preview_x, preview_y, preview_w, preview_h, CREAM, LINE, 13)
    draw_contain(
        c,
        PUBLIC / "araya-visual-masterplan-v3.png",
        preview_x + 12,
        preview_y + 58,
        preview_w - 24,
        preview_h - 74,
    )
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 14)
    c.drawString(preview_x + 15, preview_y + 34, "Plano vivo ARAYA")
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 7.4)
    c.drawString(preview_x + 15, preview_y + 19, "Pulsa cada punto para abrir su ficha.")

    rounded_rect(c, preview_x, 101, preview_w, 164, NAVY, NAVY, 13, 0)
    c.setStrokeColor(HexColor("#39D5F3"))
    c.setLineWidth(3)
    c.line(preview_x + 17, 213, preview_x + 57, 213)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 8)
    c.drawString(preview_x + 66, 209, "Plan operativo")
    c.setStrokeColor(GOLD)
    c.line(preview_x + 17, 189, preview_x + 57, 189)
    c.setFillColor(white)
    c.drawString(preview_x + 66, 185, "Ejecutado real")
    draw_wrapped(
        c,
        "Curva S: un punto por mes, valores reales solo hasta el último corte. Usa Pantalla completa y Esc o Cerrar para volver.",
        preview_x + 17,
        156,
        preview_w - 34,
        size=8.2,
        leading=11,
        color=HexColor("#DCE5EF"),
    )
    draw_label(c, "Dato clave", preview_x + 17, 112, ORANGE)


def page_management(c: canvas.Canvas) -> None:
    draw_page_frame(c, 4, "Gestión y trazabilidad")
    draw_section_title(
        c,
        "03 | Áreas de gestión",
        "Cada control abre su evidencia",
        "Las pestañas están enlazadas con fichas, documentos, facturas, acciones e informes. Los permisos determinan lo que cada persona puede ver o modificar.",
    )
    cards = [
        (
            "07",
            "Ventas y cobranza",
            "Reservas, contratos, cobros, saldos, evolución comercial y fuentes del periodo.",
        ),
        (
            "08",
            "Finanzas",
            "Presupuesto, costes, flujo, CxP y fideicomiso. Acceso bloqueado salvo autorización.",
        ),
        (
            "09",
            "Cronología",
            "Hitos, documentos y actividad ordenados por fecha para reconstruir decisiones.",
        ),
        (
            "10",
            "Proveedores",
            "Listado interactivo. Abre cada proveedor, revisa sus facturas y consulta el original.",
        ),
        (
            "11",
            "Seguridad y permisos",
            "Incidencias, controles preventivos, licencias y vencimientos con responsable.",
        ),
        (
            "12",
            "Centro de datos",
            "Inventario documental, estado de validación, autoridad de fuentes y trazabilidad.",
        ),
        (
            "AI",
            "Agente IA",
            "Consulta el proyecto o clasifica una carga. No aprueba datos ni sustituye al responsable.",
        ),
        (
            "AD",
            "Usuarios y accesos",
            "Solo administradores: altas, área, estado, foto, rol y permiso de Finanzas.",
        ),
    ]
    card_w = (PAGE_W - 2 * MARGIN_X - 14) / 2
    card_h = 98
    start_y = 651
    for index, (number, title, body) in enumerate(cards):
        col = index % 2
        row = index // 2
        x = MARGIN_X + col * (card_w + 14)
        y = start_y - row * (card_h + 11) - card_h
        accent = NAVY if number in ("AI", "AD") else ORANGE
        draw_small_card(c, x, y, card_w, card_h, number, title, body, accent)

    rounded_rect(c, MARGIN_X, 116, PAGE_W - 2 * MARGIN_X, 82, RED_PALE, RED_PALE, 11, 0)
    draw_label(c, "Seguridad por diseño", MARGIN_X + 15, 164, ORANGE_DARK)
    draw_wrapped(
        c,
        "Finanzas, sus documentos, acciones e informes completos requieren permiso individual. La aplicación registra altas, cambios, revisiones y publicaciones. Cerrar sesión elimina la copia privada del dispositivo.",
        MARGIN_X + 15,
        142,
        PAGE_W - 2 * MARGIN_X - 30,
        size=8.7,
        leading=11.3,
        color=INK,
    )


def draw_process_step(
    c: canvas.Canvas,
    number: int,
    title: str,
    body: str,
    x: float,
    y: float,
    w: float,
) -> None:
    c.setFillColor(ORANGE)
    c.circle(x + 16, y + 17, 16, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 9)
    c.drawCentredString(x + 16, y + 13.5, str(number))
    c.setFillColor(INK)
    c.setFont(font_name("Body-Bold"), 9.2)
    c.drawString(x + 43, y + 23, title)
    draw_wrapped(c, body, x + 43, y + 8, w - 43, size=7.7, leading=9.6, color=MUTED)


def page_workflow(c: canvas.Canvas) -> None:
    draw_page_frame(c, 5, "Flujo diario")
    draw_section_title(
        c,
        "04 | Incorporación de información",
        "Del archivo al dato vivo",
        "El original se guarda primero. Los hechos explícitos de alta confianza se publican automáticamente; cualquier duda queda pendiente de revisión.",
    )

    rounded_rect(c, MARGIN_X, 463, PAGE_W - 2 * MARGIN_X, 196, white, LINE, 13)
    steps = [
        ("Cargar", "Archivo o Hacer foto. El original queda guardado y trazable."),
        ("Identificar", "El sistema detecta área, tipo documental, periodo, moneda y origen."),
        ("Extraer", "Lee hechos explícitos y los contrasta con el valor vigente."),
        ("Publicar o revisar", "La alta confianza se publica; las dudas esperan decisión humana."),
        ("Sincronizar", "La revisión actualiza cifras, gráficos, planos y avisos en menos de 5 s."),
    ]
    step_w = (PAGE_W - 2 * MARGIN_X - 26) / 2
    for index, (title, body) in enumerate(steps):
        col = index % 2
        row = index // 2
        x = MARGIN_X + 16 + col * (step_w + 10)
        y = 603 - row * 54
        draw_process_step(c, index + 1, title, body, x, y, step_w)

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 18)
    c.drawString(MARGIN_X, 432, "Acciones habituales")
    action_w = (PAGE_W - 2 * MARGIN_X - 14) / 2
    action_cards = [
        (
            "Abrir documentos",
            "Los originales se abren dentro de Bricket Control. Eliminar recalcula el tablero y permite restaurar; descargar es opcional.",
            SAGE_PALE,
            SAGE,
        ),
        (
            "Crear informes",
            "Elige tipo (general, obra, finanzas o ventas) y periodo. La instantánea conserva moneda, autor, corte y revisión.",
            BLUE_PALE,
            NAVY,
        ),
        (
            "Gestionar acciones",
            "Crea tareas con responsable, prioridad, vencimiento, comentarios y enlace a la sección o documento.",
            CREAM,
            GOLD,
        ),
        (
            "Recibir avisos",
            "La campana reúne cargas, cambios y conexiones. Activa avisos una vez para recibirlos en móvil, tablet u ordenador.",
            RED_PALE,
            ORANGE_DARK,
        ),
    ]
    for index, (title, body, fill, accent) in enumerate(action_cards):
        col = index % 2
        row = index // 2
        x = MARGIN_X + col * (action_w + 14)
        y = 315 - row * 112
        rounded_rect(c, x, y, action_w, 96, fill, fill, 11, 0)
        c.setFillColor(accent)
        c.rect(x + 13, y + 68, 28, 3, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(font_name("Body-Bold"), 10)
        c.drawString(x + 13, y + 52, title)
        draw_wrapped(c, body, x + 13, y + 35, action_w - 26, size=8, leading=10.4, color=MUTED)

    rounded_rect(c, MARGIN_X, 84, PAGE_W - 2 * MARGIN_X, 54, NAVY, NAVY, 11, 0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 8.8)
    c.drawString(MARGIN_X + 16, 116, "IMPORTANTE")
    draw_wrapped(
        c,
        "La sincronización cada 5 segundos no consume tokens. Solo interpretar documentos libres o consultar al Asistente usa la API de IA.",
        MARGIN_X + 16,
        99,
        PAGE_W - 2 * MARGIN_X - 32,
        size=7.9,
        leading=9.8,
        color=HexColor("#DFE7EF"),
    )


def draw_install_column(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    subtitle: str,
    steps: Sequence[str],
    accent: Color,
) -> None:
    rounded_rect(c, x, y, w, h, white, LINE, 13)
    c.setFillColor(accent)
    c.roundRect(x + 15, y + h - 43, 40, 28, 14, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 8)
    c.drawCentredString(x + 35, y + h - 34, "APP")
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 15)
    c.drawString(x + 15, y + h - 69, title)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body"), 7.7)
    c.drawString(x + 15, y + h - 84, subtitle)
    step_y = y + h - 116
    for index, step in enumerate(steps, start=1):
        c.setFillColor(accent)
        c.circle(x + 25, step_y + 4, 10, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_name("Body-Bold"), 7.2)
        c.drawCentredString(x + 25, step_y + 1.3, str(index))
        lines = wrap_lines(step, "Body", 8.3, w - 63)
        c.setFillColor(INK)
        c.setFont(font_name("Body"), 8.3)
        local_y = step_y + 7
        for line in lines:
            c.drawString(x + 43, local_y, line)
            local_y -= 10.7
        step_y = local_y - 14


def page_mobile_install(c: canvas.Canvas) -> None:
    draw_page_frame(c, 6, "Móvil y tablet")
    draw_section_title(
        c,
        "05 | Instalación",
        "Lleva Bricket Control a la obra",
        "Instálalo desde el navegador, no desde una tienda. Usa siempre el enlace oficial y realiza la primera apertura con conexión.",
    )
    col_w = (PAGE_W - 2 * MARGIN_X - 14) / 2
    draw_install_column(
        c,
        MARGIN_X,
        364,
        col_w,
        296,
        "iPhone / iPad",
        "Safari",
        [
            "Abre el enlace oficial en Safari.",
            "Pulsa Compartir, el icono del cuadrado con flecha.",
            "Elige Añadir a pantalla de inicio.",
            "Confirma el nombre Bricket Control y pulsa Añadir.",
            "Abre el icono e inicia sesión con tu usuario autorizado.",
        ],
        ORANGE,
    )
    draw_install_column(
        c,
        MARGIN_X + col_w + 14,
        364,
        col_w,
        296,
        "Android",
        "Chrome",
        [
            "Abre el enlace oficial en Chrome.",
            "Pulsa el menú de tres puntos.",
            "Elige Instalar aplicación o Añadir a pantalla de inicio.",
            "Confirma Instalar.",
            "Abre el icono e inicia sesión con tu usuario autorizado.",
        ],
        NAVY,
    )

    rounded_rect(c, MARGIN_X, 183, PAGE_W - 2 * MARGIN_X, 162, CREAM, CREAM, 13, 0)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 16)
    c.drawString(MARGIN_X + 16, 319, "Preparar este dispositivo")
    draw_bullets(
        c,
        [
            "Permite notificaciones desde la campana si quieres avisos del sistema.",
            "Activa biometría en Avisos y seguridad: usa Face ID, Touch ID, huella, PIN o el método seguro disponible.",
            "Mantén abierta la pantalla que necesites si prevés una pérdida breve de cobertura.",
            "Sin internet puedes conservar la vista ya abierta; volver a entrar, cargar, modificar, generar informes o usar el agente requiere conexión.",
        ],
        MARGIN_X + 17,
        292,
        PAGE_W - 2 * MARGIN_X - 132,
        size=8.3,
        leading=10.7,
        gap=4,
    )
    draw_qr(c, APP_URL, PAGE_W - MARGIN_X - 94, 215, 77)
    c.setFillColor(MUTED)
    c.setFont(font_name("Body-Bold"), 6.8)
    c.drawCentredString(PAGE_W - MARGIN_X - 55, 201, "ESCANEAR")
    c.linkURL(APP_URL, (PAGE_W - MARGIN_X - 100, 198, PAGE_W - MARGIN_X - 9, 300), relative=0)

    rounded_rect(c, MARGIN_X, 99, PAGE_W - 2 * MARGIN_X, 65, SAGE_PALE, SAGE_PALE, 11, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 8.6)
    c.drawString(MARGIN_X + 15, 140, "EN EL TERRENO")
    draw_wrapped(
        c,
        "Usa Hacer foto para capturar un parte o documento. La imagen queda preseleccionada: revisa área, fecha de corte, moneda y descripción antes de enviarla.",
        MARGIN_X + 15,
        121,
        PAGE_W - 2 * MARGIN_X - 30,
        size=8.2,
        leading=10.4,
        color=INK,
    )


def page_desktop_support(c: canvas.Canvas) -> None:
    draw_page_frame(c, 7, "Ordenador y ayuda")
    draw_section_title(
        c,
        "06 | Cierre",
        "Instalación y uso seguro",
        "En ordenador puedes usar Bricket Control en una pestaña o instalarlo como aplicación. Ante una incidencia, conserva siempre la hora, sección y documento.",
    )

    rounded_rect(c, MARGIN_X, 474, 318, 184, white, LINE, 13)
    draw_label(c, "Ordenador", MARGIN_X + 15, 625, NAVY)
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 16)
    c.drawString(MARGIN_X + 15, 590, "Chrome o Microsoft Edge")
    draw_bullets(
        c,
        [
            "Abre el Centro de Control en Chrome o Edge.",
            "Pulsa «Instalar app» en la barra superior, o el icono Instalar de la barra de direcciones.",
            "Confirma «Instalar Bricket Control».",
            "Queda con su icono propio y se abre en su ventana, como un programa más.",
            "En Safari (Mac): menú Archivo → Añadir al Dock.",
        ],
        MARGIN_X + 15,
        563,
        288,
        size=8.3,
        leading=10.6,
        gap=3.3,
    )

    rounded_rect(c, 374, 474, PAGE_W - MARGIN_X - 374, 184, NAVY, NAVY, 13, 0)
    rounded_rect(c, 392, 523, 106, 106, white, white, 9, 0)
    draw_qr(c, APP_URL, 401, 532, 88)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 8)
    c.drawCentredString(445, 511, "ABRIR AHORA")
    c.setFont(font_name("Body"), 6.4)
    c.drawCentredString(445, 495, "Enlace oficial")
    c.linkURL(APP_URL, (396, 489, 496, 630), relative=0)

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 18)
    c.drawString(MARGIN_X, 436, "Si algo no funciona")
    issues = [
        ("1", "Sincronización", "Comprueba el indicador superior y tu conexión."),
        ("2", "Datos", "Abre Calidad y cobertura y revisa la última revisión."),
        ("3", "Documento", "Confirma que el expediente fue validado y publicado."),
        ("4", "Permisos", "Pide al administrador revisar tu área y acceso financiero."),
        ("5", "Soporte", "Anota hora, sección, archivo y revisión antes de avisar."),
    ]
    issue_w = PAGE_W - 2 * MARGIN_X
    y = 391
    for number, title, body in issues:
        rounded_rect(c, MARGIN_X, y - 37, issue_w, 35, white, LINE, 8)
        c.setFillColor(ORANGE)
        c.circle(MARGIN_X + 18, y - 19, 9, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(font_name("Body-Bold"), 7)
        c.drawCentredString(MARGIN_X + 18, y - 21.5, number)
        c.setFillColor(INK)
        c.setFont(font_name("Body-Bold"), 8.4)
        c.drawString(MARGIN_X + 38, y - 17, title)
        c.setFillColor(MUTED)
        c.setFont(font_name("Body"), 8)
        c.drawString(MARGIN_X + 141, y - 17, body)
        y -= 45

    rounded_rect(c, MARGIN_X, 105, PAGE_W - 2 * MARGIN_X, 58, ORANGE, ORANGE, 11, 0)
    c.setFillColor(white)
    c.setFont(font_name("Body-Bold"), 9.2)
    c.drawString(MARGIN_X + 16, 140, "RECUERDA")
    draw_wrapped(
        c,
        "Usa fuentes verificadas, revisa antes de aprobar, no compartas el acceso y cierra sesión en dispositivos ajenos. El administrador es el punto de contacto para altas y permisos.",
        MARGIN_X + 16,
        121,
        PAGE_W - 2 * MARGIN_X - 32,
        size=8.1,
        leading=10.2,
        color=white,
    )


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Guía corporativa Bricket Control - Personal de obra")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Funciones e instalación del Centro de Control ARAYA")
    c.setKeywords("Bricket Control, ARAYA, centro de control, obra, instalación")

    pages = [
        cover_page,
        page_start,
        page_core,
        page_management,
        page_workflow,
        page_mobile_install,
        page_desktop_support,
    ]
    for index, page in enumerate(pages):
        page(c)
        if index < len(pages) - 1:
            c.showPage()
    c.save()
    return OUTPUT


if __name__ == "__main__":
    path = build_pdf()
    print(path)
