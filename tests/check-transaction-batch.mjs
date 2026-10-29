import assert from "node:assert/strict";
import { makeTransactions, validateTransaction } from "../lib/finance.ts";
import {
  MAX_BULK_LINK,
  changedTransactionFields,
  planLegacyLink,
  planTransactionEdit,
  transactionTargets,
  validateBulkLinkIds,
  validateEditFields,
  validateScope,
} from "../lib/transaction-batch.ts";

const card = {
  id: "card-a",
  name: "Principal",
  creditLimit: 100000,
  closingDay: 10,
  dueDay: 31,
  archived: false,
};
const input = validateTransaction({
  description: "Notebook",
  amount: 1001,
  date: "2024-01-01",
  type: "expense",
  category: "Compras",
  payment: "card",
  status: "paid",
  installments: 3,
  cardId: card.id,
});
const rows = makeTransactions(input, card);
const noChange = validateTransaction({ ...rows[0], installments: 1 });
assert.deepEqual(changedTransactionFields(noChange, rows[0]), []);
const before = JSON.stringify(rows);
assert.equal(transactionTargets(rows, rows[1].id, "single").length, 1);
assert.equal(transactionTargets(rows, rows[1].id, "following").length, 2);
assert.equal(transactionTargets(rows, rows[1].id, "all").length, 3);
const description = validateTransaction({
  ...rows[1],
  description: "Notebook corrigido",
  installments: 1,
});
const edited = planTransactionEdit(
  rows,
  rows[1].id,
  description,
  "all",
  ["description"],
  [card],
);
assert.ok(edited.every((row) => row.description === "Notebook corrigido"));
assert.deepEqual(
  edited.map((row) => row.amount),
  [334, 334, 333],
);
assert.deepEqual(
  edited.map((row) => row.status),
  ["paid", "pending", "pending"],
);
assert.deepEqual(
  edited.map((row) => row.date),
  ["2024-01-31", "2024-02-29", "2024-03-31"],
);
const date = validateTransaction({
  ...rows[1],
  date: "2025-02-28",
  installments: 1,
});
assert.deepEqual(
  planTransactionEdit(rows, rows[1].id, date, "all", ["date"], [card]).map(
    (row) => row.date,
  ),
  ["2025-01-28", "2025-02-28", "2025-03-28"],
);
const onlyFuture = planTransactionEdit(
  rows,
  rows[1].id,
  validateTransaction({ ...rows[1], amount: 500, installments: 1 }),
  "following",
  ["amount"],
  [card],
);
assert.deepEqual(
  onlyFuture.map((row) => row.amount),
  [500, 500],
);
assert.deepEqual(
  onlyFuture.map((row) => row.installment),
  [2, 3],
);
assert.equal(JSON.stringify(rows), before);
assert.throws(() =>
  planTransactionEdit(
    rows,
    rows[1].id,
    validateTransaction({ ...rows[1], date: "2000-01-01", installments: 1 }),
    "all",
    ["date"],
    [card],
  ),
);
assert.throws(() =>
  transactionTargets([{ ...rows[0], groupId: null }], rows[0].id, "all"),
);
assert.equal(validateScope(undefined), "single");
assert.throws(() => validateScope("everything"));
assert.throws(() => validateEditFields([]));
assert.throws(() => validateEditFields(["userId"]));
const legacy = [
  { ...rows[0], id: "old-a", cardId: null, groupId: null },
  { ...rows[1], id: "old-b", cardId: null, groupId: null },
];
const legacyBefore = JSON.stringify(legacy);
const linked = planLegacyLink(legacy, ["old-a", "old-b"], card);
assert.ok(linked.every((row) => row.cardId === card.id));
assert.deepEqual(
  linked.map((row) => row.date),
  legacy.map((row) => row.date),
);
assert.deepEqual(
  linked.map((row) => row.amount),
  legacy.map((row) => row.amount),
);
assert.equal(JSON.stringify(legacy), legacyBefore);
assert.throws(() =>
  planLegacyLink(legacy, ["old-a"], { ...card, archived: true }),
);
assert.throws(() => planLegacyLink(rows, [rows[0].id], card));
assert.throws(() => planLegacyLink(legacy, ["old-a", "not-owned"], card));
assert.throws(() => validateBulkLinkIds(["old-a", "old-a"]));
assert.throws(() =>
  validateBulkLinkIds(
    Array.from({ length: MAX_BULK_LINK + 1 }, (_, i) => "id-" + i),
  ),
);
assert.throws(() =>
  planTransactionEdit(
    rows,
    rows[0].id,
    validateTransaction({ ...rows[0], cardId: "archived", installments: 1 }),
    "all",
    ["cardId"],
    [{ ...card, id: "archived", archived: true }],
  ),
);
assert.equal(
  planTransactionEdit(
    rows,
    rows[0].id,
    description,
    "all",
    ["description"],
    [{ ...card, archived: true }],
  ).length,
  3,
);
console.log(
  "OK: escopos, centavos e situações individuais preservados, datas mensais, limites de datas, cartões arquivados e vínculo em lote sem mutação do histórico.",
);
