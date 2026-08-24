-- Corrige de verdad la visibilidad de las secciones descubiertas, sin borrar
-- ningún historial. El primer intento (scripts/corregir-descubiertas-y-tema-
-- semana4-2026-08-24.sql) borró la fila "discoveredSections" de live_data_points,
-- pero esa tabla NO es la que usa el panel: readEffectivePublishedRows()
-- (lib/effective-live-data.ts) lee de live_data_history, no de
-- live_data_points. Ahí sigue existiendo una fila "discoveredSections" (clave
-- raíz, sin sufijo) con corte 2026-08-18 y contenido parcial/obsoleto que,
-- por ser "más reciente" que sus hijas individuales, las tapa a todas.
--
-- En vez de borrar esa fila del historial (no se borra historial ajeno), se
-- añade una fila NUEVA para la misma clave raíz, con un corte más reciente
-- (2026-08-24) y el contenido COMPLETO Y CORRECTO de las 6 secciones que hoy
-- existen (discoveredSections.0 … .5). Al ganar por fecha de corte, esta
-- nueva fila pasa a ser la vigente para "discoveredSections" y su propio
-- valor ya contiene todo lo que había que mostrar — no hace falta que las
-- hijas individuales "ganen", porque la raíz ya las incluye todas. Ninguna
-- cifra del Centro de Control cambia: sólo se hace visible contenido que ya
-- estaba publicado.

INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT
  '', 'Corrección de visibilidad de secciones descubiertas', 'seguridad',
  '2026-08-24', 1,
  'Repuesta la clave raíz discoveredSections con el contenido completo de sus 6 secciones.',
  'sistema@grupobricket.com', 'ARAYA Asistente',
  '2026-08-24T13:00:00.000Z', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM live_data_events
  WHERE message = 'Repuesta la clave raíz discoveredSections con el contenido completo de sus 6 secciones.'
);

INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id, 'discoveredSections',
  '[{"id":"descubierto-3b027387-6732-456d-a8dd-ec977e69b014","title":"Certificaciones LEED Gold","description":"Cantidad de certificaciones LEED Gold obtenidas por el proyecto ARAYA en el corte indicado.","area":"obra","evidence":"Página 1, texto: “Certificaciones LEED obtenidas por el proyecto ARAYA: 3 certificaciones LEED Gold otorgadas este corte.”","confidence":0.98,"sourceName":"Propuesta pendiente recuperada","detectedAt":"2026-08-12 14:06:20","values":[]},{"id":"descubierto-3c82c20a-d81b-476e-9c37-27fefc308762-0","title":"ACTOS SEGUROS","description":"Lista de buenas prácticas observadas durante el periodo reportado.","area":"seguridad","evidence":"Página 11, tabla ACTOS SEGUROS.","confidence":0.98,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.4  27-07-2026  al  1-08-2026 .pdf","detectedAt":"2026-08-22T15:55:44.570Z","values":[{"label":"Dato 1","value":"Colocación de arnés y línea retráctil."},{"label":"Dato 2","value":"Buenas respuestas a las observaciones de seguridad."},{"label":"Dato 3","value":"Colocación de señalización y tapas temporales a los registros."},{"label":"Dato 4","value":"Señalización de registros."},{"label":"Dato 5","value":"Cortar objeto corto punzantes y limpiar escombros de escaleras."}],"visualization":"list","unit":"","series":[]},{"id":"descubierto-755aacde-b83a-4e72-8948-c83f3ae6f318","title":"RELACION DE OBRA EJECUTADA","description":"Totales declarados de presupuesto, obra ejecutada en el periodo, acumulado anterior y acumulado actual.","area":"diseno","evidence":"Pestaña CARATULA, tabla “RELACION DE OBRA EJECUTADA”, fila TOTAL 50.","confidence":0.98,"sourceName":"Propuesta pendiente recuperada","detectedAt":"2026-08-14 14:07:25","values":[]},{"id":"descubierto-b0455030-be14-47cb-8a3c-e742097e83d5-0","title":"ACTOS SEGUROS","description":"Buenas prácticas observadas durante el periodo.","area":"seguridad","evidence":"Págs. 11–12, sección «VII. Buenas Prácticas», tabla «ACTOS SEGUROS» y continuación superior de pág. 12.","confidence":0.98,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.2  13-07-2026  al  18-07-2026 (2).pdf","detectedAt":"2026-08-22T12:00:00.000Z","values":[{"label":"Dato 1","value":"Colocación de arnés y línea retráctil."},{"label":"Dato 2","value":"Buenas respuestas a las observaciones de seguridad."},{"label":"Dato 3","value":"Colocación de señalización y tapas temporales a los registros."},{"label":"Dato 4","value":"Señalización de registros."},{"label":"Dato 5","value":"Cortar objetos cortopunzantes y limpiar escombros de escaleras."}],"visualization":"list","unit":"","series":[]},{"id":"descubierto-b0455030-be14-47cb-8a3c-e742097e83d5-1","title":"Tema","description":"Tema documentado para las charlas de seguridad.","area":"seguridad","evidence":"Pág. 13, sección «CHARLAS DE SEGURIDAD».","confidence":0.98,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.2  13-07-2026  al  18-07-2026 (2).pdf","detectedAt":"2026-08-22T12:00:00.000Z","values":[{"label":"Valor","value":"Protección adecuada de las manos según la tarea, trabajos en altura, repaso de la ruta de evacuación y comportamiento durante una emergencia o terremoto."}],"visualization":"list","unit":"","series":[]},{"id":"descubierto-28009245-fa26-4a4c-8f54-d6b3b6a615a3","title":"Tema","description":"Tema tratado en las charlas de seguridad del periodo.","area":"seguridad","evidence":"Página 13, sección CHARLAS DE SEGURIDAD.","confidence":0.96,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.4  27-07-2026  al  1-08-2026 .pdf","detectedAt":"2026-08-22T15:55:49.000Z","values":[{"label":"Valor","value":"Cuidado de las mano, la buena alimentación e hidratación y su impacto y relación con la seguridad, la importancia de revisar herramientas y área de trabajo antes de iniciar la tarea, concientización de la energía eléctrica y los andamios."}],"visualization":"list","unit":"","series":[]}]',
  'object', 'seguridad', '', 'Corrección de visibilidad de secciones descubiertas', 'DOP', '2026-08-24',
  e.actor_email, e.actor_name, e.created_at
FROM live_data_events e
WHERE e.message = 'Repuesta la clave raíz discoveredSections con el contenido completo de sus 6 secciones.'
  AND NOT EXISTS (
    SELECT 1 FROM live_data_history h
    WHERE h.event_id = e.id AND h.key = 'discoveredSections'
  );
