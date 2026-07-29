import { t } from "./i18n.js";

export function buildMTBFReportHtml(state) {
  const lang = state.lang || "en";
  const ui = key => t(lang, key);
  const result = state.result;
  const input = state.inputSummary;
  const target = state.targetComparison;
  const insight = state.insight;
  const unit = unitLabel(input.timeUnit, lang);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(ui("mtbfReportTitle"))}</title>${style()}</head><body><main class="report">
    <h1>${escapeHtml(ui("mtbfReportTitle"))}</h1>
    <h2>1. ${escapeHtml(ui("executiveSummary"))}</h2>${table([[ui("analysisMethod"), ui("constantFailureRate")], [ui("localProcessing"), local(lang, "User reliability data is processed locally in the browser and is not uploaded or stored.", "用户可靠性数据仅在浏览器本地处理，不上传、不保存。")], [ui("targetMTBF"), input.targetMTBF ? fmt(input.targetMTBF) : ui("targetNotProvided")]])}
    <h2>2. ${escapeHtml(ui("studyInformation"))}</h2>${table([[ui("timeUnit"), unitLabel(input.timeUnit, lang)], [ui("inputMethod"), state.inputMode === "summary" ? ui("summaryInput") : ui("unitLevelData")]])}
    <h2>3. ${escapeHtml(ui("inputMethod"))}</h2><p>${escapeHtml(state.inputMode === "summary" ? ui("summaryInput") : ui("unitLevelData"))}</p>
    <h2>4. ${escapeHtml(ui("exposureSummary"))}</h2>${table([[ui("totalTimeOnTest"), `${fmt(result.totalExposure)} ${unit}`], [ui("failureCount"), result.failureCount], [ui("censoredCount"), result.censoredCount ?? ui("notProvided")], [ui("totalUnits"), result.totalUnits ?? ui("notProvided")]])}
    <h2>5. ${escapeHtml(ui("analysisMethod"))}</h2><p>${escapeHtml(local(lang, "Exponential constant failure-rate model. MTBF is a measure of average operating exposure between failures under the selected model. It is not the expected lifetime of every individual product.", "指数分布恒定失效率模型。MTBF 是在所选模型假设下，系统平均运行暴露时间与失效之间的关系指标，并不代表每个产品的预期寿命。"))}</p><p>${escapeHtml(ui("pointEstimateOnly"))} · ${escapeHtml(ui("noStatisticalConfidenceBounds"))}</p>
    <h2>6. ${escapeHtml(ui("mtbfResults"))}</h2>${table([[ui("failureRate"), result.failureRate == null ? ui("notEstimable") : `${fmt(result.failureRate)} ${failureRateUnitLabel(input.timeUnit, lang)}`], [ui("mtbfPointEstimate"), result.mtbf == null ? ui("notEstimable") : `${fmt(result.mtbf)} ${unit}`], [ui("missionTime"), `${fmt(result.missionTime)} ${unit}`], [ui("missionReliability"), result.missionReliability == null ? ui("notEstimable") : pct(result.missionReliability)], [ui("missionFailureProbability"), result.missionFailureProbability == null ? ui("notEstimable") : pct(result.missionFailureProbability)]])}
    <h2>7. ${escapeHtml(ui("relCurve"))}</h2><div class="plots">${state.curveSvg || `<p>${escapeHtml(ui("mtbfZeroCurveNote"))}</p>`}</div>
    <h2>8. ${escapeHtml(ui("targetComparison"))}</h2>${table([[ui("targetMTBF"), input.targetMTBF ? `${fmt(input.targetMTBF)} ${unit}` : ui("targetNotProvided")], [ui("result"), localizeTargetStatus(target?.status, lang)], [ui("targetComparison"), localizeTargetMessage(target?.message, lang)]])}
    <h2>9. ${escapeHtml(ui("engineeringInterpretation"))}</h2><p><b>${escapeHtml(localizeInsight(insight.result, lang))}</b></p><p>${escapeHtml(localizeInsight(insight.meaning, lang))}</p><p>${escapeHtml(localizeInsight(insight.evidence, lang))}</p>
    <h2>10. ${escapeHtml(ui("assumptions"))}</h2><ul>${insight.assumptions.map(item => `<li>${escapeHtml(localizeInsight(item, lang))}</li>`).join("")}</ul>
    <h2>11. ${escapeHtml(ui("limitations"))}</h2><ul>${insight.limitations.map(item => `<li>${escapeHtml(localizeInsight(item, lang))}</li>`).join("")}<li>${escapeHtml(ui("mtbfRepairableBoundary"))}</li><li>${escapeHtml(local(lang, "Confidence bounds are not included in the current version.", "当前版本尚未包含统计置信界限。"))}</li></ul>
    <h2>12. ${escapeHtml(ui("dataStructureAppendix"))}</h2>${table(Object.entries(state.mapping || {}).map(([key, value]) => [key, value || ui("notMapped")]))}
  </main></body></html>`;
}

function table(rows) {
  return `<table>${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>`;
}

function style() {
  return `<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;background:#f4f6f8;color:#172033}.report{max-width:1050px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:28px;line-height:1.5}h1{font-size:34px;margin:0 0 18px;border-bottom:2px solid #2563eb;padding-bottom:10px}h2{font-size:20px;margin:24px 0 12px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #d9e0e8;padding:9px 11px;text-align:left;vertical-align:top}th{background:#f8fafc;width:240px}.plots{display:grid;gap:14px}svg{max-width:100%;height:auto;border:1px solid #d9e0e8;border-radius:8px}@media print{@page{size:A4;margin:12mm}body{background:#fff}.report{border:0;margin:0;padding:0}h1{font-size:22pt}h2{font-size:14pt;break-after:avoid}tr,svg{break-inside:avoid}}</style>`;
}

