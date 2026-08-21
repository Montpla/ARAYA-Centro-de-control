-- Saneamiento idempotente del expediente ARAYA auditado el 21/08/2026.
-- No borra originales ni historia viva: clasifica versiones, cierra colas
-- obsoletas y publica únicamente hechos contrastados con sus fuentes.
BEGIN TRANSACTION;

-- Deja trazabilidad de las decisiones antes de cambiar el estado visible.
INSERT OR IGNORE INTO file_reviews (
  file_id, action, note, proposal_count, publication_revision, request_key,
  actor_email, actor_name, previous_review_status, previous_updated_at,
  claimed_at, lease_expires_at, created_at
)
SELECT id, 'aprobado_automatico',
  'Validado en la auditoría integral de fuentes del 21/08/2026; los hechos ya publicados se conservaron sin alterar su procedencia.',
  0, publication_revision, 'cleanup-2026-08-21-approve-' || id,
  'sistema@grupobricket.com', 'Saneamiento automático', review_status, updated_at,
  '', '', '2026-08-21T17:00:00.000Z'
FROM uploaded_files
WHERE id IN (
  'b0455030-be14-47cb-8a3c-e742097e83d5',
  'de96ff24-aff7-4d83-b083-8ebdcc0bbb63',
  '0f83c7ff-4510-42be-bc84-94858e41f6d3',
  '3c82c20a-d81b-476e-9c37-27fefc308762',
  'fe3054cb-0ae4-4b7d-a32b-11d5e1618f15',
  'cc4f593e-f489-4fde-bcb4-b5acaf6eedbe',
  'e49d7c78-df54-48b7-ad91-f1892df9d264'
);

INSERT OR IGNORE INTO file_reviews (
  file_id, action, note, proposal_count, publication_revision, request_key,
  actor_email, actor_name, previous_review_status, previous_updated_at,
  claimed_at, lease_expires_at, created_at
)
SELECT id, 'superado',
  'Versión redundante conservada en el histórico; la versión canónica equivalente permanece activa.',
  0, publication_revision, 'cleanup-2026-08-21-supersede-' || id,
  'sistema@grupobricket.com', 'Saneamiento automático', review_status, updated_at,
  '', '', '2026-08-21T17:00:00.000Z'
FROM uploaded_files
WHERE id IN (
  '1f4f19dd-7635-4d73-b3f3-5d600ef90584',
  'f352ab02-a9d2-42af-b172-e61bdc369861',
  '0c353086-f45d-47fc-8cfd-82a515162d4f',
  '356f5308-9350-40c7-8e7f-b03b85742a6a',
  'ceadf9f4-f522-46f6-b68e-ddf9ebc077fc',
  'dcfc6e12-3e97-4e13-a723-78cb7d5bc9ce',
  '605ef09b-1f32-41fa-8143-71492ea7d3df',
  'f95d5f90-f826-450d-a088-4807d600b0d0',
  '1c2b2e1b-5f2f-4b5e-8b1b-5ab2dfd4d6e5'
);

-- Fuentes canónicas: todo lo contrastado queda sincronizado y sin una falsa
-- discrepancia histórica en el contador de trabajo pendiente.
UPDATE uploaded_files SET
  status = 'integrado', processing_stage = 'sincronizado',
  processing_progress = 100, requires_review = 0,
  review_status = 'aprobado', discrepancy_count = 0,
  reviewed_by_email = 'sistema@grupobricket.com',
  reviewed_by_name = 'Saneamiento automático',
  reviewed_at = '2026-08-21T17:00:00.000Z',
  review_note = 'Fuente contrastada y conciliada en la auditoría integral del 21/08/2026.',
  processed_at = CASE WHEN processed_at = '' THEN '2026-08-21T17:00:00.000Z' ELSE processed_at END,
  updated_at = '2026-08-21T17:00:00.000Z'
WHERE id IN (
  'b0455030-be14-47cb-8a3c-e742097e83d5',
  'de96ff24-aff7-4d83-b083-8ebdcc0bbb63',
  '0f83c7ff-4510-42be-bc84-94858e41f6d3',
  '3c82c20a-d81b-476e-9c37-27fefc308762',
  'fe3054cb-0ae4-4b7d-a32b-11d5e1618f15',
  'cc4f593e-f489-4fde-bcb4-b5acaf6eedbe',
  'e49d7c78-df54-48b7-ad91-f1892df9d264'
);

