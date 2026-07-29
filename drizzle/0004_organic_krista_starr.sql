CREATE TABLE `access_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_email` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_audit_target_email_idx` ON `access_audit` (`target_email`);--> statement-breakpoint
CREATE INDEX `access_audit_created_at_idx` ON `access_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`finance_access` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`last_login_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_idx` ON `app_users` (`email`);--> statement-breakpoint
CREATE INDEX `app_users_active_idx` ON `app_users` (`active`);--> statement-breakpoint
CREATE INDEX `app_users_role_idx` ON `app_users` (`role`);