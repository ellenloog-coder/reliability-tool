import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verificationRoot = resolve(root, "verification");

test("Demonstration numerical verification is read-only and passes against independent reference", () => {
  const before = snapshotFiles(verificationRoot);

  execFileSync("python3", ["verification/demonstration_reference.py", "--verify"], { cwd: root, stdio: "pipe" });
  execFileSync("node", ["verification/compare-demonstration-numerics.js", "--verify"], { cwd: root, stdio: "pipe" });

  const after = snapshotFiles(verificationRoot);
  assert.deepEqual(after, before, "verify mode must not create, remove, or modify verification files");

  const fixtures = JSON.parse(readFileSync(resolve(root, "verification/fixtures/demonstration-fixtures.json"), "utf8"));
  const expected = JSON.parse(readFileSync(resolve(root, "verification/fixtures/demonstration-expected-results.json"), "utf8"));

  assert(fixtures.length >= 60);
  assert.equal(expected.length, fixtures.length);
  assert(fixtures.some(item => item.fixtureId === "sample_plan_max_guard"));
  assert(fixtures.some(item => item.fixtureId === "time_eval_zero_point_not_estimable"));
});

function snapshotFiles(directory) {
  const snapshot = {};
  for (const path of walkFiles(directory)) {
    snapshot[relative(directory, path)] = createHash("sha256").update(readFileSync(path)).digest("hex");
  }
  return snapshot;
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return statSync(path).isFile() ? [path] : [];
  });
}
