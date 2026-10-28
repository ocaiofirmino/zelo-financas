import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const excluded = new Set([
  ".github/workflows/style-preview.yml",
  "scripts/style-preview-format.mjs",
  "scripts/style-preview-browser.mjs",
]);
const paths = execFileSync("git", ["diff", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter((path) => path && !excluded.has(path));
const files = Object.fromEntries(paths.map((path) => [path, readFileSync(path, "utf8")]));
const bytes = Buffer.from(JSON.stringify({ files }));
const data = bytes.toString("base64");
console.log("ZELO_FORMAT_META:" + JSON.stringify({ paths, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }));
for (let i = 0; i < data.length; i += 4096) console.log("ZELO_FORMAT_CHUNK:" + String(i / 4096).padStart(5, "0") + ":" + data.slice(i, i + 4096));
