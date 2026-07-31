import { t } from "../i18n.js";

export function buildDemoReportHtml(state) {
  const lang = state.lang || "en";
  const ui = key => t(lang, key);
  const result = state.result;
  const insight = state.insight;
  const unit = unitLabel(state.inputs.timeUnit, lang);
  return `<!DOCTYPE html><html lang="${lang === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8"><title>${escapeHtml(ui("demoReportTitle"))}</title>${style()}</head><body><main class="report">
    <h1>${escapeHtml(ui("demoReportTitle"))}</h1>
    <h2>1. ${escapeHtml(ui("executiveSummary"))}</h2>${table([[ui("analysisMethod"), methodLabel(result, ui)], [ui("workflow"), workflowLabel(result.workflow, ui)], [ui("result"), result.workflow === "evaluate" ? demonstratedLabel(result.demonstrated, ui) : ui("demoRequiredEvidenceCalculated")], [ui("localProcessing"), local(lang, "User reliability data is processed locally in the browser and is not uploaded or stored.", "用户可靠性数据仅在浏览器本地处理，不上传、不保存。")]])}
    <h2>2. ${escapeHtml(ui("demoMethod"))}</h2><p>${escapeHtml(methodDescription(result, lang))}</p>
    <h2>3. ${escapeHtml(ui("workflow"))}</h2><p>${escapeHtml(workflowLabel(result.workflow, ui))}</p>
    <h2>4. ${escapeHtml(ui("demoTargetDefinition"))}</h2>${targetTable(result, unit, ui)}
    <h2>5. ${escapeHtml(ui("demoTestEvidence"))}</h2>${evidenceTable(result, unit, ui)}
    <h2>6. ${escapeHtml(ui("demoStatisticalMethod"))}</h2><p>${escapeHtml(statisticalMethodText(result, lang))}</p>
    <h2>7. ${escapeHtml(ui("demoResults"))}</h2>${resultTable(result, unit, ui, lang)}
    <h2>8. ${escapeHtml(ui("demoEvidenceChart"))}</h2><div class="plots">${state.chartSvg || ""}</div>
    <h2>9. ${escapeHtml(ui("demoEvidenceGap"))}</h2>${gapTable(result, unit, ui, lang)}
    <h2>10. ${escapeHtml(ui("engineeringInterpretation"))}</h2><p><b>${escapeHtml(localizeInsight(insight.result, lang))}</b></p><p>${escapeHtml(localizeInsight(insight.meaning, lang))}</p><p>${escapeHtml(localizeInsight(insight.evidence, lang))}</p>
    <h2>11. ${escapeHtml(ui("assumptions"))}</h2><ul>${insight.assumptions.map(item => `<li>${escapeHtml(localizeInsight(item, lang))}</li>`).join("")}</ul>
    <h2>12. ${escapeHtml(ui("limitations"))} / ${escapeHtml(ui("appendix"))}</h2><ul>${insight.limitations.map(item => `<li>${escapeHtml(localizeInsight(item, lang))}</li>`).join("")}<li>${escapeHtml(local(lang, "Demonstration conclusions depend on the selected model and test definition.", "可靠性验证结论依赖所选模型和试验定义。"))}</li><li>${escapeHtml(local(lang, "Statistical demonstration is not confirmation of a physical failure mechanism.", "统计验证不等于确认物理失效机理。"))}</li></ul>
  </main></body></html>`;
}

function targetTable(result, unit, ui) {
  const rows = [];
  if (result.method === "sample") rows.push([ui("targetReliability"), pct(result.targetReliability)]);
  else {
    rows.push([ui("targetMTBF"), `${fmt(result.targetMTBF)} ${unit}`]);
    if (result.targetDefinition === "reliability") rows.push([ui("targetReliability"), pct(result.targetReliability)], [ui("missionTime"), `${fmt(result.missionTime)} ${unit}`]);
  }
  rows.push([ui("confidenceLevel"), pct(result.confidenceLevel ?? result.requiredConfidence)]);
  return table(rows);
}

function evidenceTable(result, unit, ui) {
  if (result.method === "sample" && result.workflow === "plan") return table([[ui("allowableFailures"), result.allowableFailures], [ui("missionTime"), result.missionTime ? `${fmt(result.missionTime)} ${unit}` : ui("notProvided")]]);
  if (result.method === "sample") return table([[ui("unitsTested"), result.unitsTested], [ui("observedFailures"), result.observedFailures], [ui("observedPassRate"), pct(result.observedPassRate)]]);
  if (result.workflow === "plan") return table([[ui("allowableFailures"), result.allowableFailures], [ui("numberOfUnits"), result.numberOfUnits ?? ui("notProvided")]]);
  return table([[ui("totalTestTime"), `${fmt(result.totalTestTime)} ${unit}`], [ui("observedFailures"), result.observedFailures]]);
}

