CREATE TABLE `_migration_0012_file_dedupe` (
	`file_id` text PRIMARY KEY NOT NULL,
	`survivor_id` text NOT NULL,
	`duplicate_rank` integer NOT NULL
);--> statement-breakpoint
WITH `ranked_active_sha` AS (
	SELECT
		`id`,
		`sha256`,
		FIRST_VALUE(`id`) OVER (
			PARTITION BY `sha256`
			ORDER BY
				CASE
					WHEN lower(`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
						OR lower(`document_type`) IN ('estado_financiero', 'ventas_cobranza', 'clasificacion_pendiente')
					THEN 1 ELSE 0
				END DESC,
				CASE
					WHEN `publication_revision` IS NOT NULL OR `published_at` <> '' OR lower(`review_status`) IN ('aprobado', 'aprobado_automatico', 'publicado')
					THEN 1 ELSE 0
				END DESC,
				COALESCE(`publication_revision`, 0) DESC,
				`classification_confidence` DESC,
				`created_at` DESC,
				`id` DESC
		) AS `survivor_id`,
		ROW_NUMBER() OVER (
			PARTITION BY `sha256`
			ORDER BY
				CASE
					WHEN lower(`area`) IN ('finanzas', 'comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
						OR lower(`document_type`) IN ('estado_financiero', 'ventas_cobranza', 'clasificacion_pendiente')
					THEN 1 ELSE 0
				END DESC,
				CASE
					WHEN `publication_revision` IS NOT NULL OR `published_at` <> '' OR lower(`review_status`) IN ('aprobado', 'aprobado_automatico', 'publicado')
					THEN 1 ELSE 0
				END DESC,
				COALESCE(`publication_revision`, 0) DESC,
				`classification_confidence` DESC,
				`created_at` DESC,
				`id` DESC
		) AS `duplicate_rank`,
		COUNT(*) OVER (PARTITION BY `sha256`) AS `group_size`
	FROM `uploaded_files`
	WHERE `deleted_at` = ''
)
INSERT INTO `_migration_0012_file_dedupe` (`file_id`, `survivor_id`, `duplicate_rank`)
SELECT `id`, `survivor_id`, `duplicate_rank`
FROM `ranked_active_sha`
WHERE `group_size` > 1;--> statement-breakpoint
UPDATE `uploaded_files` AS `survivor`
SET
	`area` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND lower(`candidate`.`area`) IN ('comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
		) THEN 'comercial'
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (
					lower(`candidate`.`area`) = 'finanzas'
					OR lower(`candidate`.`document_type`) IN ('estado_financiero', 'clasificacion_pendiente')
				)
		) THEN 'finanzas'
		ELSE `survivor`.`area`
	END,
	`document_type` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (
					lower(`candidate`.`area`) IN ('comercial', 'ventas', 'ventas_cobranza', 'ventas-cobranza', 'cobranza')
					OR lower(`candidate`.`document_type`) = 'ventas_cobranza'
				)
		) THEN 'ventas_cobranza'
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (
					lower(`candidate`.`area`) = 'finanzas'
					OR lower(`candidate`.`document_type`) = 'estado_financiero'
				)
		) THEN 'estado_financiero'
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND lower(`candidate`.`document_type`) = 'clasificacion_pendiente'
		) THEN 'clasificacion_pendiente'
		ELSE `survivor`.`document_type`
	END,
	`publication_revision` = COALESCE((
		SELECT MAX(`candidate`.`publication_revision`)
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
	), `survivor`.`publication_revision`),
	`classification_confidence` = MAX(`survivor`.`classification_confidence`, COALESCE((
		SELECT MAX(`candidate`.`classification_confidence`)
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
	), 0)),
	`published_at` = COALESCE(NULLIF((
		SELECT MAX(`candidate`.`published_at`)
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
	), ''), `survivor`.`published_at`),
	`review_status` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN 'aprobado'
		ELSE `survivor`.`review_status`
	END,
	`status` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN 'integrado'
		ELSE `survivor`.`status`
	END,
	`processing_stage` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN 'sincronizado'
		ELSE `survivor`.`processing_stage`
	END,
	`processing_progress` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN 100
		ELSE `survivor`.`processing_progress`
	END,
	`reviewed_by_email` = COALESCE(NULLIF((
		SELECT `candidate`.`reviewed_by_email`
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
			AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		ORDER BY COALESCE(`candidate`.`publication_revision`, 0) DESC, `candidate`.`published_at` DESC, `candidate`.`updated_at` DESC
		LIMIT 1
	), ''), `survivor`.`reviewed_by_email`),
	`reviewed_by_name` = COALESCE(NULLIF((
		SELECT `candidate`.`reviewed_by_name`
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
			AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		ORDER BY COALESCE(`candidate`.`publication_revision`, 0) DESC, `candidate`.`published_at` DESC, `candidate`.`updated_at` DESC
		LIMIT 1
	), ''), `survivor`.`reviewed_by_name`),
	`reviewed_at` = COALESCE(NULLIF((
		SELECT `candidate`.`reviewed_at`
		FROM `_migration_0012_file_dedupe` AS `mapping`
		JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
		WHERE `mapping`.`survivor_id` = `survivor`.`id`
			AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		ORDER BY COALESCE(`candidate`.`publication_revision`, 0) DESC, `candidate`.`published_at` DESC, `candidate`.`updated_at` DESC
		LIMIT 1
	), ''), `survivor`.`reviewed_at`),
	`processing_summary` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN 'Expediente publicado y consolidado durante la migracion de integridad.'
		ELSE `survivor`.`processing_summary`
	END,
	`requires_review` = CASE
		WHEN EXISTS (
			SELECT 1 FROM `_migration_0012_file_dedupe` AS `mapping`
			JOIN `uploaded_files` AS `candidate` ON `candidate`.`id` = `mapping`.`file_id`
			WHERE `mapping`.`survivor_id` = `survivor`.`id`
				AND (`candidate`.`publication_revision` IS NOT NULL OR `candidate`.`published_at` <> '')
		) THEN false
		ELSE `survivor`.`requires_review`
	END,
	`updated_at` = CURRENT_TIMESTAMP
WHERE `survivor`.`id` IN (
	SELECT DISTINCT `survivor_id` FROM `_migration_0012_file_dedupe`
);--> statement-breakpoint
CREATE TABLE `_migration_0012_proposal_dedupe` AS
SELECT
	`proposal`.`id` AS `proposal_id`,
	ROW_NUMBER() OVER (
		PARTITION BY `mapping`.`survivor_id`, `proposal`.`key`
		ORDER BY
			CASE lower(`proposal`.`status`)
				WHEN 'publicado' THEN 4
				WHEN 'aprobado' THEN 3
				WHEN 'aceptado' THEN 3
				WHEN 'pendiente' THEN 2
				ELSE 1
			END DESC,
			CASE WHEN `proposal`.`file_id` = `mapping`.`survivor_id` THEN 1 ELSE 0 END DESC,
			`proposal`.`updated_at` DESC,
			`proposal`.`created_at` DESC,
			`proposal`.`id` DESC
	) AS `proposal_rank`
FROM `document_data_proposals` AS `proposal`
JOIN `_migration_0012_file_dedupe` AS `mapping` ON `mapping`.`file_id` = `proposal`.`file_id`;--> statement-breakpoint
DELETE FROM `document_data_proposals`
WHERE `id` IN (
	SELECT `proposal_id` FROM `_migration_0012_proposal_dedupe` WHERE `proposal_rank` > 1
);--> statement-breakpoint
UPDATE `document_data_proposals`
SET `file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `document_data_proposals`.`file_id`
)
WHERE `file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
UPDATE `file_reviews`
SET `file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `file_reviews`.`file_id`
)
WHERE `file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
UPDATE `file_activity`
SET `file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `file_activity`.`file_id`
)
WHERE `file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
UPDATE `live_data_events`
SET `source_file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `live_data_events`.`source_file_id`
)
WHERE `source_file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
UPDATE `live_data_history`
SET `source_file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `live_data_history`.`source_file_id`
)
WHERE `source_file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
UPDATE `live_data_points`
SET `source_file_id` = (
	SELECT `survivor_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `_migration_0012_file_dedupe`.`file_id` = `live_data_points`.`source_file_id`
)
WHERE `source_file_id` IN (SELECT `file_id` FROM `_migration_0012_file_dedupe`);--> statement-breakpoint
INSERT INTO `file_activity` (`file_id`, `event_type`, `message`, `actor_email`, `actor_name`, `created_at`)
SELECT
	`survivor_id`,
	'duplicado_consolidado',
	'Expediente duplicado consolidado sin borrar el original ni el historial: ' || `file_id`,
	'migration@bricket.local',
	'Migracion de integridad',
	CURRENT_TIMESTAMP