-- Versiones semánticamente equivalentes. Se conservan en R2/D1 y son
-- recuperables; por defecto ya no saturan el expediente operativo.
UPDATE uploaded_files SET
  status = 'integrado', processing_stage = 'historico',
  processing_progress = 100, requires_review = 0,
  review_status = 'superado', discrepancy_count = 0,
  superseded_by_file_id = CASE
    WHEN id IN ('1f4f19dd-7635-4d73-b3f3-5d600ef90584','f352ab02-a9d2-42af-b172-e61bdc369861') THEN 'e49d7c78-df54-48b7-ad91-f1892df9d264'
    WHEN id IN ('0c353086-f45d-47fc-8cfd-82a515162d4f','356f5308-9350-40c7-8e7f-b03b85742a6a','ceadf9f4-f522-46f6-b68e-ddf9ebc077fc','dcfc6e12-3e97-4e13-a723-78cb7d5bc9ce','605ef09b-1f32-41fa-8143-71492ea7d3df') THEN '87e6b94e-8586-481b-ba8c-29c374ce9107'
    WHEN id = 'f95d5f90-f826-450d-a088-4807d600b0d0' THEN 'f2743cb3-b918-469e-b092-54b6ca82e018'
    WHEN id = '1c2b2e1b-5f2f-4b5e-8b1b-5ab2dfd4d6e5' THEN '458097f8-36d1-4761-88f7-9336da6d1a1f'
    ELSE superseded_by_file_id END,
  superseded_at = '2026-08-21T17:00:00.000Z',
  reviewed_by_email = 'sistema@grupobricket.com',
  reviewed_by_name = 'Saneamiento automático',
  reviewed_at = '2026-08-21T17:00:00.000Z',
  review_note = 'Versión redundante conservada en el histórico; sustituida por la fuente canónica indicada.',
  updated_at = '2026-08-21T17:00:00.000Z'
WHERE id IN (
  '1f4f19dd-7635-4d73-b3f3-5d600ef90584',
  'f352ab02-a9d2-42af-b172-e61bdc369861',
  '0c353086-f45d-47fc-8cfd-82a515162d4f',
  '356f5308-9350-40c7-8e7f-b03b85742a6a',
  'ceadf9f4-f522-46f6-b68e-ddf9ebc077fc',
  'dcfc6e12-3e97-4e13-a723-78cb7d5bc9ce',
  '605ef09b-1f32-41fa-8143-71492ea7d3df',
  'f95d5f90-f826-450d-a088-4807d600b0d0',
  '1c2b2e1b-5f2f-4b5e-8b1b-5ab2dfd4d6e5'
);

-- Las propuestas de archivos retirados o de generaciones anteriores no son
-- trabajo vivo. Las propuestas antiguas de KPI de Seguridad quedan superadas
-- por el corte de 01/08; los dos bloques descriptivos se publican más abajo.
UPDATE document_data_proposals SET status = 'superado',
  notes = trim(notes || ' Cerrado por saneamiento: fuente retirada, versión histórica o corte posterior vigente.'),
  updated_at = '2026-08-21T17:00:00.000Z'
WHERE status = 'pendiente' AND (
  file_id IN (SELECT id FROM uploaded_files WHERE deleted_at <> '' OR superseded_by_file_id <> '')
  OR file_id IN ('b0455030-be14-47cb-8a3c-e742097e83d5','de96ff24-aff7-4d83-b083-8ebdcc0bbb63')
) AND NOT (file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5' AND key IN ('discoveredSections.1','discoveredSections.2'));

-- Buenas prácticas y tema de charla de la semana 1: se conservan como
-- secciones visuales nuevas, en ranuras libres y sin colisionar con Obra.
INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT 'b0455030-be14-47cb-8a3c-e742097e83d5',
  'Seguridad semana 1 · secciones conciliadas', 'seguridad', '2026-08-18', 2,
  'Buenas prácticas y tema de charla integrados como secciones trazables.',
  'sistema@grupobricket.com', 'Saneamiento automático',
  '2026-08-21T17:01:00.000Z', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM live_data_events WHERE source_name = 'Seguridad semana 1 · secciones conciliadas'
);

