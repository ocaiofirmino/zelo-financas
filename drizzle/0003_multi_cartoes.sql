CREATE TABLE `credit_cards` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `creditLimit` integer NOT NULL,
  `closingDay` integer NOT NULL,
  `dueDay` integer NOT NULL,
  CONSTRAINT `card_limit_valid` CHECK (`creditLimit` > 0 AND `creditLimit` <= 1000000000),
  CONSTRAINT `card_closing_valid` CHECK (`closingDay` BETWEEN 1 AND 31),
  CONSTRAINT `card_due_valid` CHECK (`dueDay` BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credit_cards_id_user` ON `credit_cards` (`id`, `userId`);
--> statement-breakpoint
CREATE INDEX `idx_credit_cards_user` ON `credit_cards` (`userId`);
--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
  `groupId` text,
  `cardId` text,
  `purchaseDate` text,
  CONSTRAINT `transactions_card_owner_fk` FOREIGN KEY (`cardId`, `userId`) REFERENCES `credit_cards` (`id`, `userId`) ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_transactions` (`id`, `userId`, `description`, `amount`, `date`, `type`, `category`, `payment`, `status`, `installment`, `installments`, `groupId`)
SELECT `id`, `userId`, `description`, `amount`, `date`, `type`, `category`, `payment`, `status`, `installment`, `installments`, `groupId` FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`userId`, `date`);
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_card_date` ON `transactions` (`userId`, `cardId`, `date`);
