import { localDate, shiftMonth } from "./finance.ts";

export type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  deadline: string;
  monthly: number;
  paydays: number[];
  weights: number[];
  createdAt: string;
  archived: boolean;
};

export type SavingsEntry = {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  kind: "initial" | "deposit" | "withdrawal";
  note: string;
};

export type SavingsData = { goals: SavingsGoal[]; entries: SavingsEntry[] };

type GoalInput = Pick<
  SavingsGoal,
  "name" | "target" | "deadline" | "monthly" | "paydays" | "weights"
>;
type EntryInput = Omit<SavingsEntry, "id" | "kind"> & {
  kind: "deposit" | "withdrawal";
};

export type ContributionPlan = {
  monthlyTarget: number;
  saved: number;
  remaining: number;
  suggestions: { date: string; amount: number }[];
  missingDate: boolean;
  minMonthly: number | null;
};

const MAX_AMOUNT = 1_000_000_000;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validAmount(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= MAX_AMOUNT
  );
}

function schedule(paydays: unknown, weights: unknown) {
  if (
    !Array.isArray(paydays) ||
    paydays.length < 1 ||
    paydays.length > 31 ||
    paydays.some((day) => !Number.isInteger(day) || day < 1 || day > 31) ||
    new Set(paydays).size !== paydays.length
  )
    throw new Error("Escolha dias de aporte diferentes, entre 1 e 31.");
  const shares = weights === undefined ? paydays.map(() => 1) : weights;
  if (
    !Array.isArray(shares) ||
    shares.length !== paydays.length ||
    shares.some(
      (weight) => !Number.isInteger(weight) || weight < 1 || weight > 10_000,
    )
  )
    throw new Error(
      "Informe uma proporção inteira entre 1 e 10.000 para cada dia.",
    );
  return paydays
    .map((day, index) => ({
      day: day as number,
      weight: shares[index] as number,
    }))
    .sort((a, b) => a.day - b.day);
}

export function validateGoal(value: unknown, today = localDate()): GoalInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Informe os dados do cofrinho.");
  const goal = value as Partial<GoalInput>;
  if (
    typeof goal.name !== "string" ||
    !goal.name.trim() ||
    goal.name.length > 80
  )
    throw new Error("Informe um nome de até 80 caracteres para o cofrinho.");
  if (!validAmount(goal.target))
    throw new Error("Informe uma meta entre R$ 0,01 e R$ 10.000.000.");
  if (!validAmount(goal.monthly))
    throw new Error("Informe um aporte mensal entre R$ 0,01 e R$ 10.000.000.");
  if (
    !validDate(goal.deadline) ||
    goal.deadline < today ||
    goal.deadline > "2100-12-31"
  )
    throw new Error("Escolha um prazo válido, a partir de hoje e até 2100.");
  const days = schedule(goal.paydays, goal.weights);
  return {
    name: goal.name.trim(),
    target: goal.target,
    deadline: goal.deadline,
    monthly: goal.monthly,
    paydays: days.map(({ day }) => day),
    weights: days.map(({ weight }) => weight),
  };
}

export function validateEntry(value: unknown, today = localDate()): EntryInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Informe os dados do aporte ou da retirada.");
  const entry = value as Partial<EntryInput>;
  if (
    typeof entry.goalId !== "string" ||
    !entry.goalId.trim() ||
    entry.goalId.length > 128
  )
    throw new Error("Escolha um cofrinho.");
  if (!validAmount(entry.amount))
    throw new Error("Informe um valor entre R$ 0,01 e R$ 10.000.000.");
  if (!validDate(entry.date) || entry.date < "2000-01-01" || entry.date > today)
    throw new Error("Informe uma data válida entre 2000 e hoje.");
  if (entry.kind !== "deposit" && entry.kind !== "withdrawal")
    throw new Error("Escolha aporte ou retirada.");
  if (
    entry.note !== undefined &&
    (typeof entry.note !== "string" || entry.note.length > 200)
  )
    throw new Error("A observação deve ter até 200 caracteres.");
  return {
    goalId: entry.goalId.trim(),
    amount: entry.amount,
    date: entry.date,
    kind: entry.kind,
    note: entry.note?.trim() ?? "",
  };
}

