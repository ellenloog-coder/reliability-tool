import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF,
  RELIABILITY_FIXTURE_VERSION
} from "../src/reliability/engine/index.js";
import { adaptLifeDataFacadeResult } from "../src/reliability/adapters/life-data-ui-adapter.js";
import { adaptMTBFFacadeResult } from "../src/reliability/adapters/mtbf-ui-adapter.js";
import { adaptDemonstrationFacadeResult } from "../src/reliability/adapters/demonstration-ui-adapter.js";
import { buildReportHtml } from "../src/reliability/report.js";
import { buildMTBFReportHtml } from "../src/reliability/mtbf-report.js";
import { buildDemoReportHtml } from "../src/reliability/demonstration/report.js";

const scenarios = readJson("../verification/fixtures/reliability-engineering-scenarios-v1.json");
const lifeFixtures = readJson("../verification/fixtures/expected-results.json");
const mtbfFixtures = readJson("../verification/fixtures/mtbf-fixtures.json");
const demonstrationFixtures = readJson("../verification/fixtures/demonstration-fixtures.json");

test("Engineering scenario manifest covers the frozen Phase 5.3 matrix", () => {
  assert.equal(scenarios.fixtureVersion, RELIABILITY_FIXTURE_VERSION);
  assert.equal(scenarios.lifeData.length, 7);
  assert.equal(scenarios.mtbf.length, 7);
  assert.equal(scenarios.demonstration.length, 7);
  assertCoverage(scenarios.lifeData, [
    "beta_lt_1",
    "beta_approx_1",
    "beta_gt_1",
    "censored_data",
    "limited_failure_data",
    "target_meets",
    "target_does_not_meet"
  ]);
  assertCoverage(scenarios.mtbf, [
    "zero_failure",
    "few_failure",
    "target_meets",
    "target_does_not_meet",
    "summary_input",
    "unit_level_input",
    "summary_unit_equivalence"
  ]);
  assertCoverage(scenarios.demonstration, [
    "zero_failure",
    "failure_observed",
    "confidence_not_met",
    "evidence_gap",
    "sample_demonstration",
    "time_demonstration",
    "equal_boundary"
  ]);
});

for (const scenario of scenarios.lifeData) {
  test(`Life Data engineering scenario: ${scenario.id}`, () => {
    const source = fixtureBy(lifeFixtures, "name", scenario.sourceFixture);
    const input = lifeInput(source, scenario.targetReliability);
    const facade = analyzeLifeData(input);
    const expected = scenario.expected;

    assert.equal(facade.validation.status, expected.validationStatus);
    assert.equal(facade.calculation.status, "COMPLETED");
    assertClose(facade.calculation.metrics.beta, expected.beta, 1e-4);
    if (expected.missionReliability !== undefined) {
      assertClose(
        facade.calculation.metrics.missionReliability,
        expected.missionReliability,
        1e-6
      );
    }
    if (expected.censoredCount !== undefined) {
      assert.equal(facade.calculation.metrics.censoredCount, expected.censoredCount);
    }
    if (expected.warningIncludes) {
      assert(
        facade.validation.warnings.some(item => item.includes(expected.warningIncludes))
      );
    }
    assert.equal(facade.decision.status, expected.decisionStatus);
    assert.deepEqual(facade.decision.reasonCodes, expected.reasonCodes);
    assert.equal(facade.insight.parameters.trend, expected.trend);
    assert(
      facade.insight.limitations.length >= expected.minimumInsightLimitations,
      `${scenario.id}: missing engineering limitations`
    );

    const adapted = adaptLifeDataFacadeResult(facade);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.state.metrics.beta, facade.calculation.metrics.beta);
    assert.equal(
      adapted.state.metrics.targetComparison.status,
      facade.decision.existingDecision.status
    );

    const report = buildReportHtml({
      ...adapted.state,
      validation: adapted.validation,
      mapping: input.mapping,
      settings: input.settings,
      plots: {},
      tables: {},
      curveMode: "reliability",
      lang: "en"
    });
    assertReport(report, "Reliability Analysis Report");
  });
}

