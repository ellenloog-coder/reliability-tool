import { t } from "./i18n.js";

export function buildReportHtml(state) {
  const { metrics, insight, validation, mapping, settings, plots, tables, curveMode } = state;
  const lang = state.lang || settings.lang || "en";
  const ui = key => t(lang, key);
  const target = metrics?.targetComparison || {};
  const unit = unitLabel(settings.timeUnit, lang);
  const rows = [
    [ui("analysisMethod"), "Weibull 2P MLE"],
    [ui("missionTime"), `${fmt(settings.missionTime)} ${unit}`],
    [ui("targetReliability"), settings.targetReliability ? `${(Number(settings.targetReliability) * 100).toFixed(2)}%` : ui("targetNotProvided")],
    [ui("localProcessing"), lang === "zh" ? "用户可靠性数据仅在浏览器本地处理，不上传、不保存。" : "User reliability data is processed locally in the browser and is not uploaded or stored."]
  ];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reliability Analysis Report</title>${reportStyle()}</head><body><main class="report">
    <h1>${escapeHtml(ui("reportTitle"))}</h1>
    <h2>1. ${escapeHtml(ui("executiveSummary"))}</h2>${table(rows)}${metrics ? `<p>${escapeHtml(summarySentence(metrics, target, lang))}</p>` : ""}
    <h2>2. ${escapeHtml(ui("studyInformation"))}</h2>${table([[ui("timeUnit"), unitLabel(settings.timeUnit, lang)], [ui("totalSamples"), validation.totalCount], [ui("failureCount"), validation.failureCount], [ui("censored"), validation.censoredCount]])}
    <h2>3. ${escapeHtml(ui("dataSummary"))}</h2><p>${escapeHtml(validation.censoredCount ? local(lang, "Right-censored observations are present and included in the likelihood.", "存在右删失数据，并已纳入似然函数。") : local(lang, "No right-censored observations were detected.", "未检测到右删失数据。"))}</p>
    <h2>4. ${escapeHtml(ui("analysisMethod"))}</h2><p>${escapeHtml(local(lang, "Weibull 2P parameters are estimated by maximum likelihood. Right-censored observations contribute to the likelihood. This MVP reports point estimates and does not report fit-quality or compliance conclusions.", "Weibull 2P 参数使用最大似然估计；右删失数据会进入似然函数。当前 MVP 仅报告点估计，不报告拟合质量或符合性结论。"))}</p>
    ${metrics ? `<h2>5. ${escapeHtml(ui("weibullResults"))}</h2>${table([[ui("betaShape"), fmt(metrics.beta)], [ui("etaScale"), `${fmt(metrics.eta)} ${unit}`], ["B1", `${fmt(metrics.b1)} ${unit}`], ["B5", `${fmt(metrics.b5)} ${unit}`], ["B10", `${fmt(metrics.b10)} ${unit}`], ["B50", `${fmt(metrics.b50)} ${unit}`], [ui("missionReliability"), pct(metrics.missionReliability)], [ui("missionFailureProbability"), pct(metrics.missionFailureProbability)]])}` : ""}
    <h2>6. ${escapeHtml(ui("reliabilityPlots"))}</h2><p>${escapeHtml(ui("probabilityPlotLimit"))}</p><p>${escapeHtml(local(lang, `Default report curve view: ${curveMode === "failure" ? "Cumulative Failure F(t)" : "Reliability R(t)"}.`, `默认报告曲线视图：${curveMode === "failure" ? "累计失效概率 F(t)" : "可靠度 R(t)"}。`))}</p><div class="plots">${plots?.probability || ""}${plots?.reliability || ""}</div>
    <h2>7. ${escapeHtml(ui("lifePercentiles"))}</h2><p>${escapeHtml(ui("lifePercentilesHint"))}</p>${lifePercentilesTable(tables?.percentiles?.rows || [], unit, ui)}
    <h2>8. ${escapeHtml(ui("reliabilityAtSelectedTimes"))}</h2>${reliabilityTimesTable(tables?.selectedTimes?.rows || [], unit, ui)}
    <h2>9. ${escapeHtml(ui("targetGap"))}</h2>${targetGapTable(tables?.targetGap, ui)}
    <h2>10. ${escapeHtml(ui("engineeringInterpretation"))}</h2>${insight ? `<p><b>${escapeHtml(localizeInsight(insight.result, lang))}</b></p><p>${escapeHtml(ui("failureRateTrend"))}: ${escapeHtml(failureRateTrendLabel(metrics?.beta, lang))}</p><p>${escapeHtml(localizeInsight(insight.meaning, lang))}</p><p>${escapeHtml(localizeInsight(insight.evidence, lang))}</p><p>${escapeHtml(ui("possibleConsiderations"))}: ${escapeHtml((insight.possibleConsiderations || []).map(item => localizeInsight(item, lang)).join(", ") || localizeInsight("No confirmed physical failure mechanism is identified by β alone.", lang))}</p>` : "<p>No Weibull interpretation is available.</p>"}
    <h2>11. ${escapeHtml(ui("targetComparison"))}</h2>${table([[ui("targetReliability"), settings.targetReliability ? pct(Number(settings.targetReliability)) : ui("targetNotProvided")], [ui("missionReliability"), metrics ? pct(metrics.missionReliability) : "-"], [ui("result"), localizeTargetStatus(target.status, lang)], [ui("targetComparison"), localizeTargetMessage(target.message, lang)], [ui("limitations"), ui("pointEstimateComparisonOnly")]])}
    <h2>12. ${escapeHtml(ui("limitations"))}</h2><ul><li>${escapeHtml(local(lang, "Possible mechanism does not mean root cause is confirmed.", "可能机理不代表根因已经确认。"))}</li><li>${escapeHtml(local(lang, "Point estimates are sensitive to small samples and heavy censoring.", "点估计会受到小样本和大量删失数据影响。"))}</li><li>${escapeHtml(local(lang, "No confidence intervals, probability bands, goodness-of-fit statistics, Anderson-Darling values, correlation coefficients, or standards-compliance conclusions are reported in this version.", "当前版本不报告置信区间、概率带、拟合优度统计、Anderson-Darling 值、相关系数或标准符合性结论。"))}</li><li>${escapeHtml(local(lang, "Legacy binary XLS parsing is limited; CSV, TSV, XLSX, and Excel HTML/XML are preferred.", "旧版二进制 XLS 解析能力有限；建议使用 CSV、TSV、XLSX 或 Excel HTML/XML。"))}</li></ul>
    <h2>13. ${escapeHtml(ui("recommendedActions"))}</h2>${insight ? `<ul>${insight.recommendedActions.map(item => `<li>${escapeHtml(localizeInsight(item, lang))}</li>`).join("")}</ul>` : `<p>${escapeHtml(local(lang, "Review mission requirements and data quality.", "复核任务要求和数据质量。"))}</p>`}
    <h2>14. ${escapeHtml(ui("dataStructure"))}</h2>${table(Object.entries(mapping).map(([k, v]) => [k, v || ui("notMapped")]))}
    <h2>15. ${escapeHtml(ui("appendix"))}</h2><p>${escapeHtml(validation.warnings.join(" ") || local(lang, "No non-blocking warnings.", "无非阻断提示。"))}</p>
  </main></body></html>`;
}

export function downloadHtml(reportHtml, fileName = "reliability-analysis-report.html") {
  const blob = new Blob([reportHtml], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export function printReport(reportHtml) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.document.write(reportHtml);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

function table(rows) {
  return `<table>${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</table>`;
}

function lifePercentilesTable(rows, unit, ui) {
  return `<table><thead><tr><th>${escapeHtml(ui("percentFailed"))}</th><th>${escapeHtml(ui("lifeMetric"))}</th><th>${escapeHtml(ui("estimatedTime"))}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.percent)}%</td><td>${escapeHtml(row.metric)}</td><td>${fmt(row.estimatedTime)} ${escapeHtml(unit)}</td></tr>`).join("")}</tbody></table>`;
}

