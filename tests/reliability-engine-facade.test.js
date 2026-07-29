import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF,
  RELIABILITY_ENGINE_VERSION
} from "../src/reliability/engine/index.js";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { weibullMetrics } from "../src/reliability/metrics.js";
import {
  analyzeExponentialMTBF,
  compareTargetMTBF,
  summarizeUnitExposure
} from "../src/reliability/mtbf.js";
import {
  validateMTBFSummaryInput,
  validateMTBFUnitRows
} from "../src/reliability/mtbf-validation.js";
import {
  evaluateBinomialDemonstration,
  planBinomialDemonstration
} from "../src/reliability/demonstration/sample-demonstration.js";
import {
  evaluateExponentialDemonstration,
  planExponentialDemonstration
} from "../src/reliability/demonstration/time-demonstration.js";

const lifeFixtures = JSON.parse(readFileSync(
  new URL("../verification/fixtures/life-data-fixtures.json", import.meta.url)
));
const mtbfFixtures = JSON.parse(readFileSync(
  new URL("../verification/fixtures/mtbf-fixtures.json", import.meta.url)
));
const demonstrationFixtures = JSON.parse(readFileSync(
  new URL("../verification/fixtures/demonstration-fixtures.json", import.meta.url)
));

function lifeRows(records) {
  return records.map((record, index) => ({
    Sample: `S${index + 1}`,
    Time: record.time,
    Status: record.status
  }));
}

test("Life Data facade preserves existing Weibull parameters and metrics", () => {
  let compared = 0;
  for (const fixture of lifeFixtures) {
    const rows = fixture.records ? lifeRows(fixture.records) : fixture.rawRows;
    const result = analyzeLifeData({
      rows,
      mapping: {
        sampleId: fixture.records ? "Sample" : "Sample ID",
        time: "Time",
        status: "Status"
      },
      settings: {
        timeUnit: "hours",
        missionTime: fixture.missionTime,
        targetReliability: ""
      }
    });
    if (result.validation.status === "INVALID") {
      assert.equal(Boolean(fixture.expectError), true, fixture.name);
      continue;
    }

    const legacyFit = fitWeibull2PMLE(result.validation.records);
    const legacyMetrics = weibullMetrics(
      legacyFit,
      result.validation.records,
      fixture.missionTime,
      ""
    );
    const { targetComparison, ...legacyCalculationMetrics } = legacyMetrics;
    assert.deepEqual(result.calculation.parameters, legacyFit);
    assert.deepEqual(result.calculation.metrics, legacyCalculationMetrics);
    assert.equal("targetComparison" in result.calculation.metrics, false);
    assert.deepEqual(
      result.decision.existingDecision,
      targetComparison
    );
    assert.equal(result.metadata.engineVersion, RELIABILITY_ENGINE_VERSION);
    compared += 1;
  }
  assert(compared >= 5);
});

function legacyMTBF(fixture) {
  if (fixture.inputMode !== "unit") {
    const validation = validateMTBFSummaryInput(fixture);
    if (validation.errors.length) return { status: "INVALID" };
    const metrics = analyzeExponentialMTBF(validation.input);
    return {
      status: "OK",
      metrics,
      decision: compareTargetMTBF(metrics.mtbf, validation.input.targetMTBF)
    };
  }
  const mapping = {
    unitId: "unitId",
    exposureTime: "exposureTime",
    status: "status",
    failureMode: "failureMode",
    testCondition: "testCondition",
    notes: "notes"
  };
  const rowValidation = validateMTBFUnitRows(
    fixture.rows,
    mapping,
    { timeUnit: fixture.timeUnit }
  );
  const input = {
    ...summarizeUnitExposure(rowValidation.records, fixture.timeUnit),
    missionTime: fixture.missionTime,
    targetMTBF: fixture.targetMTBF
  };
  const summaryValidation = validateMTBFSummaryInput(input);
  if (rowValidation.errors.length || summaryValidation.errors.length) {
    return { status: "INVALID" };
  }
  const metrics = analyzeExponentialMTBF(summaryValidation.input);
  return {
    status: "OK",
    metrics,
    decision: compareTargetMTBF(metrics.mtbf, summaryValidation.input.targetMTBF)
  };
}

