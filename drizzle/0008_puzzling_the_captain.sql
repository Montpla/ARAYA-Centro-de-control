ALTER TABLE `app_users` ADD `deleted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `deleted_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `app_users_deleted_at_idx` ON `app_users` (`deleted_at`);