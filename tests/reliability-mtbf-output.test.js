import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExponentialMTBF, compareTargetMTBF } from "../src/reliability/mtbf.js";
import { buildMTBFInsight } from "../src/reliability/mtbf-insight.js";
import { mtbfCurvePoints, mtbfReliabilityCurveSvg } from "../src/reliability/mtbf-plotting.js";
import { buildMTBFReportHtml } from "../src/reliability/mtbf-report.js";
import { createMTBFState, invalidateMTBFResult, resetMTBFState } from "../src/reliability/mtbf-state.js";

test("MTBF reliability curve is exponential and includes the mission marker", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 250, timeUnit: "hours" });
  const points = mtbfCurvePoints(result, 12);
  assert.equal(points[0].reliability, 1);
  assert(points.at(-1).reliability < points[1].reliability);
  assert.equal(points.every(point => point.failureProbability >= 0 && point.failureProbability <= 1), true);
  const svg = mtbfReliabilityCurveSvg(result, { reliabilityCurve: "Reliability Curve", exponentialCurve: "Exponential reliability curve", time: "Time", reliability: "Reliability" });
  assert.match(svg, /mission/);
  assert.match(svg, /Exponential reliability curve/);
  assert(!svg.includes("Weibull"));
});

test("zero-failure MTBF curve output is empty", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 0, missionTime: 250, timeUnit: "hours" });
  assert.equal(mtbfReliabilityCurveSvg(result), "");
  assert.deepEqual(mtbfCurvePoints(result), []);
});

test("MTBF report uses the required section structure and avoids unsupported claims", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 250, timeUnit: "hours", censoredCount: null, totalUnits: null });
  const targetComparison = compareTargetMTBF(result.mtbf, 2000);
  const report = buildMTBFReportHtml({
    inputMode: "summary",
    inputSummary: { totalExposure: 10000, failureCount: 4, censoredCount: null, totalUnits: null, missionTime: 250, targetMTBF: 2000, timeUnit: "hours" },
    result,
    targetComparison,
    insight: buildMTBFInsight(result, targetComparison),
    curveSvg: "<svg></svg>",
    mapping: { totalExposure: "Total Time on Test", failureCount: "Failure Count" },
    lang: "en"
  });
  for (const section of ["Executive Summary", "Study Information", "Input Method", "Exposure Summary", "Analysis Method", "MTBF Results", "Reliability Curve", "Target Comparison", "Engineering Interpretation", "Assumptions", "Limitations", "Data Structure / Appendix"]) {
    assert(report.includes(section));
  }
  for (const forbidden of ["Confidence Interval", "Model Fit", "Pass Qualification", "Infinite MTBF"]) {
    assert(!report.includes(forbidden));
  }
});

test("zero-failure MTBF report marks the point estimate as not estimable", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 0, missionTime: 250, timeUnit: "hours" });
  const targetComparison = compareTargetMTBF(result.mtbf, 2000);
  const report = buildMTBFReportHtml({
    inputMode: "summary",
    inputSummary: { totalExposure: 10000, failureCount: 0, censoredCount: null, totalUnits: null, missionTime: 250, targetMTBF: 2000, timeUnit: "hours" },
    result,
    targetComparison,
    insight: buildMTBFInsight(result, targetComparison),
    curveSvg: "",
    mapping: { totalExposure: "Total Time on Test", failureCount: "Failure Count" },
    lang: "en"
  });
  assert(report.includes("MTBF Point Estimate"));
  assert(report.includes("Not Estimable"));
  assert(!report.includes("Infinity"));
});

test("MTBF state invalidation clears old results while keeping inputs", () => {
  const state = createMTBFState();
  state.summary.totalExposure = "1000";
  state.result = { mtbf: 1000 };
  state.reportHtml = "<html></html>";
  invalidateMTBFResult(state);
  assert.equal(state.summary.totalExposure, "1000");
  assert.equal(state.result, null);
  assert.equal(state.reportHtml, null);
  resetMTBFState(state);
  assert.equal(state.summary.totalExposure, "");
  assert.equal(state.inputMode, "summary");
});
