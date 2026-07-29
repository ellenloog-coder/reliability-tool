import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMTBFInsight,
  buildStructuredMTBFInsight
} from "../src/reliability/mtbf-insight.js";
import { analyzeMTBF } from "../src/reliability/engine/mtbf-engine.js";

function input(failureCount = 4) {
  return {
    status: "VALID",
    errors: [],
    warnings: [],
    normalizedInput: {
      totalExposure: 10000,
      failureCount
    }
  };
}

function calculation(mtbf = 2500) {
  return {
    status: "COMPLETED",
    model: "Exponential / constant failure-rate assumption",
    metrics: {
      mtbf,
      mtbfLowerBound: null,
      missionReliability: mtbf == null ? null : Math.exp(-100 / mtbf),
      failureRate: mtbf == null ? null : 1 / mtbf
    }
  };
}

test("structured MTBF Insight follows target Decision instead of comparing metrics", () => {
  const insight = buildStructuredMTBFInsight({
    validation: input(),
    calculation: calculation(100),
    decision: {
      status: "MEETS_REQUIREMENT",
      reasonCodes: ["MTBF_MEETS_TARGET_POINT_ESTIMATE"]
    }
  });

  assert.equal(
    insight.parameters.resultText,
    "Observed MTBF meets the target point estimate"
  );
  assert.equal(insight.parameters.decisionStatus, "MEETS_REQUIREMENT");
});

test("structured MTBF Insight uses zero-failure Decision reason code", () => {
  const insight = buildStructuredMTBFInsight({
    validation: input(8),
    calculation: calculation(2500),
    decision: {
      status: "REVIEW_REQUIRED",
      reasonCodes: ["MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"]
    }
  });

  assert.equal(insight.parameters.resultText, "MTBF point estimate not available");
  assert(
    insight.recommendationKeys.includes(
      "Use Reliability Demonstration for zero-failure test evaluation."
    )
  );
});

test("structured MTBF Insight uses invalid-metric Decision without validating metrics", () => {
  const insight = buildStructuredMTBFInsight({
    validation: input(),
    calculation: calculation(2500),
    decision: {
      status: "REVIEW_REQUIRED",
      reasonCodes: ["MTBF_METRIC_INVALID"]
    }
  });

  assert.equal(insight.parameters.decisionStatus, "REVIEW_REQUIRED");
  assert.deepEqual(insight.parameters.decisionReasonCodes, ["MTBF_METRIC_INVALID"]);
  assert(insight.recommendationKeys.includes("Review failure classification."));
});

test("legacy MTBF Insight adapter preserves page and report fields", () => {
  const insight = buildMTBFInsight(
    {
      model: "Exponential / constant failure-rate assumption",
      totalExposure: 10000,
      failureCount: 4,
      mtbf: 2500,
      missionReliability: Math.exp(-0.04),
      failureRate: 0.0004,
      warnings: []
    },
    {
      status: "Meets Target",
      message: "Observed MTBF meets the target point estimate."
    }
  );

  for (const key of [
    "meaning",
    "evidence",
    "recommendedActions",
    "flags",
    "assumptions",
    "result"
  ]) {
    assert(Object.hasOwn(insight, key), key);
  }
  assert.equal(insight.result, "Observed MTBF meets the target point estimate");
  assert.match(insight.evidence, /T = 10000, r = 4, MTBF = 2500/);
});

test("MTBF Facade returns structured Insight for summary and unit inputs", () => {
  const summary = analyzeMTBF({
    inputMode: "summary",
    totalExposure: 10000,
    failureCount: 4,
    missionTime: 100,
    targetMTBF: 2000,
    timeUnit: "hours"
  });
  const unit = analyzeMTBF({
    inputMode: "unit",
    rows: [
      { unitId: "A", exposureTime: 4000, status: "failure" },
      { unitId: "B", exposureTime: 6000, status: "censored" }
    ],
    missionTime: 100,
    targetMTBF: 8000,
    timeUnit: "hours"
  });

  for (const result of [summary, unit]) {
    assert(result.insight);
    assert.deepEqual(
      Object.keys(result.insight).sort(),
      ["explanationKeys", "recommendationKeys", "limitations", "parameters"].sort()
    );
  }
});
