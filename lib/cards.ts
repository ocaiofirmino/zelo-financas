import type { Transaction } from "./finance.ts";

export type CreditCard = {
  id: string;
  name: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
};
export type CardInput = Omit<CreditCard, "id">;

export function validateCard(value: unknown): CardInput {
  const v = value as Partial<CreditCard> | null;
  if (
    !v ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.trim().length > 40
  )
    throw new Error("Informe um nome de até 40 caracteres para o cartão.");
  if (
    !Number.isSafeInteger(v.creditLimit) ||
    v.creditLimit! < 1 ||
    v.creditLimit! > 1000000000
  )
    throw new Error("Informe um limite entre R$ 0,01 e R$ 10.000.000.");
  if (
    ![v.closingDay, v.dueDay].every(
      (day) => Number.isInteger(day) && day! >= 1 && day! <= 31,
    )
  )
    throw new Error("Fechamento e vencimento devem ser dias de 1 a 31.");
  return {
    name: v.name.trim(),
    creditLimit: v.creditLimit!,
    closingDay: v.closingDay!,
    dueDay: v.dueDay!,
  };
}

/** Clamp each invoice independently, so February never moves March's due day. */
export function invoiceDueDate(
  month: string,
  dueDay: number,
  offset = 0,
): string {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1 + offset, 1));
  const end = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const date = new Date(
    Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth(),
      Math.min(dueDay, end),
    ),
  )
    .toISOString()
    .slice(0, 10);
  if (date < "2000-01-01" || date > "2100-12-31")
    throw new Error("O vencimento das parcelas deve estar entre 2000 e 2100.");
  return date;
}

/** Purchases on the closing day belong to the next cycle. */
export function firstInvoiceDate(
  purchaseDate: string,
  card: CreditCard,
): string {
  const month = purchaseDate.slice(0, 7);
  const nextCycle =
    purchaseDate >= invoiceDueDate(month, card.closingDay) ? 1 : 0;
  return invoiceDueDate(
    month,
    card.dueDay,
    nextCycle + (card.dueDay <= card.closingDay ? 1 : 0),
  );
}

export function cardInvoice(
  rows: Transaction[],
  cardId: string | null,
  month: string,
) {
  const purchases = rows.filter(
    (r) =>
      r.type === "expense" &&
      r.payment === "card" &&
      (r.cardId ?? null) === cardId,
  );
  const transactions = purchases
    .filter((r) => r.date.slice(0, 7) === month)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.description.localeCompare(b.description),
    );
  const total = transactions.reduce((sum, r) => sum + r.amount, 0);
  const pending = transactions.reduce(
    (sum, r) => sum + (r.status === "pending" ? r.amount : 0),
    0,
  );
  const committed = purchases.reduce(
    (sum, r) => sum + (r.status === "pending" ? r.amount : 0),
    0,
  );
  return { transactions, total, pending, paid: total - pending, committed };
}

export const demoCards: CreditCard[] = [
  {
    id: "demo-card-principal",
    name: "Meu cartão",
    creditLimit: 500000,
    closingDay: 25,
    dueDay: 5,
  },
  {
    id: "demo-card-compras",
    name: "Cartão de compras",
    creditLimit: 300000,
    closingDay: 10,
    dueDay: 20,
  },
];