function resultTable(result, unit, ui, lang) {
  if (result.method === "sample" && result.workflow === "plan") return table([[ui("requiredSampleSize"), result.requiredSampleSize], [ui("achievedConfidence"), pct(result.achievedConfidenceAtRequiredN)], [ui("acceptanceRule"), acceptanceRuleText(result, unit, lang)], [ui("minimalityVerified"), result.minimalityVerified ? ui("yes") : ui("no")]]);
  if (result.method === "sample") return table([[ui("reliabilityLowerBound"), pct(result.reliabilityLowerBound)], [ui("targetReliability"), pct(result.targetReliability)], [ui("requiredConfidence"), pct(result.requiredConfidence)], [ui("achievedConfidenceAtTarget"), pct(result.achievedConfidenceAtTarget)], [ui("result"), demonstratedLabel(result.demonstrated, ui)]]);
  if (result.workflow === "plan") return table([[ui("requiredTotalTestTime"), `${fmt(result.requiredTotalTestTime)} ${unit}`], [ui("estimatedTimePerUnit"), result.estimatedTimePerUnit ? `${fmt(result.estimatedTimePerUnit)} ${unit}` : ui("notProvided")], [ui("requiredExposureFactor"), fmt(result.requiredExposureFactor)], [ui("achievedConfidence"), pct(result.achievedConfidence)], [ui("acceptanceRule"), acceptanceRuleText(result, unit, lang)]]);
  return table([[ui("mtbfPointEstimate"), result.mtbfPointEstimate == null ? ui("pointEstimateNotEstimable") : `${fmt(result.mtbfPointEstimate)} ${unit}`], [ui("mtbfLowerBound"), `${fmt(result.mtbfLowerBound)} ${unit}`], [ui("targetMTBF"), `${fmt(result.targetMTBF)} ${unit}`], [ui("reliabilityLowerBoundAtMission"), result.reliabilityLowerBoundAtMissionTime == null ? ui("notProvided") : pct(result.reliabilityLowerBoundAtMissionTime)], [ui("requiredConfidence"), pct(result.requiredConfidence)], [ui("achievedConfidenceAtTarget"), pct(result.achievedConfidenceAtTarget)], [ui("result"), demonstratedLabel(result.demonstrated, ui)]]);
}

function gapTable(result, unit, ui, lang) {
  if (result.workflow !== "evaluate") return table([[ui("demoEvidenceGap"), ui("notProvided")]]);
  if (result.method === "sample") return table([[ui("additionalUnitsRequired"), result.evidenceGap.additionalUnitsRequired], [ui("assumptions"), localizeGapAssumption(result.evidenceGap.assumption, lang)]]);
  return table([[ui("additionalTestTimeRequired"), `${fmt(result.evidenceGap.additionalTotalTestTimeRequired)} ${unit}`], [ui("assumptions"), localizeGapAssumption(result.evidenceGap.assumption, lang)]]);
}

function methodLabel(result, ui) {
  return result.method === "sample" ? `${ui("sampleBasedDemo")} / ${ui("binomialModel")}` : `${ui("timeBasedDemo")} / ${ui("exponentialModel")}`;
}

function workflowLabel(workflow, ui) {
  return workflow === "plan" ? ui("planTest") : ui("evaluateTestResults");
}

function demonstratedLabel(value, ui) {
  return value ? ui("targetDemonstrated") : ui("targetNotDemonstrated");
}

function acceptanceRuleText(result, unit, lang) {
  if (lang === "zh") {
    if (result.method === "sample") return `测试 ${fmt(result.requiredSampleSize)} 个样品，失效数量不得超过 ${fmt(result.allowableFailures)} 个。`;
    return `累计至少 ${fmt(result.requiredTotalTestTime)} ${unit} 的运行暴露时间，失效数量不得超过 ${fmt(result.allowableFailures)} 个。`;
  }
  if (result.method === "sample") return result.acceptanceRule;
  return `Accumulate at least ${fmt(result.requiredTotalTestTime)} ${unit} and observe no more than ${fmt(result.allowableFailures)} failures.`;
}

function localizeGapAssumption(text, lang) {
  if (lang !== "zh") return text;
  if (text.includes("No additional units")) return "无需增加样品。";
  if (text.includes("No additional exposure")) return "无需增加暴露时间。";
  if (text.includes("added units")) return "该估计假设新增测试样品中不再发生额外失效。";
  if (text.includes("additional exposure")) return "该估计假设新增暴露时间内不再发生额外失效。";
  return text;
}