UPDATE live_data_events SET cutoff='2026-08-18'
WHERE source_name='Seguridad semana 1 · secciones conciliadas';

INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id,
  CASE p.key WHEN 'discoveredSections.1' THEN 'discoveredSections.3' ELSE 'discoveredSections.4' END,
  p.value_json, 'object', 'seguridad', p.file_id, e.source_name, 'DOP',
  '2026-08-18', 'sistema@grupobricket.com', 'Saneamiento automático',
  '2026-08-21T17:01:00.000Z'
FROM document_data_proposals p
JOIN live_data_events e ON e.source_name = 'Seguridad semana 1 · secciones conciliadas'
WHERE p.file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5'
  AND p.key IN ('discoveredSections.1','discoveredSections.2')
  AND NOT EXISTS (
    SELECT 1 FROM live_data_history h WHERE h.event_id = e.id AND h.key = CASE p.key WHEN 'discoveredSections.1' THEN 'discoveredSections.3' ELSE 'discoveredSections.4' END
  );

UPDATE live_data_history SET cutoff='2026-08-18'
WHERE event_id=(SELECT id FROM live_data_events WHERE source_name='Seguridad semana 1 · secciones conciliadas');

INSERT INTO live_data_points (
  key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, revision, updated_by_email, updated_by_name, updated_at
)
SELECT h.key, h.value_json, h.value_type, h.area, h.source_file_id, h.source_name,
  h.source_currency, h.cutoff, h.event_id, h.actor_email, h.actor_name, h.created_at
FROM live_data_history h
JOIN live_data_events e ON e.id = h.event_id
WHERE e.source_name = 'Seguridad semana 1 · secciones conciliadas'
ON CONFLICT(key) DO UPDATE SET
  value_json=excluded.value_json, value_type=excluded.value_type, area=excluded.area,
  source_file_id=excluded.source_file_id, source_name=excluded.source_name,
  source_currency=excluded.source_currency, cutoff=excluded.cutoff,
  revision=excluded.revision, updated_by_email=excluded.updated_by_email,
  updated_by_name=excluded.updated_by_name, updated_at=excluded.updated_at;

UPDATE document_data_proposals SET status = 'publicado',
  notes = trim(notes || ' Integrado como sección visual de Seguridad en la auditoría del 21/08/2026.'),
  updated_at = '2026-08-21T17:01:00.000Z'
WHERE file_id = 'b0455030-be14-47cb-8a3c-e742097e83d5'
  AND key IN ('discoveredSections.1','discoveredSections.2') AND status = 'pendiente';

-- Serie semanal y seguimiento operativo de Seguridad. El KPI vigente sigue
-- siendo el consolidado del 01/08; esta raíz guarda el detalle S1-S4.
INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT '3c82c20a-d81b-476e-9c37-27fefc308762',
  'Seguridad julio · serie semanal conciliada', 'seguridad', '2026-08-01', 2,
  'Serie S1-S4 y acciones abiertas de Seguridad conciliadas con los cuatro reportes.',
  'sistema@grupobricket.com', 'Saneamiento automático',
  '2026-08-21T17:02:00.000Z', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM live_data_events WHERE source_name = 'Seguridad julio · serie semanal conciliada'
);

