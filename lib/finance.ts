export const categories = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Lazer",
  "Compras",
  "Saúde",
  "Outros",
] as const;
export const categoryColors = [
  "#03624c",
  "#095544",
  "#17876d",
  "#06302b",
  "#08453a",
  "#2fa98c",
  "#334e49",
];
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category: string;
  payment: "pix" | "card";
  status: "paid" | "pending";
  installment: number;
  installments: number;
  groupId: string | null;
};
export type Settings = { goal: number; budgets: Record<string, number> };
export const defaultSettings: Settings = { goal: 0, budgets: {} };
export const demoSettings: Settings = {
  goal: 150000,
  budgets: {
    Moradia: 180000,
    Alimentação: 95000,
    Transporte: 35000,
    Lazer: 40000,
    Compras: 60000,
    Saúde: 25000,
    Outros: 20000,
  },
};
export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
export function monthTitle(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));
}
export function localMonth() {
  return localDate().slice(0, 7);
}
export function localDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((t) => parts.find((p) => p.type === t)?.value)
    .join("-");
}
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function installmentDate(date: string, index: number) {
  const [y, m, d] = date.split("-").map(Number);
  const end = new Date(Date.UTC(y, m + index, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + index, Math.min(d, end)))
    .toISOString()
    .slice(0, 10);
}
export function totals(rows: Transaction[]) {
  const sum = (type: string, status: string) =>
    rows
      .filter((r) => r.type === type && r.status === status)
      .reduce((v, r) => v + r.amount, 0);
  const income = sum("income", "paid"),
    expense = sum("expense", "paid"),
    pendingIncome = sum("income", "pending"),
    pendingExpense = sum("expense", "pending");
  return {
    income,
    expense,
    pendingIncome,
    pendingExpense,
    result: income - expense,
    projected: income + pendingIncome - expense - pendingExpense,
  };
}
export function parseAmount(input: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(input.trim())) return NaN;
  return Math.round(Number(input.replace(",", ".")) * 100);
}
export function validateTransaction(value: unknown) {
  const v = value as Partial<Transaction>;
  if (
    !v ||
    typeof v.description !== "string" ||
    !v.description.trim() ||
    v.description.length > 100
  )
    throw new Error("Informe uma descrição de até 100 caracteres.");
  if (
    !Number.isSafeInteger(v.amount) ||
    v.amount! < 1 ||
    v.amount! > 1000000000
  )
    throw new Error("Informe um valor entre R$ 0,01 e R$ 10.000.000.");
  if (
    typeof v.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ||
    v.date < "2000-01-01" ||
    v.date > "2100-12-31" ||
    !Number.isFinite(Date.parse(v.date + "T12:00:00Z")) ||
    new Date(v.date + "T12:00:00Z").toISOString().slice(0, 10) !== v.date
  )
    throw new Error("Informe uma data válida entre 2000 e 2100.");
  if (
    !["income", "expense"].includes(v.type!) ||
    !["paid", "pending"].includes(v.status!) ||
    !["pix", "card"].includes(v.payment!)
  )
    throw new Error("Tipo, pagamento ou situação inválidos.");
  if (
    typeof v.category !== "string" ||
    (v.type === "expense" &&
      !categories.includes(v.category as (typeof categories)[number])) ||
    (v.type === "income" &&
      !["Salário", "Extra", "Outros"].includes(v.category))
  )
    throw new Error("Escolha uma categoria válida.");
  if (
    !Number.isInteger(v.installments) ||
    v.installments! < 1 ||
    v.installments! > 60 ||
    (v.installments! > 1 && (v.type !== "expense" || v.payment !== "card")) ||
    v.amount! < v.installments!
  )
    throw new Error("Confira a quantidade de parcelas (1 a 60).");
  if (installmentDate(v.date, v.installments! - 1) > "2100-12-31")
    throw new Error("A última parcela deve vencer até 2100.");
  return {
    description: v.description.trim(),
    amount: v.amount!,
    date: v.date,
    type: v.type!,
    status: v.status!,
    category: v.category,
    payment: v.payment!,
    installments: v.installments!,
  };
}
export function makeTransactions(
  input: ReturnType<typeof validateTransaction>,
): Transaction[] {
  const groupId = input.installments > 1 ? crypto.randomUUID() : null;
  const base = Math.floor(input.amount / input.installments),
    remainder = input.amount % input.installments;
  return Array.from({ length: input.installments }, (_, i) => ({
    ...input,
    id: crypto.randomUUID(),
    groupId,
    installment: i + 1,
    amount: base + (i < remainder ? 1 : 0),
    date: installmentDate(input.date, i),
    status: i === 0 ? input.status : "pending",
  }));
}
export function getDemo(month: string): Transaction[] {
  const seed: [
    string,
    number,
    number,
    Transaction["type"],
    string,
    Transaction["payment"],
    Transaction["status"],
  ][] = [
    ["Salário", 540000, 2, "income", "Salário", "pix", "paid"],
    ["Projeto extra", 80000, 5, "income", "Extra", "pix", "paid"],
    ["Aluguel", 160000, 3, "expense", "Moradia", "pix", "paid"],
    ["Mercado da semana", 42350, 4, "expense", "Alimentação", "pix", "paid"],
    ["Internet", 11990, 5, "expense", "Moradia", "pix", "paid"],
    ["Restaurante", 18500, 6, "expense", "Alimentação", "card", "paid"],
    ["Academia", 14990, 5, "expense", "Saúde", "pix", "paid"],
    ["Combustível", 23000, 5, "expense", "Transporte", "pix", "paid"],
    ["Tênis", 19900, 6, "expense", "Compras", "card", "paid"],
    ["Cinema", 7600, 4, "expense", "Lazer", "card", "paid"],
    ["Café e lanches", 9840, 6, "expense", "Alimentação", "pix", "paid"],
    ["Energia", 18300, 15, "expense", "Moradia", "pix", "pending"],
    ["Celular", 28000, 20, "expense", "Compras", "card", "pending"],
    ["Streaming", 5590, 12, "expense", "Lazer", "card", "pending"],
    [
      "Supermercado previsto",
      42000,
      18,
      "expense",
      "Alimentação",
      "pix",
      "pending",
    ],
  ];
  const current = localMonth(),
    previous = shiftMonth(current, -1);
  if (month !== current && month !== previous) return [];
  return seed.map(
    ([description, amount, day, type, category, payment, status], i) => ({
      id: "demo-" + month + "-" + i,
      description,
      amount: month === previous ? Math.round(amount * 0.94) : amount,
      date: month + "-" + String(day).padStart(2, "0"),
      type,
      category,
      payment,
      status: month === previous ? "paid" : status,
      installment: i === 8 ? 2 : i === 12 ? 4 : 1,
      installments: i === 8 ? 3 : i === 12 ? 10 : 1,
      groupId: null,
    }),
  );
}
