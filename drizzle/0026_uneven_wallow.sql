ALTER TABLE `app_users` ADD `finance_upload_access` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `finance_approve_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `app_users` SET `finance_approve_access` = `finance_access` WHERE `finance_access` = true;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processing_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `next_retry_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `last_processing_error` text DEFAULT '' NOT NULL;