/** Aportes são movimentos entre reservas: não alteram receitas ou despesas. */
export function goalBalance(goal: SavingsGoal, entries: SavingsEntry[]) {
  return entries.reduce(
    (sum, entry) =>
      entry.goalId === goal.id
        ? sum + (entry.kind === "withdrawal" ? -entry.amount : entry.amount)
        : sum,
    0,
  );
}

export function goalProgress(goal: SavingsGoal, entries: SavingsEntry[]) {
  return goal.target > 0
    ? Math.max(
        0,
        Math.min(100, (goalBalance(goal, entries) / goal.target) * 100),
      )
    : 0;
}

export function monthSaved(
  goal: SavingsGoal,
  entries: SavingsEntry[],
  month: string,
) {
  return goalBalance(
    goal,
    entries.filter(
      (entry) => entry.kind !== "initial" && entry.date.slice(0, 7) === month,
    ),
  );
}

/** Dias 29–31 viram o último dia de meses curtos; proporções são somadas. */
function eligibleDates(
  goal: Pick<SavingsGoal, "paydays" | "weights" | "deadline" | "createdAt">,
  month: string,
  today: string,
) {
  if (!validMonth(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates = new Map<string, number>();
  goal.paydays.forEach((day, index) => {
    const date = `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    if (date < today || date < goal.createdAt || date > goal.deadline) return;
    dates.set(date, (dates.get(date) ?? 0) + (goal.weights[index] ?? 1));
  });
  return [...dates]
    .map(([date, weight]) => ({ date, weight }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function eligibleMonths(
  goal: Pick<SavingsGoal, "paydays" | "weights" | "deadline" | "createdAt">,
  today: string,
) {
  if (goal.deadline < today || goal.deadline < goal.createdAt) return 0;
  const start = today > goal.createdAt ? today : goal.createdAt;
  const end = goal.deadline.slice(0, 7);
  let count = 0;
  for (
    let month = start.slice(0, 7);
    month <= end;
    month = shiftMonth(month, 1)
  ) {
    if (eligibleDates(goal, month, today).length) count += 1;
  }
  return count;
}

/** Maior resto preserva cada centavo; empates favorecem a primeira data. */
function distribute(amount: number, dates: { date: string; weight: number }[]) {
  const totalWeight = dates.reduce((sum, item) => sum + item.weight, 0);
  const allocations = dates.map(({ date, weight }) => ({
    date,
    amount: Math.floor((amount * weight) / totalWeight),
    remainder: (amount * weight) % totalWeight,
  }));
  const remainder =
    amount - allocations.reduce((sum, item) => sum + item.amount, 0);
  [...allocations]
    .sort((a, b) => b.remainder - a.remainder || a.date.localeCompare(b.date))
    .slice(0, remainder)
    .forEach((item) => {
      item.amount += 1;
    });
  return allocations
    .filter((item) => item.amount > 0)
    .map(({ date, amount: cents }) => ({ date, amount: cents }));
}

export function contributionPlan(
  goal: SavingsGoal,
  entries: SavingsEntry[],
  month: string,
  today = localDate(),
): ContributionPlan {
  const saved = monthSaved(goal, entries, month);
  const goalRemaining = Math.max(0, goal.target - goalBalance(goal, entries));
  const monthlyTarget = Math.min(
    goal.monthly,
    goalRemaining + Math.max(0, saved),
  );
  const remaining = Math.min(goalRemaining, Math.max(0, monthlyTarget - saved));
  const dates = eligibleDates(goal, month, today);
  const months = eligibleMonths(goal, today);
  const currentSaved = monthSaved(goal, entries, today.slice(0, 7));
  const currentMonthEligible =
    eligibleDates(goal, today.slice(0, 7), today).length > 0;
  const average = months
    ? (goalRemaining + (currentMonthEligible ? currentSaved : 0)) / months
    : 0;
  // Se este mês já recebeu mais que a média, só os meses futuros
  // precisam cobrir o saldo restante; o aporte feito não se repete.
  const futureOnly =
    currentMonthEligible && months > 1 && currentSaved >= average;
  const minMonthly =
    goalRemaining === 0
      ? 0
      : months
        ? Math.max(
            0,
            Math.ceil(futureOnly ? goalRemaining / (months - 1) : average),
          )
        : null;
  return {
    monthlyTarget,
    saved,
    remaining,
    suggestions:
      remaining > 0 && dates.length ? distribute(remaining, dates) : [],
    missingDate: remaining > 0 && dates.length === 0,
    minMonthly,
  };
}

export function suggestMonthly(
  target: number,
  deadline: string,
  paydays: number[],
  today = localDate(),
  initial = 0,
): number | null {
  if (
    !validAmount(target) ||
    !validDate(deadline) ||
    deadline > "2100-12-31" ||
    !Number.isSafeInteger(initial) ||
    initial < 0
  )
    return null;
  let days: ReturnType<typeof schedule>;
  try {
    days = schedule(paydays, undefined);
  } catch {
    return null;
  }
  const remaining = Math.max(0, target - initial);
  if (!remaining) return 0;
  const months = eligibleMonths(
    {
      paydays: days.map(({ day }) => day),
      weights: days.map(({ weight }) => weight),
      deadline,
      createdAt: today,
    },
    today,
  );
  return months ? Math.ceil(remaining / months) : null;
}

function monthEnd(month: string) {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`;
}

export function getDemoSavings(month: string): SavingsData {
  const today = localDate();
  const selectedMonth = validMonth(month) ? month : today.slice(0, 7);
  const previousDate = `${shiftMonth(selectedMonth, -1)}-05`;
  const openingDate = previousDate > today ? today : previousDate;
  const currentDate = `${selectedMonth}-05`;
  const hasCurrentDeposit = currentDate <= today && currentDate >= openingDate;
  const goals: SavingsGoal[] = [
    {
      id: "demo-trip",
      name: "Viagem",
      target: 600_000,
      monthly: 60_000,
      deadline: monthEnd(shiftMonth(selectedMonth, 7)),
    },
    {
      id: "demo-party",
      name: "Festa",
      target: 100_000,
      monthly: 15_000,
      deadline: monthEnd(shiftMonth(selectedMonth, 3)),
    },
    {
      id: "demo-phone",
      name: "Celular novo",
      target: 300_000,
      monthly: 30_000,
      deadline: monthEnd(shiftMonth(selectedMonth, 8)),
    },
  ].map((goal) => ({
    ...goal,
    paydays: [5, 15],
    weights: [1, 1],
    createdAt: openingDate,
    archived: false,
  }));
  const entries: SavingsEntry[] = [
    {
      id: "demo-trip-opening",
      goalId: "demo-trip",
      amount: hasCurrentDeposit ? 160_000 : 180_000,
      date: openingDate,
      kind: "deposit",
      note: "Valor já guardado",
    },
    {
      id: "demo-party-opening",
      goalId: "demo-party",
      amount: 60_000,
      date: openingDate,
      kind: "deposit",
      note: "Valor já guardado",
    },
    {
      id: "demo-phone-opening",
      goalId: "demo-phone",
      amount: 75_000,
      date: openingDate,
      kind: "deposit",
      note: "Valor já guardado",
    },
  ];
  if (hasCurrentDeposit)
    entries.push({
      id: "demo-trip-current",
      goalId: "demo-trip",
      amount: 20_000,
      date: currentDate,
      kind: "deposit",
      note: "Aporte do dia 5",
    });
  return { goals, entries };
}
