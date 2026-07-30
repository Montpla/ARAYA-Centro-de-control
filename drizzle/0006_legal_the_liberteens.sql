ALTER TABLE `app_users` ADD `avatar_storage_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `avatar_mime_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `avatar_updated_at` text DEFAULT '' NOT NULL;