CREATE TABLE `automation_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`assignee_email` text DEFAULT '' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_retry_at` text DEFAULT '' NOT NULL,
	`first_detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL,
	`resolved_by_email` text DEFAULT '' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_incidents_fingerprint_idx` ON `automation_incidents` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `automation_incidents_status_severity_idx` ON `automation_incidents` (`status`,`severity`);--> statement-breakpoint
CREATE INDEX `automation_incidents_source_file_idx` ON `automation_incidents` (`source_file_id`);--> statement-breakpoint
CREATE INDEX `automation_incidents_retry_idx` ON `automation_incidents` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`idempotency_key` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`actor_email` text DEFAULT 'system' NOT NULL,
	`actor_name` text DEFAULT 'Automatización Bricket' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_runs_idempotency_idx` ON `automation_runs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `automation_runs_kind_started_idx` ON `automation_runs` (`kind`,`started_at`);--> statement-breakpoint
CREATE INDEX `automation_runs_status_idx` ON `automation_runs` (`status`);--> statement-breakpoint
CREATE TABLE `reporting_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`cadence` text NOT NULL,
	`label` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_by_email` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`closed_at` text DEFAULT '' NOT NULL,
	`closed_by_email` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reporting_periods_status_end_idx` ON `reporting_periods` (`status`,`end_date`);--> statement-breakpoint
CREATE TABLE `reporting_requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_id` text NOT NULL,
	`area` text NOT NULL,
	`document_type` text NOT NULL,
	`label` text NOT NULL,
	`owner_email` text DEFAULT '' NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`fulfilled_at` text DEFAULT '' NOT NULL,
	`last_reminder_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reporting_requirements_period_area_type_idx` ON `reporting_requirements` (`period_id`,`area`,`document_type`);--> statement-breakpoint
CREATE INDEX `reporting_requirements_period_status_idx` ON `reporting_requirements` (`period_id`,`status`);--> statement-breakpoint
CREATE INDEX `reporting_requirements_owner_idx` ON `reporting_requirements` (`owner_email`);--> statement-breakpoint
CREATE TABLE `user_automation_preferences` (
	`user_email` text PRIMARY KEY NOT NULL,
	`notification_areas_json` text DEFAULT '[]' NOT NULL,
	`critical_only` integer DEFAULT false NOT NULL,
	`digest_frequency` text DEFAULT 'immediate' NOT NULL,
	`quiet_start` text DEFAULT '' NOT NULL,
	`quiet_end` text DEFAULT '' NOT NULL,
	`onboarding_step` integer DEFAULT 0 NOT NULL,
	`onboarding_completed_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_automation_preferences_digest_idx` ON `user_automation_preferences` (`digest_frequency`);