function local(lang, en, zh) {
  return lang === "zh" ? zh : en;
}

function unitLabel(unit, lang) {
  return t(lang, unit) || unit;
}

function failureRateUnitLabel(unit, lang) {
  const keys = {
    hours: "failureRateUnitHours",
    cycles: "failureRateUnitCycles",
    days: "failureRateUnitDays",
    minutes: "failureRateUnitMinutes",
    other: "failureRateUnitOther"
  };
  return t(lang, keys[unit] || "failureRateUnitOther");
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 6 }) : "-";
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "-";
}

function localizeTargetStatus(status, lang) {
  if (status === "Meets Target") return t(lang, "meetsTarget");
  if (status === "Below Target") return t(lang, "belowTarget");
  if (status === "Not Estimable") return t(lang, "notEstimable");
  return t(lang, "targetNotProvided");
}

function localizeTargetMessage(message = "", lang) {
  if (lang !== "zh") return message || t(lang, "mtbfNoTargetMessage");
  if (message.includes("no target MTBF")) return t(lang, "mtbfNoTargetMessage");
  if (message.includes("finite positive")) return "目标 MTBF 必须为有限正数，因此未进行目标比较。";
  if (message.includes("not available")) return "MTBF 点估计不可用，因此未进行目标比较。";
  if (message.includes("meets")) return t(lang, "mtbfMeetsTargetMessage");
  if (message.includes("below")) return t(lang, "mtbfBelowTargetMessage");
  return message;
}

function localizeInsight(text, lang) {
  if (lang !== "zh") return text;
  const replacements = new Map([
    ["MTBF point estimate not available", "MTBF 点估计不可用"],
    ["The test accumulated operating exposure without an observed failure, but this does not establish infinite MTBF.", "试验累计了运行暴露时间且未观察到失效，但这并不代表 MTBF 无限大。"],
    ["A confidence-based reliability demonstration is required to quantify zero-failure evidence.", "需要基于置信度的可靠性验证来量化零失效证据。"],
    ["Limited failure information", "失效信息有限"],
    ["The MTBF point estimate is based on a small number of observed failures and may be unstable.", "MTBF 点估计基于较少失效数量，可能不稳定。"],
    ["MTBF point estimate calculated", "已计算 MTBF 点估计"],
    ["The estimate summarizes observed failure frequency under the constant failure-rate assumption.", "该估计在恒定失效率假设下概括观察到的失效频率。"],
    ["Observed MTBF meets the target point estimate", "观察 MTBF 达到目标点估计"],
    ["Observed MTBF is below the target point estimate", "观察 MTBF 低于目标点估计"],
    ["The current comparison does not include statistical confidence bounds.", "当前比较不包含统计置信界限。"],
    ["Exponential / constant failure-rate assumption", "指数分布 / 恒定失效率假设"],
    ["Failure events are treated as independent.", "失效事件按相互独立处理。"],
    ["Accumulated exposure time is treated as reliable.", "累计暴露时间被视为可信。"],
    ["The model does not evaluate changing failure rates.", "该模型不评估随时间变化的失效率。"],
    ["The result does not represent individual product lifetime.", "该结果不代表单个产品寿命。"],
    ["Unit-Level Data currently treats each row as one unit exposure record with a final Failure or Censored status. It does not model repeated failures of the same repairable system.", "当前单元级数据将每一行视为一个单元的暴露记录及最终 Failure 或 Censored 状态，不用于分析同一可维修系统的多次重复失效。"],
    ["Physical failure analysis is still required.", "仍需要物理失效分析。"],
    ["Continue accumulating exposure.", "继续累计暴露时间。"],
    ["Review failure classification.", "复核失效分类。"],
    ["Consider reliability demonstration or confidence-bound analysis.", "考虑可靠性验证或置信界限分析。"],
    ["Use Reliability Demonstration for zero-failure test evaluation.", "使用可靠性验证评估零失效试验。"],
    ["Continue accumulating exposure or define a target reliability and confidence level.", "继续累计暴露时间，或定义目标可靠性和置信水平。"]
  ]);
  let output = text;
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  return output;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
