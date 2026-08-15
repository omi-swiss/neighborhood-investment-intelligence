CREATE TABLE `financial_model_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`version` integer NOT NULL,
	`assumptions_json` text NOT NULL,
	`calculation_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `financial_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_model_versions_model_version_idx` ON `financial_model_versions` (`model_id`,`version`);--> statement-breakpoint
CREATE TABLE `financial_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`property_id` integer,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financial_scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_version_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`scenario_type` text NOT NULL,
	`overrides_json` text NOT NULL,
	`results_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`model_version_id`) REFERENCES `financial_model_versions`(`id`) ON UPDATE no action ON DELETE no action
);
