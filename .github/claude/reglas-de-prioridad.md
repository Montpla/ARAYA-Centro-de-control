# Reglas de prioridad entre fuentes

Qué documento manda cuando dos dicen cosas distintas del mismo dato. Son
decisiones del dueño del proyecto. El arreglo automático de cargas
(`.github/claude/arreglar-carga.md`) las aplica sin preguntar, y cada decisión
nueva que el dueño tome desde el móvil se añade al final de este archivo para
no volver a preguntarla.

Las reglas marcadas con **[en código]** ya las aplica el propio programa al
publicar o al verificar; el resto las aplica Claude al revisar una carga.

## 0. Es real si lo dice el documento **[en código]**

Norma del dueño (19/11/2026): «es real si lo dice el Excel». El programa publica
exactamente lo que dice el documento, sin estimar ni redondear por su cuenta, y
cada lector debe reproducir los totales del propio documento:

- La cubicación se autocomprueba: la suma de sus oficios debe cuadrar (±1 punto)
  con el total del capítulo «EDIFICIOS» del propio Excel. Si no cuadra, los
  oficios no se publican y la verificación lo trata como anomalía para
  arreglar el lector (`lib/ingestion.ts`, `extractCubicacionDisciplineProgress`).
- Los números se leen como los escribió quien hizo el documento
  (`parseLocalizedNumber` en `lib/ingestion.ts`). La oficina de la obra
  (República Dominicana) escribe coma de miles y punto decimal
  («1,234,567.89»); en España, al revés («1.234.567,89»); un .xlsx guarda el
  número en formato de máquina («53771.928»). Con los dos separadores, el último
  es el decimal; sólo comas en grupos de tres («45,000») son miles; una sola
  coma suelta («12,5») es decimal.
- Las hojas se leen enteras (hasta 50.000 filas); nunca se publica una lectura
  parcial como si fuera completa.
- Al arreglar cualquier lector, compara su resultado con los totales del propio
  documento antes de dar el arreglo por bueno.

## 1. Avance físico (edificios, apartamentos, oficios, urbanismo, avance total y ejecutado de la Curva S) **[en código: `lib/source-precedence.ts`]**

Decisión del dueño: «deben mandar los edificios y la cubicación».

1. Cubicación (`Cubicacion_*`).
2. Excel de avance de edificios o de urbanismo (`Avance edificio`, `Avance urbanismo`).
3. Plan de Project (`.mpp` y su `.xml` convertido).
4. Informe Ejecutivo y presentaciones (`.pptx`).
5. Cualquier otro documento.

- Una fuente de menos prioridad **no pisa** lo que ya fijó una de más prioridad
  para el mismo mes. Sí puede adelantar un mes nuevo, que la siguiente
  cubicación corregirá.
- Si una fuente de más prioridad corrige a la baja un valor de otra de menos,
  es una corrección esperada, no un fallo (la verificación lo trata como aviso).
- A igual prioridad, gana el corte más reciente y, a igual corte, la versión
  subida después.

## 2. Fechas de corte **[en código]**

- Un dato con un corte anterior al ya publicado para la misma clave nunca pisa
  al vigente (se conserva en el historial).
- El corte de un documento es la fecha que trae su nombre; en un rango
  («26-10-2026 al 31-10-2026») manda la fecha final; «CORTE dd-mm-aaaa» manda
  sobre cualquier otra.

## 3. Seguridad

- La «foto» de la semana (`safetyMetrics`) es la del reporte semanal más
  reciente; un reporte de una semana anterior no la pisa **[en código]**.
- La serie semanal (`safetyWeeklySeries`) acumula todas las semanas; cada
  reporte sustituye sólo su propia fila.

## 4. Curva S

- Plan operativo: el Excel maestro de gráficos (`GRAFICOS ARAYA FASE II…`).
- Plan reprogramado: el del Informe Ejecutivo del mes.
- Ejecutado: según la regla 1 (la cubicación del mes manda).

## 5. Documentos con errores de origen

No se integran y se avisa al dueño para que pida la corrección a la obra:
porcentajes por encima de 100 % o negativos, fechas de corte futuras, o un
documento que se contradice a sí mismo.

## Decisiones del dueño

Cada decisión tomada al responder a una incidencia de carga se añade aquí con
la fecha, la incidencia y la regla resultante.

<!-- Claude: añade las nuevas decisiones debajo de esta línea, una por punto. -->

- 19/11/2026, encargo directo del dueño: hacer coincidir el centro de control con
  el Excel de octubre, respetando comas y n?meros sin separadores. Conservar
  las celdas num?ricas nativas del XLSX; en texto porcentual, la coma es decimal.
  No deducir decimales ausentes ni eliminar partidas de rectificación por su signo.
  Los desgloses por edificio conservan ese alcance; no implican avance por vivienda.
