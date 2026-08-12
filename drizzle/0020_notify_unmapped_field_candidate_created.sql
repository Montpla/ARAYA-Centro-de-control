-- Custom SQL migration file, put your code below! --
CREATE TRIGGER `notify_unmapped_field_candidate_created`
AFTER INSERT ON `unmapped_field_candidates`
BEGIN
  INSERT INTO `notification_events` (
    `kind`, `project_id`, `area`, `audience`, `actor_email`, `actor_name`,
    `subject_type`, `subject_id`, `title`, `body`, `view`, `payload_json`, `created_at`
  )
  SELECT
    'unmapped_field_candidates', COALESCE(NULLIF(file.`project_id`, ''), 'araya'), file.`area`, 'admin',
    LOWER(file.`uploader_email`), file.`uploader_name`, 'uploaded_file', NEW.`file_id`,
    SUBSTR('Posible sección nueva · ' || NEW.`label`, 1, 240),
    SUBSTR(
      COALESCE(NULLIF(NEW.`description`, ''), 'Un dato no encaja en ningún campo existente.')
        || ' Revísalo en el expediente del archivo.',
      1, 800
    ),
    'fuentes',
    json_object('fileId', NEW.`file_id`, 'candidateId', NEW.`id`, 'label', NEW.`label`),
    NEW.`created_at`
  FROM `uploaded_files` AS file
  WHERE file.`id` = NEW.`file_id` AND file.`deleted_at` = '';
END;--> statement-breakpoint
