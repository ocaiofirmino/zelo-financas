CREATE TABLE `savings_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`goalId` text NOT NULL,
	`userId` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`goalId`,`userId`) REFERENCES `savings_goals`(`id`,`userId`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "savings_amount_valid" CHECK("savings_entries"."amount" > 0 AND "savings_entries"."amount" <= 1000000000),
	CONSTRAINT "savings_kind_valid" CHECK("savings_entries"."kind" IN ('initial', 'deposit', 'withdrawal'))
);
--> statement-breakpoint
CREATE INDEX `idx_savings_entries_user_goal_date` ON `savings_entries` (`userId`,`goalId`,`date`);--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`target` integer NOT NULL,
	`deadline` text NOT NULL,
	`monthly` integer NOT NULL,
	`paydays` text NOT NULL,
	`weights` text NOT NULL,
	`createdAt` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "savings_target_valid" CHECK("savings_goals"."target" > 0 AND "savings_goals"."target" <= 1000000000),
	CONSTRAINT "savings_monthly_valid" CHECK("savings_goals"."monthly" > 0 AND "savings_goals"."monthly" <= 1000000000),
	CONSTRAINT "savings_archived_valid" CHECK("savings_goals"."archived" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_savings_goals_id_user` ON `savings_goals` (`id`,`userId`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`userId`,`archived`);