WITH safety_values(key, value_json, value_type) AS (
  VALUES
    ('safetyWeeklySeries', '[{"week":"S1","startDate":"2026-07-06","endDate":"2026-07-11","cutoff":"2026-07-11","eventsWeek":null,"eventsCumulative":2,"personnel":134,"hoursWeek":48,"hoursCumulative":48,"observationsWeek":5,"observationsCumulative":5,"meetingsWeek":5,"meetingsCumulative":5,"inspectionsWeek":5,"inspectionsCumulative":5,"openActions":3},{"week":"S2","startDate":"2026-07-13","endDate":"2026-07-18","cutoff":"2026-07-18","eventsWeek":null,"eventsCumulative":2,"personnel":134,"hoursWeek":48,"hoursCumulative":96,"observationsWeek":5,"observationsCumulative":10,"meetingsWeek":5,"meetingsCumulative":10,"inspectionsWeek":5,"inspectionsCumulative":10,"openActions":3},{"week":"S3","startDate":"2026-07-20","endDate":"2026-07-25","cutoff":"2026-07-25","eventsWeek":0,"eventsCumulative":2,"personnel":134,"hoursWeek":48,"hoursCumulative":144,"observationsWeek":7,"observationsCumulative":17,"meetingsWeek":4,"meetingsCumulative":14,"inspectionsWeek":5,"inspectionsCumulative":15,"openActions":2},{"week":"S4","startDate":"2026-07-27","endDate":"2026-08-01","cutoff":"2026-08-01","eventsWeek":0,"eventsCumulative":2,"personnel":134,"hoursWeek":48,"hoursCumulative":192,"observationsWeek":7,"observationsCumulative":24,"meetingsWeek":5,"meetingsCumulative":19,"inspectionsWeek":5,"inspectionsCumulative":20,"openActions":2}]', 'array'),
    ('safetyFindingTracking', '[{"finding":"Escombros acumulados","responsible":"Ingeniero del Proyecto","status":"En proceso","dueDate":"","evidence":"Pendiente designar contratista para retirar los escombros acumulados."},{"finding":"Personal sin EPP adecuado","responsible":"Ingeniero del Proyecto","status":"En proceso","dueDate":"","evidence":"Pendiente completar el suministro y uso de EPP del personal."}]', 'array')
)
INSERT INTO live_data_history (
  event_id, key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, actor_email, actor_name, created_at
)
SELECT e.id, v.key, v.value_json, v.value_type, 'seguridad', e.source_file_id,
  e.source_name, 'DOP', '2026-08-01', 'sistema@grupobricket.com',
  'Saneamiento automático', '2026-08-21T17:02:00.000Z'
FROM safety_values v
JOIN live_data_events e ON e.source_name = 'Seguridad julio · serie semanal conciliada'
WHERE NOT EXISTS (SELECT 1 FROM live_data_history h WHERE h.event_id=e.id AND h.key=v.key);

INSERT INTO live_data_points (
  key, value_json, value_type, area, source_file_id, source_name,
  source_currency, cutoff, revision, updated_by_email, updated_by_name, updated_at
)
SELECT h.key, h.value_json, h.value_type, h.area, h.source_file_id, h.source_name,
  h.source_currency, h.cutoff, h.event_id, h.actor_email, h.actor_name, h.created_at
FROM live_data_history h JOIN live_data_events e ON e.id=h.event_id
WHERE e.source_name='Seguridad julio · serie semanal conciliada'
ON CONFLICT(key) DO UPDATE SET
  value_json=excluded.value_json, value_type=excluded.value_type, area=excluded.area,
  source_file_id=excluded.source_file_id, source_name=excluded.source_name,
  source_currency=excluded.source_currency, cutoff=excluded.cutoff,
  revision=excluded.revision, updated_by_email=excluded.updated_by_email,
  updated_by_name=excluded.updated_by_name, updated_at=excluded.updated_at;

-- Restaura también la caché mutable al ganador real del corte 01/08. Los
-- lectores confían en historia, pero la siguiente ingesta compara esta caché.
UPDATE live_data_points SET
  value_json=(SELECT value_json FROM live_data_history WHERE id=70),
  value_type=(SELECT value_type FROM live_data_history WHERE id=70),
  area=(SELECT area FROM live_data_history WHERE id=70),
  source_file_id=(SELECT source_file_id FROM live_data_history WHERE id=70),
  source_name=(SELECT source_name FROM live_data_history WHERE id=70),
  source_currency=(SELECT source_currency FROM live_data_history WHERE id=70),
  cutoff=(SELECT cutoff FROM live_data_history WHERE id=70),
  revision=(SELECT event_id FROM live_data_history WHERE id=70),
  updated_by_email=(SELECT actor_email FROM live_data_history WHERE id=70),
  updated_by_name=(SELECT actor_name FROM live_data_history WHERE id=70),
  updated_at=(SELECT created_at FROM live_data_history WHERE id=70)
WHERE key='safetyMetrics' AND EXISTS (SELECT 1 FROM live_data_history WHERE id=70 AND key='safetyMetrics');

