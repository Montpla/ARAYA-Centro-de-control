ALTER TABLE `file_reviews` ADD `previous_review_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_reviews` ADD `previous_updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_reviews` ADD `claimed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_reviews` ADD `lease_expires_at` text DEFAULT '' NOT NULL;