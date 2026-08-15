CREATE TABLE `property_comparable_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`comparable_type` text NOT NULL,
	`source_name` text NOT NULL,
	`source_license` text NOT NULL,
	`source_url` text,
	`source_record_id` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`county` text,
	`state` text NOT NULL,
	`postal_code` text,
	`latitude` real,
	`longitude` real,
	`parcel_id` text,
	`tract_geoid` text,
	`property_type` text NOT NULL,
	`unit_count` integer DEFAULT 1 NOT NULL,
	`bedrooms` real,
	`bathrooms` real,
	`building_square_feet` integer,
	`year_built` integer,
	`condition` text,
	`transaction_date` text NOT NULL,
	`sale_price` real,
	`monthly_rent` real,
	`observed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_comparable_records_user_source_idx` ON `property_comparable_records` (`user_email`,`source_name`,`source_record_id`,`comparable_type`);--> statement-breakpoint
CREATE TABLE `property_comparable_selections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`subject_property_id` integer NOT NULL,
	`comparable_record_id` integer NOT NULL,
	`decision` text NOT NULL,
	`adjustment_percent` real DEFAULT 0 NOT NULL,
	`adjustment_notes` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subject_property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comparable_record_id`) REFERENCES `property_comparable_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_comparable_selections_subject_record_idx` ON `property_comparable_selections` (`user_email`,`subject_property_id`,`comparable_record_id`);