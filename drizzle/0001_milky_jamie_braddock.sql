CREATE TABLE `file_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` text NOT NULL,
	`event_type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_activity_file_id_idx` ON `file_activity` (`file_id`);--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`safe_name` text NOT NULL,
	`area` text NOT NULL,
	`section` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`extension` text DEFAULT '' NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`source` text DEFAULT 'dashboard' NOT NULL,
	`status` text DEFAULT 'pendiente_revision' NOT NULL,
	`uploader_email` text NOT NULL,
	`uploader_name` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`declared_cutoff` text DEFAULT '' NOT NULL,
	`classification_confidence` real DEFAULT 0 NOT NULL,
	`classification_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploaded_files_created_at_idx` ON `uploaded_files` (`created_at`);--> statement-breakpoint
CREATE INDEX `uploaded_files_area_idx` ON `uploaded_files` (`area`);--> statement-breakpoint
CREATE INDEX `uploaded_files_sha256_idx` ON `uploaded_files` (`sha256`);