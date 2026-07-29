CREATE TABLE `live_data_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`key` text NOT NULL,
	`value_json` text NOT NULL,
	`value_type` text NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`source_currency` text DEFAULT 'DOP' NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_data_history_event_idx` ON `live_data_history` (`event_id`);--> statement-breakpoint
CREATE INDEX `live_data_history_key_idx` ON `live_data_history` (`key`);--> statement-breakpoint
CREATE INDEX `live_data_history_created_at_idx` ON `live_data_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `live_data_history_source_file_id_idx` ON `live_data_history` (`source_file_id`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `area` text DEFAULT 'direccion' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processing_stage` text DEFAULT 'recibido' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processing_progress` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processing_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `requires_review` integer DEFAULT true NOT NULL;