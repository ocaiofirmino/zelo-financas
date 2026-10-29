ALTER TABLE `credit_cards` ADD `archived` integer DEFAULT 0 NOT NULL CONSTRAINT `card_archived_valid` CHECK (`archived` IN (0, 1));