FROM `_migration_0012_file_dedupe`
WHERE `file_id` <> `survivor_id`;--> statement-breakpoint
UPDATE `uploaded_files`
SET
	`deleted_at` = CURRENT_TIMESTAMP,
	`deleted_by_email` = 'migration@bricket.local',
	`deleted_by_name` = 'Migracion de integridad',
	`delete_reason` = 'Duplicado exacto consolidado en ' || (
		SELECT `survivor_id`
		FROM `_migration_0012_file_dedupe`
		WHERE `_migration_0012_file_dedupe`.`file_id` = `uploaded_files`.`id`
	),
	`updated_at` = CURRENT_TIMESTAMP
WHERE `id` IN (
	SELECT `file_id`
	FROM `_migration_0012_file_dedupe`
	WHERE `file_id` <> `survivor_id`
);--> statement-breakpoint
DROP TABLE `_migration_0012_proposal_dedupe`;--> statement-breakpoint
DROP TABLE `_migration_0012_file_dedupe`;--> statement-breakpoint
WITH `ranked_versions` AS (
	SELECT
		`id`,
		ROW_NUMBER() OVER (
			PARTITION BY `area`, `safe_name`
			ORDER BY `version` ASC, `created_at` ASC, `id` ASC
		) AS `normalized_version`
	FROM `uploaded_files`
)
UPDATE `uploaded_files`
SET `version` = (
	SELECT `normalized_version`
	FROM `ranked_versions`
	WHERE `ranked_versions`.`id` = `uploaded_files`.`id`
);--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_files_active_sha256_idx` ON `uploaded_files` (`sha256`) WHERE "uploaded_files"."deleted_at" = '';--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_files_area_name_version_idx` ON `uploaded_files` (`area`,`safe_name`,`version`);
