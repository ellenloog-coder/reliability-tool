import test from "node:test";
import assert from "node:assert/strict";
import { buildReportHtml } from "../src/reliability/report.js";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { weibullMetrics } from "../src/reliability/metrics.js";
import { interpretWeibull } from "../src/reliability/insight-engine.js";
import { calculateLifePercentile, lifePercentileRows } from "../src/reliability/life-percentiles.js";
import { buildWeibullFittedLine, weibullProbabilityPlotSvg } from "../src/reliability/probability-plot.js";
import { reliabilityCurveSvg, targetGapSummary } from "../src/reliability/reliability-curve.js";
import { buildTargetGap, curvePoints, reliabilityTableRows, selectedReliabilityTimes } from "../src/reliability/reliability-table.js";
import { calculateKaplanMeierPositions, transformToWeibullCoordinates, weibullProbabilityTicks, weibullProbabilityY } from "../src/reliability/plotting-positions.js";
import { invalidateAnalysisState } from "../src/reliability/state.js";
import { dictionary } from "../src/reliability/i18n.js";
import { fixture } from "./helpers.js";

const labels = {
  probPlot: "Weibull Probability Plot",
  time: "Time",
  unit: "hours",
  cumulativeFailureProbability: "Cumulative failure probability",
  weibullLine: "Fitted Weibull line",
  failureObservation: "Failure Observation",
  rightCensored: "Right-censored",
  sample: "Sample",
  failureTime: "Failure Time",
  estimatedCumulativeFailure: "Estimated Cumulative Failure",
  status: "Status",
  failure: "Failure",
  failureMode: "Failure Mode",
  testCondition: "Test Condition",
  notProvided: "Not provided",
  reliabilityCurve: "Reliability Curve",
  reliabilityRt: "Reliability R(t)",
  cumulativeFailureFt: "Cumulative Failure F(t)",
  missionTime: "Mission Time",
  targetReliability: "Target Reliability"
};

function fittedFixture() {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  const metrics = weibullMetrics(fit, item.records, item.missionTime, 0.8);
  return { item, fit, metrics };
}

test("Weibull probability coordinate transform uses ln(t) and ln[-ln(1-F)]", () => {
  const point = transformToWeibullCoordinates(100, 0.1);
  assert.equal(point.transformedX, Math.log(100));
  assert.equal(point.transformedY, Math.log(-Math.log(0.9)));
  assert(Number.isFinite(point.transformedX));
  assert(Number.isFinite(point.transformedY));
});

test("probability ticks match the required Weibull percent scale", () => {
  assert.deepEqual(weibullProbabilityTicks(), [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99]);
  assert(weibullProbabilityTicks().every(value => Number.isFinite(weibullProbabilityY(value))));
});

test("Kaplan-Meier plotting positions are monotonic and finite", () => {
  const { item } = fittedFixture();
  const positions = calculateKaplanMeierPositions(item.records);
  assert.equal(positions.failurePositions.length, item.failureCount);
  assert.equal(positions.censoredMarkers.length, item.censoredCount);
  for (let i = 1; i < positions.failurePositions.length; i += 1) {
    assert(positions.failurePositions[i].cumulativeFailureProbability >= positions.failurePositions[i - 1].cumulativeFailureProbability);
  }
  assert(positions.failurePositions.every(point => Number.isFinite(point.transformedX) && Number.isFinite(point.transformedY)));
});

test("right-censored observations are rug markers, not probability points", () => {
  const { item } = fittedFixture();
  const positions = calculateKaplanMeierPositions(item.records);
  assert(positions.censoredMarkers.every(point => point.status === "censored"));
  assert(positions.censoredMarkers.every(point => !Object.hasOwn(point, "cumulativeFailureProbability")));
  assert(positions.failurePositions.every(point => point.status === "failure"));
});

