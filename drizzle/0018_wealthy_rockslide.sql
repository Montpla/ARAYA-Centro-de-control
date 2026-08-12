CREATE TABLE `unmapped_field_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`value_json` text NOT NULL,
	`suggested_area` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`reviewed_by_email` text DEFAULT '' NOT NULL,
	`reviewed_by_name` text DEFAULT '' NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `unmapped_field_candidates_file_id_idx` ON `unmapped_field_candidates` (`file_id`);--> statement-breakpoint
CREATE INDEX `unmapped_field_candidates_status_idx` ON `unmapped_field_candidates` (`status`);--> statement-breakpoint
CREATE INDEX `unmapped_field_candidates_created_at_idx` ON `unmapped_field_candidates` (`created_at`);