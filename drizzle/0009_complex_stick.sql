CREATE TABLE `notification_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`project_id` text DEFAULT 'araya' NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`audience` text DEFAULT 'all' NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`actor_name` text DEFAULT '' NOT NULL,
	`subject_type` text DEFAULT '' NOT NULL,
	`subject_id` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`view` text DEFAULT 'resumen' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_events_created_at_idx` ON `notification_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `notification_events_audience_idx` ON `notification_events` (`audience`);--> statement-breakpoint
CREATE INDEX `notification_events_area_idx` ON `notification_events` (`area`);--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`opened_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_reads_event_user_idx` ON `notification_reads` (`notification_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `notification_reads_user_idx` ON `notification_reads` (`user_email`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`expiration_time` text DEFAULT '' NOT NULL,
	`platform` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_success_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_email`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_active_idx` ON `push_subscriptions` (`active`);--> statement-breakpoint
CREATE TABLE `user_presence` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text DEFAULT '' NOT NULL,
	`device_id` text DEFAULT '' NOT NULL,
	`platform` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`connected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_presence_email_idx` ON `user_presence` (`user_email`);--> statement-breakpoint
CREATE INDEX `user_presence_last_seen_idx` ON `user_presence` (`last_seen_at`);--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `deleted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `deleted_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `deleted_by_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `delete_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `restored_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `restored_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `uploaded_files_deleted_at_idx` ON `uploaded_files` (`deleted_at`);