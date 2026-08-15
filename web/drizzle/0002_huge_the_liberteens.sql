CREATE TABLE `properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`import_id` integer,
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
	`property_type` text NOT NULL,
	`unit_count` integer DEFAULT 1 NOT NULL,
	`bedrooms` real,
	`bathrooms` real,
	`building_square_feet` integer,
	`lot_square_feet` integer,
	`year_built` integer,
	`asking_price` real NOT NULL,
	`current_monthly_rent` real,
	`market_monthly_rent` real,
	`annual_property_taxes` real,
	`annual_insurance` real,
	`hoa_monthly` real,
	`maintenance_monthly` real,
	`vacancy_assumption` real,
	`renovation_estimate` real,
	`listing_date` text,
	`listing_status` text DEFAULT 'active' NOT NULL,
	`broker` text,
	`tract_geoid` text,
	`observed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `property_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `properties_user_source_record_idx` ON `properties` (`user_email`,`source_name`,`source_record_id`);--> statement-breakpoint
CREATE TABLE `property_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`filename` text NOT NULL,
	`source_name` text NOT NULL,
	`source_license` text NOT NULL,
	`source_url` text,
	`submitted_count` integer NOT NULL,
	`accepted_count` integer NOT NULL,
	`rejected_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`property_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_properties_user_property_idx` ON `saved_properties` (`user_email`,`property_id`);