UPDATE live_data_points SET
  value_json=(SELECT value_json FROM live_data_history WHERE id=143),
  value_type=(SELECT value_type FROM live_data_history WHERE id=143),
  area=(SELECT area FROM live_data_history WHERE id=143),
  source_file_id=(SELECT source_file_id FROM live_data_history WHERE id=143),
  source_name=(SELECT source_name FROM live_data_history WHERE id=143),
  source_currency=(SELECT source_currency FROM live_data_history WHERE id=143),
  cutoff=(SELECT cutoff FROM live_data_history WHERE id=143),
  revision=(SELECT event_id FROM live_data_history WHERE id=143),
  updated_by_email=(SELECT actor_email FROM live_data_history WHERE id=143),
  updated_by_name=(SELECT actor_name FROM live_data_history WHERE id=143),
  updated_at=(SELECT created_at FROM live_data_history WHERE id=143)
WHERE key='safetyFindings' AND EXISTS (SELECT 1 FROM live_data_history WHERE id=143 AND key='safetyFindings');

-- Precisión de CxP: el PDF muestra enteros, pero su Excel de autoridad aporta
-- los centavos y el total conciliado de RD$20.921.175,00.
INSERT INTO live_data_events (
  source_file_id, source_name, area, cutoff, change_count, message,
  actor_email, actor_name, created_at, status
)
SELECT 'cc4f593e-f489-4fde-bcb4-b5acaf6eedbe',
  'CXP julio · precisión conciliada', 'finanzas', '2026-07-31', 3,
  'Centavos de antigüedad de CxP restaurados desde el detalle Excel; el total no cambia.',
  'sistema@grupobricket.com', 'Saneamiento automático',
  '2026-08-21T17:03:00.000Z', 'published'
WHERE NOT EXISTS (SELECT 1 FROM live_data_events WHERE source_name='CXP julio · precisión conciliada');

WITH cxp_values(key,value_json) AS (
  VALUES
    ('antonelyDetailTotals.payablesCurrentDop','19747897.22'),
    ('antonelyDetailTotals.payablesUnderOneMonthDop','1003815.37'),
    ('antonelyDetailTotals.payablesOlderDop','169462.41')
)
INSERT INTO live_data_history (
  event_id,key,value_json,value_type,area,source_file_id,source_name,
  source_currency,cutoff,actor_email,actor_name,created_at
)
SELECT e.id,v.key,v.value_json,'number','finanzas',e.source_file_id,e.source_name,
  'DOP','2026-07-31','sistema@grupobricket.com','Saneamiento automático',
  '2026-08-21T17:03:00.000Z'
FROM cxp_values v JOIN live_data_events e ON e.source_name='CXP julio · precisión conciliada'
WHERE NOT EXISTS (SELECT 1 FROM live_data_history h WHERE h.event_id=e.id AND h.key=v.key);

INSERT INTO live_data_points (
  key,value_json,value_type,area,source_file_id,source_name,source_currency,
  cutoff,revision,updated_by_email,updated_by_name,updated_at
)
SELECT h.key,h.value_json,h.value_type,h.area,h.source_file_id,h.source_name,
  h.source_currency,h.cutoff,h.event_id,h.actor_email,h.actor_name,h.created_at
FROM live_data_history h JOIN live_data_events e ON e.id=h.event_id
WHERE e.source_name='CXP julio · precisión conciliada'
ON CONFLICT(key) DO UPDATE SET
  value_json=excluded.value_json,value_type=excluded.value_type,area=excluded.area,
  source_file_id=excluded.source_file_id,source_name=excluded.source_name,
  source_currency=excluded.source_currency,cutoff=excluded.cutoff,
  revision=excluded.revision,updated_by_email=excluded.updated_by_email,
  updated_by_name=excluded.updated_by_name,updated_at=excluded.updated_at;

-- Los ceros de fórmula después de julio son "sin dato", no ejecución 0%.
INSERT INTO live_data_events (
  source_file_id,source_name,area,cutoff,change_count,message,
  actor_email,actor_name,created_at,status
)
SELECT '87e6b94e-8586-481b-ba8c-29c374ce9107',
  'Curva S julio · futuros normalizados','obra','2026-08-20',1,
  'Los ceros de fórmula de agosto 2026 a agosto 2027 se normalizan como meses todavía no ejecutados.',
  'sistema@grupobricket.com','Saneamiento automático','2026-08-21T17:04:00.000Z','published'
