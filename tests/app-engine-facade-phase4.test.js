import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF,
  previewDemonstrationTarget
} from "../src/reliability/engine/index.js";

const appSource = await readFile(
  new URL("../src/reliability/app.js", import.meta.url),
  "utf8"
);

test("app analysis entries call Reliability Engine facades", () => {
  for (const facade of [
    "analyzeLifeData",
    "analyzeMTBF",
    "analyzeDemonstration"
  ]) {
    assert.match(appSource, new RegExp(`\\b${facade}\\(`), facade);
  }
  for (const directCalculation of [
    "fitWeibull2PMLE(",
    "weibullMetrics(",
    "analyzeExponentialMTBF(",
    "compareTargetMTBF(",
    "planBinomialDemonstration(",
    "evaluateBinomialDemonstration(",
    "planExponentialDemonstration(",
    "evaluateExponentialDemonstration("
  ]) {
    assert.equal(
      appSource.includes(directCalculation),
      false,
      directCalculation
    );
  }
  for (const adapter of [
    "adaptLifeDataFacadeResult",
    "adaptMTBFFacadeResult",
    "adaptDemonstrationFacadeResult"
  ]) {
    assert.match(appSource, new RegExp(`\\b${adapter}\\(`), adapter);
  }
  assert.equal(appSource.includes("engineResult.compatibility"), false);
});

test("Life Data facade exposes the existing page and report contract", () => {
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

  assert(result.compatibility.fit);
  assert(result.compatibility.metrics.targetComparison);
  assert(result.compatibility.mtbf);
  assert(result.compatibility.insight.meaning);
  assert(result.compatibility.insight.recommendedActions);
});

test("MTBF facade preserves summary and unit-level page contracts", () => {
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

  assert.equal(summary.compatibility.result.mtbf, 2500);
  assert.equal(summary.compatibility.targetComparison.status, "Meets Target");
  assert(summary.compatibility.insight.meaning);
  assert.equal(unit.compatibility.result.totalUnits, 2);
  assert.equal(unit.compatibility.result.censoredCount, 1);
});

test("Demonstration facade preserves legacy result and report fields", () => {
  const result = analyzeDemonstration({
    method: "sample",
    workflow: "plan",
    inputs: {
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      allowableFailures: 0,
      missionTime: "",
      timeUnit: "hours"
    }
  });

  assert.equal(result.compatibility.result.requiredSampleSize, 22);
  assert.equal(result.compatibility.result.method, "sample");
  assert.equal(result.compatibility.result.workflow, "plan");
  assert(result.compatibility.insight.meaning);
  assert(result.compatibility.insight.recommendedActions);
});

test("Demonstration target preview preserves the existing conversion", () => {
  const target = previewDemonstrationTarget({
    targetDefinition: "reliability",
    targetReliability: 0.9,
    missionTime: 100
  });

  assert(Math.abs(target - (-100 / Math.log(0.9))) < 1e-12);
  assert.equal(previewDemonstrationTarget({
    targetDefinition: "mtbf",
    targetReliability: 0.9,
    missionTime: 100
  }), null);
});
