import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateDemonstrationDecision,
  evaluateDemonstrationResult
} from "../src/reliability/decision/demonstration-rule.js";
import {
  evaluateBinomialDemonstration
} from "../src/reliability/demonstration/sample-demonstration.js";
import {
  evaluateExponentialDemonstration,
  planExponentialDemonstration
} from "../src/reliability/demonstration/time-demonstration.js";

test("Sample Decision returns demonstrated", () => {
  const result = evaluateBinomialDemonstration({
    unitsTested: 30,
    observedFailures: 0,
    targetReliability: 0.9,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert.equal(decision.status, "DEMONSTRATED");
  assert.equal(decision.existingDecision.demonstrated, true);
  assert(decision.reasonCodes.includes("RELIABILITY_LOWER_BOUND_MEETS_TARGET"));
});

test("Sample Decision returns not demonstrated with evidence gap", () => {
  const result = evaluateBinomialDemonstration({
    unitsTested: 10,
    observedFailures: 0,
    targetReliability: 0.9,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert.equal(decision.status, "NOT_DEMONSTRATED");
  assert.equal(decision.existingDecision.demonstrated, false);
  assert.equal(decision.evidenceGap.status, "GAP_REMAINS");
  assert(decision.evidenceGap.additionalUnitsRequired > 0);
  assert(decision.reasonCodes.includes("EVIDENCE_GAP_REMAINS"));
});

test("Time Decision returns demonstrated", () => {
  const result = evaluateExponentialDemonstration({
    totalTestTime: 3000,
    observedFailures: 0,
    targetMTBF: 1000,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert.equal(decision.status, "DEMONSTRATED");
  assert.equal(decision.existingDecision.demonstrated, true);
  assert(decision.reasonCodes.includes("MTBF_LOWER_BOUND_MEETS_TARGET"));
});

test("Time Decision returns not demonstrated", () => {
  const result = evaluateExponentialDemonstration({
    totalTestTime: 1000,
    observedFailures: 0,
    targetMTBF: 1000,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert.equal(decision.status, "NOT_DEMONSTRATED");
  assert.equal(decision.existingDecision.demonstrated, false);
  assert.equal(decision.evidenceGap.status, "GAP_REMAINS");
});

test("Time zero-failure Decision preserves valid evidence and point-estimate limitation", () => {
  const result = evaluateExponentialDemonstration({
    totalTestTime: 3000,
    observedFailures: 0,
    targetMTBF: 1000,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert(decision.reasonCodes.includes("ZERO_OBSERVED_FAILURES"));
  assert(decision.limitations.includes(
    "MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"
  ));
  assert.equal(decision.actualEvidence.observedFailures, 0);
});

test("Decision returns not evaluated for missing target", () => {
  const decision = evaluateDemonstrationDecision({
    method: "sample",
    workflow: "evaluate",
    metrics: {
      reliabilityLowerBound: 0.9,
      achievedConfidenceAtTarget: 0.9
    },
    evidence: { unitsTested: 22, observedFailures: 0 },
    requirement: { requiredConfidence: 0.9 }
  });

  assert.equal(decision.status, "NOT_EVALUATED");
  assert.deepEqual(
    decision.reasonCodes,
    ["TARGET_RELIABILITY_MISSING_OR_INVALID"]
  );
});

test("Sample Decision treats tolerance boundary as demonstrated", () => {
  const decision = evaluateDemonstrationDecision({
    method: "sample",
    workflow: "evaluate",
    metrics: {
      reliabilityLowerBound: 0.9 - 5e-11,
      achievedConfidenceAtTarget: 0.9
    },
    evidence: {
      unitsTested: 22,
      observedFailures: 0,
      evidenceGap: { additionalUnitsRequired: 0, requiredTotalUnits: 22 }
    },
    requirement: {
      targetReliability: 0.9,
      requiredConfidence: 0.9
    }
  });

  assert.equal(decision.status, "DEMONSTRATED");
  assert.equal(decision.evidenceGap.status, "SATISFIED");
});

test("Time Decision treats exact required exposure boundary as demonstrated", () => {
  const plan = planExponentialDemonstration({
    targetMTBF: 1000,
    confidenceLevel: 0.9,
    allowableFailures: 0
  });
  const result = evaluateExponentialDemonstration({
    totalTestTime: plan.requiredTotalTestTime,
    observedFailures: 0,
    targetMTBF: 1000,
    confidenceLevel: 0.9
  });
  const decision = evaluateDemonstrationResult(result);

  assert.equal(decision.status, "DEMONSTRATED");
  assert.equal(decision.evidenceGap.status, "SATISFIED");
});
