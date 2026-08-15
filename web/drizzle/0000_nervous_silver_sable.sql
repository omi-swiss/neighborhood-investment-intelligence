CREATE TABLE `saved_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`area_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_areas_user_area_idx` ON `saved_areas` (`user_email`,`area_id`);--> statement-breakpoint
CREATE TABLE `saved_filter_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`query_json` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_filter_sets_user_name_idx` ON `saved_filter_sets` (`user_email`,`name`);