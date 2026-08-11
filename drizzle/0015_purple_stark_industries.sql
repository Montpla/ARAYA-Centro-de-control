ALTER TABLE `app_users` ADD `notification_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `notification_nonce` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `notification_actor_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `notification_actor_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `control_actions` ADD `notification_nonce` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `control_actions` ADD `notification_actor_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `control_actions` ADD `notification_actor_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_metrics` ADD `created_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_metrics` ADD `created_by_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `created_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `created_by_name` text DEFAULT '' NOT NULL;--> statement-breakpoint

CREATE TRIGGER `notify_uploaded_file_received`
AFTER INSERT ON `uploaded_files`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'file_received', COALESCE(NULLIF(NEW.`project_id`, ''), 'araya'), 'direccion', 'admin',
    LOWER(NEW.`uploader_email`), NEW.`uploader_name`, 'uploaded_file', NEW.`id`,
    'Nuevo archivo recibido',
    'El original está archivado y su clasificación confidencial continúa en curso.',
    'fuentes', json_object('fileId', NEW.`id`, 'processingStage', NEW.`processing_stage`),
    NEW.`created_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_uploaded_file_processing_resumed`
AFTER UPDATE OF `processing_stage`, `processing_summary`, `updated_at` ON `uploaded_files`
WHEN NEW.`deleted_at` = ''
  AND NEW.`processing_stage` = 'extraccion_en_curso'
  AND NEW.`updated_at` <> OLD.`updated_at`
  AND NEW.`processing_summary` LIKE 'Reprocesamiento idempotente%'
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'file_processing_resumed', COALESCE(NULLIF(NEW.`project_id`, ''), 'araya'),
    'direccion', 'admin', LOWER(NEW.`uploader_email`), NEW.`uploader_name`,
    'uploaded_file', NEW.`id`, 'Extracción documental reanudada',
    'El expediente durable ha retomado su clasificación confidencial.', 'fuentes',
    json_object('fileId', NEW.`id`, 'processingStage', NEW.`processing_stage`), NEW.`updated_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_uploaded_file_classified`
