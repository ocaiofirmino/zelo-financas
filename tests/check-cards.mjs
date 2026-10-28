import assert from "node:assert/strict";
import { cardInvoice, firstInvoiceDate, invoiceDueDate, validateCard } from "../lib/cards.ts";
import { makeTransactions, validateTransaction } from "../lib/finance.ts";
import { buildFinanceExport } from "../lib/finance-export.ts";

const a = { id: "card-a", ...validateCard({ name: " Principal ", creditLimit: 100000, closingDay: 25, dueDay: 5 }) };
const b = { id: "card-b", ...validateCard({ name: "Compras", creditLimit: 200000, closingDay: 10, dueDay: 20 }) };
assert.equal(a.name, "Principal");
for (const input of [null, {}, { ...a, name: " " }, { ...a, name: "a".repeat(41) }, { ...a, creditLimit: 0 }, { ...a, creditLimit: 1.5 }, { ...a, closingDay: 0 }, { ...a, dueDay: 32 }, { ...a, closingDay: "25" }]) assert.throws(() => validateCard(input));
assert.equal(firstInvoiceDate("2024-01-24", a), "2024-02-05");
assert.equal(firstInvoiceDate("2024-01-25", a), "2024-03-05");
assert.equal(firstInvoiceDate("2024-01-26", a), "2024-03-05");
assert.equal(firstInvoiceDate("2024-12-31", a), "2025-02-05");
assert.equal(firstInvoiceDate("2024-01-09", b), "2024-01-20");
assert.equal(firstInvoiceDate("2024-01-10", b), "2024-02-20");
assert.equal(firstInvoiceDate("2024-02-28", { ...a, closingDay: 31 }), "2024-03-05");
assert.equal(firstInvoiceDate("2024-02-29", { ...a, closingDay: 31 }), "2024-04-05");
assert.equal(firstInvoiceDate("2025-02-28", { ...a, closingDay: 31 }), "2025-04-05");
assert.equal(invoiceDueDate("2024-02", 31), "2024-02-29");
assert.equal(invoiceDueDate("2024-02", 31, 1), "2024-03-31");
assert.throws(() => firstInvoiceDate("2100-12-31", a));

const draft = { description: "Compra parcelada", amount: 1001, date: "2024-01-31", type: "expense", category: "Compras", payment: "card", status: "paid", installments: 3, cardId: a.id };
const parts = makeTransactions(validateTransaction(draft), a);
assert.deepEqual(parts.map((r) => r.date), ["2024-03-05", "2024-04-05", "2024-05-05"]);
assert.deepEqual(parts.map((r) => r.amount), [334, 334, 333]);
assert.deepEqual(parts.map((r) => r.status), ["paid", "pending", "pending"]);
assert.equal(parts.reduce((sum, r) => sum + r.amount, 0), 1001);
assert.ok(parts.every((r) => r.cardId === a.id && r.purchaseDate === draft.date));
assert.equal(new Set(parts.map((r) => r.groupId)).size, 1);
assert.throws(() => makeTransactions(validateTransaction(draft), b));
assert.throws(() => makeTransactions(validateTransaction(draft)));
assert.throws(() => validateTransaction({ ...draft, payment: "pix" }));
assert.throws(() => makeTransactions(validateTransaction({ ...draft, date: "2100-11-20" }), a));
const monthEnd = makeTransactions(validateTransaction({ ...draft, date: "2024-01-01" }), { ...a, closingDay: 10, dueDay: 31 });
assert.deepEqual(monthEnd.map((r) => r.date), ["2024-01-31", "2024-02-29", "2024-03-31"]);
const other = makeTransactions(validateTransaction({ ...draft, cardId: b.id, status: "pending", date: "2024-02-15" }), b);
const legacy = { ...parts[0], id: "legacy", cardId: null, amount: 900 };
const rows = [...parts, ...other, legacy];
const invoice = cardInvoice(rows, a.id, "2024-03");
assert.equal(invoice.total, 334);
assert.equal(invoice.paid, 334);
assert.equal(invoice.pending, 0);
assert.equal(invoice.committed, 667);
assert.equal(cardInvoice(rows, b.id, "2024-03").pending, 334);
assert.equal(cardInvoice(rows, null, "2024-03").total, 900);
assert.equal(cardInvoice(rows, a.id, "2024-06").total, 0);
assert.deepEqual(parts.map((r) => r.date), ["2024-03-05", "2024-04-05", "2024-05-05"]);

for (const format of ["csv", "bi"]) {
  const file = await buildFinanceExport({ transactions: rows, cards: [{ ...a, name: "=HYPERLINK(1)" }, b], month: "2024-03", scope: "month", format, demo: false });
  const csv = new TextDecoder().decode(file.bytes);
  assert.ok(csv.includes("card-a"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes("2024-01-31"));
  assert.ok(csv.includes("Sem cartão vinculado"));
}
console.log("OK: cartões, ciclos de fatura, fechamento, virada do ano, meses curtos, parcelas em centavos, isolamento das faturas, legado e exportação CSV/BI.");
