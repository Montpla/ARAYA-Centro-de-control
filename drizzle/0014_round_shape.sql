CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` integer NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text DEFAULT '' NOT NULL,
	`claimed_at` text DEFAULT '' NOT NULL,
	`delivered_at` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_event_subscription_idx` ON `notification_deliveries` (`notification_id`,`subscription_id`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_next_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_event_idx` ON `notification_deliveries` (`notification_id`);--> statement-breakpoint
DROP INDEX `document_data_proposals_file_key_idx`;--> statement-breakpoint
ALTER TABLE `document_data_proposals` ADD `generation` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `document_data_proposals_file_generation_key_idx` ON `document_data_proposals` (`file_id`,`generation`,`key`);--> statement-breakpoint
ALTER TABLE `notification_events` ADD `fanout_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_events` ADD `fanout_claimed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_events` ADD `fanout_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_events` ADD `fanout_error` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `notification_events`
SET `fanout_status` = 'ready', `fanout_at` = `created_at`
WHERE `fanout_status` = 'pending';--> statement-breakpoint
CREATE INDEX `notification_events_fanout_idx` ON `notification_events` (`fanout_status`,`fanout_claimed_at`);--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `proposal_generation` text DEFAULT '' NOT NULL;
