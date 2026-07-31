import { t } from "./i18n.js";

export function buildReportHtml(state) {
  const { metrics, insight, validation = {}, settings = {}, plots = {}, tables = {}, curveMode } = state;
  const lang = state.lang || settings.lang || "en";
  const ui = key => t(lang, key);
  const target = metrics?.targetComparison || {};
  const unit = reportUnitLabel(settings.timeUnit, lang);
  const missionTime = Number(metrics?.missionTime ?? settings.missionTime);
  const targetReliability = Number(settings.targetReliability);
  const hasTarget = Number.isFinite(targetReliability) && targetReliability > 0 && targetReliability < 1;

  const summaryRows = [
    [local(lang, "Analysis Method", "分析方法"), metrics ? "Weibull 2P MLE" : null],
    [local(lang, "Sample Size", "样本量"), finiteInteger(validation.totalCount, lang)],
    [local(lang, "Failure Count", "失效数"), finiteInteger(validation.failureCount, lang)],
    ...(Number(validation.censoredCount) > 0
      ? [[local(lang, "Right-censored Observations", "右删失观测数"), finiteInteger(validation.censoredCount, lang)]]
      : []),
    [local(lang, "Time Unit", "时间单位"), unit]
  ];
  const summaryContent = `${metricTable(summaryRows, lang)}
    ${metrics ? `<p class="lead">${escapeHtml(summarySentence(metrics, target, lang))}</p>` : ""}
    ${insight ? engineeringInterpretation(insight, lang, ui) : ""}`;

  const weibullRows = metrics ? [
    [local(lang, "Shape Parameter β", "形状参数 β"), formatNumber(metrics.beta, 3, lang)],
    [local(lang, "Scale Parameter η", "尺度参数 η"), withUnit(formatNumber(metrics.eta, 1, lang), unit)],
    ["B1", withUnit(formatNumber(metrics.b1, 2, lang), unit)],
    ["B5", withUnit(formatNumber(metrics.b5, 2, lang), unit)],
    ["B10", withUnit(formatNumber(metrics.b10, 2, lang), unit)],
    ["B50", withUnit(formatNumber(metrics.b50, 1, lang), unit)]
  ] : [];
  const weibullContent = metrics
    ? `<p class="section-note">${escapeHtml(local(lang, "Weibull 2-parameter maximum-likelihood point estimates.", "Weibull 双参数最大似然点估计。"))}</p>
      <h3>${escapeHtml(ui("lifePercentiles"))}</h3>
      ${metricTable(weibullRows, lang)}`
    : "";

  const predictionRows = metrics ? [
    [local(lang, "Target Time", "目标时间"), withUnit(formatFlexible(missionTime, 2, lang), unit)],
    [local(lang, "Reliability R(t)", "可靠度 R(t)"), pct(metrics.missionReliability)],
    [local(lang, "Failure Probability F(t)", "失效概率 F(t)"), pct(metrics.missionFailureProbability)],
    [ui("targetReliability"), hasTarget ? pct(targetReliability) : ui("targetNotProvided")],
    ...(hasTarget ? [
      [local(lang, "Decision", "判定"), localizeTargetStatus(target.status, lang)]
    ] : [])
  ] : [];
  const selectedTimes = tables?.selectedTimes?.rows || [];
  const targetGap = hasTarget ? tables?.targetGap : null;
  const predictionContent = metrics
    ? `${metricTable(predictionRows, lang)}
      ${selectedTimes.length ? `<h3>${escapeHtml(ui("reliabilityAtSelectedTimes"))}</h3>${reliabilityTimesTable(selectedTimes, unit, ui, lang)}` : ""}
      ${targetGap ? `<h3>${escapeHtml(ui("targetGap"))}</h3>${targetGapTable(targetGap, ui)}` : ""}
      ${hasTarget ? `<h3>${escapeHtml(ui("targetComparison"))}</h3><p>${escapeHtml(localizeTargetMessage(target.message, lang))}</p>` : ""}`
    : "";

  const chartFigures = [
    chartFigure(
      plots?.probability,
      ui("probPlot"),
      ui("probabilityPlotLimit")
    ),
    chartFigure(
      plots?.reliability,
      ui("relCurve"),
      metrics
        ? local(
          lang,
          `Reliability at ${withUnit(formatFlexible(missionTime, 2, lang), unit)}: ${pct(metrics.missionReliability)}. Highlighted point: the specified target time.`,
          `${withUnit(formatFlexible(missionTime, 2, lang), unit)} 时的可靠度：${pct(metrics.missionReliability)}。高亮点表示指定目标时间。`
        )
        : ""
    )
  ].filter(Boolean).join("");
  const chartsContent = chartFigures
    ? `<p class="section-note">${escapeHtml(local(
      lang,
      `Default report curve view: ${curveMode === "failure" ? "Cumulative Failure F(t)" : "Reliability R(t)"}.`,
      `默认报告曲线视图：${curveMode === "failure" ? "累计失效概率 F(t)" : "可靠度 R(t)"}。`
    ))}</p>${chartFigures}`
    : "";

  const statisticalContent = metrics ? `${metricTable([
    [local(lang, "Estimation Method", "估计方法"), local(lang, "Maximum Likelihood Estimation (MLE)", "最大似然估计（MLE）")],
    [local(lang, "Censoring Treatment", "删失处理"), Number(validation.censoredCount) > 0
      ? local(lang, "Right-censored observations included in the likelihood", "右删失观测已纳入似然函数")
      : local(lang, "No right-censored observations", "无右删失观测")],
    [local(lang, "Estimate Type", "估计类型"), local(lang, "Point estimates", "点估计")],
    [local(lang, "Confidence Information", "置信信息"), local(lang, "Not available in the current version", "当前版本暂未提供")]
  ], lang)}
    <p class="section-note">${escapeHtml(local(
      lang,
      "Goodness-of-fit and Anderson-Darling statistics are not calculated in the current version and are therefore not reported.",
      "当前版本未计算拟合优度和 Anderson-Darling 统计量，因此报告中不展示相关结果。"
    ))}</p>` : "";

  const appendixContent = appendix(insight, validation.warnings || [], lang, ui);

  return `<!DOCTYPE html><html lang="${lang === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8"><title>${escapeHtml(ui("reportTitle"))}</title>${reportStyle()}</head><body><main class="report">
    <h1>${escapeHtml(ui("reportTitle"))}</h1>
    ${section(1, local(lang, "Analysis Summary", "分析摘要"), summaryContent)}
    ${section(2, local(lang, "Weibull Parameters", "Weibull 参数"), weibullContent)}
    ${section(3, local(lang, "Reliability Prediction", "可靠性预测"), predictionContent)}
    ${section(4, local(lang, "Charts", "图表"), chartsContent, "chart-section")}
    ${section(5, local(lang, "Statistical Information", "统计信息"), statisticalContent)}
    ${section(6, local(lang, "Data Information / Appendix", "数据信息 / 附录"), appendixContent)}
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
  const printWhenReady = async () => {
    try {
      await popup.document.fonts?.ready;
    } catch {
      // System-font fallback remains available if the FontFaceSet is unavailable.
    }
    const nextFrame = callback => popup.requestAnimationFrame
      ? popup.requestAnimationFrame(callback)
      : popup.setTimeout(callback, 0);
    nextFrame(() => nextFrame(() => {
      popup.focus();
      popup.print();
    }));
  };
  if (popup.document.readyState === "complete") printWhenReady();
  else popup.addEventListener("load", printWhenReady, { once: true });
  return true;
}

function section(number, title, content, className = "") {
  if (!String(content || "").trim()) return "";
  const classes = ["report-section", className].filter(Boolean).join(" ");
  return `<section class="${classes}"><h2>${number}. ${escapeHtml(title)}</h2>${content}</section>`;
}

function metricTable(rows, lang) {
  const availableRows = rows.filter(([label, value]) =>
    String(label || "").trim() && value !== null && value !== undefined && String(value).trim()
  );
  if (!availableRows.length) return "";
  return `<table class="metric-table"><thead><tr><th scope="col">${escapeHtml(local(lang, "Metric", "指标"))}</th><th scope="col">${escapeHtml(local(lang, "Value", "数值"))}</th></tr></thead><tbody>${availableRows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

function reliabilityTimesTable(rows, unit, ui, lang) {
  if (!rows.length) return "";
  return `<table class="data-table"><thead><tr><th>${escapeHtml(ui("chartTime"))}</th><th>${escapeHtml(ui("reliabilityRt"))}</th><th>${escapeHtml(ui("cumulativeFailureFt"))}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(withUnit(formatFlexible(row.time, 2, lang), unit))}${row.isMissionTime ? ` · ${escapeHtml(ui("missionTime"))}` : ""}</td><td>${pct(row.reliability)}</td><td>${pct(row.failureProbability)}</td></tr>`).join("")}</tbody></table>`;
}

function targetGapTable(gap, ui) {
  if (!gap) return "";
  const sign = gap.gapPercentagePoints >= 0 ? "+" : "";
  return `<table class="metric-table"><tbody>${[
    [ui("predictedReliability"), pct(gap.predictedReliability)],
    [ui("targetReliability"), pct(gap.targetReliability)],
    [ui("gap"), `${sign}${gap.gapPercentagePoints.toFixed(2)} ${ui("percentagePoints")}`],
    [ui("limitations"), ui("pointEstimateComparisonOnly")]
  ].map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

function chartFigure(svg, title, caption) {
  if (!String(svg || "").trim()) return "";
  return `<figure class="chart-figure"><h3>${escapeHtml(title)}</h3>${svg}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
}

function reportStyle() {
  return `<style>
    *{box-sizing:border-box}
    body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;background:#eef2f6;color:#172033;line-height:1.5}
    .report{max-width:980px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:10px;padding:34px 38px}
    h1{font-size:32px;margin:0 0 22px;border-bottom:3px solid #2563eb;padding-bottom:12px;color:#172033}
    h2{font-size:20px;margin:0 0 13px;color:#172033}
    h3{font-size:15px;margin:18px 0 9px;color:#344054}
    p{margin:8px 0 12px}
    .lead{font-size:16px;color:#344054}
    .section-note,figcaption{font-size:13px;color:#475467}
    .report-section{border-top:1px solid #e4e7ec;padding-top:20px;margin-top:24px}
    table{width:100%;border-collapse:collapse;margin:10px 0 16px;color:#172033}
    th,td{border:1px solid #cfd8e3;padding:9px 11px;text-align:left;vertical-align:top;color:#172033}
    thead th{background:#eaf0f7;font-weight:700}
    .metric-table th[scope="row"]{background:#f6f8fb;font-weight:650;width:42%}
    .data-table th{background:#eaf0f7}
    .interpretation{border-left:4px solid #2563eb;background:#f6f8fb;padding:10px 14px;margin-top:14px}
    .chart-figure{margin:14px 0 22px;border:1px solid #d9e0e8;border-radius:8px;padding:14px;background:#fff}
    .chart-figure h3{margin:0 0 10px}
    .chart-figure svg{display:block;width:100%;height:auto;border:0}
    .chart-figure figcaption{border-top:1px solid #e4e7ec;margin-top:10px;padding-top:9px}
    ul{margin:8px 0 14px;padding-left:22px}
    @media print{
      @page{size:A4;margin:14mm}
      html,body{background:#fff}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .report{border:0;margin:0;padding:0;max-width:none}
      h1{font-size:22pt}
      h2{font-size:14pt;break-after:avoid-page}
      h3{break-after:avoid-page}
      .report-section:not(.chart-section){break-inside:avoid-page}
      .chart-section{break-before:page;break-inside:auto}
      table,.interpretation,.chart-figure{break-inside:avoid-page}
      tr{break-inside:avoid}
      th,td,h1,h2,h3,p,li{color:#172033!important}
      thead th{background:#eaf0f7!important}
      .metric-table th[scope="row"]{background:#f6f8fb!important}
    }
  </style>`;
}

function engineeringInterpretation(insight, lang, ui) {
  const considerations = (insight.possibleConsiderations || [])
    .map(item => localizeInsight(item, lang))
    .filter(Boolean);
  return `<div class="interpretation"><h3>${escapeHtml(ui("engineeringInterpretation"))}</h3>
    <p><strong>${escapeHtml(ui("failureRateTrend"))}:</strong> ${escapeHtml(localizeInsight(insight.result, lang))}</p>
    <p>${escapeHtml(localizeInsight(insight.meaning, lang))}</p>
    <p>${escapeHtml(localizeInsight(insight.evidence, lang))}</p>
    ${considerations.length ? `<p><strong>${escapeHtml(ui("possibleConsiderations"))}:</strong> ${escapeHtml(considerations.join(", "))}</p>` : ""}
  </div>`;
}

function appendix(insight, warnings, lang, ui) {
  const limitations = [
    local(lang, "Point estimates are sensitive to small samples and heavy censoring.", "点估计会受到小样本和大量删失数据影响。"),
    local(lang, "Confidence bounds and formal goodness-of-fit statistics are not available in the current version.", "当前版本暂未提供置信界限和正式拟合优度统计量。"),
    local(lang, "Statistical interpretation does not confirm a physical root cause.", "统计解释不能确认物理根因。")
  ];
  const recommendations = (insight?.recommendedActions || []).map(item => localizeInsight(item, lang)).filter(Boolean);
  const warningContent = warnings.length
    ? `<h3>${escapeHtml(local(lang, "Data Warnings", "数据提示"))}</h3><ul>${warnings.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `<p class="section-note">${escapeHtml(local(
    lang,
    "Internal import mappings and extraction diagnostics are intentionally omitted from this user report.",
    "本用户报告有意省略内部导入映射和提取诊断信息。"
  ))}</p>
    <h3>${escapeHtml(ui("limitations"))}</h3><ul>${limitations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${recommendations.length ? `<h3>${escapeHtml(ui("recommendedActions"))}</h3><ul>${recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${warningContent}`;
}

function formatNumber(value, decimals, lang) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatFlexible(value, maximumFractionDigits, lang) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  });
}

function finiteInteger(value, lang) {
  return Number.isFinite(Number(value)) ? formatNumber(value, 0, lang) : null;
}

function withUnit(value, unit) {
  return value === "-" ? value : `${value} ${unit}`.trim();
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "-";
}

function reportUnitLabel(unit, lang) {
  const units = {
    hours: "h",
    cycles: lang === "zh" ? "次" : "cycles",
    days: "d",
    minutes: "min",
    other: lang === "zh" ? "单位" : "units"
  };
  return units[unit] || t(lang, unit) || unit || "";
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
