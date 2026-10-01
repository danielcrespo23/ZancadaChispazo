CREATE TABLE `strava_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`external_id` text NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strava_connection` (
	`user_id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`cipher` text NOT NULL,
	`mode` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text NOT NULL,
	`verified_at` integer NOT NULL,
	`last_sync` integer,
	`version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strava_connection_athlete_id_unique` ON `strava_connection` (`athlete_id`);--> statement-breakpoint
CREATE TABLE `strava_control` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strava_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`due` integer NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strava_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strava_oauth` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cookie_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`settings` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strava_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