AFTER UPDATE OF `document_type` ON `uploaded_files`
WHEN OLD.`document_type` = 'clasificacion_pendiente'
  AND NEW.`document_type` <> 'clasificacion_pendiente'
  AND NEW.`deleted_at` = ''
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'file_uploaded', COALESCE(NULLIF(NEW.`project_id`, ''), 'araya'), NEW.`area`,
    CASE
      WHEN LOWER(NEW.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
        OR LOWER(NEW.`document_type`) IN ('estado_financiero', 'ventas_cobranza')
      THEN 'finance' ELSE 'all'
    END,
    LOWER(NEW.`uploader_email`), NEW.`uploader_name`, 'uploaded_file', NEW.`id`,
    SUBSTR('Nuevo archivo: ' || NEW.`original_name`, 1, 240),
    CASE
      WHEN (SELECT COUNT(*) FROM `document_data_proposals`
            WHERE `file_id` = NEW.`id` AND `generation` = NEW.`proposal_generation`) > 0
      THEN (SELECT COUNT(*) FROM `document_data_proposals`
            WHERE `file_id` = NEW.`id` AND `generation` = NEW.`proposal_generation`)
           || ' datos se han preparado en ' || NEW.`area` || '.'
      ELSE 'El original ya está archivado en ' || NEW.`area` || '.'
    END,
    'fuentes',
    json_object(
      'fileId', NEW.`id`,
      'area', NEW.`area`,
      'extension', NEW.`extension`,
      'updateCount', (SELECT COUNT(*) FROM `document_data_proposals`
                      WHERE `file_id` = NEW.`id` AND `generation` = NEW.`proposal_generation`)
    ),
    NEW.`updated_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_uploaded_file_observed`
AFTER UPDATE OF `processing_stage`, `status` ON `uploaded_files`
WHEN NEW.`deleted_at` = ''
  AND NEW.`processing_stage` = 'observado'
  AND OLD.`processing_stage` <> 'observado'
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'file_processing_observed', COALESCE(NULLIF(NEW.`project_id`, ''), 'araya'),
    'direccion', 'admin', LOWER(NEW.`uploader_email`), NEW.`uploader_name`,
    'uploaded_file', NEW.`id`, 'Archivo pendiente de revisión',
    'El original está archivado, pero su extracción o clasificación requiere intervención.',
    'fuentes', json_object('fileId', NEW.`id`, 'processingStage', NEW.`processing_stage`),
    NEW.`updated_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_file_review_decision_updated`
AFTER UPDATE OF `action` ON `file_reviews`
WHEN OLD.`action` LIKE 'procesando_%'
  AND NEW.`action` IN ('preparado', 'aprobado', 'observado', 'rechazado', 'reabierto')
  AND NEW.`publication_revision` IS NULL
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  )
  SELECT
    CASE NEW.`action`
      WHEN 'preparado' THEN 'file_review_prepared'
      ELSE 'file_' || NEW.`action`
    END,
    COALESCE(NULLIF(file.`project_id`, ''), 'araya'), file.`area`,
    CASE
      WHEN LOWER(file.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
        OR LOWER(file.`document_type`) IN ('clasificacion_pendiente', 'estado_financiero', 'ventas_cobranza')
      THEN 'finance' ELSE 'area'
    END,
    LOWER(NEW.`actor_email`), NEW.`actor_name`, 'file', NEW.`file_id`,
    SUBSTR(
      CASE NEW.`action`
        WHEN 'preparado' THEN 'Revisión preparada · '
        WHEN 'aprobado' THEN 'Documento validado · '
        ELSE 'Documento ' || NEW.`action` || ' · '
      END || file.`original_name`, 1, 240
    ),
    SUBSTR(
      COALESCE(NULLIF(NEW.`note`, ''),
        CASE NEW.`action`
          WHEN 'preparado' THEN NEW.`proposal_count` || ' cambios esperan decisión final.'
          WHEN 'aprobado' THEN 'Catalogado sin modificar indicadores vivos.'
          WHEN 'reabierto' THEN 'La revisión vuelve a estar abierta.'
          ELSE 'La decisión se ha registrado en el historial.'
        END
      ), 1, 800
    ),
    'fuentes',
    json_object('fileId', NEW.`file_id`, 'reviewAction', NEW.`action`, 'proposalCount', NEW.`proposal_count`),
    file.`updated_at`
  FROM `uploaded_files` AS file
  WHERE file.`id` = NEW.`file_id` AND file.`deleted_at` = '';
END;--> statement-breakpoint

CREATE TRIGGER `notify_file_review_decision_inserted`
AFTER INSERT ON `file_reviews`
WHEN NEW.`action` IN ('preparado', 'aprobado', 'observado', 'rechazado', 'reabierto')
  AND NEW.`publication_revision` IS NULL
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  )
  SELECT
    CASE NEW.`action`
      WHEN 'preparado' THEN 'file_review_prepared'
      ELSE 'file_' || NEW.`action`
    END,
    COALESCE(NULLIF(file.`project_id`, ''), 'araya'), file.`area`,
    CASE
      WHEN LOWER(file.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
        OR LOWER(file.`document_type`) IN ('clasificacion_pendiente', 'estado_financiero', 'ventas_cobranza')
      THEN 'finance' ELSE 'area'
    END,
    LOWER(NEW.`actor_email`), NEW.`actor_name`, 'file', NEW.`file_id`,
    SUBSTR('Documento ' || NEW.`action` || ' · ' || file.`original_name`, 1, 240),
    SUBSTR(COALESCE(NULLIF(NEW.`note`, ''), 'La decisión se ha registrado en el historial.'), 1, 800),
    'fuentes',
    json_object('fileId', NEW.`file_id`, 'reviewAction', NEW.`action`, 'proposalCount', NEW.`proposal_count`),
    file.`updated_at`
  FROM `uploaded_files` AS file
  WHERE file.`id` = NEW.`file_id` AND file.`deleted_at` = '';
END;--> statement-breakpoint

CREATE TRIGGER `notify_app_user_created`
AFTER INSERT ON `app_users`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'user_created', 'araya', NEW.`area`, 'admin', LOWER(NEW.`created_by_email`),
    COALESCE((SELECT NULLIF(`display_name`, '') FROM `app_users`
              WHERE LOWER(`email`) = LOWER(NEW.`created_by_email`) LIMIT 1), NEW.`created_by_email`),
    'user', CAST(NEW.`id` AS TEXT),
    SUBSTR('Nuevo usuario · ' || COALESCE(NULLIF(NEW.`display_name`, ''), NEW.`email`), 1, 240),
    'Acceso autorizado al Centro de Control.', 'usuarios', json_object('userId', NEW.`id`),
    NEW.`created_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_app_user_mutated`
AFTER UPDATE OF `notification_nonce` ON `app_users`
WHEN NEW.`notification_nonce` <> ''
  AND NEW.`notification_nonce` <> OLD.`notification_nonce`
  AND NEW.`notification_kind` IN ('user_updated', 'user_restored', 'user_removed', 'user_avatar_updated')
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    NEW.`notification_kind`, 'araya', NEW.`area`, 'admin',
    LOWER(NEW.`notification_actor_email`), NEW.`notification_actor_name`,
    'user', CAST(NEW.`id` AS TEXT),
    SUBSTR(
      CASE NEW.`notification_kind`
        WHEN 'user_restored' THEN 'Usuario restaurado · '
        WHEN 'user_removed' THEN 'Acceso eliminado · '
        WHEN 'user_avatar_updated' THEN 'Fotografía actualizada · '
        ELSE 'Usuario actualizado · '
      END || COALESCE(NULLIF(NEW.`display_name`, ''), NEW.`email`), 1, 240
    ),
    CASE NEW.`notification_kind`
      WHEN 'user_restored' THEN 'El acceso vuelve a estar activo.'
      WHEN 'user_removed' THEN 'El historial de actividad se conserva.'
      WHEN 'user_avatar_updated' THEN 'La imagen del perfil ha cambiado.'
      ELSE 'Sus permisos o datos de acceso han cambiado.'
    END,
    'usuarios', json_object('userId', NEW.`id`), NEW.`updated_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_user_presence_connected`
AFTER INSERT ON `user_presence`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'user_connected', 'araya', 'direccion', 'all', LOWER(NEW.`user_email`), NEW.`user_name`,
    'user', COALESCE((SELECT CAST(`id` AS TEXT) FROM `app_users`
                      WHERE LOWER(`email`) = LOWER(NEW.`user_email`) LIMIT 1), NEW.`user_email`),
    SUBSTR(COALESCE(NULLIF(NEW.`user_name`, ''), NEW.`user_email`) || ' se ha conectado', 1, 240),
    CASE WHEN NEW.`platform` <> ''
      THEN SUBSTR('Ha abierto Bricket Control desde ' || NEW.`platform` || '.', 1, 800)
      ELSE 'Ha abierto Bricket Control desde un dispositivo autorizado.'
    END,
    'usuarios', json_object('platform', NEW.`platform`), NEW.`connected_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_user_presence_reconnected`
AFTER UPDATE OF `connected_at` ON `user_presence`
WHEN NEW.`connected_at` <> OLD.`connected_at`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'user_connected', 'araya', 'direccion', 'all', LOWER(NEW.`user_email`), NEW.`user_name`,
    'user', COALESCE((SELECT CAST(`id` AS TEXT) FROM `app_users`
                      WHERE LOWER(`email`) = LOWER(NEW.`user_email`) LIMIT 1), NEW.`user_email`),
    SUBSTR(COALESCE(NULLIF(NEW.`user_name`, ''), NEW.`user_email`) || ' se ha conectado', 1, 240),
    CASE WHEN NEW.`platform` <> ''
      THEN SUBSTR('Ha abierto Bricket Control desde ' || NEW.`platform` || '.', 1, 800)
      ELSE 'Ha abierto Bricket Control desde un dispositivo autorizado.'
    END,
    'usuarios', json_object('platform', NEW.`platform`), NEW.`connected_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_control_action_created`
AFTER INSERT ON `control_actions`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'action_created', 'araya', NEW.`area`,
    CASE WHEN LOWER(NEW.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
      THEN 'finance' ELSE 'area' END,
    LOWER(NEW.`created_by_email`), NEW.`created_by_name`, 'control_action', NEW.`id`,
    SUBSTR('Nueva acción · ' || NEW.`title`, 1, 240),
    CASE WHEN NEW.`assignee_name` <> ''
      THEN SUBSTR('Asignada a ' || NEW.`assignee_name` || '.', 1, 800)
      ELSE 'Acción pendiente de seguimiento.' END,
    NEW.`related_view`, json_object('actionId', NEW.`id`, 'status', NEW.`status`), NEW.`created_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_control_action_updated`
AFTER UPDATE OF `notification_nonce` ON `control_actions`
WHEN NEW.`notification_nonce` <> '' AND NEW.`notification_nonce` <> OLD.`notification_nonce`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'action_status_changed', 'araya', NEW.`area`,
    CASE WHEN LOWER(NEW.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
      THEN 'finance' ELSE 'area' END,
    LOWER(NEW.`notification_actor_email`), NEW.`notification_actor_name`,
    'control_action', NEW.`id`, SUBSTR('Estado actualizado · ' || NEW.`title`, 1, 240),
    SUBSTR('Nuevo estado: ' || NEW.`status` || '.', 1, 800), NEW.`related_view`,
    json_object('actionId', NEW.`id`, 'status', NEW.`status`), NEW.`updated_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_control_action_commented`
AFTER INSERT ON `control_action_activity`
WHEN NEW.`event_type` = 'comment'
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  )
  SELECT
    'action_commented', 'araya', action.`area`,
    CASE WHEN LOWER(action.`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
      THEN 'finance' ELSE 'area' END,
    LOWER(NEW.`actor_email`), NEW.`actor_name`, 'control_action', NEW.`action_id`,
    SUBSTR('Nuevo comentario · ' || action.`title`, 1, 240), SUBSTR(NEW.`message`, 1, 800),
    action.`related_view`, json_object('actionId', NEW.`action_id`), NEW.`created_at`
  FROM `control_actions` AS action
  WHERE action.`id` = NEW.`action_id`;
END;--> statement-breakpoint

CREATE TRIGGER `notify_report_snapshot_created`
AFTER INSERT ON `report_snapshots`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'report_created', 'araya', CASE WHEN NEW.`includes_finance` = 1 THEN 'finanzas' ELSE 'direccion' END,
    CASE WHEN NEW.`includes_finance` = 1 THEN 'finance' ELSE 'all' END,
    LOWER(NEW.`created_by_email`), NEW.`created_by_name`, 'report', NEW.`id`,
    SUBSTR('Informe generado · ' || NEW.`label`, 1, 240),
    SUBSTR(NEW.`start_date` || ' · ' || NEW.`end_date`, 1, 800), 'resumen',
    json_object('reportId', NEW.`id`, 'frequency', NEW.`frequency`), NEW.`created_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_custom_metric_created`
AFTER INSERT ON `custom_metrics`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'metric_created', 'araya', 'finanzas', 'finance', LOWER(NEW.`created_by_email`),
    NEW.`created_by_name`, 'metric', CAST(NEW.`id` AS TEXT),
    SUBSTR('Indicador añadido · ' || NEW.`name`, 1, 240),
    'El panel financiero incorpora un nuevo indicador.', 'metricas',
    json_object('metricId', NEW.`id`), NEW.`created_at`
  );
END;--> statement-breakpoint

CREATE TRIGGER `notify_supplier_created`
AFTER INSERT ON `suppliers`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  ) VALUES (
    'supplier_created', 'araya', 'obra', 'all', LOWER(NEW.`created_by_email`),
    NEW.`created_by_name`, 'supplier', CAST(NEW.`id` AS TEXT),
    SUBSTR('Proveedor añadido · ' || NEW.`name`, 1, 240),
    SUBSTR(NEW.`category` || ' · ' || NEW.`status`, 1, 800), 'proveedores',
    json_object('supplierId', NEW.`id`), NEW.`created_at`
  );
END;
