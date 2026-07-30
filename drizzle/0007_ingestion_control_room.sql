ALTER TABLE `uploaded_files` ADD `project_id` text DEFAULT 'araya' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `document_type` text DEFAULT 'documento_general' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `detected_period` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `extraction_mode` text DEFAULT 'asistida' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `extraction_confidence` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `extraction_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `discrepancy_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `review_status` text DEFAULT 'pendiente_extraccion' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `reviewed_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `reviewed_by_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `reviewed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `publication_revision` integer;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `published_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE `document_data_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`value_json` text NOT NULL,
	`previous_value_json` text,
	`value_type` text NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`source_currency` text DEFAULT 'DOP' NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`discrepancy` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`created_by_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_data_proposals_file_key_idx` ON `document_data_proposals` (`file_id`,`key`);--> statement-breakpoint
CREATE INDEX `document_data_proposals_file_id_idx` ON `document_data_proposals` (`file_id`);--> statement-breakpoint
CREATE INDEX `document_data_proposals_status_idx` ON `document_data_proposals` (`status`);--> statement-breakpoint
CREATE TABLE `file_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`proposal_count` integer DEFAULT 0 NOT NULL,
	`publication_revision` integer,
	`request_key` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_reviews_request_key_idx` ON `file_reviews` (`request_key`);--> statement-breakpoint
CREATE INDEX `file_reviews_file_id_idx` ON `file_reviews` (`file_id`);--> statement-breakpoint
CREATE INDEX `file_reviews_created_at_idx` ON `file_reviews` (`created_at`);
