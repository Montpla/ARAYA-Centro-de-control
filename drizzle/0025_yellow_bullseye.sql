CREATE TABLE `document_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`name_pattern` text NOT NULL,
	`extension` text NOT NULL,
	`area` text NOT NULL,
	`document_type` text NOT NULL,
	`mapping_json` text DEFAULT '[]' NOT NULL,
	`visualization_json` text DEFAULT '[]' NOT NULL,
	`prompt_version` text DEFAULT '' NOT NULL,
	`schema_version` text DEFAULT 'live-v1' NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`last_source_file_id` text DEFAULT '' NOT NULL,
	`last_run_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_templates_fingerprint_idx` ON `document_templates` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `document_templates_lookup_idx` ON `document_templates` (`extension`,`area`,`document_type`);--> statement-breakpoint
CREATE INDEX `document_templates_last_run_idx` ON `document_templates` (`last_run_at`);--> statement-breakpoint
CREATE TABLE `ingestion_agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`template_id` text DEFAULT '' NOT NULL,
	`fingerprint` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`prompt_version` text DEFAULT '' NOT NULL,
	`iterations` integer DEFAULT 0 NOT NULL,
	`tool_calls_json` text DEFAULT '[]' NOT NULL,
	`validation_json` text DEFAULT '{}' NOT NULL,
	`proposed_count` integer DEFAULT 0 NOT NULL,
	`published_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ingestion_agent_runs_file_idx` ON `ingestion_agent_runs` (`file_id`);--> statement-breakpoint
CREATE INDEX `ingestion_agent_runs_status_idx` ON `ingestion_agent_runs` (`status`);--> statement-breakpoint
CREATE INDEX `ingestion_agent_runs_started_idx` ON `ingestion_agent_runs` (`started_at`);