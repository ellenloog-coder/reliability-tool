import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExponentialMTBF, compareTargetMTBF, summarizeUnitExposure, updateMTBFMission } from "../src/reliability/mtbf.js";
import { buildMTBFInsight } from "../src/reliability/mtbf-insight.js";
import { relError } from "./helpers.js";

test("summary MTBF uses exponential constant failure-rate formulas", () => {
  const result = analyzeExponentialMTBF({
    totalExposure: 10000,
    failureCount: 4,
    censoredCount: null,
    totalUnits: null,
    missionTime: 100,
    timeUnit: "hours"
  });
  assert.equal(result.failureRate, 0.0004);
  assert.equal(result.lambda, 0.0004);
  assert.equal(result.mtbf, 2500);
  assert(relError(result.missionReliability, Math.exp(-0.0004 * 100)) < 1e-12);
  assert(relError(result.missionFailureProbability, 1 - Math.exp(-0.0004 * 100)) < 1e-12);
});

test("unit-level exposure summary counts failures, censored rows, units, and total exposure", () => {
  const summary = summarizeUnitExposure([
    { exposureTime: 100, status: "failure" },
    { exposureTime: 200, status: "censored" },
    { exposureTime: 300, status: "failure" }
  ], "cycles");
  assert.deepEqual(summary, {
    totalExposure: 600,
    failureCount: 2,
    censoredCount: 1,
    totalUnits: 3,
    timeUnit: "cycles"
  });
});

test("zero-failure MTBF is not estimable and never returns infinity", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 2500, failureCount: 0, missionTime: 100, timeUnit: "hours" });
  assert.equal(result.estimable, false);
  assert.equal(result.failureRate, null);
  assert.equal(result.lambda, null);
  assert.equal(result.mtbf, null);
  assert.equal(result.missionReliability, null);
  assert(!JSON.stringify(result).includes("Infinity"));
  const insight = buildMTBFInsight(result);
  assert.match(insight.result, /not available/);
  assert(insight.recommendedActions.some(action => action.includes("Reliability Demonstration")));
});

test("mission and target updates refresh derived MTBF fields without changing point estimate", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 5, missionTime: 50, timeUnit: "hours" });
  const updated = updateMTBFMission(result, 100, 1500);
  assert.equal(updated.mtbf, result.mtbf);
  assert.equal(updated.failureRate, result.failureRate);
  assert(relError(updated.missionReliability, Math.exp(-0.0005 * 100)) < 1e-12);
  assert.equal(updated.targetComparison.status, "Meets Target");
});

test("target comparison is point-estimate only", () => {
  assert.equal(compareTargetMTBF(2000, "").status, "Target not provided");
  assert.equal(compareTargetMTBF(null, 1000).status, "Not Estimable");
  assert.equal(compareTargetMTBF(2000, 1500).status, "Meets Target");
  assert.equal(compareTargetMTBF(1200, 1500).status, "Below Target");
  assert.match(compareTargetMTBF(2000, 1500).message, /confidence bounds/);
});
