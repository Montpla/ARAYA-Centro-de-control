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

## 4. Curva S **[en código: `lib/source-precedence.ts`]**

- Plan operativo: el Excel maestro de gráficos (`GRAFICOS ARAYA FASE II…`).
- Plan reprogramado: el del Informe Ejecutivo del mes, completado por el Excel
  de curva reprogramada cuando el dueño lo aporte para su integración. Las
  series de edificios y urbanismo conservan su alcance agregado.
- La fila «Original» de ese Excel se conserva como comparación del documento;
  no sustituye automáticamente el plan operativo del Excel maestro.
- Una presentación no sustituye el plan operativo del Excel maestro. Para el
  mismo corte, la curva reprogramada del Excel aportado prevalece sobre la
  presentación; una presentación de un corte posterior puede adelantarlo.
- Ejecutado: el del Excel de la curva reprogramada (bloque «EJECUTADOS MES …», fila
  «Conjunto»), que fija también el avance global del resumen **[en código:
  `lib/source-precedence.ts`, `CURVE_ACTUAL_KEY`]**. Decisión de la oficina de obra
  trasladada por el dueño el 25/11/2026: «la curva debe agarrarla del archivo
  donde está la curva, no de la cubicación». La cubicación sigue mandando en
  edificios, oficios y urbanismo y **nunca** fija el ejecutado ni el avance
  global, tampoco en un mes nuevo (su total ponderado sólo se cita en el
  resumen de la carga). Si falta el Excel de la curva de un mes, la
  verificación avisa de que falta ese archivo; no es un fallo que arreglar.

## 5. Documentos con errores de origen

No se integran y se avisa al dueño para que pida la corrección a la obra:
porcentajes por encima de 100 % o negativos, fechas de corte futuras, o un
documento que se contradice a sí mismo.

## 6. Flujo financiero reprogramado **[en código]**

Para el mismo corte, el Excel del flujo aportado por el dueño prevalece sobre
el Informe Ejecutivo en los meses, resúmenes y auditoría de ese flujo. Los
anticipos conservan su alcance separado. No se modifica el original del informe
para hacer desaparecer diferencias entre documentos.

## Decisiones del dueño

Cada decisión tomada al responder a una incidencia de carga se añade aquí con
la fecha, la incidencia y la regla resultante.

<!-- Claude: añade las nuevas decisiones debajo de esta línea, una por punto. -->

- 19/11/2026, encargo directo del dueño: hacer coincidir el centro de control con
  el Excel de octubre, respetando comas y números sin separadores. Conservar
  las celdas numéricas nativas del XLSX; en texto porcentual, la coma es decimal.
  No deducir decimales ausentes ni eliminar partidas de rectificación por su signo.
  Los desgloses por edificio conservan ese alcance; no implican avance por vivienda.
- 25/11/2026, oficina de obra (audios trasladados por el dueño): el ejecutado de la
  Curva S y el avance global salen del Excel de la curva reprogramada (octubre:
  32,06 % del conjunto); los edificios siguen la cubicación (edificio 75: 33,60 %).
