CREATE TABLE `alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_key` text NOT NULL,
	`event_types_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_user_entity_idx` ON `alert_rules` (`user_email`,`entity_type`,`entity_key`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`rule_id` integer,
	`entity_type` text NOT NULL,
	`entity_key` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`previous_json` text,
	`current_json` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`why_it_matters` text NOT NULL,
	`detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`read_at` text,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_user_fingerprint_idx` ON `alerts` (`user_email`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `property_listing_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`property_id` integer NOT NULL,
	`asking_price` real NOT NULL,
	`listing_status` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_listing_history_observation_idx` ON `property_listing_history` (`user_email`,`property_id`,`observed_at`,`asking_price`,`listing_status`);--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`search_type` text NOT NULL,
	`query_json` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_searches_user_name_idx` ON `saved_searches` (`user_email`,`name`);--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watchlist_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_key` text NOT NULL,
	`label` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`watchlist_id`) REFERENCES `watchlists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_items_list_entity_idx` ON `watchlist_items` (`watchlist_id`,`entity_type`,`entity_key`);--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlists_user_name_idx` ON `watchlists` (`user_email`,`name`);
