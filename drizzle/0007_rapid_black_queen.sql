CREATE TABLE `control_action_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action_id` text NOT NULL,
	`event_type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`request_key` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_action_activity_request_key_idx` ON `control_action_activity` (`request_key`);--> statement-breakpoint
CREATE INDEX `control_action_activity_action_id_idx` ON `control_action_activity` (`action_id`);--> statement-breakpoint
CREATE INDEX `control_action_activity_created_at_idx` ON `control_action_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `control_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`related_view` text DEFAULT 'resumen' NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_email` text DEFAULT '' NOT NULL,
	`assignee_name` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`request_key` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_actions_request_key_idx` ON `control_actions` (`request_key`);--> statement-breakpoint
CREATE INDEX `control_actions_area_idx` ON `control_actions` (`area`);--> statement-breakpoint
CREATE INDEX `control_actions_status_idx` ON `control_actions` (`status`);--> statement-breakpoint
CREATE INDEX `control_actions_assignee_email_idx` ON `control_actions` (`assignee_email`);--> statement-breakpoint
CREATE INDEX `control_actions_due_date_idx` ON `control_actions` (`due_date`);--> statement-breakpoint
CREATE TABLE `report_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`label` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`live_revision` integer DEFAULT 0 NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`snapshot_json` text NOT NULL,
	`includes_finance` integer DEFAULT false NOT NULL,
	`request_key` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_snapshots_request_key_idx` ON `report_snapshots` (`request_key`);--> statement-breakpoint
CREATE INDEX `report_snapshots_created_at_idx` ON `report_snapshots` (`created_at`);--> statement-breakpoint
CREATE INDEX `report_snapshots_frequency_idx` ON `report_snapshots` (`frequency`);
