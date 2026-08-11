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
CREATE INDEX `file_reviews_created_at_idx` ON `file_reviews` (`created_at`);--> statement-breakpoint
CREATE TABLE `control_action_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action_id` text NOT NULL,
	`event_type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`request_key` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_action_activity_request_key_idx` ON `control_action_activity` (`request_key`);--> statement-breakpoint
CREATE INDEX `control_action_activity_action_id_idx` ON `control_action_activity` (`action_id`);--> statement-breakpoint
CREATE INDEX `control_action_activity_created_at_idx` ON `control_action_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `control_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`related_view` text DEFAULT 'resumen' NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_email` text DEFAULT '' NOT NULL,
	`assignee_name` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`request_key` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_actions_request_key_idx` ON `control_actions` (`request_key`);--> statement-breakpoint
CREATE INDEX `control_actions_area_idx` ON `control_actions` (`area`);--> statement-breakpoint
CREATE INDEX `control_actions_status_idx` ON `control_actions` (`status`);--> statement-breakpoint
CREATE INDEX `control_actions_assignee_email_idx` ON `control_actions` (`assignee_email`);--> statement-breakpoint
CREATE INDEX `control_actions_due_date_idx` ON `control_actions` (`due_date`);--> statement-breakpoint
CREATE TABLE `report_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`label` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`live_revision` integer DEFAULT 0 NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`snapshot_json` text NOT NULL,
	`includes_finance` integer DEFAULT false NOT NULL,
	`request_key` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_snapshots_request_key_idx` ON `report_snapshots` (`request_key`);--> statement-breakpoint
CREATE INDEX `report_snapshots_created_at_idx` ON `report_snapshots` (`created_at`);--> statement-breakpoint
CREATE INDEX `report_snapshots_frequency_idx` ON `report_snapshots` (`frequency`);
