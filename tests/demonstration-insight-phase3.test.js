import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDemoInsight,
  buildStructuredDemoInsight
} from "../src/reliability/demonstration/insight.js";
import { evaluateBinomialDemonstration } from "../src/reliability/demonstration/sample-demonstration.js";
import { analyzeDemonstration } from "../src/reliability/engine/demonstration-engine.js";

const validation = { status: "VALID", errors: [], warnings: [] };

function sampleCalculation() {
  return {
    model: "Exact Binomial",
    metrics: {
      reliabilityLowerBound: 0.99,
      achievedConfidenceAtTarget: 0.99
    },
    evidence: {
      unitsTested: 30,
      observedFailures: 0,
      evidenceGap: { additionalUnitsRequired: 0 }
    },
    requirement: {
      targetReliability: 0.9,
      requiredConfidence: 0.9
    },
    assumptions: {}
  };
}

function decision(overrides = {}) {
  return {
    status: "DEMONSTRATED",
    reasonCodes: [
      "RELIABILITY_LOWER_BOUND_MEETS_TARGET",
      "ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT"
    ],
    evidenceGap: { status: "SATISFIED" },
    limitations: [],
    ...overrides
  };
}

test("structured Insight follows Decision status instead of recalculating target", () => {
  const insight = buildStructuredDemoInsight({
    validation,
    calculation: sampleCalculation(),
    decision: decision({
      status: "NOT_DEMONSTRATED",
      reasonCodes: ["RELIABILITY_LOWER_BOUND_BELOW_TARGET"],
      evidenceGap: { status: "SATISFIED" }
    })
  });

  assert.equal(
    insight.parameters.resultText,
    "Target not demonstrated at the selected confidence level"
  );
  assert(insight.explanationKeys.includes(
    "Target not demonstrated at the selected confidence level"
  ));
});

test("structured Insight consumes Decision evidence-gap status", () => {
  const calculation = sampleCalculation();
  calculation.evidence.evidenceGap.additionalUnitsRequired = 0;
  const insight = buildStructuredDemoInsight({
    validation,
    calculation,
    decision: decision({
      status: "NOT_DEMONSTRATED",
      evidenceGap: { status: "GAP_REMAINS" }
    })
  });

  assert(insight.recommendationKeys.includes(
    "Continue testing to close the evidence gap"
  ));
  assert.equal(insight.parameters.evidenceGapStatus, "GAP_REMAINS");
});

test("structured Insight passes through Decision limitations", () => {
  const insight = buildStructuredDemoInsight({
    validation,
    calculation: {
      ...sampleCalculation(),
      model: "Exponential / Poisson"
    },
    decision: decision({
      limitations: ["MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"]
    })
  });

  assert(insight.limitations.includes(
    "MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"
  ));
  assert(insight.recommendationKeys.includes(
    "Use the lower confidence bound instead of an infinite point estimate"
  ));
});

test("legacy Insight adapter preserves current page text fields", () => {
  const result = evaluateBinomialDemonstration({
    unitsTested: 30,
    observedFailures: 0,
    targetReliability: 0.9,
    confidenceLevel: 0.9
  });
  const insight = buildDemoInsight({
    result,
    method: "sample",
    workflow: "evaluate"
  });

  assert.equal(
    insight.result,
    "Target demonstrated at the selected confidence level"
  );
  assert.match(insight.evidence, /Reliability lower bound is/);
  assert(Array.isArray(insight.explanationKeys));
  assert(Array.isArray(insight.recommendationKeys));
  assert(Array.isArray(insight.limitations));
  assert.equal(typeof insight.parameters, "object");
});

test("Demonstration Facade returns structured Insight", () => {
  const result = analyzeDemonstration({
    method: "sample",
    workflow: "evaluate",
    inputs: {
      unitsTested: 30,
      observedFailures: 0,
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      allowableFailures: 0,
      timeUnit: "hours"
    }
  });

  assert.equal(result.insight.parameters.decisionStatus, "DEMONSTRATED");
  assert(result.insight.explanationKeys.length > 0);
  assert(result.insight.recommendationKeys.length > 0);
});