function reliabilityTimesTable(rows, unit, ui) {
  return `<table><thead><tr><th>${escapeHtml(ui("chartTime"))}</th><th>${escapeHtml(ui("reliabilityRt"))}</th><th>${escapeHtml(ui("cumulativeFailureFt"))}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.time)} ${escapeHtml(unit)}${row.isMissionTime ? ` · ${escapeHtml(ui("missionTime"))}` : ""}</td><td>${pct(row.reliability)}</td><td>${pct(row.failureProbability)}</td></tr>`).join("")}</tbody></table>`;
}

function targetGapTable(gap, ui) {
  if (!gap) return table([[ui("targetGap"), ui("targetNotProvided")]]);
  const sign = gap.gapPercentagePoints >= 0 ? "+" : "";
  return table([[ui("predictedReliability"), pct(gap.predictedReliability)], [ui("targetReliability"), pct(gap.targetReliability)], [ui("gap"), `${sign}${gap.gapPercentagePoints.toFixed(2)} ${ui("percentagePoints")}`], [ui("limitations"), ui("pointEstimateComparisonOnly")]]);
}

function failureRateTrendLabel(beta, lang) {
  const value = Number(beta);
  if (!Number.isFinite(value)) return "-";
  if (value < 0.9) return t(lang, "decreasingFailureRateTrend");
  if (value <= 1.1) return t(lang, "constantFailureRateTrend");
  return t(lang, "increasingFailureRateTrend");
}

function reportStyle() {
  return `<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;background:#f4f6f8;color:#172033}.report{max-width:1050px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:28px;line-height:1.5}h1{font-size:34px;margin:0 0 18px;border-bottom:2px solid #2563eb;padding-bottom:10px}h2{font-size:20px;margin:24px 0 12px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #d9e0e8;padding:9px 11px;text-align:left;vertical-align:top}th{background:#f8fafc;width:220px}.plots{display:grid;gap:14px}svg{max-width:100%;height:auto;border:1px solid #d9e0e8;border-radius:8px}@media print{@page{size:A4;margin:12mm}body{background:#fff}.report{border:0;margin:0;padding:0}h1{font-size:22pt}h2{font-size:14pt;break-after:avoid}tr,svg{break-inside:avoid}}</style>`;
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 5 }) : "-";
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "-";
}

