CREATE TABLE `ai_usage_settings` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`monthly_budget_usd_micros` integer DEFAULT 0 NOT NULL,
	`updated_by_email` text DEFAULT '' NOT NULL,
	`updated_by_name` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assistant_ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`user_name` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`turns` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd_micros` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_ai_runs_started_idx` ON `assistant_ai_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `assistant_ai_runs_model_idx` ON `assistant_ai_runs` (`model`);--> statement-breakpoint
CREATE INDEX `assistant_ai_runs_user_idx` ON `assistant_ai_runs` (`user_email`);--> statement-breakpoint
ALTER TABLE `ingestion_agent_runs` ADD `cached_input_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_agent_runs` ADD `cache_write_input_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_agent_runs` ADD `estimated_cost_usd_micros` integer DEFAULT 0 NOT NULL;