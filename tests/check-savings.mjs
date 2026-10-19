import assert from "node:assert/strict";
import {
  validateGoal,
  validateEntry,
  goalBalance,
  goalProgress,
  monthSaved,
  contributionPlan,
  suggestMonthly,
  getDemoSavings,
} from "../lib/savings.ts";

const today = "2026-10-10";
const goal = {
  id: "trip",
  name: "Viagem",
  target: 600_000,
  deadline: "2027-05-31",
  monthly: 60_000,
  paydays: [5, 15],
  weights: [1, 1],
  createdAt: "2026-09-01",
  archived: false,
};
const deposit = (id, amount, date, goalId = goal.id) => ({
  id,
  goalId,
  amount,
  date,
  kind: "deposit",
  note: "",
});
const entries = [
  deposit("opening", 160_000, "2026-09-05"),
  deposit("oct", 20_000, "2026-10-05"),
];

assert.deepEqual(
  validateGoal(
    { ...goal, name: " Viagem ", paydays: [15, 5], weights: [3, 1] },
    today,
  ),
  {
    name: "Viagem",
    target: 600_000,
    deadline: "2027-05-31",
    monthly: 60_000,
    paydays: [5, 15],
    weights: [1, 3],
  },
);
assert.deepEqual(
  validateGoal({ ...goal, weights: undefined }, today).weights,
  [1, 1],
);
for (const invalid of [
  null,
  {},
  { ...goal, name: " " },
  { ...goal, name: "x".repeat(81) },
  { ...goal, target: 1.5 },
  { ...goal, target: 0 },
  { ...goal, target: 1_000_000_001 },
  { ...goal, monthly: -1 },
  { ...goal, deadline: "2027-02-29" },
  { ...goal, deadline: "2026-10-09" },
  { ...goal, deadline: "2101-01-01" },
  { ...goal, paydays: [] },
  { ...goal, paydays: [5, 5] },
  { ...goal, paydays: [0] },
  { ...goal, paydays: [32] },
  { ...goal, weights: [1] },
  { ...goal, weights: [0, 1] },
  { ...goal, weights: [1.5, 1] },
]) {
  assert.throws(() => validateGoal(invalid, today));
}
assert.equal(validateGoal({ ...goal, deadline: today }, today).deadline, today);
assert.deepEqual(
  validateEntry(
    { goalId: " trip ", amount: 1, date: today, kind: "deposit", note: " a " },
    today,
  ),
  { goalId: "trip", amount: 1, date: today, kind: "deposit", note: "a" },
);
assert.equal(
  validateEntry(
    { goalId: "trip", amount: 1, date: today, kind: "withdrawal" },
    today,
  ).note,
  "",
);
for (const invalid of [
  null,
  { goalId: "", amount: 1, date: today, kind: "deposit" },
  { goalId: "trip", amount: 1, date: "2026-10-11", kind: "deposit" },
  { goalId: "trip", amount: 1, date: "2026-02-30", kind: "deposit" },
  { goalId: "trip", amount: 1, date: "1999-12-31", kind: "deposit" },
  { goalId: "trip", amount: 1.5, date: today, kind: "deposit" },
  { goalId: "trip", amount: 1, date: today, kind: "transfer" },
  {
    goalId: "trip",
    amount: 1,
    date: today,
    kind: "deposit",
    note: "x".repeat(201),
  },
]) {
  assert.throws(() => validateEntry(invalid, today));
}

assert.equal(
  goalBalance(goal, [...entries, deposit("other", 50_000, today, "party")]),
  180_000,
);
assert.equal(goalProgress(goal, entries), 30);
assert.equal(monthSaved(goal, entries, "2026-10"), 20_000);
const initial = [{ ...deposit("initial", 180_000, today), kind: "initial" }];
assert.equal(goalBalance(goal, initial), 180_000);
assert.equal(goalProgress(goal, initial), 30);
assert.equal(monthSaved(goal, initial, "2026-10"), 0);
assert.deepEqual(contributionPlan(goal, initial, "2026-10", today), {
  monthlyTarget: 60_000,
  saved: 0,
  remaining: 60_000,
  suggestions: [{ date: "2026-10-15", amount: 60_000 }],
  missingDate: false,
  minMonthly: 52_500,
});
assert.throws(() => validateEntry(initial[0], today));
const current = contributionPlan(goal, entries, "2026-10", today);
assert.equal(
  contributionPlan(goal, [deposit("large", 500_000, today)], "2026-10", today)
    .minMonthly,
  14_286,
);
assert.deepEqual(current, {
  monthlyTarget: 60_000,
  saved: 20_000,
  remaining: 40_000,
  suggestions: [{ date: "2026-10-15", amount: 40_000 }],
  missingDate: false,
  minMonthly: 55_000,
});
assert.deepEqual(
  contributionPlan(goal, entries, "2026-11", today).suggestions,
  [
    { date: "2026-11-05", amount: 30_000 },
    { date: "2026-11-15", amount: 30_000 },
  ],
);
assert.deepEqual(
  contributionPlan(goal, entries, "2026-09", today).suggestions,
  [],
);
assert.equal(
  contributionPlan(goal, entries, "2026-10", "2026-10-16").missingDate,
  true,
);
assert.equal(
  contributionPlan(goal, entries, "2026-10", "2026-10-20").minMonthly,
  60_000,
);
assert.deepEqual(
  contributionPlan(goal, entries, "2026-10", "2026-10-15").suggestions,
  [{ date: "2026-10-15", amount: 40_000 }],
);
assert.deepEqual(
  contributionPlan({ ...goal, createdAt: "2026-11-06" }, [], "2026-11", today)
    .suggestions,
  [{ date: "2026-11-15", amount: 60_000 }],
);