function unitLabel(unit, lang) {
  return t(lang, unit) || unit;
}

function summarySentence(metrics, target, lang) {
  const message = localizeTargetMessage(target.message, lang);
  return local(lang, `Predicted reliability at mission time is ${pct(metrics.missionReliability)}. ${message}`, `任务时间预测可靠度为 ${pct(metrics.missionReliability)}。${message}`);
}

function local(lang, en, zh) {
  return lang === "zh" ? zh : en;
}

function localizeTargetStatus(status, lang) {
  if (status === "Meets Target") return t(lang, "meetsTarget");
  if (status === "Below Target") return t(lang, "belowTarget");
  return t(lang, "targetNotProvided");
}

function localizeTargetMessage(message = "", lang) {
  if (message.includes("between 0 and 1")) return t(lang, "targetInvalidMessage");
  if (message.includes("no target reliability")) return t(lang, "targetNotProvidedMessage");
  if (message.includes("meets")) return t(lang, "meetsTargetMessage");
  if (message.includes("below")) return t(lang, "belowTargetMessage");
  return message;
}

function localizeInsight(text, lang) {
  if (lang !== "zh") return text;
  const replacements = new Map([
    ["Decreasing failure-rate behavior", "失效率随时间下降的行为"],
    ["Approximately constant failure-rate behavior", "近似恒定失效率行为"],
    ["Increasing failure-rate behavior", "失效率随时间上升的行为"],
    ["Possible early-life failure pattern.", "可能存在早期失效模式。"],
    ["Random failure pattern may be present.", "可能存在随机失效模式。"],
    ["Potential wear-out pattern.", "可能存在磨损失效模式。"],
    ["manufacturing variation", "制造波动"],
    ["process defects", "过程缺陷"],
    ["screening weakness", "筛选不足"],
    ["aging", "老化"],
    ["fatigue", "疲劳"],
    ["material degradation", "材料退化"],
    ["No confirmed physical failure mechanism is identified by beta alone.", "不能仅凭 β 确认物理失效机理。"],
    ["No confirmed physical failure mechanism is identified by β alone.", "不能仅凭 β 确认物理失效机理。"],
    ["Review right-censoring, sample size, and test stress coverage.", "复核右删失、样本量和试验应力覆盖。"],
    ["Compare predicted reliability only against an explicit mission requirement or target.", "仅在存在明确任务要求或目标时比较预测可靠度。"]
  ]);
  let output = text.replace("The fitted Weibull shape beta is", "拟合 Weibull 形状参数 β 为").replace("The fitted Weibull shape β is", "拟合 Weibull 形状参数 β 为").replace("The configured random-failure band is", "配置的随机失效区间为");
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  return output.replace("Review possible considerations:", "复核可能关注项：").replace("Do not claim a confirmed physical mechanism from beta alone.", "不要仅凭 beta 声称已确认物理机理。");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