for (const scenario of scenarios.mtbf.filter(item => item.sourceFixture)) {
  test(`MTBF engineering scenario: ${scenario.id}`, () => {
    const input = fixtureBy(mtbfFixtures, "id", scenario.sourceFixture);
    const facade = analyzeMTBF(input);
    assertMTBFScenario(facade, scenario.expected, scenario.id);

    const adapted = adaptMTBFFacadeResult(facade);
    assert.equal(adapted.ok, true);
    assert.deepEqual(adapted.state.result.mtbf, facade.calculation.metrics.mtbf);

    const report = buildMTBFReportHtml({
      inputMode: input.inputMode,
      inputSummary: adapted.inputSummary,
      result: adapted.state.result,
      targetComparison: adapted.state.targetComparison,
      insight: adapted.state.insight,
      curveSvg: "",
      mapping: input.mapping || {},
      lang: "en"
    });
    assertReport(report, "MTBF");
    assertNoInfinity(facade);
  });
}

test("MTBF engineering scenario: summary and unit-level inputs are equivalent end to end", () => {
  const scenario = scenarios.mtbf.find(item => item.id === "mtbf_summary_unit_equivalence");
  const results = scenario.sourceFixtures.map(id => {
    const input = fixtureBy(mtbfFixtures, "id", id);
    const facade = analyzeMTBF(input);
    assertMTBFScenario(facade, scenario.expected, id);
    const adapted = adaptMTBFFacadeResult(facade);
    const report = buildMTBFReportHtml({
      inputMode: input.inputMode,
      inputSummary: adapted.inputSummary,
      result: adapted.state.result,
      targetComparison: adapted.state.targetComparison,
      insight: adapted.state.insight,
      curveSvg: "",
      mapping: input.mapping || {},
      lang: "en"
    });
    assertReport(report, "MTBF");
    return { facade, adapted };
  });

  assert.deepEqual(results[0].facade.calculation.metrics, results[1].facade.calculation.metrics);
  assert.deepEqual(results[0].facade.decision, results[1].facade.decision);
  assert.deepEqual(
    results[0].adapted.state.targetComparison,
    results[1].adapted.state.targetComparison
  );
});

for (const scenario of scenarios.demonstration.filter(item => item.sourceFixture)) {
  test(`Demonstration engineering scenario: ${scenario.id}`, () => {
    const source = fixtureBy(
      demonstrationFixtures,
      "fixtureId",
      scenario.sourceFixture
    );
    const facade = runDemonstration(source);
    assertDemonstrationScenario(facade, scenario.expected, scenario.id);
    assertDemonstrationInvariant(facade, scenario.id);

    const adapted = adaptDemonstrationFacadeResult(facade);
    assert.equal(adapted.ok, true);
    assert.equal(
      adapted.state.result.demonstrated,
      facade.decision.existingDecision.demonstrated
    );

    const report = buildDemoReportHtml({
      result: adapted.state.result,
      insight: adapted.state.insight,
      inputs: {
        ...source.inputs,
        timeUnit: source.inputs.timeUnit || "hours"
      },
      chartSvg: "",
      lang: "en"
    });
    assertReport(report, "Reliability Demonstration");
  });
}

test("Demonstration engineering scenario: sample and time equal boundaries are demonstrated", () => {
  const scenario = scenarios.demonstration.find(item => item.id === "demo_equal_boundary");
  const results = scenario.sourceFixtures.map(id => runDemonstration(
    fixtureBy(demonstrationFixtures, "fixtureId", id)
  ));

  for (const facade of results) {
    assert.equal(facade.decision.status, scenario.expected.decisionStatus);
    assert(
      scenario.expected.targetReasonCodes.some(code =>
        facade.decision.reasonCodes.includes(code)
      )
    );
    assert(
      facade.decision.reasonCodes.includes(
        scenario.expected.confidenceReasonCode
      )
    );
    assert.equal(
      facade.decision.evidenceGap.status,
      scenario.expected.evidenceGapStatus
    );
    assertDemonstrationInvariant(facade, scenario.id);

    const adapted = adaptDemonstrationFacadeResult(facade);
    const report = buildDemoReportHtml({
      result: adapted.state.result,
      insight: adapted.state.insight,
      inputs: {
        timeUnit: adapted.state.result.timeUnit || "hours"
      },
      chartSvg: "",
      lang: "en"
    });
    assertReport(report, "Reliability Demonstration");
  }
});

