import { installmentDate, validateTransaction, type Transaction } from "./finance.ts";
import type { CreditCard } from "./cards.ts";

export type TransactionScope = "single" | "following" | "all";
export const editableTransactionFields = ["description", "amount", "date", "type", "category", "payment", "status", "cardId"] as const;
export type TransactionField = (typeof editableTransactionFields)[number];
export const MAX_BULK_LINK = 25;

export function validateScope(value: unknown): TransactionScope {
  if (value === undefined || value === "single") return "single";
  if (value === "following" || value === "all") return value;
  throw new Error("Escolha quais parcelas deseja alterar.");
}

export function transactionTargets(rows: Transaction[], id: string, scope: TransactionScope): Transaction[] {
  const anchor = rows.find((row) => row.id === id);
  if (!anchor) throw new Error("Lançamento não encontrado.");
  if (scope === "single") return [anchor];
  if (!anchor.groupId || anchor.installments <= 1)
    throw new Error("Este lançamento não possui um grupo de parcelas. Altere apenas este lançamento.");
  return rows.filter((row) => row.groupId === anchor.groupId && (scope === "all" || row.installment >= anchor.installment)).sort((a, b) => a.installment - b.installment);
}

export function validateEditFields(value: unknown): TransactionField[] {
  if (!Array.isArray(value) || !value.length || value.length > editableTransactionFields.length || value.some((field) => !editableTransactionFields.includes(field)))
    throw new Error("Altere ao menos um campo e confira quais campos serão aplicados.");
  return [...new Set(value)] as TransactionField[];
}

export function planTransactionEdit(rows: Transaction[], id: string, value: ReturnType<typeof validateTransaction>, scope: TransactionScope, fields: TransactionField[], cards: CreditCard[]): Transaction[] {
  const targets = transactionTargets(rows, id, scope);
  const anchor = rows.find((row) => row.id === id)!;
  return targets.map((row) => {
    const change = Object.fromEntries(fields.map((field) => [field, value[field]]));
    const next = { ...row, ...change } as Transaction;
    if (fields.includes("date") && scope !== "single") next.date = installmentDate(value.date, row.installment - anchor.installment);
    if (next.payment !== "card") next.cardId = null;
    const valid = validateTransaction({ ...next, installments: 1 });
    if (row.installments > 1 && (valid.type !== "expense" || valid.payment !== "card"))
      throw new Error("Parcelas devem continuar como despesas no cartão.");
    if (valid.cardId) {
      const card = cards.find((item) => item.id === valid.cardId);
      if (!card) throw new Error("Cartão não encontrado.");
      if (card.archived && row.cardId !== card.id) throw new Error("Restaure o cartão antes de vincular novas compras.");
    }
    return { ...row, ...valid, installments: row.installments, installment: row.installment, purchaseDate: valid.payment === "card" ? row.purchaseDate ?? null : null };
  });
}

export function validateBulkLinkIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_BULK_LINK || value.some((id) => typeof id !== "string" || !id || id.length > 100) || new Set(value).size !== value.length)
    throw new Error(`Selecione de 1 a ${MAX_BULK_LINK} lançamentos diferentes.`);
  return value;
}

export function planLegacyLink(rows: Transaction[], ids: string[], card: CreditCard): Transaction[] {
  validateBulkLinkIds(ids);
  if (card.archived) throw new Error("Restaure o cartão antes de vincular compras.");
  const selected = ids.map((id) => rows.find((row) => row.id === id));
  if (selected.some((row) => !row)) throw new Error("Um dos lançamentos não foi encontrado.");
  if (selected.some((row) => row!.type !== "expense" || row!.payment !== "card" || row!.cardId))
    throw new Error("Selecione somente despesas no cartão que ainda estejam sem vínculo.");
  return selected.map((row) => ({ ...row!, cardId: card.id }));
}
