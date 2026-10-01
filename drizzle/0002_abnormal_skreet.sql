CREATE UNIQUE INDEX `strava_cache_owner_activity` ON `strava_cache` (`user_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `strava_cache_expiry` ON `strava_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `strava_jobs_due` ON `strava_jobs` (`due`,`lease`);--> statement-breakpoint
CREATE INDEX `strava_jobs_owner` ON `strava_jobs` (`user_id`);