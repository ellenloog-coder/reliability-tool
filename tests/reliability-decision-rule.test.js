import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateReliabilityTarget,
  toLegacyReliabilityTargetDecision
} from "../src/reliability/decision/reliability-rule.js";
import { compareReliabilityTarget } from "../src/reliability/metrics.js";

test("Reliability target rule returns met decision", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.95 },
    { targetReliability: 0.90 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
  assert.deepEqual(decision.reasonCodes, ["MISSION_RELIABILITY_MEETS_TARGET"]);
  assert.deepEqual(decision.requirement, { targetReliability: 0.9 });
  assert.equal(decision.actualValue, 0.95);
});

test("Reliability target rule returns not-met decision", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.85 },
    { targetReliability: 0.90 }
  );

  assert.equal(decision.status, "DOES_NOT_MEET_REQUIREMENT");
  assert.deepEqual(decision.reasonCodes, ["MISSION_RELIABILITY_BELOW_TARGET"]);
});

test("Reliability target rule treats exact equality as met", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.9 },
    { targetReliability: 0.9 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
});

test("Reliability target rule returns not evaluated when target is missing", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.95 },
    { targetReliability: "" }
  );

  assert.equal(decision.status, "NOT_EVALUATED");
  assert.deepEqual(decision.reasonCodes, ["TARGET_RELIABILITY_NOT_PROVIDED"]);
  assert.deepEqual(decision.requirement, { targetReliability: null });
});

test("Reliability target rule tolerates machine-precision boundary noise", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.3 },
    { targetReliability: 0.1 + 0.2 }
  );

  assert.equal(decision.status, "MEETS_REQUIREMENT");
});

test("legacy comparison contract delegates to the new rule", () => {
  const decision = evaluateReliabilityTarget(
    { missionReliability: 0.85 },
    { targetReliability: 0.9 }
  );

  assert.deepEqual(
    compareReliabilityTarget(0.85, 0.9),
    toLegacyReliabilityTargetDecision(decision)
  );
  assert.deepEqual(compareReliabilityTarget(0.95, ""), {
    status: "Target not provided",
    message: "Reliability risk not assessed — no target reliability was provided."
  });
});
