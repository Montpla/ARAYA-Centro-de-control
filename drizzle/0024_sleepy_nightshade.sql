ALTER TABLE `uploaded_files` ADD `ingestion_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `derived_from_file_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `automation_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `superseded_by_file_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `superseded_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `uploaded_files_ingestion_version_idx` ON `uploaded_files` (`ingestion_version`);--> statement-breakpoint
CREATE INDEX `uploaded_files_derived_from_idx` ON `uploaded_files` (`derived_from_file_id`);--> statement-breakpoint
CREATE INDEX `uploaded_files_superseded_by_idx` ON `uploaded_files` (`superseded_by_file_id`);