test("fitted Weibull line uses supplied beta and eta over the requested dynamic range", () => {
  const lowBeta = buildWeibullFittedLine(1.1, 600, [90, 1540], 5);
  const highBeta = buildWeibullFittedLine(2.4, 900, [90, 1540], 5);
  assert.equal(lowBeta[0].time, 90);
  assert.equal(Number(lowBeta.at(-1).time.toFixed(9)), 1540);
  assert.notEqual(lowBeta[2].transformedY.toFixed(5), highBeta[2].transformedY.toFixed(5));
});

test("probability plot includes fitted line, required ticks, rich failure tooltip, and censored tooltip", () => {
  const { item, fit } = fittedFixture();
  const svg = weibullProbabilityPlotSvg(item.records, fit, labels);
  for (const text of ["Fitted Weibull line", "Failure Observation", "Right-censored", "1%", "2%", "5%", "10%", "50%", "90%", "99%", "Failure Mode", "Test Condition"]) {
    assert(svg.includes(text), text);
  }
});

test("probability plot draws censored observations with path markers instead of circles", () => {
  const { item, fit } = fittedFixture();
  const svg = weibullProbabilityPlotSvg(item.records, fit, labels);
  const censoredPathCount = (svg.match(/class="cens-fill"/g) || []).length;
  const failureCircleCount = (svg.match(/class="fail"/g) || []).length;
  assert(censoredPathCount >= item.censoredCount);
  assert(failureCircleCount >= item.failureCount);
});

test("reliability curve mode is monotonic decreasing", () => {
  const values = curvePoints(1.7, 900, 1500, "reliability", 20).map(point => point.value);
  for (let i = 1; i < values.length; i += 1) assert(values[i] <= values[i - 1]);
});

test("failure probability curve mode is monotonic increasing and needs no refit", () => {
  const values = curvePoints(1.7, 900, 1500, "failure", 20).map(point => point.value);
  for (let i = 1; i < values.length; i += 1) assert(values[i] >= values[i - 1]);
});

test("reliability curve shows mission marker and target line only in R(t) mode", () => {
  const { item, fit } = fittedFixture();
  const reliabilitySvg = reliabilityCurveSvg(item.records, fit, item.missionTime, labels, { mode: "reliability", targetReliability: 0.8 });
  const failureSvg = reliabilityCurveSvg(item.records, fit, item.missionTime, labels, { mode: "failure", targetReliability: 0.8 });
  assert(reliabilitySvg.includes("Mission Time"));
  assert(reliabilitySvg.includes("Target Reliability"));
  assert(failureSvg.includes("Cumulative Failure F(t)"));
  assert(!failureSvg.includes("Target Reliability ="));
});

test("target gap reports percentage point difference only when target is valid", () => {
  assert.equal(buildTargetGap(0.91, ""), null);
  assert.equal(buildTargetGap(0.91, 1), null);
  const gap = buildTargetGap(0.91, 0.9);
  assert.equal(gap.gapPercentagePoints.toFixed(2), "1.00");
  assert.deepEqual(targetGapSummary(0.85, 0.9), buildTargetGap(0.85, 0.9));
});

test("life percentiles return B1/B5/B10/B50 and a validated custom percentile", () => {
  const rows = lifePercentileRows(1.7, 900, 12.5);
  assert.deepEqual(rows.rows.map(row => row.metric), ["B1", "B5", "B10", "B50", "B12.5"]);
  assert.equal(rows.error, "");
  assert(calculateLifePercentile(1.7, 900, 10) < calculateLifePercentile(1.7, 900, 50));
});

test("invalid custom percentile preserves base rows and reports an error", () => {
  const rows = lifePercentileRows(1.7, 900, 100);
  assert.equal(rows.rows.length, 4);
  assert.match(rows.error, /greater than 0/);
});

test("selected reliability times include mission and custom time without refit inputs", () => {
  const { item } = fittedFixture();
  const selected = selectedReliabilityTimes(item.records, item.missionTime, 333);
  assert(selected.times.includes(item.missionTime));
  assert(selected.times.includes(333));
  assert.equal(selected.error, "");
});

