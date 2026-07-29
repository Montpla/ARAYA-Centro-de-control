CREATE TABLE `live_data_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`change_count` integer DEFAULT 0 NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_data_events_created_at_idx` ON `live_data_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `live_data_events_source_file_id_idx` ON `live_data_events` (`source_file_id`);--> statement-breakpoint
CREATE TABLE `live_data_points` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`value_type` text NOT NULL,
	`area` text DEFAULT 'direccion' NOT NULL,
	`source_file_id` text DEFAULT '' NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`source_currency` text DEFAULT 'DOP' NOT NULL,
	`cutoff` text DEFAULT '' NOT NULL,
	`revision` integer NOT NULL,
	`updated_by_email` text NOT NULL,
	`updated_by_name` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_data_points_revision_idx` ON `live_data_points` (`revision`);--> statement-breakpoint
CREATE INDEX `live_data_points_area_idx` ON `live_data_points` (`area`);--> statement-breakpoint
CREATE INDEX `live_data_points_source_file_id_idx` ON `live_data_points` (`source_file_id`);