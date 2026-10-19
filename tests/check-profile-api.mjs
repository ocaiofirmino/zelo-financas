import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { personalAccessUnavailable } from "../lib/app-access.ts";
import { emptyProfile, demoProfile, validateProfile } from "../lib/profile.ts";

// Exercise the real route handlers and SQL in an isolated in-memory database.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(
  readFileSync(new URL("../drizzle/0002_perfil.sql", import.meta.url), "utf8"),
);
let actor = null;
const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {
      bind(...values) {
        return {
          async first() {
            return statement.get(...values) || null;
          },
          async run() {
            return statement.run(...values);
          },
        };
      },
    };
  },
};
globalThis.__zeloProfileTest = {
  getChatGPTUser: async () => actor,
  database: () => db,
  emptyProfile,
  validateProfile,
  PERSONAL_ACCOUNTS_ENABLED: true,
  personalAccessUnavailable,
};
let source = readFileSync(
  new URL("../app/api/profile/route.ts", import.meta.url),
  "utf8",
);
source = source.replace(/^import .*;$/gm, "");
source =
  "const { getChatGPTUser, database, emptyProfile, validateProfile, PERSONAL_ACCOUNTS_ENABLED, personalAccessUnavailable } = globalThis.__zeloProfileTest;\n" +
  source;
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { GET, PUT } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const request = (body, extra = {}) =>
  new Request("http://zelo.local/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://zelo.local",
      ...extra,
    },
    body: JSON.stringify(body),
  });
try {
  const blockedSource = compiled
    .replace(
      "PERSONAL_ACCOUNTS_ENABLED, personalAccessUnavailable }",
      "personalAccessUnavailable }",
    )
    .replaceAll("!PERSONAL_ACCOUNTS_ENABLED", "true");
  const blocked = await import(
    "data:text/javascript;base64," +
      Buffer.from(blockedSource).toString("base64")
  );
  assert.equal((await blocked.GET()).status, 503);
  assert.equal((await blocked.PUT(request(demoProfile))).status, 503);
  assert.equal((await GET()).status, 401);
  assert.equal((await PUT(request(demoProfile))).status, 401);
  actor = {
    userId: "profile-test-a",
    fullName: "Ana Silva",
    email: "ana@example.test",
  };
  const initial = await GET();
  assert.match(initial.headers.get("cache-control"), /no-store/);
  assert.equal((await initial.json()).profile.preferredName, "Ana");
  const avatar =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1kAAAAASUVORK5CYII=";
  const draft = {
    ...demoProfile,
    preferredName: "Ana",
    monthlySalary: 450050,
    paydays: [20, 5],
    avatar,
    userId: "profile-test-b",
  };
  assert.equal((await PUT(request(draft))).status, 200);
  let read = await (await GET()).json();
  assert.equal(read.profile.monthlySalary, 450050);
  assert.deepEqual(read.profile.paydays, [5, 20]);
  assert.equal(read.profile.avatar, avatar);
  assert.equal(read.accountEmail, "ana@example.test");
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS total FROM profiles WHERE userId = ?")
      .get("profile-test-b").total,
    0,
  );
  actor = {
    userId: "profile-test-b",
    fullName: "Bruno Lima",
    email: "bruno@example.test",
  };
  assert.equal((await (await GET()).json()).profile.preferredName, "Bruno");
  assert.equal(
    (
      await PUT(
        request({
          ...demoProfile,
          preferredName: "Bruno",
          monthlySalary: null,
          avatar: "",
        }),
      )
    ).status,
    200,
  );
  actor = {
    userId: "profile-test-a",
    fullName: "Ana Silva",
    email: "ana@example.test",
  };
  read = await (await GET()).json();
  assert.equal(read.profile.preferredName, "Ana");
  assert.equal(read.profile.monthlySalary, 450050);
  assert.equal(
    (await PUT(request(draft, { Origin: "https://other.example" }))).status,
    403,
  );
  assert.equal(
    (await PUT(request(draft, { "Sec-Fetch-Site": "cross-site" }))).status,
    403,
  );
  for (const change of [
    { monthlySalary: -1 },
    { monthlySalary: 1.5 },
    { paydays: [5, 5] },
    { paydays: [32] },
    { preferredName: " " },
    { avatar: "data:image/svg+xml;base64,PHN2Zz4=" },
    { email: "invalid" },
  ]) {
    assert.equal((await PUT(request({ ...draft, ...change }))).status, 400);
  }
  assert.equal(
    (await PUT(request(draft, { "Content-Length": "250001" }))).status,
    413,
  );
  assert.equal(
    (
      await PUT(
        new Request("http://zelo.local/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal((await (await GET()).json()).profile.preferredName, "Ana");
  console.log(
    "API de perfil: persistência, foto, centavos, quinzena, autenticação e isolamento entre usuários OK.",
  );
} finally {
  sqlite.close();
  delete globalThis.__zeloProfileTest;
}
