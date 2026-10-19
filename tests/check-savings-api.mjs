import assert from "node:assert/strict";

const base = (
  process.env.TEST_BASE_URL ||
  process.argv[2] ||
  "http://127.0.0.1:5174"
).replace(/\/$/, "");
const url = `${base}/api/savings`;
const origin = new URL(base).origin;
const user = `qa-savings-${crypto.randomUUID()}`;
const otherUser = `${user}-other`;
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const datePart = (name) => parts.find((part) => part.type === name).value;
const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
const dayAfter = (days) =>
  new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
const goalDraft = {
  name: "Viagem QA",
  target: 100000,
  deadline: dayAfter(365),
  monthly: 10000,
  paydays: [5, 15],
  weights: [1, 1],
};

async function request(
  method,
  body,
  identity = user,
  path = url,
  extraHeaders = {},
) {
  const response = await fetch(path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "oai-authenticated-user-id": identity,
      "oai-authenticated-user-email": `${identity}@example.test`,
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `${method} ${path}: HTTP ${response.status}, ${text.slice(0, 300)}`,
    );
  }
  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

function status(result, expected) {
  assert.equal(result.status, expected, JSON.stringify(result.data));
}

async function newGoal(draft, identity = user) {
  const result = await request(
    "POST",
    { action: "goal", ...goalDraft, ...draft },
    identity,
  );
  status(result, 201);
  return result.data;
}

async function newEntry(goalId, amount, kind = "deposit", identity = user) {
  return request(
    "POST",
    {
      action: "entry",
      goalId,
      amount,
      date: today,
      kind,
      note: "Registro fictício de teste",
    },
    identity,
  );
}

async function cleanup(identity) {
  const read = await request("GET", undefined, identity);
  if (read.status !== 200) return;
  // Só removemos registros das identidades fictícias criadas nesta execução.
  const sorted = [...read.data.entries].sort(
    (a, b) =>
      (a.kind === "withdrawal" ? 0 : 1) - (b.kind === "withdrawal" ? 0 : 1),
  );
  for (const entry of sorted)
    status(
      await request("DELETE", { action: "entry", id: entry.id }, identity),
      200,
    );
  for (const goal of read.data.goals)
    status(
      await request("DELETE", { action: "goal", id: goal.id }, identity),
      200,
    );
}

