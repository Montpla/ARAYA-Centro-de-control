# Plan de legibilidad e identidad corporativa

Fecha: 22/08/2026

## Diagnóstico

La estructura del Centro de Control funciona y no debe rediseñarse. El problema
principal está en la escala tipográfica acumulada: `app/globals.css` contiene
544 declaraciones en píxeles, 380 de ellas de 10 px o menos y 302 por debajo de
10 px. En pantallas grandes ya resultan pequeñas; en tablet y móvil pierden
contraste y obligan a acercar la vista.

También existen demasiados grises claros y tamaños distintos para funciones
equivalentes. Esto reduce la jerarquía y hace que algunas pantallas parezcan
construidas por piezas independientes.

## Dirección visual

Se mantiene la arquitectura, las cinco áreas de navegación, el plano, las
interacciones y los datos actuales. El cambio será una capa visual coherente:

- Fondo hueso cálido y superficies marfil, no blanco clínico.
- Grafito profundo para navegación y texto principal.
- Naranja Bricket reservado para selección, acciones y énfasis corporativo.
- Verde, ámbar y rojo sólo para estados; nunca como decoración.
- Sans serif corporativa y muy legible para interfaz; serif editorial sólo en
  títulos y cifras protagonistas.
- Bordes finos, radios de 10–12 px y sombras casi imperceptibles.

## Escala tipográfica mínima

| Uso | Escritorio | Móvil/tablet | Regla |
| --- | ---: | ---: | --- |
| Texto general | 15 px | 16 px | Interlineado 1,55–1,65 |
| Tablas y tarjetas | 13–14 px | 14–15 px | Nunca menos de 13 px para datos |
| Metadatos | 12 px | 12–13 px | Color con contraste AA |
| Etiquetas en mayúsculas | 11 px | 11–12 px | Peso 750 y espaciado moderado |
| Botones y pestañas | 13–14 px | 14–16 px | Alto táctil mínimo 44 px |
| Títulos de tarjeta | 20–24 px | 19–22 px | Serif editorial |
| Títulos de vista | 32–42 px | 28–34 px | Serif editorial, línea corta |

Las excepciones sólo serán rótulos internos del plano cuando el espacio físico
lo exija; deben disponer de ficha ampliada al pulsarlos.

## Ejecución por fases

### 1. Tokens globales y accesibilidad

- Crear variables de tamaño, peso, línea y color en `:root`.
- Subir el tamaño base de 14 a 15 px en escritorio y 16 px en móvil.
- Sustituir grises demasiado claros por dos niveles secundarios aprobados.
- Exigir contraste WCAG AA: 4,5:1 en texto normal y 3:1 en texto grande.
- Definir foco visible uniforme y objetivos táctiles de al menos 44 px.

### 2. Navegación y cabecera corporativas

- Reforzar el logotipo Bricket y el nombre ARAYA sin ampliar la barra lateral.
- Unificar grupos, subpestañas, estados activos e indicadores de sincronización.
- Llevar botones, selector de moneda, usuario y notificaciones a la misma escala.
- Mantener el orden y funcionamiento actuales en ordenador, tablet y móvil.

### 3. Tarjetas, tablas, formularios y visores

- Aplicar una única jerarquía a títulos, cifras, notas, botones y estados.
- Normalizar alturas, rellenos, bordes y radios de todos los componentes.
- Convertir tablas frágiles en tablas semánticas con encabezado estable,
  alineación numérica y desplazamiento horizontal controlado.
- Hacer que formularios, cargas y bandejas de revisión puedan leerse sin zoom.

### 4. Gráficas y plano operativo

- Aumentar etiquetas, leyendas, puntos y tooltips sin reducir el área de datos.
- Mantener la paleta de avance espacial; ajustar contraste y texto de cada nivel.
- Reservar el naranja Bricket para interacción y no confundirlo con estados.
- Revisar pantalla completa, tablet horizontal y móvil vertical.

### 5. Revisión completa y protección contra regresiones

- Revisar cada pestaña en 1440 px, 1024 px, 768 px y 390 px.
- Añadir pruebas que impidan nuevos textos dañados y tamaños críticos.
- Validar contraste, teclado, foco, zoom al 200 % y áreas táctiles.
- Publicar por bloques: base, navegación, Obra, Finanzas, Datos y Agente IA.
  Cada bloque se valida antes de continuar para no alterar datos ni funciones.

## Primer arreglo aplicado

La tabla `Evolución de seguridad` ya se convirtió en una tabla semántica de
cinco columnas. Se corrigió la codificación de `Evolución` y de la flecha de
fechas, se elevó el texto de datos a 13 px y se dejó desplazamiento horizontal
para móvil. Una prueba automática protege esta estructura y la codificación.

## Ejecución completa

Los cinco bloques quedaron aplicados el 22/08/2026 mediante
`app/corporate-theme.css`, cargado después de `app/globals.css`. Esta separación
conserva toda la lógica histórica y concentra en un único archivo la identidad,
la escala tipográfica, el contraste y la adaptación responsive.

- Se implantaron tokens marfil, grafito, naranja Bricket y estados semánticos.
- Navegación, cabecera, buscador, selector de moneda y cuenta comparten jerarquía.
- Tarjetas, pestañas, tablas, formularios, modales, cargas y visor se normalizaron.
- Curva S, leyendas, indicadores, apartamentos y controles del plano ganaron
  lectura sin alterar datos, colores de avance ni coordenadas de edificios.
- Tablet y móvil usan base de 16 px, controles táctiles de 44–58 px y visor
  adaptado a pantalla completa.
- La auditoría automática pasó de 235 selectores históricos pequeños pendientes
  tras la primera capa a **0 reglas de 10 px o menos sin cobertura**.
- Se eliminaron secuencias de codificación rota de `app/` y `lib/`, incluidos
  mensajes de validación y las instrucciones internas del agente documental.

Las pruebas `corporate-theme.test.mjs` verifican orden de carga, contraste AA,
escala, tactilidad, responsive, tipografías y cobertura de reglas antiguas.
`text-encoding.test.mjs` impide reintroducir mojibake en la interfaz o sus
mensajes. El modo TV y los rótulos espaciales tienen excepciones controladas por
su contexto, no quedan sometidos a una ampliación indiscriminada. Verificación
final local: TypeScript y build Vinext correctos, ESLint con 0 errores (20 avisos
históricos) y suite completa **360/360**.

## Criterio de cierre

El criterio queda satisfecho por código y pruebas: los textos de negocio tienen
cobertura corporativa, los tokens principales pasan contraste AA, las mismas
jerarquías se mantienen en ordenador, tablet y móvil y el modelo de navegación
existente no cambia. La revisión visual automatizada queda condicionada a que el
navegador integrado esté disponible en la sesión de trabajo.