WHERE NOT EXISTS (SELECT 1 FROM live_data_events WHERE source_name='Curva S julio · futuros normalizados');

UPDATE live_data_events SET cutoff='2026-08-20'
WHERE source_name='Curva S julio · futuros normalizados';

INSERT INTO live_data_history (
  event_id,key,value_json,value_type,area,source_file_id,source_name,
  source_currency,cutoff,actor_email,actor_name,created_at
)
SELECT e.id,'monthlyPlan',
  json_set(p.value_json,
    '$[14].actual',NULL,'$[15].actual',NULL,'$[16].actual',NULL,'$[17].actual',NULL,
    '$[18].actual',NULL,'$[19].actual',NULL,'$[20].actual',NULL,'$[21].actual',NULL,
    '$[22].actual',NULL,'$[23].actual',NULL,'$[24].actual',NULL,'$[25].actual',NULL,
    '$[26].actual',NULL),
  'array','obra',e.source_file_id,e.source_name,'DOP','2026-08-20',
  'sistema@grupobricket.com','Saneamiento automático','2026-08-21T17:04:00.000Z'
FROM live_data_points p
JOIN live_data_events e ON e.source_name='Curva S julio · futuros normalizados'
WHERE p.key='monthlyPlan'
  AND NOT EXISTS (SELECT 1 FROM live_data_history h WHERE h.event_id=e.id AND h.key='monthlyPlan');

UPDATE live_data_history SET cutoff='2026-08-20'
WHERE event_id=(SELECT id FROM live_data_events WHERE source_name='Curva S julio · futuros normalizados')
  AND key='monthlyPlan';

INSERT INTO live_data_points (
  key,value_json,value_type,area,source_file_id,source_name,source_currency,
  cutoff,revision,updated_by_email,updated_by_name,updated_at
)
SELECT h.key,h.value_json,h.value_type,h.area,h.source_file_id,h.source_name,
  h.source_currency,h.cutoff,h.event_id,h.actor_email,h.actor_name,h.created_at
FROM live_data_history h JOIN live_data_events e ON e.id=h.event_id
WHERE e.source_name='Curva S julio · futuros normalizados'
ON CONFLICT(key) DO UPDATE SET
  value_json=excluded.value_json,value_type=excluded.value_type,area=excluded.area,
  source_file_id=excluded.source_file_id,source_name=excluded.source_name,
  source_currency=excluded.source_currency,cutoff=excluded.cutoff,
  revision=excluded.revision,updated_by_email=excluded.updated_by_email,
  updated_by_name=excluded.updated_by_name,updated_at=excluded.updated_at;

-- La única conciliación crítica se convierte en una acción gestionable. Las
-- otras 22 permanecen como observaciones documentales, ya no como falsas
-- "acciones abiertas".
INSERT OR IGNORE INTO control_actions (
  id,title,description,area,related_view,severity,status,assignee_email,
  assignee_name,due_date,source_file_id,request_key,created_by_email,
  created_by_name,completed_at,created_at,updated_at
)
VALUES (
  'cleanup-provider-flow-formula-2026-08-21',
  'Conciliar fórmula del flujo de proveedores',
  'La fórmula fuente omite RD$4.095.000 de la partida de revestimiento de duchas, aunque el total mensual auditado es RD$202.373.400,47. Corregir la fórmula en el archivo de autoridad y volver a cargarlo.',
  'finanzas','metrics','critical','open','','','2026-08-28','',
  'cleanup-2026-08-21-provider-formula','sistema@grupobricket.com',
  'Saneamiento automático','','2026-08-21T17:05:00.000Z','2026-08-21T17:05:00.000Z'
);

INSERT OR IGNORE INTO control_action_activity (
  action_id,event_type,message,request_key,actor_email,actor_name,created_at
)
VALUES (
  'cleanup-provider-flow-formula-2026-08-21','created',
  'Acción creada desde la conciliación crítica detectada en la auditoría integral.',
  'cleanup-2026-08-21-provider-formula-activity','sistema@grupobricket.com',
  'Saneamiento automático','2026-08-21T17:05:00.000Z'
);

COMMIT;
