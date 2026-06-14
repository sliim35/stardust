CREATE TABLE `memory_stars` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`name` text,
	`mood` text NOT NULL,
	`color` text NOT NULL,
	`r` real NOT NULL,
	`angle` real NOT NULL,
	`brightness` real NOT NULL,
	`grp` text,
	`who` text,
	`tier` text,
	`parent_id` text,
	`placement_r` real,
	`placement_angle` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memory_stars_created_at` ON `memory_stars` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_memory_stars_grp` ON `memory_stars` (`grp`);