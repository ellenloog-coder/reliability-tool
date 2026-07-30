import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

import {
  verifyFrozenBrowserEngineBaseline
} from "../verification/browser-engine-baseline.mjs";

const manifest = JSON.parse(readFileSync(
  new URL(
    "../verification/baselines/browser-engine-v1/manifest.json",
    import.meta.url
  ),
  "utf8"
));

test("frozen browser Engine baseline metadata identifies the dirty local reference", () => {
  assert.equal(
    manifest.baseline_id,
    "browser-engine-reference-v1-20260730-dirty-53ce11e"
  );
  assert.equal(manifest.git.working_tree_state, "DIRTY");
  assert.equal(
    manifest.git.commit,
    "53ce11ea9a1f4632a0fed7fc3b07f7c5104c4c8a"
  );
  assert.deepEqual(
    manifest.reference.modules,
    ["life-data", "mtbf", "demonstration"]
  );
  assert.deepEqual(manifest.reference.excluded_modules, ["alt"]);
});

test("current browser Engines reproduce the frozen migration baseline", () => {
  const files = [
    "../verification/baselines/browser-engine-v1/manifest.json",
    "../verification/baselines/browser-engine-v1/life-data.json",
    "../verification/baselines/browser-engine-v1/mtbf.json",
    "../verification/baselines/browser-engine-v1/demonstration.json"
  ].map(path => new URL(path, import.meta.url));
  const mtimesBefore = files.map(file => statSync(file).mtimeMs);
  const result = verifyFrozenBrowserEngineBaseline();
  const mtimesAfter = files.map(file => statSync(file).mtimeMs);
  assert.deepEqual(result.modules, ["life-data", "mtbf", "demonstration"]);
  assert(result.cases["life-data"] >= 8);
  assert(result.cases.mtbf >= 9);
  assert(result.cases.demonstration >= 9);
  assert.deepEqual(mtimesAfter, mtimesBefore);
});

test("baseline policy freezes nullability, finite values, tolerances, and language boundary", () => {
  assert.equal(manifest.comparison_policy.non_finite_numbers, "forbidden");
  assert.equal(manifest.comparison_policy.missing_fields.includes("not equivalent"), true);
  assert.equal(manifest.output_rules.invalid_validation.calculation, null);
  assert.equal(manifest.output_rules.invalid_validation.decision, null);
  assert.equal(manifest.output_rules.invalid_validation.insight, null);
  assert.equal(
    manifest.authority_boundary.localization_rule.includes("language-neutral"),
    true
  );
});
