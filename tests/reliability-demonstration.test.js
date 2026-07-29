import test from "node:test";
import assert from "node:assert/strict";
import { dictionary } from "../src/reliability/i18n.js";
import { binomialCDF, binomialLogPMF } from "../src/reliability/demonstration/binomial.js";
import { poissonCDF, poissonLogPMF, requiredPoissonMean } from "../src/reliability/demonstration/poisson.js";
import { solveMonotonicRoot } from "../src/reliability/demonstration/root-solver.js";
import { planBinomialDemonstration, evaluateBinomialDemonstration, calculateReliabilityLowerBound, achievedBinomialConfidence } from "../src/reliability/demonstration/sample-demonstration.js";
import { planExponentialDemonstration, evaluateExponentialDemonstration, calculateMTBFLowerBound, achievedExponentialConfidence, targetReliabilityToMTBF } from "../src/reliability/demonstration/time-demonstration.js";
import { createDemoState, invalidateDemoResult, resetDemoState } from "../src/reliability/demonstration/state.js";
import { validateDemoInputs } from "../src/reliability/demonstration/validation.js";
import { buildDemoInsight } from "../src/reliability/demonstration/insight.js";
import { demonstrationEvidenceChartSvg } from "../src/reliability/demonstration/plotting.js";
import { buildDemoReportHtml } from "../src/reliability/demonstration/report.js";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { analyzeExponentialMTBF } from "../src/reliability/mtbf.js";
import { fixture } from "./helpers.js";

const labels = { evidenceChart: "Demonstration Evidence", x: "Sample Size", achievedConfidence: "Achieved Confidence", requiredConfidence: "Required Confidence", evidenceGap: "Evidence Gap" };

test("Sample-Based Plan: 90% reliability / 90% confidence / 0 failures requires 22 units", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 0 });
  assert.equal(result.requiredSampleSize, 22);
  assert(result.achievedConfidenceAtRequiredN >= 0.9);
});

test("Sample-Based Plan: 95% reliability / 90% confidence / 0 failures", () => {
  assert.equal(planBinomialDemonstration({ targetReliability: 0.95, confidenceLevel: 0.9, allowableFailures: 0 }).requiredSampleSize, 45);
});

test("Sample-Based Plan: 90% reliability / 95% confidence / 0 failures", () => {
  assert.equal(planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.95, allowableFailures: 0 }).requiredSampleSize, 29);
});

test("Sample-Based Plan supports allowable failures = 1", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 1 });
  assert.equal(result.requiredSampleSize, 38);
  assert(result.acceptanceRule.includes("no more than 1"));
});

test("Sample-Based Plan supports allowable failures = 2", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 2 });
  assert.equal(result.requiredSampleSize, 52);
});

test("Sample-Based Plan required n satisfies target condition", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.95, allowableFailures: 1 });
  assert(result.achievedConfidenceAtRequiredN >= result.confidenceLevel);
});

test("Sample-Based Plan required n - 1 does not satisfy target condition", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.95, allowableFailures: 1 });
  assert(result.achievedConfidenceAtPreviousN < result.confidenceLevel);
  assert.equal(result.minimalityVerified, true);
});

test("Sample-Based Plan rejects invalid reliability", () => {
  assert.throws(() => planBinomialDemonstration({ targetReliability: 1, confidenceLevel: 0.9, allowableFailures: 0 }), /Target Reliability/);
});

test("Sample-Based Plan rejects invalid confidence", () => {
  assert.throws(() => planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0, allowableFailures: 0 }), /Confidence Level/);
});

test("Sample-Based Plan rejects invalid allowable failures", () => {
  assert.throws(() => planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 1.2 }), /Allowable Failures/);
});

test("Sample-Based Evaluate supports zero observed failures", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 22, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 });
  assert(result.reliabilityLowerBound >= 0.9);
  assert.equal(result.demonstrated, true);
});

test("Sample-Based Evaluate supports one observed failure", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 38, observedFailures: 1, targetReliability: 0.9, confidenceLevel: 0.9 });
  assert(result.reliabilityLowerBound >= 0.9);
});

test("Sample-Based Evaluate identifies target demonstrated", () => {
  assert.equal(evaluateBinomialDemonstration({ unitsTested: 30, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 }).demonstrated, true);
});

test("Sample-Based Evaluate treats numerical equality with the lower bound as demonstrated", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 22, observedFailures: 0, targetReliability: 0.9006280202112785, confidenceLevel: 0.9 });
  assert.equal(result.demonstrated, true);
  assert.equal(result.evidenceGap.additionalUnitsRequired, 0);
});

