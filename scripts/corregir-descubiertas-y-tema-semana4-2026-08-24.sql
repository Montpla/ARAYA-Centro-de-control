-- Corrige la lectura del panel y publica el "Tema" pendiente de la Semana Nº4
-- de Seguridad. No cambia ninguna cifra existente del Centro de Control.
--
-- 1) Elimina la fila "discoveredSections" (clave raíz, sin sufijo numérico)
--    que quedó publicada por error en la revisión 44 con un contenido
--    parcial/obsoleto. Por cómo se relee el dato vivo, una clave raíz más
--    "reciente" (por fecha de corte) tapa a todas sus claves hijas
--    (discoveredSections.0 … .4), aunque esas hijas sean individualmente más
--    nuevas y estén correctamente publicadas. Al quitar la raíz obsoleta,
--    vuelven a verse las 4 secciones que ya estaban publicadas pero ocultas
--    (Certificaciones LEED Gold, ACTOS SEGUROS ×2 y el Tema de una semana
--    anterior) — ninguna cifra cambia, sólo su visibilidad.
--
-- 2) Publica como discoveredSections.5 el "Tema" de la charla de seguridad de
--    la Semana Nº4, que seguía como candidato "pendiente" (unmapped_field_candidates
--    id 28009245-fa26-4a4c-8f54-d6b3b6a615a3), tal como se hizo para las
--    charlas de semanas anteriores.

DELETE FROM live_data_points WHERE key = 'discoveredSections';

INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT
  '3c82c20a-d81b-476e-9c37-27fefc308762',
  'ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.4  27-07-2026  al  1-08-2026 .pdf',
  'seguridad', '2026-07-27', 1,
  '1 sección de Seguridad (Tema) creada automáticamente con trazabilidad.',
  'sistema@grupobricket.com', 'ARAYA Asistente',
  '2026-08-24T12:00:00.000Z', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM live_data_events
  WHERE source_file_id = '3c82c20a-d81b-476e-9c37-27fefc308762'
    AND message = '1 sección de Seguridad (Tema) creada automáticamente con trazabilidad.'
);

INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id, 'discoveredSections.5',
  '{"id":"descubierto-28009245-fa26-4a4c-8f54-d6b3b6a615a3","title":"Tema","description":"Tema tratado en las charlas de seguridad del periodo.","area":"seguridad","evidence":"Página 13, sección CHARLAS DE SEGURIDAD.","confidence":0.96,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.4  27-07-2026  al  1-08-2026 .pdf","detectedAt":"2026-08-22T15:55:49.000Z","values":[{"label":"Valor","value":"Cuidado de las mano, la buena alimentación e hidratación y su impacto y relación con la seguridad, la importancia de revisar herramientas y área de trabajo antes de iniciar la tarea, concientización de la energía eléctrica y los andamios."}],"visualization":"list","unit":"","series":[]}',
  'object', 'seguridad', e.source_file_id, e.source_name, 'DOP', e.cutoff,
  e.actor_email, e.actor_name, e.created_at
FROM live_data_events e
WHERE e.source_file_id = '3c82c20a-d81b-476e-9c37-27fefc308762'
  AND e.message = '1 sección de Seguridad (Tema) creada automáticamente con trazabilidad.'
  AND NOT EXISTS (
    SELECT 1 FROM live_data_history h
    WHERE h.event_id = e.id AND h.key = 'discoveredSections.5'
  );

INSERT INTO live_data_points (
  key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, revision, updated_by_email, updated_by_name, updated_at
)
SELECT h.key, h.value_json, h.value_type, h.area, h.source_file_id, h.source_name,
  h.source_currency, h.cutoff, h.event_id, h.actor_email, h.actor_name, h.created_at
FROM live_data_history h
JOIN live_data_events e ON e.id = h.event_id
WHERE e.source_file_id = '3c82c20a-d81b-476e-9c37-27fefc308762'
  AND e.message = '1 sección de Seguridad (Tema) creada automáticamente con trazabilidad.'
  AND h.key = 'discoveredSections.5'
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  value_type = excluded.value_type,
  area = excluded.area,
  source_file_id = excluded.source_file_id,
  source_name = excluded.source_name,
  source_currency = excluded.source_currency,
  cutoff = excluded.cutoff,
  revision = excluded.revision,
  updated_by_email = excluded.updated_by_email,
  updated_by_name = excluded.updated_by_name,
  updated_at = excluded.updated_at;

UPDATE unmapped_field_candidates
SET status = 'adaptado',
  reviewed_by_email = 'sistema@grupobricket.com',
  reviewed_by_name = 'ARAYA Asistente',
  reviewed_at = '2026-08-24T12:00:00.000Z',
  review_note = 'Publicado en su sección estable de Seguridad (discoveredSections.5).'
WHERE id = '28009245-fa26-4a4c-8f54-d6b3b6a615a3'
  AND status = 'pendiente';

INSERT INTO file_activity (
  file_id, event_type, message, actor_email, actor_name, created_at
)
SELECT '3c82c20a-d81b-476e-9c37-27fefc308762', 'secciones_publicadas',
  'Tema (charla de seguridad, Semana Nº4) publicado automáticamente en Seguridad.',
  'sistema@grupobricket.com', 'ARAYA Asistente', '2026-08-24T12:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM file_activity
  WHERE file_id = '3c82c20a-d81b-476e-9c37-27fefc308762'
    AND event_type = 'secciones_publicadas'
    AND message = 'Tema (charla de seguridad, Semana Nº4) publicado automáticamente en Seguridad.'
);
