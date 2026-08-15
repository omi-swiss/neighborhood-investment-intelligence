CREATE TABLE `strategy_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`weights_json` text NOT NULL,
	`minimum_coverage_bps` integer DEFAULT 7000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_versions_user_name_version_idx` ON `strategy_versions` (`user_email`,`name`,`version`);