function assertMTBFScenario(facade, expected, id) {
  assert.equal(facade.validation.status, expected.validationStatus, id);
  assert.equal(facade.calculation.status, "COMPLETED", id);
  assert.deepEqual(facade.calculation.metrics.mtbf, expected.mtbf, id);
  if (expected.failureRate !== undefined) {
    assertClose(facade.calculation.metrics.failureRate, expected.failureRate, 1e-12);
  }
  if (expected.totalUnits !== undefined) {
    assert.equal(facade.validation.normalizedInput.totalUnits, expected.totalUnits);
  }
  if (expected.censoredCount !== undefined) {
    assert.equal(
      facade.validation.normalizedInput.censoredCount,
      expected.censoredCount
    );
  }
  assert.equal(facade.decision.status, expected.decisionStatus, id);
  assert.deepEqual(facade.decision.reasonCodes, expected.reasonCodes, id);
  if (expected.pointEstimateAvailable !== undefined) {
    assert.equal(
      facade.insight.parameters.pointEstimateAvailable,
      expected.pointEstimateAvailable
    );
  }
  if (expected.limitedFailureInformation !== undefined) {
    assert.equal(
      facade.insight.parameters.limitedFailureInformation,
      expected.limitedFailureInformation
    );
  }
  assert(
    facade.insight.limitations.some(item =>
      item.includes(expected.limitationIncludes)
    ),
    `${id}: missing limitation ${expected.limitationIncludes}`
  );
  assertNoInfinity(facade);
}

function assertDemonstrationScenario(facade, expected, id) {
  assert.equal(facade.validation.status, "VALID", id);
  assert.equal(facade.calculation.status, "COMPLETED", id);
  assert.equal(facade.decision.status, expected.decisionStatus, id);
  assert.deepEqual(facade.decision.reasonCodes, expected.reasonCodes, id);
  assert.equal(facade.decision.evidenceGap.status, expected.evidenceGapStatus, id);
  if (expected.observedFailures !== undefined) {
    assert.equal(
      facade.decision.actualEvidence.observedFailures,
      expected.observedFailures
    );
  }
  assert(facade.insight.limitations.length > 0, `${id}: missing limitations`);
  assertNoInfinity(facade);
}

function assertDemonstrationInvariant(facade, id) {
  if (facade.decision.status !== "DEMONSTRATED") return;
  const decision = facade.decision;
  const metrics = facade.calculation.metrics;
  const requirement = facade.calculation.requirement;
  const sample = facade.calculation.model === "Exact Binomial";
  const targetMetCode = sample
    ? "RELIABILITY_LOWER_BOUND_MEETS_TARGET"
    : "MTBF_LOWER_BOUND_MEETS_TARGET";
  const actual = sample
    ? metrics.reliabilityLowerBound
    : metrics.mtbfLowerBound;
  const target = sample
    ? requirement.targetReliability
    : requirement.targetMTBF;
  const tolerance = sample
    ? 1e-10
    : Math.max(1e-12, Math.abs(target) * 1e-12);

  assert(decision.reasonCodes.includes(targetMetCode), `${id}: target reason`);
  assert(
    decision.reasonCodes.includes("ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT"),
    `${id}: confidence reason`
  );
  assert(actual + tolerance >= target, `${id}: target requirement`);
  assert(
    metrics.achievedConfidenceAtTarget + 1e-12
      >= requirement.requiredConfidence,
    `${id}: confidence requirement`
  );
}

function runDemonstration(source) {
  return analyzeDemonstration({
    method: source.method,
    workflow: source.workflow,
    targetDefinition: source.inputs.targetDefinition,
    inputs: source.inputs
  });
}

function lifeInput(source, targetReliability) {
  return {
    rows: source.records.map((record, index) => ({
      Sample: `S${index + 1}`,
      Time: record.time,
      Status: record.status
    })),
    mapping: {
      sampleId: "Sample",
      time: "Time",
      status: "Status"
    },
    settings: {
      timeUnit: "hours",
      missionTime: source.missionTime,
      targetReliability
    }
  };
}

function fixtureBy(items, key, value) {
  const fixture = items.find(item => item[key] === value);
  assert(fixture, `Missing fixture ${value}`);
  return fixture;
}

function assertCoverage(items, required) {
  const coverage = new Set(items.flatMap(item => item.covers));
  for (const item of required) assert(coverage.has(item), `Missing coverage: ${item}`);
}

function assertClose(actual, expected, tolerance) {
  const scale = Math.max(1, Math.abs(expected));
  assert(
    Math.abs(actual - expected) <= tolerance * scale,
    `${actual} differs from ${expected}`
  );
}

function assertReport(report, title) {
  assert.match(report, /^<!DOCTYPE html>/);
  assert(report.includes(title), title);
  assert.equal(report.includes("Infinity"), false);
  assert.equal(report.includes("NaN"), false);
  assert.equal(report.includes("undefined"), false);
}

function assertNoInfinity(value) {
  assert.equal(JSON.stringify(value).includes("Infinity"), false);
  walk(value);
}

function walk(value, path = "result") {
  if (typeof value === "number") {
    assert(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}