function methodDescription(result, lang) {
  if (result.method === "sample") return local(lang, "Exact binomial demonstration for independent pass/fail units at the same mission definition.", "基于精确二项模型，适用于相同任务定义下相互独立的通过/失效样品。");
  return local(lang, "Exponential constant failure-rate demonstration using accumulated operating exposure.", "基于指数分布恒定失效率假设，使用累计运行暴露时间进行可靠性验证。");
}

function statisticalMethodText(result, lang) {
  if (result.method === "sample") return local(lang, "Uses exact binomial CDF and one-sided reliability lower bound. No normal approximation is used.", "使用精确二项分布 CDF 和单侧可靠度置信下限，不使用正态近似。");
  return local(lang, "Uses Poisson exposure factor and one-sided exponential MTBF lower confidence bound. No Weibull fit is performed.", "使用泊松暴露因子和单侧指数模型 MTBF 置信下限，不执行 Weibull 拟合。");
}

function table(rows) {
  return `<table>${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>`;
}

function style() {
  return `<style>body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;background:#f4f6f8;color:#172033}.report{max-width:1050px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:28px;line-height:1.5}h1{font-size:34px;margin:0 0 18px;border-bottom:2px solid #2563eb;padding-bottom:10px}h2{font-size:20px;margin:24px 0 12px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #d9e0e8;padding:9px 11px;text-align:left;vertical-align:top}th{background:#f8fafc;width:240px}.plots{display:grid;gap:14px}svg{max-width:100%;height:auto;border:1px solid #d9e0e8;border-radius:8px}@media print{@page{size:A4;margin:12mm}body{background:#fff}.report{border:0;margin:0;padding:0}h1{font-size:22pt}h2{font-size:14pt;break-after:avoid}tr,svg{break-inside:avoid}}</style>`;
}

function localizeInsight(text, lang) {
  if (lang !== "zh") return text;
  const replacements = new Map([
    ["Required evidence calculated", "已计算所需证据"],
    ["Target demonstrated at the selected confidence level", "在所选置信水平下已证明达到目标"],
    ["Target not demonstrated at the selected confidence level", "在所选置信水平下尚未证明达到目标"],
    ["The result is based on the exact binomial model, the selected target reliability, and the selected confidence level.", "该结果基于精确二项模型、所选目标可靠度和置信水平。"],
    ["The result is based on the exponential constant failure-rate model, the selected target, and the selected confidence level.", "该结果基于指数分布恒定失效率模型、所选目标和置信水平。"],
    ["Independent pass/fail observations", "通过/失效观测相互独立"],
    ["Same mission definition for all units", "所有样品采用相同任务定义"],
    ["No time-to-failure modeling", "不进行失效时间建模"],
    ["Exponential constant failure-rate assumption", "指数分布恒定失效率假设"],
    ["Independent failure events", "失效事件相互独立"],
    ["Accumulated exposure time is treated as reliable", "累计暴露时间被视为可信"],
    ["No reliability growth evaluation", "不评估可靠性增长"],
    ["Statistical demonstration does not confirm a physical failure mechanism", "统计验证不确认物理失效机理"],
    ["No failure-rate trend evaluation", "不评估失效率趋势"],
    ["No repairable-system growth modeling", "不建模可维修系统增长"],
    ["Confirm mission definition", "确认任务定义"],
    ["Confirm failure classification", "确认失效分类"],
    ["Continue testing to close the evidence gap", "继续测试以缩小证据差距"],
    ["Review whether the exponential assumption is appropriate", "复核指数分布假设是否适用"],
    ["Use Life Data if failure times and censoring information are available", "如有失效时间和删失信息，请使用寿命数据模块"],
    ["Review the allowable-failure rule with stakeholders", "与相关方复核允许失效准则"],
    ["Use the lower confidence bound instead of an infinite point estimate", "使用置信下限，不使用无限大的点估计"]
  ]);
  let output = text;
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  output = output.replace("Required sample size is", "所需样本量为").replace("achieved confidence is", "实际达到的置信水平为").replace("Reliability lower bound is", "可靠度置信下限为").replace("achieved confidence at target is", "目标处实际达到的置信水平为").replace("Required total test time is", "所需累计测试时间为").replace("exposure factor is", "暴露因子为").replace("MTBF lower bound is", "MTBF 置信下限为");
  return output;
}

function unitLabel(unit, lang) {
  return t(lang, unit) || unit;
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 6 }) : "-";
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "-";
}

function local(lang, en, zh) {
  return lang === "zh" ? zh : en;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