test("Sample-Based Evaluate identifies target not demonstrated", () => {
  assert.equal(evaluateBinomialDemonstration({ unitsTested: 10, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 }).demonstrated, false);
});

test("Sample-Based Evaluate calculates reliability lower bound exactly", () => {
  const lower = calculateReliabilityLowerBound({ unitsTested: 22, observedFailures: 0, confidenceLevel: 0.9 });
  assert(Math.abs(lower - 0.9 ** 0) < 1);
  assert(Math.abs(lower - Math.exp(Math.log(0.1) / 22)) < 1e-9);
});

test("Sample-Based Evaluate calculates achieved confidence at target", () => {
  assert(Math.abs(achievedBinomialConfidence(22, 0, 0.9) - (1 - 0.9 ** 22)) < 1e-12);
});

test("Sample-Based Evaluate handles all units failed", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 5, observedFailures: 5, targetReliability: 0.9, confidenceLevel: 0.9 });
  assert.equal(result.reliabilityLowerBound, 0);
  assert.equal(result.demonstrated, false);
});

test("Sample-Based Evaluate blocks failures greater than units", () => {
  assert.throws(() => evaluateBinomialDemonstration({ unitsTested: 5, observedFailures: 6, targetReliability: 0.9, confidenceLevel: 0.9 }), /greater/);
});

test("Sample-Based Evaluate calculates evidence gap", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 10, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 });
  assert.equal(result.evidenceGap.additionalUnitsRequired, 12);
});

test("Sample-Based evidence gap includes additional-units assumption", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 10, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 });
  assert(result.evidenceGap.assumption.includes("no additional failures"));
});

test("Time-Based Plan zero allowable failure matches closed form", () => {
  const result = planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.9, allowableFailures: 0 });
  assert(Math.abs(result.requiredTotalTestTime - (-Math.log(0.1) * 1000)) < 1e-6);
});

test("Time-Based Plan supports one allowable failure", () => {
  const result = planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.9, allowableFailures: 1 });
  assert(result.requiredExposureFactor > requiredPoissonMean(0, 0.9));
});

test("Time-Based Plan supports target MTBF", () => {
  const result = planExponentialDemonstration({ targetMTBF: 2000, confidenceLevel: 0.9, allowableFailures: 0 });
  assert.equal(result.targetMTBF, 2000);
});

test("Time-Based Plan converts target reliability at mission time to MTBF", () => {
  const targetMTBF = targetReliabilityToMTBF(0.9, 100);
  const result = planExponentialDemonstration({ targetDefinition: "reliability", targetReliability: 0.9, missionTime: 100, confidenceLevel: 0.9, allowableFailures: 0 });
  assert(Math.abs(result.targetMTBF - targetMTBF) < 1e-10);
});

test("Time-Based Plan returns required total test time", () => {
  assert(planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.95, allowableFailures: 0 }).requiredTotalTestTime > 2900);
});

test("Time-Based Plan exposes chi-square equivalent quantile", () => {
  const result = planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.9, allowableFailures: 1 });
  assert(Math.abs(result.chiSquareEquivalentQuantile - 2 * result.requiredExposureFactor) < 1e-12);
});

test("Time-Based Plan returns per-unit duration", () => {
  const result = planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.9, allowableFailures: 0, numberOfUnits: 10 });
  assert(Math.abs(result.estimatedTimePerUnit - result.requiredTotalTestTime / 10) < 1e-12);
});

test("Time-Based Plan rejects fractional number of units", () => {
  assert.throws(() => planExponentialDemonstration({ targetMTBF: 1000, confidenceLevel: 0.9, allowableFailures: 0, numberOfUnits: 2.5 }), /Number of Units/);
});

test("Time-Based Plan rejects invalid target MTBF", () => {
  assert.throws(() => planExponentialDemonstration({ targetMTBF: 0, confidenceLevel: 0.9, allowableFailures: 0 }), /Target MTBF/);
});

test("Time-Based Plan rejects invalid mission time for reliability target", () => {
  assert.throws(() => planExponentialDemonstration({ targetDefinition: "reliability", targetReliability: 0.9, missionTime: 0, confidenceLevel: 0.9, allowableFailures: 0 }), /Mission Time/);
});

test("Time-Based Evaluate supports zero observed failures", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 2302.585093, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  assert.equal(result.pointEstimateNotEstimable, true);
  assert(result.mtbfLowerBound > 999.999);
});

test("Time-Based Evaluate supports one observed failure", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 4000, observedFailures: 1, targetMTBF: 1000, confidenceLevel: 0.9 });
  assert(result.mtbfLowerBound > 0);
});

