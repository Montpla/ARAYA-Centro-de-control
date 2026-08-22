ALTER TABLE `live_data_events` ADD `financial_validation_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_data_events` ADD `monetary_audit_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_data_events` ADD `source_authority_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_data_events` ADD `affected_views_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_data_events` ADD `verification_json` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `processing_receipt_json` text DEFAULT '' NOT NULL;