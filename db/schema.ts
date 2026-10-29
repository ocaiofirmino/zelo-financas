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
export const creditCards = sqliteTable(
  "credit_cards",
  {
    id: text("id").primaryKey(),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    creditLimit: integer("creditLimit").notNull(),
    closingDay: integer("closingDay").notNull(),
    dueDay: integer("dueDay").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("idx_credit_cards_id_user").on(t.id, t.userId),
    index("idx_credit_cards_user").on(t.userId),
    check(
      "card_limit_valid",
      sql`${t.creditLimit} > 0 AND ${t.creditLimit} <= 1000000000`,
    ),
    check("card_closing_valid", sql`${t.closingDay} BETWEEN 1 AND 31`),
    check("card_due_valid", sql`${t.dueDay} BETWEEN 1 AND 31`),
    check("card_archived_valid", sql`${t.archived} IN (0, 1)`),
  ],
);
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
    cardId: text("cardId"),
    purchaseDate: text("purchaseDate"),
  },
  (t) => [
    index("idx_transactions_user_date").on(t.userId, t.date),
    index("idx_transactions_user_card_date").on(t.userId, t.cardId, t.date),
    foreignKey({
      name: "transactions_card_owner_fk",
      columns: [t.cardId, t.userId],
      foreignColumns: [creditCards.id, creditCards.userId],
    }).onDelete("restrict"),
  ],
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

export const profiles = sqliteTable(
  "profiles",
  {
    userId: text("userId").primaryKey(),
    preferredName: text("preferredName").notNull(),
    fullName: text("fullName").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    occupation: text("occupation").notNull().default(""),
    company: text("company").notNull().default(""),
    monthlySalary: integer("monthlySalary"),
    paydays: text("paydays").notNull().default("[]"),
    avatar: text("avatar").notNull().default(""),
    updatedAt: text("updatedAt").notNull(),
  },
  (t) => [
    check(
      "profile_salary_valid",
      sql`${t.monthlySalary} IS NULL OR (${t.monthlySalary} >= 0 AND ${t.monthlySalary} <= 1000000000)`,
    ),
  ],
);