test("Time-Based Evaluate calculates MTBF lower bound", () => {
  const lower = calculateMTBFLowerBound({ totalTestTime: 2302.585093, observedFailures: 0, confidenceLevel: 0.9 });
  assert(Math.abs(lower - 1000) < 1e-3);
});

test("Time-Based Evaluate calculates reliability lower bound at mission time", () => {
  const result = evaluateExponentialDemonstration({ targetDefinition: "reliability", targetReliability: 0.9, missionTime: 100, totalTestTime: 2200, observedFailures: 0, confidenceLevel: 0.9 });
  assert(result.reliabilityLowerBoundAtMissionTime > 0 && result.reliabilityLowerBoundAtMissionTime < 1);
});

test("Time-Based Evaluate identifies target demonstrated", () => {
  assert.equal(evaluateExponentialDemonstration({ totalTestTime: 3000, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 }).demonstrated, true);
});

test("Time-Based Evaluate treats numerical equality with the MTBF lower bound as demonstrated", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 2302.585092994046, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  assert.equal(result.demonstrated, true);
  assert.equal(result.evidenceGap.additionalTotalTestTimeRequired, 0);
  assert(Math.abs(result.chiSquareEquivalentQuantile - 2 * result.requiredExposureFactor) < 1e-12);
});

test("Time-Based Evaluate identifies target not demonstrated", () => {
  assert.equal(evaluateExponentialDemonstration({ totalTestTime: 1000, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 }).demonstrated, false);
});

test("Time-Based Evaluate calculates achieved confidence", () => {
  assert(Math.abs(achievedExponentialConfidence(2302.585093, 0, 1000) - 0.9) < 1e-9);
});

test("Time-Based Evaluate does not show infinity for zero failures", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 2302.585093, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  assert.equal(result.mtbfPointEstimate, null);
  assert.equal(result.pointEstimateNotEstimable, true);
  assert(!JSON.stringify(result).includes("Infinity"));
});

test("Time-Based Evaluate calculates additional exposure required", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 1000, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  assert(result.evidenceGap.additionalTotalTestTimeRequired > 1300);
  assert(result.evidenceGap.assumption.includes("no additional failures"));
});

test("Time-Based Evaluate rejects invalid total test time", () => {
  assert.throws(() => evaluateExponentialDemonstration({ totalTestTime: 0, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 }), /Total Test Time/);
});

test("Time-Based Evaluate rejects invalid observed failures", () => {
  assert.throws(() => evaluateExponentialDemonstration({ totalTestTime: 1000, observedFailures: -1, targetMTBF: 1000, confidenceLevel: 0.9 }), /Observed Failures/);
});

test("Numerical binomial CDF matches known zero-failure value", () => {
  assert(Math.abs(binomialCDF(0, 22, 0.1) - 0.9 ** 22) < 1e-12);
});

test("Numerical poisson CDF matches known zero-failure value", () => {
  assert(Math.abs(poissonCDF(0, 2.302585092994046) - 0.1) < 1e-12);
});

test("Numerical functions handle p near zero", () => {
  assert(binomialCDF(0, 1000, 1e-12) > 0.999999);
  assert(Number.isFinite(binomialLogPMF(0, 1000, 1e-12)));
});

test("Numerical functions handle p near one", () => {
  assert(binomialCDF(999, 1000, 1 - 1e-12) < 0.000001);
});

test("Numerical functions handle large n", () => {
  const value = binomialCDF(5, 10000, 0.0005);
  assert(Number.isFinite(value));
  assert(value > 0 && value < 1);
});

test("Numerical functions handle large exposure factor", () => {
  const value = poissonCDF(20, 50);
  assert(Number.isFinite(value));
  assert(value > 0 && value < 1);
  assert(Number.isFinite(poissonLogPMF(20, 50)));
});

test("Root solver converges on monotonic function", () => {
  const root = solveMonotonicRoot({ fn: x => x * x, lower: 0, upper: 2, target: 2, increasing: true });
  assert(Math.abs(root - Math.SQRT2) < 1e-6);
});

test("Root solver failure is explicit when bracket is invalid", () => {
  assert.throws(() => solveMonotonicRoot({ fn: x => x + 1, lower: 0, upper: 1, target: 5, increasing: true }), /not bracketed/);
});

test("UI state method switch clears results", () => {
  const state = createDemoState();
  state.result = { ok: true };
  state.method = "time";
  invalidateDemoResult(state);
  assert.equal(state.result, null);
});

