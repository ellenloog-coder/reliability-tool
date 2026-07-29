import test from "node:test";
import assert from "node:assert/strict";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { weibullMetrics } from "../src/reliability/metrics.js";
import { weibullProbabilityPlotSvg, reliabilityCurveSvg } from "../src/reliability/plotting.js";
import { interpretWeibull } from "../src/reliability/insight-engine.js";
import { buildReportHtml } from "../src/reliability/report.js";
import { fixture } from "./helpers.js";

function report(lang = "en", targetReliability = 0.8) {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  const metrics = weibullMetrics(fit, item.records, item.missionTime, targetReliability);
  return buildReportHtml({
    metrics,
    insight: interpretWeibull(fit.beta),
    validation: { totalCount: item.records.length, failureCount: item.failureCount, censoredCount: item.censoredCount, warnings: [] },
    mapping: lang === "zh" ? { time: "时间", status: "状态", sampleId: "样品编号" } : { time: "Time", status: "Status", sampleId: "Sample ID" },
    settings: { timeUnit: "hours", missionTime: item.missionTime, targetReliability, lang },
    plots: { probability: weibullProbabilityPlotSvg(item.records, fit), reliability: reliabilityCurveSvg(item.records, fit, item.missionTime) },
    lang
  });
}

test("English report contains required sections and excludes fake fields", () => {
  const html = report("en", 0.8);
  for (const text of ["Executive Summary", "Study Information", "Data Summary", "Analysis Method", "Weibull Results", "Reliability Plots", "Engineering Interpretation", "Target Comparison", "Limitations", "Recommended Actions", "Data Structure", "Appendix"]) {
    assert(html.includes(text), text);
  }
  assert(!html.includes("Model Fit"));
  assert(!html.includes("Confidence Interval"));
  assert(!html.includes("Standards compliance"));
});

test("No target report does not claim meets/below target", () => {
  const html = report("en", "");
  assert(html.includes("Target not provided"));
  assert(!html.includes("Meets Target"));
  assert(!html.includes("Below Target"));
});

test("Chinese report localizes section titles", () => {
  const html = report("zh", "");
  assert(html.includes("执行摘要"));
  assert(html.includes("目标比较"));
  assert(!html.includes("Executive Summary"));
  assert(!html.includes("Target Comparison"));
});
