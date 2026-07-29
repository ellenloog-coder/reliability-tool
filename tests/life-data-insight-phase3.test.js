import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStructuredLifeDataInsight,
  interpretWeibull
} from "../src/reliability/insight-engine.js";
import { analyzeLifeData } from "../src/reliability/engine/life-data-engine.js";

function calculation(beta = 1.4, missionReliability = 0.2) {
  return {
    status: "COMPLETED",
    model: "Weibull 2P MLE",
    parameters: { beta, eta: 1000 },
    metrics: {
      beta,
      eta: 1000,
      missionReliability
    }
  };
}

function decision(status, reasonCode) {
  return {
    status,
    reasonCodes: [reasonCode]
  };
}

test("structured Life Data Insight interprets beta independently of target status", () => {
  const met = buildStructuredLifeDataInsight({
    validation: { status: "VALID" },
    calculation: calculation(1.4, 0.2),
    decision: decision(
      "MEETS_REQUIREMENT",
      "MISSION_RELIABILITY_MEETS_TARGET"
    )
  });
  const below = buildStructuredLifeDataInsight({
    validation: { status: "VALID" },
    calculation: calculation(1.4, 0.99),
    decision: decision(
      "DOES_NOT_MEET_REQUIREMENT",
      "MISSION_RELIABILITY_BELOW_TARGET"
    )
  });

  assert.equal(met.parameters.resultText, "Increasing failure-rate behavior");
  assert.equal(below.parameters.resultText, "Increasing failure-rate behavior");
  assert.equal(met.parameters.decisionStatus, "MEETS_REQUIREMENT");
  assert.equal(below.parameters.decisionStatus, "DOES_NOT_MEET_REQUIREMENT");
});

test("structured Life Data Insight does not calculate a target gap", () => {
  const insight = buildStructuredLifeDataInsight({
    validation: { status: "VALID" },
    calculation: calculation(1, 0.85),
    decision: decision(
      "DOES_NOT_MEET_REQUIREMENT",
      "MISSION_RELIABILITY_BELOW_TARGET"
    )
  });

  assert.equal(Object.hasOwn(insight.parameters, "targetGap"), false);
  assert.equal(Object.hasOwn(insight.parameters, "requirementMet"), false);
  assert.deepEqual(
    insight.parameters.decisionReasonCodes,
    ["MISSION_RELIABILITY_BELOW_TARGET"]
  );
});

test("structured Life Data Insight preserves configured beta interpretation", () => {
  const insight = buildStructuredLifeDataInsight({
    validation: { status: "WARNING" },
    calculation: calculation(0.7, 0.9),
    decision: decision(
      "NOT_EVALUATED",
      "TARGET_RELIABILITY_NOT_PROVIDED"
    )
  });

  assert.equal(insight.parameters.trend, "DECREASING");
  assert.equal(insight.parameters.resultText, "Decreasing failure-rate behavior");
  assert(insight.parameters.possibleConsiderations.includes("process defects"));
});

test("legacy Weibull Insight adapter preserves page and report fields", () => {
  const insight = interpretWeibull(1.4);

  for (const key of [
    "meaning",
    "evidence",
    "recommendedActions",
    "flags",
    "result",
    "possibleConsiderations",
    "limitations"
  ]) {
    assert(Object.hasOwn(insight, key), key);
  }
  assert.equal(insight.result, "Increasing failure-rate behavior");
  assert.match(insight.evidence, /β is 1.400/);
  assert.equal(insight.flags.increasingFailureRate, true);
});

test("Life Data Facade returns structured Insight", () => {
  const result = analyzeLifeData({
    rows: [
      { Sample: "S1", Time: 100, Status: "failure" },
      { Sample: "S2", Time: 180, Status: "failure" },
      { Sample: "S3", Time: 240, Status: "failure" },
      { Sample: "S4", Time: 320, Status: "censored" },
      { Sample: "S5", Time: 410, Status: "failure" }
    ],
    mapping: {
      sampleId: "Sample",
      time: "Time",
      status: "Status"
    },
    settings: {
      timeUnit: "hours",
      missionTime: 200,
      targetReliability: 0.8
    }
  });

  assert(result.insight);
  assert.deepEqual(
    Object.keys(result.insight).sort(),
    ["explanationKeys", "recommendationKeys", "limitations", "parameters"].sort()
  );
  assert.equal(
    result.insight.parameters.decisionStatus,
    result.decision.status
  );
});
