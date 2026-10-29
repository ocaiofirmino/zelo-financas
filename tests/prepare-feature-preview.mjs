import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";

// Build a disposable copy. Public source files and their access gate stay untouched.
const target = resolve(".sites-runtime/feature-preview");
assert.ok(
  existsSync(resolve("demo/node_modules")),
  "Instale as dependências da demo antes de preparar a prévia.",
);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const name of [
  "app",
  "lib",
  "components",
  "hooks",
  "public",
  "vendor",
  "demo",
]) {
  cpSync(resolve(name), join(target, name), {
    recursive: true,
    filter: (path) =>
      !["node_modules", "dist", ".git"].includes(path.split(/[\\/]/).at(-1)),
  });
}
symlinkSync(
  resolve("demo/node_modules"),
  join(target, "demo/node_modules"),
  "dir",
);
const accessPath = join(target, "lib/app-access.ts");
const access = readFileSync(accessPath, "utf8");
assert.ok(access.includes("PERSONAL_ACCOUNTS_ENABLED = false"));
writeFileSync(
  accessPath,
  access.replace(
    "PERSONAL_ACCOUNTS_ENABLED = false",
    "PERSONAL_ACCOUNTS_ENABLED = true",
  ),
);
const entryPath = join(target, "demo/src/main.tsx");
const entry = readFileSync(entryPath, "utf8");
const editable = entry.replace(/\bpreviewOnly(?=\s*\n)/, "previewOnly={false}");
assert.notEqual(
  entry,
  editable,
  "A entrada da demo mudou; revise a preparação do teste.",
);
writeFileSync(entryPath, editable);
assert.ok(
  readFileSync(resolve("lib/app-access.ts"), "utf8").includes(
    "PERSONAL_ACCOUNTS_ENABLED = false",
  ),
);
console.log(
  "Prévia isolada preparada com exemplos em memória; acesso pessoal público preservado.",
);