const weighted = contributionPlan(
  { ...goal, monthly: 10_001, weights: [1, 2] },
  [],
  "2026-11",
  today,
);
assert.deepEqual(
  weighted.suggestions.map((item) => item.amount),
  [3_334, 6_667],
);
assert.equal(
  weighted.suggestions.reduce((sum, item) => sum + item.amount, 0),
  weighted.remaining,
);
assert.deepEqual(
  contributionPlan({ ...goal, monthly: 1 }, [], "2026-11", today).suggestions,
  [{ date: "2026-11-05", amount: 1 }],
);
assert.deepEqual(
  contributionPlan(
    {
      ...goal,
      paydays: [29, 31],
      monthly: 10_001,
      weights: [1, 2],
      deadline: "2028-12-31",
    },
    [],
    "2028-02",
    today,
  ).suggestions,
  [{ date: "2028-02-29", amount: 10_001 }],
);
assert.deepEqual(
  contributionPlan(
    { ...goal, paydays: [29, 31], monthly: 10_001, weights: [1, 2] },
    [],
    "2027-02",
    today,
  ).suggestions,
  [{ date: "2027-02-28", amount: 10_001 }],
);
assert.deepEqual(
  contributionPlan({ ...goal, deadline: "2026-11-10" }, [], "2026-11", today)
    .suggestions,
  [{ date: "2026-11-05", amount: 60_000 }],
);
assert.equal(
  contributionPlan(
    { ...goal, deadline: "2026-10-14" },
    entries,
    "2026-10",
    today,
  ).minMonthly,
  null,
);
assert.equal(
  suggestMonthly(600_000, "2027-05-31", [5, 15], today, 180_000),
  52_500,
);
assert.equal(
  suggestMonthly(600_000, "2026-10-14", [5, 15], today, 180_000),
  null,
);
assert.equal(suggestMonthly(600_000, "2026-10-10", [10], today), 600_000);
assert.equal(suggestMonthly(600_000, "2027-05-31", [5, 15], today, 700_000), 0);

const withdrawn = [
  ...entries,
  { ...deposit("withdrawal", 25_000, today), kind: "withdrawal" },
];
assert.equal(goalBalance(goal, withdrawn), 155_000);
assert.equal(monthSaved(goal, withdrawn, "2026-10"), -5_000);
assert.equal(
  contributionPlan(goal, withdrawn, "2026-10", today).remaining,
  65_000,
);
assert.equal(
  contributionPlan(goal, withdrawn, "2026-10", today).minMonthly,
  55_000,
);
const withdrawnInitial = [
  ...initial,
  { ...deposit("initial-withdrawal", 10_000, today), kind: "withdrawal" },
];
assert.equal(monthSaved(goal, withdrawnInitial, "2026-10"), -10_000);
assert.equal(
  contributionPlan(goal, withdrawnInitial, "2026-10", today).minMonthly,
  52_500,
);
assert.equal(
  contributionPlan(goal, withdrawnInitial, "2026-10", "2026-10-20").minMonthly,
  61_429,
);
assert.equal(
  contributionPlan(
    goal,
    [deposit("almost", 590_000, "2026-09-05")],
    "2026-10",
    today,
  ).remaining,
  10_000,
);
assert.equal(goalProgress(goal, [deposit("over", 650_000, today)]), 100);
assert.deepEqual(
  contributionPlan(goal, [deposit("over", 650_000, today)], "2026-10", today)
    .suggestions,
  [],
);
assert.equal(
  contributionPlan(goal, [deposit("over", 650_000, today)], "2026-10", today)
    .minMonthly,
  0,
);

const currentRealDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const demo = getDemoSavings(currentRealDate.slice(0, 7));
assert.equal(demo.goals.length, 3);
assert.deepEqual(
  demo.goals.map((item) => goalBalance(item, demo.entries)),
  [180_000, 60_000, 75_000],
);
assert.ok(demo.entries.every((item) => item.date <= currentRealDate));
const futureDemo = getDemoSavings("2099-08");
assert.ok(futureDemo.entries.every((item) => item.date <= currentRealDate));

console.log(
  "Cofrinhos: validação, calendário, centavos, retiradas e sugestões conferidos.",
);
