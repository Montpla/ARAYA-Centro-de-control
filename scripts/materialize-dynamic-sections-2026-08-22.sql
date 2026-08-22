-- Materialización idempotente de las dos secciones de Seguridad que el
-- reproceso de Semana 2 detectó, pero marcó como adaptadas antes de que el
-- contrato vivo consiguiera publicarlas. Conserva los IDs de Semana 1 para
-- que las cargas sucesivas actualicen el mismo bloque y no creen duplicados.

-- El saneamiento anterior fechó por error la Semana 1 en agosto. La fecha
-- demostrada por el propio nombre del informe es 11/07/2026.
UPDATE live_data_events
SET cutoff = '2026-07-11'
WHERE source_file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5'
  AND source_name = 'Seguridad semana 1 · secciones conciliadas';

UPDATE live_data_history
SET cutoff = '2026-07-11'
WHERE source_file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5'
  AND key IN ('discoveredSections.3', 'discoveredSections.4');

UPDATE live_data_points
SET cutoff = '2026-07-11'
WHERE source_file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5'
  AND key IN ('discoveredSections.3', 'discoveredSections.4');

INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT
  'de96ff24-aff7-4d83-b083-8ebdcc0bbb63',
  'ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.2  13-07-2026  al  18-07-2026 (2).pdf',
  'seguridad', '2026-07-18', 2,
  '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.',
  'sistema@grupobricket.com', 'ARAYA Asistente',
  '2026-08-22T12:00:00.000Z', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM live_data_events
  WHERE source_file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
    AND message = '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.'
);

INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id, 'discoveredSections.3',
  '{"id":"descubierto-b0455030-be14-47cb-8a3c-e742097e83d5-0","title":"ACTOS SEGUROS","description":"Buenas prácticas observadas durante el periodo.","area":"seguridad","evidence":"Págs. 11–12, sección «VII. Buenas Prácticas», tabla «ACTOS SEGUROS» y continuación superior de pág. 12.","confidence":0.98,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.2  13-07-2026  al  18-07-2026 (2).pdf","detectedAt":"2026-08-22T12:00:00.000Z","values":[{"label":"Dato 1","value":"Colocación de arnés y línea retráctil."},{"label":"Dato 2","value":"Buenas respuestas a las observaciones de seguridad."},{"label":"Dato 3","value":"Colocación de señalización y tapas temporales a los registros."},{"label":"Dato 4","value":"Señalización de registros."},{"label":"Dato 5","value":"Cortar objetos cortopunzantes y limpiar escombros de escaleras."}],"visualization":"list","unit":"","series":[]}',
  'object', 'seguridad', e.source_file_id, e.source_name, 'DOP', e.cutoff,
  e.actor_email, e.actor_name, e.created_at
FROM live_data_events e
WHERE e.source_file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
  AND e.message = '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.'
  AND NOT EXISTS (
    SELECT 1 FROM live_data_history h
    WHERE h.event_id = e.id AND h.key = 'discoveredSections.3'
  );

INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id, 'discoveredSections.4',
  '{"id":"descubierto-b0455030-be14-47cb-8a3c-e742097e83d5-1","title":"Tema","description":"Tema documentado para las charlas de seguridad.","area":"seguridad","evidence":"Pág. 13, sección «CHARLAS DE SEGURIDAD».","confidence":0.98,"sourceName":"ARAYA - Reporte Semanal de Indicadores de Seguridad - Semana No.2  13-07-2026  al  18-07-2026 (2).pdf","detectedAt":"2026-08-22T12:00:00.000Z","values":[{"label":"Valor","value":"Protección adecuada de las manos según la tarea, trabajos en altura, repaso de la ruta de evacuación y comportamiento durante una emergencia o terremoto."}],"visualization":"list","unit":"","series":[]}',
  'object', 'seguridad', e.source_file_id, e.source_name, 'DOP', e.cutoff,
  e.actor_email, e.actor_name, e.created_at
FROM live_data_events e
WHERE e.source_file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
  AND e.message = '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.'
  AND NOT EXISTS (
    SELECT 1 FROM live_data_history h
    WHERE h.event_id = e.id AND h.key = 'discoveredSections.4'
  );

INSERT INTO live_data_points (
  key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, revision, updated_by_email, updated_by_name, updated_at
)
SELECT h.key, h.value_json, h.value_type, h.area, h.source_file_id, h.source_name,
  h.source_currency, h.cutoff, h.event_id, h.actor_email, h.actor_name, h.created_at
FROM live_data_history h
JOIN live_data_events e ON e.id = h.event_id
WHERE e.source_file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
  AND e.message = '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.'
  AND h.key IN ('discoveredSections.3', 'discoveredSections.4')
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
  reviewed_at = '2026-08-22T12:00:00.000Z',
  review_note = 'Publicado en su sección estable de Seguridad y preparado para futuras actualizaciones automáticas.'
WHERE file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
  AND id IN ('07d93cd7-2cf2-4dc1-bfd4-63175c7e3284', 'b70b57fc-0e31-4bf0-8037-2185a6f9f657');

UPDATE uploaded_files
SET status = 'integrado',
  processing_stage = 'sincronizado',
  processing_progress = 100,
  processing_summary = 'Seguridad · Semana 2 (13–18/07/2026). La serie semanal ya coincidía; ACTOS SEGUROS y Tema quedaron publicados en sus secciones estables y trazables.',
  requires_review = 0,
  review_status = 'aprobado',
  reviewed_by_email = 'sistema@grupobricket.com',
  reviewed_by_name = 'ARAYA Asistente',
  reviewed_at = '2026-08-22T12:00:00.000Z',
  review_note = 'Secciones nuevas materializadas automáticamente tras corregir el contrato dinámico.',
  publication_revision = (
    SELECT MAX(id) FROM live_data_events
    WHERE source_file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
      AND message = '2 secciones de Seguridad creadas o actualizadas automáticamente con trazabilidad.'
  ),
  published_at = '2026-08-22T12:00:00.000Z',
  updated_at = '2026-08-22T12:00:00.000Z'
WHERE id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63';

INSERT OR IGNORE INTO file_reviews (
  file_id, action, note, proposal_count, publication_revision, request_key,
  actor_email, actor_name, previous_review_status, previous_updated_at,
  claimed_at, lease_expires_at, created_at
)
SELECT id, 'aprobado_automatico',
  'ACTOS SEGUROS y Tema materializados en las secciones estables de Seguridad.',
  2, publication_revision, 'materialize-dynamic-sections-2026-08-22-' || id,
  'sistema@grupobricket.com', 'ARAYA Asistente', 'procesado_con_alertas', updated_at,
  '', '', '2026-08-22T12:00:00.000Z'
FROM uploaded_files
WHERE id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63';

INSERT INTO file_activity (
  file_id, event_type, message, actor_email, actor_name, created_at
)
SELECT 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63', 'secciones_publicadas',
  'ACTOS SEGUROS y Tema creados o actualizados automáticamente en Seguridad.',
  'sistema@grupobricket.com', 'ARAYA Asistente', '2026-08-22T12:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM file_activity
  WHERE file_id = 'de96ff24-aff7-4d83-b083-8ebdcc0bbb63'
    AND event_type = 'secciones_publicadas'
    AND message = 'ACTOS SEGUROS y Tema creados o actualizados automáticamente en Seguridad.'
);