try {
  const anonymous = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(anonymous.status, 401);
  await anonymous.text();
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  );
  const financeBefore = await request(
    "GET",
    undefined,
    user,
    `${base}/api/finance`,
  );
  status(financeBefore, 200);

  status(
    await request("POST", { action: "goal", ...goalDraft, target: -1 }),
    400,
  );
  status(
    await request("POST", { action: "goal", ...goalDraft, initialAmount: 1.5 }),
    400,
  );
  status(
    await request("POST", { action: "goal", ...goalDraft, paydays: [5, 5] }),
    400,
  );

  const created = await newGoal({ initialAmount: 1000 });
  const goalId = created.goal.id;
  assert.equal(created.entries.length, 1);
  assert.equal(created.entries[0].amount, 1000);
  assert.equal(created.entries[0].kind, "initial");
  assert.equal(created.entries[0].date, today);
  assert.equal(created.goal.archived, false);
  const deposit = await newEntry(goalId, 2000);
  status(deposit, 201);
  const withdrawal = await newEntry(goalId, 2500, "withdrawal");
  status(withdrawal, 201);
  status(await newEntry(goalId, 501, "withdrawal"), 409);
  status(
    await request("DELETE", { action: "entry", id: deposit.data.entry.id }),
    409,
  );
  status(
    await request("DELETE", { action: "entry", id: created.entries[0].id }),
    409,
  );
  status(await request("DELETE", { action: "goal", id: goalId }), 409);
  status(
    await request("POST", {
      action: "entry",
      goalId,
      amount: 100,
      date: dayAfter(1),
      kind: "deposit",
      note: "",
    }),
    400,
  );
  status(await newEntry(goalId, -100), 400);
  status(await newEntry(goalId, 100.5), 400);
  status(await newEntry(goalId, 100, "initial"), 400);

  const reload = await request("GET");
  status(reload, 200);
  assert.equal(reload.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    reload.data.goals.find((goal) => goal.id === goalId).paydays,
    [5, 15],
  );
  assert.deepEqual(
    reload.data.goals.find((goal) => goal.id === goalId).weights,
    [1, 1],
  );
  assert.equal(
    reload.data.entries.filter((entry) => entry.goalId === goalId).length,
    3,
  );

  const edit = await request("PATCH", {
    id: goalId,
    ...goalDraft,
    name: "Viagem editada",
    monthly: 12000,
    weights: [1, 2],
  });
  status(edit, 200);
  assert.equal(edit.data.goal.name, "Viagem editada");
  assert.equal(edit.data.goal.createdAt, created.goal.createdAt);
  assert.deepEqual((await request("GET")).data.entries, reload.data.entries);

  const isolated = await request("GET", undefined, otherUser);
  status(isolated, 200);
  assert.deepEqual(isolated.data, { goals: [], entries: [] });
  status(await newEntry(goalId, 100, "deposit", otherUser), 404);
  status(await request("PATCH", { id: goalId, ...goalDraft }, otherUser), 404);
  status(
    await request("PATCH", { id: goalId, archived: true }, otherUser),
    404,
  );
  status(
    await request("DELETE", { action: "goal", id: goalId }, otherUser),
    404,
  );
  status(
    await request(
      "DELETE",
      { action: "entry", id: deposit.data.entry.id },
      otherUser,
    ),
    404,
  );

  status(await request("PATCH", { id: goalId, archived: true }), 200);
  status(await newEntry(goalId, 100), 409);
  assert.equal(
    (await request("GET")).data.goals.find((goal) => goal.id === goalId)
      .archived,
    true,
  );
  status(await request("PATCH", { id: goalId, archived: false }), 200);
  status(await newEntry(goalId, 100), 201);

  const festa = await newGoal({ name: "Festa QA", initialAmount: 5000 });
  const celular = await newGoal({ name: "Celular QA" });
  assert.equal((await request("GET")).data.goals.length, 3);
  status(await request("DELETE", { action: "goal", id: celular.goal.id }), 200);
  status(await request("DELETE", { action: "goal", id: celular.goal.id }), 404);

  // Teste concorrente: apenas uma retirada pode consumir estes R$ 50.
  const concurrent = await Promise.all([
    newEntry(festa.goal.id, 4000, "withdrawal"),
    newEntry(festa.goal.id, 4000, "withdrawal"),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [201, 409],
  );
  const finalRead = await request("GET");
  const balance = finalRead.data.entries
    .filter((entry) => entry.goalId === festa.goal.id)
    .reduce(
      (sum, entry) =>
        sum + (entry.kind === "withdrawal" ? -entry.amount : entry.amount),
      0,
    );
  assert.equal(balance, 1000);

  status(
    await request("DELETE", { action: "entry", id: withdrawal.data.entry.id }),
    200,
  );
  status(
    await request("DELETE", { action: "entry", id: deposit.data.entry.id }),
    200,
  );
  assert.deepEqual(
    (await request("GET", undefined, user, `${base}/api/finance`)).data,
    financeBefore.data,
  );
  console.log(
    "OK: cofrinhos persistidos, saldo inicial, histórico, edição, arquivamento, isolamento, desfazer movimentos, datas e retiradas concorrentes; receitas/despesas preservadas.",
  );
} finally {
  await cleanup(user);
  await cleanup(otherUser);
}

status(
  await request("POST", { action: "goal", ...goalDraft }, user, url, {
    Origin: "https://foreign.example.test",
  }),
  403,
);
console.log("OK: requisições de outra origem rejeitadas.");
