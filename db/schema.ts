import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    type: text("type").notNull(),
    category: text("category").notNull(),
    payment: text("payment").notNull(),
    status: text("status").notNull(),
    installment: integer("installment").notNull(),
    installments: integer("installments").notNull(),
    groupId: text("groupId"),
  },
  (t) => [index("idx_transactions_user_date").on(t.userId, t.date)],
);
export const preferences = sqliteTable(
  "preferences",
  {
    userId: text("userId").notNull(),
    month: text("month").notNull(),
    goal: integer("goal").notNull().default(0),
    budgets: text("budgets").notNull().default("{}"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
);
