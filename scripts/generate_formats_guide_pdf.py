"""Genera la guía de formatos: qué hace el Centro de Control con cada archivo.

Es la tercera guía del personal y la más práctica de las tres. La corporativa
explica el programa entero y la de carga explica por qué un archivo a veces no
mueve las cifras; ésta responde la pregunta concreta que se hace delante del
ordenador con el archivo ya elegido: «esto que voy a subir, ¿va a actualizar
el panel o no?».

El orden no es alfabético ni por programa: los formatos se agrupan por lo que
les pasa, porque eso es lo único que quien sube un archivo necesita saber. Y
se dedica una página entera al `.mpp`, que es el caso que más veces ha dejado
un corte mensual sin publicar.

Reutiliza la identidad visual de la guía corporativa (mismos colores, fuentes
y retículas) importando sus utilidades, para que las tres se lean como parte
de la misma familia.

    python scripts/generate_formats_guide_pdf.py

El PDF se escribe en ``output/pdf/guia_formatos_araya.pdf`` y se copia a
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
OUTPUT = ROOT / "output" / "pdf" / "guia_formatos_araya.pdf"
PUBLISHED = ROOT / "historical" / "data-center" / "guias" / "guia-formatos-araya.pdf"

CONTENT_W = PAGE_W - 2 * MARGIN_X

# Rojo y verde de la paleta corporativa, para el estado de cada grupo. El color
# aquí no decora: dice si el archivo va a mover cifras o no.
RED_DEEP = ORANGE_DARK


def draw_chips(
    c: canvas.Canvas,
    items: list[str],
    x: float,
    y: float,
    max_width: float,
    fill: Color,
    color: Color = INK,
) -> float:
    """Dibuja las extensiones como etiquetas, en varias filas si no caben.

    Se dibujan como etiquetas y no como una lista separada por comas porque se
    leen de un vistazo: quien busca «.pptx» lo encuentra sin leer la frase.
    """
    cursor_x = x
    line_y = y
    for item in items:
        w = text_width(item, "Body-Bold", 7.6) + 14
        if cursor_x + w > x + max_width:
            cursor_x = x
            line_y -= 20
        c.setFillColor(fill)
        c.roundRect(cursor_x, line_y - 4, w, 16, 8, fill=1, stroke=0)
        c.setFillColor(color)
        c.setFont(font_name("Body-Bold"), 7.6)
        c.drawString(cursor_x + 7, line_y + 1, item)
        cursor_x += w + 5
    return line_y - 14


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
    c.drawString(MARGIN_X, PAGE_H - 218, "Qué pasa con")
    c.drawString(MARGIN_X, PAGE_H - 256, "cada archivo")

    c.setStrokeColor(ORANGE)
    c.setLineWidth(2.2)
    c.line(MARGIN_X, PAGE_H - 282, MARGIN_X + 74, PAGE_H - 282)

    draw_wrapped(
        c,
        "Cuando subes un archivo al Centro de Control, el sistema elige cómo "
        "procesarlo: lectura directa, interpretación visual o conversión segura. "
        "El original y cada resultado quedan enlazados.",
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
        "Subes el archivo una vez. El sistema lo lee, lo interpreta o lo convierte y actualiza el panel.",
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
        "Los grupos seguros que el programa lee, interpreta o convierte entran "
        "automáticamente. Lo dudoso queda aislado en el recibo. MPP y DWG "
        "también tienen su proceso, explicado en la página 3.",
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
    c.drawString(MARGIN_X, 80, "4 páginas  ·  4 minutos de lectura")


def page_resultados(c: canvas.Canvas) -> None:
    draw_page_frame(c, 2, "Los tres resultados")
    y = draw_section_title(
        c,
        "SEGÚN EL FORMATO",
        "Tres resultados posibles",
        "Agrupados por lo que le pasa al archivo, no por programa: la pregunta "
        "siempre es si va a mover las cifras.",
    )

    grupos = [
        (
            "Se lee tal cual",
            "ACTUALIZA EL PANEL",
            SAGE,
            SAGE_PALE,
            [".csv", ".json", ".xml", ".xlsx", ".xls", ".docx", ".pptx", ".pdf", ".zip"],
            "Las cifras se sacan del archivo directamente, celda a celda o "
            "fila a fila. No interviene ninguna interpretación: lo que llega "
            "al panel es lo que estaba escrito. De Word y PowerPoint se leen "
            "las tablas, y del informe de obra tambien los indicadores de "
            "seguridad y los hallazgos de campo, que no van en tabla; del "
            "PDF, el texto, incluida la matriz de obligaciones del prestamo "
            "IFC; del ZIP, lo que lleve dentro.",
            152,
        ),
        (
            "Se interpreta",
            "ACTUALIZA EL PANEL",
            NAVY,
            BLUE_PALE,
            [".png", ".jpg", "PDF escaneado"],
            "Una fotografía de un parte de obra, o un PDF que es la imagen de "
            "un papel, no traen texto que leer: se interpretan. Antes lo "
            "extraído esperaba a que alguien lo aprobara; ahora entra solo, "
            "igual que lo demás. El programa comprueba que cada cifra encaje "
            "en su sitio antes de colocarla.",
            134,
        ),
        (
            "Se convierte",
            "ACTUALIZA AL TERMINAR",
            NAVY,
            BLUE_PALE,
            [".mpp", ".dwg"],
            "El original se guarda primero. Después, un proceso seguro genera "
            "un XML de Project o una vista PNG del plano, lo enlaza al original "
            "y lo vuelve a leer. No hay que convertir ni subir otra copia.",
            134,
        ),
    ]

    y -= 14
    for titulo, estado, acento, pale, formatos, cuerpo, alto in grupos:
        y -= alto
        rounded_rect(c, MARGIN_X, y, CONTENT_W, alto, white, LINE, 12)
        # La franja de color a la izquierda es la que se ve al hojear: dice el
        # resultado sin leer una palabra.
        c.setFillColor(acento)
        c.roundRect(MARGIN_X, y, 5, alto, 2.5, fill=1, stroke=0)

        c.setFillColor(INK)
        c.setFont(font_name("Display-Bold"), 14)
        c.drawString(MARGIN_X + 20, y + alto - 30, titulo)

        estado_w = text_width(estado, "Body-Bold", 7) + 16
        c.setFillColor(pale)
        c.roundRect(PAGE_W - MARGIN_X - 16 - estado_w, y + alto - 33, estado_w, 17, 8.5, fill=1, stroke=0)
        c.setFillColor(acento)
        c.setFont(font_name("Body-Bold"), 7)
        c.drawString(PAGE_W - MARGIN_X - 8 - estado_w, y + alto - 28, estado)

        chip_y = draw_chips(c, formatos, MARGIN_X + 20, y + alto - 56, CONTENT_W - 40, pale, acento)
        draw_wrapped(
            c,
            cuerpo,
            MARGIN_X + 20,
            chip_y,
            CONTENT_W - 40,
            size=9,
            leading=12.4,
            color=MUTED,
        )
        y -= 14

    # El formato es sólo la mitad de la respuesta: un Excel impecable tampoco
    # publica nada si sus filas no dicen a qué edificio pertenecen. Conviene
    # cerrar la página con eso, porque es el motivo más frecuente de que un
    # archivo del grupo verde acabe sin mover ninguna cifra.
    y -= 12
    rounded_rect(c, MARGIN_X, y - 92, CONTENT_W, 92, PALE, PALE, 12, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "EL FORMATO ES SÓLO LA MITAD")
    draw_wrapped(
        c,
        "Que el formato se lea no basta: cada cifra tiene que decir a qué "
        "pertenece. Una fila con un porcentaje pero sin el edificio al que "
        "corresponde se descarta, venga de un Excel o de un PDF. Si tienes "
        "que preparar el archivo desde cero, pide las plantillas al "
        "administrador: ya traen las columnas con el nombre correcto.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )


def page_mpp(c: canvas.Canvas) -> None:
    draw_page_frame(c, 3, "MPP y DWG automáticos")
    y = draw_section_title(
        c,
        "FORMATOS BINARIOS",
        "Los formatos binarios se convierten solos",
        "El original queda protegido desde el primer momento. La conversión "
        "continúa en segundo plano y vuelve a la misma ingesta.",
    )

    y -= 24
    card_h = 196
    col_w = (CONTENT_W - 16) / 2

    salidas = [
        (
            "MICROSOFT PROJECT",
            "MPP a XML",
            "Comprobación cada 15 minutos",
            "Se genera un XML completo con tareas, porcentajes, fechas y "
            "jerarquía. El cronograma, los edificios y la fecha prevista se "
            "actualizan cuando los datos pasan el contrato.",
            "El XML queda enlazado al .mpp: siempre se puede volver al original "
            "y saber de qué archivo salió cada dato.",
            SAGE,
            SAGE_PALE,
        ),
        (
            "AUTOCAD",
            "DWG a vista PNG",
            "Comprobación cada hora",
            "LibreDWG genera el dibujo y una vista PNG de alta resolución. "
            "Se abre en móvil o tableta y puede pasar por lectura visual.",
            "El .dwg nunca se sustituye ni se expone: la imagen es un derivado "
            "privado y queda identificada como vista automática.",
            NAVY,
            BLUE_PALE,
        ),
    ]

    for index, (rotulo, titulo, ruta, cuerpo, nota, acento, pale) in enumerate(salidas):
        x = MARGIN_X + index * (col_w + 16)
        top = y - card_h
        rounded_rect(c, x, top, col_w, card_h, white, LINE, 12)

        c.setFillColor(MUTED)
        c.setFont(font_name("Body-Bold"), 7)
        c.drawString(x + 18, top + card_h - 26, rotulo)

        c.setFillColor(INK)
        c.setFont(font_name("Display-Bold"), 14)
        c.drawString(x + 18, top + card_h - 48, titulo)

        # La ruta va en su propia caja porque es lo que la persona tiene que
        # reproducir literalmente delante de la pantalla.
        rounded_rect(c, x + 18, top + card_h - 82, col_w - 36, 26, pale, pale, 7)
        c.setFillColor(acento)
        c.setFont(font_name("Body-Bold"), 7.9)
        c.drawString(x + 27, top + card_h - 73, ruta)

        after = draw_wrapped(
            c,
            cuerpo,
            x + 18,
            top + card_h - 102,
            col_w - 36,
            size=8.8,
            leading=12,
            color=INK,
        )
        draw_wrapped(
            c,
            nota,
            x + 18,
            after - 6,
            col_w - 36,
            size=8.4,
            leading=11.4,
            color=MUTED,
        )

    y -= card_h + 30

    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Por qué se convierten fuera del panel")
    y -= 20
    y = draw_wrapped(
        c,
        "El servidor del Centro de Control es ligero y no incluye Java ni las "
        "herramientas CAD. Un runner privado aporta MPXJ, LibreDWG y librsvg, "
        "valida el resultado y lo devuelve por la API autenticada. Si una "
        "conversión falla, el original sigue intacto y el error queda visible; "
        "nunca se publica un derivado incompleto.",
        MARGIN_X,
        y,
        CONTENT_W,
        size=9.4,
        leading=13.4,
        color=MUTED,
    )

    y -= 26
    rounded_rect(c, MARGIN_X, y - 74, CONTENT_W, 74, PALE, PALE, 11, 0)
    c.setFillColor(ORANGE_DARK)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI EL CORTE ES URGENTE")
    draw_wrapped(
        c,
        "En Usuarios / Actualizar porcentajes a mano puedes publicar un avance "
        "puntual mientras termina el MPP. Queda con autor, fecha e histórico; "
        "no es necesario volver a subir el archivo.",
        MARGIN_X + 18,
        y - 42,
        CONTENT_W - 36,
        size=8.8,
        leading=11.8,
        color=INK,
    )
    y -= 74

    # Lo que hace utilizable la vía manual es que no es un atajo: cierra la
    # página porque es la duda que sigue a «puedo escribirlo yo».
    y -= 26
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "La conversión también es trazable")
    y -= 20
    draw_bullets(
        c,
        [
            "El original y el derivado aparecen enlazados en el mismo expediente.",
            "Cada derivado guarda el tipo de automatización y la versión del lector.",
            "El MPP no publica una previsión si el XML no contiene fechas Finish.",
            "El DWG conserva siempre el archivo CAD original, aunque la vista falle.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9,
        leading=12.4,
        color=MUTED,
    )


def page_detalles(c: canvas.Canvas) -> None:
    draw_page_frame(c, 4, "Detalles y comprobación")
    y = draw_section_title(
        c,
        "ANTES DE SUBIR",
        "Detalles que conviene saber",
        "Cinco cosas que evitan la mayor parte de las subidas que no acaban "
        "publicando nada.",
    )

    detalles = [
        (
            "Celdas en blanco",
            "No borran nada. Una casilla vacía significa «esto no ha "
            "cambiado», no «pon esto a cero». Puedes mandar una plantilla "
            "rellenando sólo las filas del mes.",
        ),
        (
            "Nombra el edificio",
            "Usa el código —TH-14, Edificio 14, Ed. 7— y no el número de "
            "fila. Un nombre que no corresponde a ningún edificio se descarta "
            "y se avisa, en vez de escribir la cifra en el equivocado.",
        ),
        (
            "Comprimidos",
            "Puedes subir el ZIP del mes entero. Se abre, se procesa lo que "
            "lleva dentro y en la auditoría queda de cuál de los archivos "
            "salió cada cifra. Las carpetas ocultas que añade el sistema al "
            "comprimir se ignoran.",
        ),
        (
            "PDF con tablas",
            "Un PDF no guarda tablas: guarda instrucciones de dibujo. Se "
            "recuperan los porcentajes que estén junto al nombre de su "
            "edificio, y ante la duda no se coge ninguno. Si el informe "
            "importa, manda también la hoja de cálculo.",
        ),
        (
            "Cifras financieras",
            "Puede entregarlas quien tenga el permiso para aportar documentos "
            "financieros, aunque no pueda consultar Finanzas. El sistema "
            "comprueba balance, resultados, CxP, moneda, corte y autoridad de "
            "la fuente; publica cada grupo seguro y aísla sólo lo descuadrado.",
        ),
    ]

    y -= 16
    for titulo, cuerpo in detalles:
        c.setFillColor(ORANGE)
        c.circle(MARGIN_X + 3, y + 3, 2.4, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(font_name("Body-Bold"), 9.6)
        c.drawString(MARGIN_X + 14, y, titulo)
        y = draw_wrapped(
            c,
            cuerpo,
            MARGIN_X + 14,
            y - 14,
            CONTENT_W - 14,
            size=8.9,
            leading=12,
            color=MUTED,
        )
        y -= 8
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(MARGIN_X, y + 4, PAGE_W - MARGIN_X, y + 4)
        y -= 14

    y -= 6
    c.setFillColor(INK)
    c.setFont(font_name("Display-Bold"), 13)
    c.drawString(MARGIN_X, y, "Comprobar que ha entrado")
    y -= 22
    y = draw_bullets(
        c,
        [
            "Lee el recibo al terminar: indica datos publicados, aislados, "
            "controles contables, conversiones, pantallas afectadas y la "
            "comprobación posterior.",
            "Si es MPP o DWG, el mensaje indica que la conversión sigue en "
            "segundo plano y el plazo normal de cada formato.",
            "Mira la implantación: los colores y los porcentajes cambian en "
            "menos de cinco segundos, en todas las pantallas a la vez.",
            "Si algo no cuadra, cada cifra guarda de qué archivo salió, quién "
            "lo subió y cuándo — y una publicación se puede deshacer.",
            "Para balances, resultados y flujo usa las plantillas del Centro de "
            "datos: entran por lector directo y no necesitan interpretación IA.",
        ],
        MARGIN_X,
        y,
        CONTENT_W,
        size=9,
        leading=12.4,
        color=MUTED,
    )

    y -= 18
    rounded_rect(c, MARGIN_X, y - 86, CONTENT_W, 86, SAGE_PALE, SAGE_PALE, 12, 0)
    c.setFillColor(SAGE)
    c.setFont(font_name("Body-Bold"), 7.4)
    c.drawString(MARGIN_X + 18, y - 24, "SI SÓLO TE QUEDAS CON UNA COSA")
    draw_wrapped(
        c,
        "Tu archivo nunca se pierde: se guarda siempre, con tu nombre y la "
        "fecha. El Centro de Control elige lector, interpretación o conversión, "
        "y cada resultado conserva su fuente. La bandeja se actualiza sola.",
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
        "¿Dudas con un archivo concreto? Pregunta al administrador del Centro de Control.",
    )


def build_pdf() -> Path:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Guía de formatos - Centro de Control ARAYA")
    c.setAuthor("Grupo Bricket | ARAYA Punta Cana")
    c.setSubject("Qué hace el Centro de Control con cada formato de archivo")
    c.setKeywords("Bricket Control, ARAYA, formatos, mpp, Project, obra, datos")

    pages = [cover, page_resultados, page_mpp, page_detalles]
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