test("UI state workflow switch clears results", () => {
  const state = createDemoState();
  state.result = { ok: true };
  state.workflow = "evaluate";
  invalidateDemoResult(state);
  assert.equal(state.reportHtml, null);
});

test("UI state reset clears results and restores defaults", () => {
  const state = createDemoState();
  state.result = { ok: true };
  state.method = "time";
  resetDemoState(state);
  assert.equal(state.method, "sample");
  assert.equal(state.result, null);
});

test("Evidence chart uses current inputs", () => {
  const a = demonstrationEvidenceChartSvg(planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 0 }), labels);
  const b = demonstrationEvidenceChartSvg(planBinomialDemonstration({ targetReliability: 0.95, confidenceLevel: 0.9, allowableFailures: 0 }), labels);
  assert.notEqual(a, b);
  assert(a.includes("Required Confidence"));
  const path = a.match(/<path d="([^"]+)"/)?.[1] || "";
  assert(path.split(" L ").length >= 100);
});

test("Evidence chart marks evaluate-mode evidence gap", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 10, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 });
  const svg = demonstrationEvidenceChartSvg(result, labels);
  assert(svg.includes("gap-marker"));
  assert(svg.includes("Evidence Gap"));
});

test("Report values match calculated page result", () => {
  const result = evaluateBinomialDemonstration({ unitsTested: 22, observedFailures: 0, targetReliability: 0.9, confidenceLevel: 0.9 });
  const insight = buildDemoInsight({ result, method: "sample", workflow: "evaluate" });
  const report = buildDemoReportHtml({ result, insight, chartSvg: "<svg></svg>", inputs: { timeUnit: "hours" }, lang: "en" });
  assert(report.includes("90.06%"));
  assert(report.includes("Target Demonstrated"));
});

test("Chinese report localizes evidence-gap assumptions", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 1000, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  const insight = buildDemoInsight({ result, method: "time", workflow: "evaluate", lang: "zh" });
  const report = buildDemoReportHtml({ result, insight, chartSvg: "", inputs: { timeUnit: "hours" }, lang: "zh" });
  assert(report.includes("新增暴露时间"));
  assert(!report.includes("additional exposure"));
});

test("Report includes plan acceptance rule and enables plan exports", () => {
  const result = planBinomialDemonstration({ targetReliability: 0.9, confidenceLevel: 0.9, allowableFailures: 0 });
  const insight = buildDemoInsight({ result, method: "sample", workflow: "plan" });
  const report = buildDemoReportHtml({ result, insight, chartSvg: "<svg></svg>", inputs: { timeUnit: "hours" }, lang: "en" });
  assert(report.includes("Acceptance Rule"));
  assert(report.includes("Test 22 units"));
});

test("Report excludes unsupported claims", () => {
  const result = evaluateExponentialDemonstration({ totalTestTime: 2302.585093, observedFailures: 0, targetMTBF: 1000, confidenceLevel: 0.9 });
  const report = buildDemoReportHtml({ result, insight: buildDemoInsight({ result, method: "time", workflow: "evaluate" }), chartSvg: "", inputs: { timeUnit: "hours" }, lang: "en" });
  for (const forbidden of ["Standards Compliance", "Guaranteed Reliability", "Qualification Passed", "Infinite MTBF", "Model Fit = Good", "Weibull Fit", "Failure mechanism confirmed"]) {
    assert(!report.includes(forbidden), forbidden);
  }
});

test("Demonstration i18n completeness", () => {
  assert.deepEqual(Object.keys(dictionary.zh).sort(), Object.keys(dictionary.en).sort());
  for (const key of ["demoTitle", "sampleBasedDemo", "timeBasedDemo", "targetDemonstrated", "pointEstimateNotEstimable"]) assert(dictionary.zh[key], key);
});

test("Life Data regression still fits Weibull fixture", () => {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  assert(fit.beta > 0);
  assert(fit.eta > 0);
});

test("MTBF regression still calculates exponential point estimate", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" });
  assert.equal(result.mtbf, 2500);
});

test("Validation blocks invalid Demonstration form state", () => {
  const state = createDemoState();
  state.inputs.targetReliability = "100";
  const validation = validateDemoInputs(state, key => key);
  assert(validation.errors.includes("demoReliabilityInvalid"));
});

test("Validation blocks fractional Demonstration number of units", () => {
  const state = createDemoState();
  state.method = "time";
  state.workflow = "plan";
  state.inputs.numberOfUnits = "2.5";
  const validation = validateDemoInputs(state, key => key);
  assert(validation.errors.includes("demoUnitsOptionalInvalid"));
});
