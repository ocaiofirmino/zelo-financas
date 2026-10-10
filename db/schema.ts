import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
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

// Cofrinhos são reservas pessoais: seus movimentos não criam despesas.
export const savingsGoals = sqliteTable(
  "savings_goals",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    target: integer("target").notNull(),
    deadline: text("deadline").notNull(),
    monthly: integer("monthly").notNull(),
    paydays: text("paydays").notNull(),
    weights: text("weights").notNull(),
    createdAt: text("createdAt").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("idx_savings_goals_id_user").on(t.id, t.userId),
    index("idx_savings_goals_user").on(t.userId, t.archived),
    check(
      "savings_target_valid",
      sql`${t.target} > 0 AND ${t.target} <= 1000000000`,
    ),
    check(
      "savings_monthly_valid",
      sql`${t.monthly} > 0 AND ${t.monthly} <= 1000000000`,
    ),
    check("savings_archived_valid", sql`${t.archived} IN (0, 1)`),
  ],
);

export const savingsEntries = sqliteTable(
  "savings_entries",
  {
    id: text("id").primaryKey(),
    goalId: text("goalId").notNull(),
    userId: text("userId").notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    kind: text("kind", {
      enum: ["initial", "deposit", "withdrawal"],
    }).notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [
    foreignKey({
      name: "savings_entries_goal_owner_fk",
      columns: [t.goalId, t.userId],
      foreignColumns: [savingsGoals.id, savingsGoals.userId],
    }).onDelete("restrict"),
    index("idx_savings_entries_user_goal_date").on(t.userId, t.goalId, t.date),
    check(
      "savings_amount_valid",
      sql`${t.amount} > 0 AND ${t.amount} <= 1000000000`,
    ),
    check(
      "savings_kind_valid",
      sql`${t.kind} IN ('initial', 'deposit', 'withdrawal')`,
    ),
  ],
);