test("reliability table returns R(t) and F(t) with a custom-time validation error", () => {
  const { item, fit } = fittedFixture();
  const table = reliabilityTableRows(fit.beta, fit.eta, item.records, item.missionTime, -5);
  assert(table.rows.some(row => row.isMissionTime));
  assert(table.rows.every(row => Math.abs(row.reliability + row.failureProbability - 1) < 1e-12));
  assert.match(table.error, /finite positive/);
});

test("report includes upgraded Life Data tables, target gap, default curve view, and limitations", () => {
  const { item, fit, metrics } = fittedFixture();
  const report = buildReportHtml({
    metrics,
    insight: interpretWeibull(fit.beta),
    validation: { totalCount: item.records.length, failureCount: item.failureCount, censoredCount: item.censoredCount, warnings: [] },
    mapping: { time: "Time", status: "Status", sampleId: "Sample ID" },
    settings: { timeUnit: "hours", missionTime: item.missionTime, targetReliability: 0.8, lang: "en" },
    plots: {
      probability: weibullProbabilityPlotSvg(item.records, fit, labels),
      reliability: reliabilityCurveSvg(item.records, fit, item.missionTime, labels, { targetReliability: 0.8 })
    },
    tables: {
      percentiles: lifePercentileRows(fit.beta, fit.eta, 12.5),
      selectedTimes: reliabilityTableRows(fit.beta, fit.eta, item.records, item.missionTime, 333),
      targetGap: targetGapSummary(metrics.missionReliability, 0.8)
    },
    curveMode: "reliability",
    lang: "en"
  });
  for (const text of ["Life Percentiles", "Reliability at Selected Times", "Target Gap", "Default report curve view", "Failure-Rate Trend"]) assert(report.includes(text), text);
  assert(report.includes("does not report fit-quality"));
  assert(report.includes("No confidence intervals, probability bands, goodness-of-fit statistics"));
  for (const unsupportedField of ["Model Fit = Good", "Confidence Interval</th>", "Anderson-Darling</th>", "Correlation Coefficient</th>", "Standards compliance</th>"]) assert(!report.includes(unsupportedField));
});

test("Chinese plot/report labels are localized for new visualization text", () => {
  const { item, fit, metrics } = fittedFixture();
  const zhLabels = {
    ...labels,
    failureObservation: dictionary.zh.failureObservation,
    rightCensored: dictionary.zh.rightCensored,
    reliabilityRt: dictionary.zh.reliabilityRt,
    cumulativeFailureFt: dictionary.zh.cumulativeFailureFt,
    missionTime: dictionary.zh.missionTime,
    targetReliability: dictionary.zh.targetReliability
  };
  const svg = weibullProbabilityPlotSvg(item.records, fit, zhLabels);
  const html = buildReportHtml({
    metrics,
    insight: interpretWeibull(fit.beta),
    validation: { totalCount: item.records.length, failureCount: item.failureCount, censoredCount: item.censoredCount, warnings: [] },
    mapping: { time: "时间", status: "状态" },
    settings: { timeUnit: "hours", missionTime: item.missionTime, targetReliability: "", lang: "zh" },
    plots: { probability: svg, reliability: reliabilityCurveSvg(item.records, fit, item.missionTime, zhLabels) },
    tables: { percentiles: lifePercentileRows(fit.beta, fit.eta), selectedTimes: reliabilityTableRows(fit.beta, fit.eta, item.records, item.missionTime), targetGap: null },
    curveMode: "reliability",
    lang: "zh"
  });
  assert(svg.includes("右删失"));
  assert(html.includes("寿命百分位"));
  assert(html.includes("失效率趋势"));
  assert(!html.includes("Failure-Rate Trend"));
});

test("Life Data state invalidation clears tables with stale plots and metrics", () => {
  const state = { fit: {}, metrics: {}, insight: {}, plots: {}, tables: {}, reportHtml: "<html></html>" };
  invalidateAnalysisState(state);
  assert.equal(state.fit, null);
  assert.equal(state.metrics, null);
  assert.equal(state.insight, null);
  assert.equal(state.plots, null);
  assert.equal(state.tables, null);
  assert.equal(state.reportHtml, null);
});
