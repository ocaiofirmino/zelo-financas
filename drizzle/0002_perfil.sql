CREATE TABLE `profiles` (
	`userId` text PRIMARY KEY NOT NULL,
	`preferredName` text NOT NULL,
	`fullName` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`occupation` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`monthlySalary` integer,
	`paydays` text DEFAULT '[]' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`updatedAt` text NOT NULL,
	CONSTRAINT "profile_salary_valid" CHECK("profiles"."monthlySalary" IS NULL OR ("profiles"."monthlySalary" >= 0 AND "profiles"."monthlySalary" <= 1000000000))
);
