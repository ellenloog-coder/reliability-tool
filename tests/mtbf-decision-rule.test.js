import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMTBFTarget,
  toLegacyMTBFTargetDecision
} from "../src/reliability/decision/mtbf-rule.js";
import { compareTargetMTBF } from "../src/reliability/mtbf.js";

test("MTBF rule returns meets target", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: 2000, estimable: true, failureCount: 5 },
    { targetMTBF: 1500 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
  assert.deepEqual(decision.reasonCodes, ["MTBF_MEETS_TARGET_POINT_ESTIMATE"]);
  assert.deepEqual(decision.requirement, { targetMTBF: 1500 });
  assert.equal(decision.actualValue, 2000);
});

test("MTBF rule returns below target", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: 1200, estimable: true, failureCount: 5 },
    { targetMTBF: 1500 }
  );

  assert.equal(decision.status, "DOES_NOT_MEET_REQUIREMENT");
  assert.deepEqual(decision.reasonCodes, ["MTBF_BELOW_TARGET_POINT_ESTIMATE"]);
});

test("MTBF rule treats equal boundary as met", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: 1500, estimable: true },
    { targetMTBF: 1500 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
});

test("MTBF rule returns not evaluated for missing requirement", () => {
  const decision = evaluateMTBFTarget({ mtbf: 1500 }, { targetMTBF: "" });

  assert.equal(decision.status, "NOT_EVALUATED");
  assert.deepEqual(decision.reasonCodes, ["TARGET_MTBF_NOT_PROVIDED"]);
  assert.deepEqual(decision.requirement, { targetMTBF: null });
});

test("MTBF rule returns zero-failure review without infinity", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: null, estimable: false, failureCount: 0 },
    { targetMTBF: 1000 }
  );

  assert.equal(decision.status, "REVIEW_REQUIRED");
  assert.deepEqual(
    decision.reasonCodes,
    ["MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"]
  );
  assert.equal(decision.actualValue, null);
  assert.equal(JSON.stringify(decision).includes("Infinity"), false);
});

test("MTBF rule rejects invalid metrics", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: Number.NaN, estimable: true, failureCount: 2 },
    { targetMTBF: 1000 }
  );

  assert.equal(decision.status, "REVIEW_REQUIRED");
  assert.deepEqual(decision.reasonCodes, ["MTBF_METRIC_INVALID"]);
});

test("MTBF rule tolerates machine-precision boundary noise", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: 0.3, estimable: true },
    { targetMTBF: 0.1 + 0.2 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
});

test("legacy MTBF comparison delegates to the new rule", () => {
  const decision = evaluateMTBFTarget(
    { mtbf: 1200 },
    { targetMTBF: 1500 }
  );

  assert.deepEqual(
    compareTargetMTBF(1200, 1500),
    toLegacyMTBFTargetDecision(decision)
  );
  assert.deepEqual(compareTargetMTBF(null, 1000), {
    status: "Not Estimable",
    message: "Target comparison not performed because the MTBF point estimate is not available."
  });
});
