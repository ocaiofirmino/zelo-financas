CREATE TABLE `preferences` (
	`userId` text NOT NULL,
	`month` text NOT NULL,
	`goal` integer DEFAULT 0 NOT NULL,
	`budgets` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`userId`, `month`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`payment` text NOT NULL,
	`status` text NOT NULL,
	`installment` integer NOT NULL,
	`installments` integer NOT NULL,
	`groupId` text
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`userId`,`date`);