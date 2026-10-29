import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { personalAccessUnavailable } from "../lib/app-access.ts";
import { validateCard } from "../lib/cards.ts";
import {
  categories,
  makeTransactions,
  validateTransaction,
} from "../lib/finance.ts";

// Execute the real handlers and SQL in an isolated in-memory database.
// Only authentication, the demo gate and the D1 transport are test doubles.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
for (const file of [
  "0000_wonderful_thunderbird.sql",
  "0001_cofrinhos.sql",
  "0002_perfil.sql",
])
  sqlite.exec(
    readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"),
  );
sqlite
  .prepare(
    "INSERT INTO transactions (id,userId,description,amount,date,type,category,payment,status,installment,installments,groupId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  )
  .run(
    "legacy",
    "alice",
    "Compra anterior",
    1299,
    "2024-02-15",
    "expense",
    "Compras",
    "card",
    "pending",
    1,
    1,
    null,
  );
sqlite
  .prepare(
    "INSERT INTO preferences (userId,month,goal,budgets) VALUES (?,?,?,?)",
  )
  .run("alice", "2024-02", 15000, '{"Compras":20000}');
sqlite.exec(
  readFileSync(
    new URL("../drizzle/0003_multi_cartoes.sql", import.meta.url),
    "utf8",
  ),
);
assert.equal(
  sqlite.prepare("SELECT amount FROM transactions WHERE id = 'legacy'").get()
    .amount,
  1299,
);
assert.equal(
  sqlite.prepare("SELECT cardId FROM transactions WHERE id = 'legacy'").get()
    .cardId,
  null,
);

function statement(sql, values = []) {
  return {
    bind: (...bound) => statement(sql, bound),
    async first() {
      return sqlite.prepare(sql).get(...values) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...values), meta: {} };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...values);
      return { results: [], meta: { changes: Number(r.changes) } };
    },
  };
}
globalThis.__cardsDb = {
  prepare: (sql) => statement(sql),
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const result = [];
      for (const s of statements) {
        // D1 batch returns rows for SELECT and mutation metadata otherwise.
        try {
          result.push(await s.all());
        } catch {
          result.push(await s.run());
        }
      }
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
globalThis.__cardsTest = {
  enabled: false,
  getChatGPTUser: async () => globalThis.__cardsUser,
  database: () => globalThis.__cardsDb,
  validateCard,
  categories,
  makeTransactions,
  validateTransaction,
  personalAccessUnavailable,
};
async function handlers(path) {
  const source =
    "const { getChatGPTUser, database, validateCard, categories, makeTransactions, validateTransaction, personalAccessUnavailable } = globalThis.__cardsTest;\n" +
    readFileSync(new URL(path, import.meta.url), "utf8").replaceAll(
      "!PERSONAL_ACCOUNTS_ENABLED",
      "!globalThis.__cardsTest.enabled",
    );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    transformers: {
      before: [
        () => (node) =>
          ts.factory.updateSourceFile(
            node,
            node.statements.filter(
              (statement) => !ts.isImportDeclaration(statement),
            ),
          ),
      ],
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
  );
}
try {
  const cards = await handlers("../app/api/cards/route.ts");
  const finance = await handlers("../app/api/finance/route.ts");
  async function request(
    api,
    method,
    body,
    identity = "alice",
    extraHeaders = {},
  ) {
    globalThis.__cardsUser = identity
      ? { userId: identity, email: `${identity}@example.test` }
      : null;
    const response = await api[method](
      new Request(
        `https://zelo.test/api/${api === cards ? "cards" : "finance"}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: "https://zelo.test",
            ...extraHeaders,
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
        },
      ),
    );
    return { status: response.status, data: await response.json() };
  }
  const expect = (result, status) => {
    assert.equal(result.status, status, JSON.stringify(result));
    return result.data;
  };
  for (const api of [cards, finance])
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      expect(await request(api, method), 503);
  globalThis.__cardsTest.enabled = true;
  expect(await request(cards, "GET", undefined, null), 401);
  expect(await request(cards, "POST", {}, null), 401);
  expect(
    await request(cards, "POST", {}, "alice", {
      Origin: "https://foreign.test",
    }),
    403,
  );
  expect(
    await request(cards, "POST", {}, "alice", {
      "Sec-Fetch-Site": "cross-site",
    }),
    403,
  );
  const input = {
    name: "Principal",
    creditLimit: 500000,
    closingDay: 25,
    dueDay: 5,
  };
  for (const body of [
    null,
    [],
    { ...input, creditLimit: -1 },
    { ...input, dueDay: 0 },
  ])
    expect(await request(cards, "POST", body), 400);
  const a = expect(await request(cards, "POST", input), 201).card;
  const b = expect(
    await request(cards, "POST", {
      ...input,
      name: "Compras",
      closingDay: 10,
      dueDay: 20,
    }),
    201,
  ).card;
  assert.notEqual(a.id, b.id);
  assert.equal(expect(await request(cards, "GET"), 200).cards.length, 2);
  assert.deepEqual(
    expect(await request(cards, "GET", undefined, "bob"), 200).cards,
    [],
  );
  expect(await request(cards, "PATCH", { ...input, id: a.id }, "bob"), 404);
  expect(await request(cards, "DELETE", { id: a.id }, "bob"), 404);
  const draft = {
    description: "Compra parcelada",
    amount: 1001,
    date: "2024-01-31",
    type: "expense",
    category: "Compras",
    payment: "card",
    status: "pending",
    installments: 3,
    cardId: a.id,
  };
  expect(await request(finance, "POST", { ...draft, cardId: null }), 400);
  expect(await request(finance, "POST", draft, "bob"), 404);
  expect(
    await request(finance, "POST", {
      ...draft,
      date: "2100-12-01",
      installments: 1,
    }),
    400,
  );
  const purchasesA = expect(
    await request(finance, "POST", draft),
    201,
  ).transactions;
  const purchasesB = expect(
    await request(finance, "POST", { ...draft, cardId: b.id }),
    201,
  ).transactions;
  assert.deepEqual(
    purchasesA.map((r) => r.date),
    ["2024-03-05", "2024-04-05", "2024-05-05"],
  );
  assert.deepEqual(
    purchasesB.map((r) => r.date),
    ["2024-02-20", "2024-03-20", "2024-04-20"],
  );
  assert.deepEqual(
    purchasesA.map((r) => r.amount),
    [334, 334, 333],
  );
  assert.ok(
    purchasesA.every(
      (r) => r.cardId === a.id && r.purchaseDate === "2024-01-31",
    ),
  );
  const read = expect(await request(finance, "GET"), 200);
  assert.equal(read.transactions.length, 7);
  assert.equal(read.cards.length, 2);
  assert.equal(read.settings["2024-02"].goal, 15000);
  assert.equal(read.settings["2024-02"].budgets.Compras, 20000);
  assert.deepEqual(
    expect(await request(finance, "GET", undefined, "bob"), 200).transactions,
    [],
  );
  expect(
    await request(
      finance,
      "PATCH",
      { id: purchasesA[0].id, statusOnly: true, status: "paid" },
      "bob",
    ),
    404,
  );
  expect(
    await request(finance, "PATCH", {
      id: purchasesA[0].id,
      statusOnly: true,
      status: "paid",
    }),
    200,
  );
  expect(await request(cards, "DELETE", { id: a.id }), 409);
  expect(
    await request(cards, "PATCH", {
      ...input,
      id: a.id,
      closingDay: 15,
      dueDay: 28,
    }),
    200,
  );
  const after = expect(await request(finance, "GET"), 200);
  assert.equal(
    after.transactions.find((r) => r.id === purchasesA[0].id).date,
    "2024-03-05",
  );
  const linked = expect(
    await request(finance, "PATCH", {
      ...draft,
      id: "legacy",
      cardId: b.id,
      amount: 1299,
      date: "2024-02-15",
      installments: 1,
    }),
    200,
  ).transaction;
  assert.equal(linked.cardId, b.id);
  assert.equal(linked.date, "2024-02-15");
  assert.equal(linked.purchaseDate, null);
  const foreign = expect(await request(cards, "POST", input, "bob"), 201).card;
  expect(
    await request(finance, "PATCH", {
      ...draft,
      id: "legacy",
      cardId: foreign.id,
      installments: 1,
    }),
    404,
  );
  assert.throws(
    () =>
      sqlite
        .prepare("UPDATE transactions SET cardId = ? WHERE id = 'legacy'")
        .run(foreign.id),
    /FOREIGN KEY/,
  );
  expect(await request(cards, "DELETE", { id: foreign.id }, "bob"), 200);
  const c = expect(await request(cards, "POST", input), 201).card;
  expect(await request(cards, "DELETE", { id: c.id }), 200);
  expect(await request(cards, "DELETE", { id: c.id }), 404);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  console.log(
    "OK: migração preserva histórico e preferências; CRUD de cartões, compras parceladas por cartão, autenticação, bloqueio da demo, isolamento por usuário, vínculo do legado, integridade referencial e vencimentos preservados.",
  );
} finally {
  sqlite.close();
  delete globalThis.__cardsTest;
  delete globalThis.__cardsDb;
  delete globalThis.__cardsUser;
}
