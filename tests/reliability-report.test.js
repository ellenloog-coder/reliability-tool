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
  for (const text of ["Analysis Summary", "Weibull Parameters", "Reliability Prediction", "Charts", "Statistical Information", "Data Information / Appendix", "Engineering Interpretation", "Target Comparison", "Limitations", "Recommended Actions"]) {
    assert(html.includes(text), text);
  }
  assert(html.includes('<th scope="col">Metric</th>'));
  assert(html.includes('<th scope="col">Value</th>'));
  assert(!/<h[23][^>]*>\s*(?:\d+\.\s*)?<\/h[23]>/.test(html));
  assert(!html.includes("<tbody></tbody>"));
  assert(!html.includes("Model Fit"));
  assert(!html.includes("Confidence Interval"));
  assert(!html.includes("Standards compliance"));
  assert(!html.includes('<th scope="row">sampleId</th>'));
  assert(!html.includes('<th scope="row">failureMode</th>'));
});

test("No target report does not claim meets/below target", () => {
  const html = report("en", "");
  assert(html.includes("Target not provided"));
  assert(!html.includes("Meets Target"));
  assert(!html.includes("Below Target"));
});

test("Chinese report localizes section titles", () => {
  const html = report("zh", "");
  assert(html.includes('<html lang="zh-CN">'));
  assert(html.includes('"PingFang SC"'));
  for (const title of ["分析摘要", "Weibull 参数", "可靠性预测", "图表", "统计信息", "数据信息 / 附录"]) {
    assert(html.includes(title), title);
  }
  assert(html.includes("指标"));
  assert(html.includes("数值"));
  assert(!html.includes("Analysis Summary"));
  assert(!html.includes("Statistical Information"));
});

test("report uses deterministic engineering number formatting", () => {
  const html = buildReportHtml({
    metrics: {
      beta: 1.8569539916901703,
      eta: 2128.29203465823,
      b1: 178.71988943584796,
      b5: 429.9102681498103,
      b10: 633.4718607051329,
      b50: 1747.0813805507328,
      missionTime: 1275,
      missionReliability: 0.6796488440883219,
      missionFailureProbability: 0.32035115591167806,
      targetComparison: { status: "Target not provided", message: "Reliability risk not assessed — no target reliability was provided." }
    },
    validation: { totalCount: 15, failureCount: 7, censoredCount: 8, warnings: [] },
    settings: { timeUnit: "hours", missionTime: 1275, targetReliability: "", lang: "en" },
    plots: {},
    tables: {},
    lang: "en"
  });
  for (const value of ["1.857", "2,128.3 h", "178.72 h", "429.91 h", "633.47 h", "1,747.1 h", "1,275 h", "67.96%", "32.04%"]) {
    assert(html.includes(value), value);
  }
  assert(!html.includes("1,7471"));
});
