CREATE TABLE `user_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_idx` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `pin_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `failed_pin_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `pin_locked_until` text DEFAULT '' NOT NULL;