test("MTBF facade preserves existing summary and unit-level results", () => {
  let compared = 0;
  for (const fixture of mtbfFixtures) {
    const legacy = legacyMTBF(fixture);
    const result = analyzeMTBF(fixture);
    if (legacy.status === "INVALID") {
      assert.equal(result.validation.status, "INVALID", fixture.id);
      continue;
    }
    assert.deepEqual(result.calculation.metrics, {
      mtbf: legacy.metrics.mtbf,
      mtbfLowerBound: legacy.metrics.mtbfLowerBound ?? null,
      missionReliability: legacy.metrics.missionReliability,
      failureRate: legacy.metrics.failureRate
    }, fixture.id);
    assert.deepEqual(result.decision.existingDecision, legacy.decision, fixture.id);
    assert.equal(result.metadata.engineVersion, RELIABILITY_ENGINE_VERSION);
    compared += 1;
  }
  assert(compared >= 10);
});

function runLegacyDemonstration(fixture) {
  try {
    const fn = fixture.method === "sample"
      ? fixture.workflow === "plan"
        ? planBinomialDemonstration
        : evaluateBinomialDemonstration
      : fixture.workflow === "plan"
        ? planExponentialDemonstration
        : evaluateExponentialDemonstration;
    return { status: "OK", result: fn(fixture.inputs) };
  } catch (error) {
    return { status: "ERROR", message: error.message };
  }
}

test("Demonstration facade preserves all 63 legacy numerical fixture outputs", () => {
  let passed = 0;
  for (const fixture of demonstrationFixtures) {
    const legacy = runLegacyDemonstration(fixture);
    const facade = analyzeDemonstration({
      method: fixture.method,
      workflow: fixture.workflow,
      targetDefinition: fixture.inputs.targetDefinition,
      inputs: fixture.inputs
    });

    if (legacy.status === "ERROR") {
      const facadeErrored = facade.validation.status === "INVALID"
        || facade.calculation?.status === "ERROR";
      assert.equal(facadeErrored, true, fixture.fixtureId);
      passed += 1;
      continue;
    }

    assert.equal(facade.calculation.status, "COMPLETED", fixture.fixtureId);
    assert.equal("result" in facade.calculation, false, fixture.fixtureId);
    for (const key of ["metrics", "evidence", "requirement", "assumptions"]) {
      assert.equal(typeof facade.calculation[key], "object", `${fixture.fixtureId}.${key}`);
    }
    assert.deepEqual(
      facade.decision.existingDecision.demonstrated,
      legacy.result.demonstrated ?? null,
      fixture.fixtureId
    );
    assert.equal(facade.metadata.engineVersion, RELIABILITY_ENGINE_VERSION);
    passed += 1;
  }
  assert.equal(passed, 63);
});

test("facades stop calculation after invalid validation", () => {
  const life = analyzeLifeData({
    rows: [],
    mapping: { time: "Time", status: "Status" },
    settings: { timeUnit: "hours" }
  });
  const mtbf = analyzeMTBF({
    inputMode: "summary",
    totalExposure: 0,
    failureCount: 0,
    missionTime: 100,
    targetMTBF: "",
    timeUnit: "hours"
  });
  const demonstration = analyzeDemonstration({
    method: "sample",
    workflow: "evaluate",
    inputs: {
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      unitsTested: 0,
      observedFailures: 0
    }
  });

  for (const result of [life, mtbf, demonstration]) {
    assert.equal(result.validation.status, "INVALID");
    assert.equal(result.calculation, null);
    assert.equal(result.decision, null);
  }
});
