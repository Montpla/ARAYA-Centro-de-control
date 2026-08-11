ALTER TABLE `live_data_events` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `live_data_events_status_idx` ON `live_data_events` (`status`);