import { buildTargetGap, curvePoints } from "./reliability-table.js";
import { failureProbabilityAt, reliabilityAt } from "./metrics.js";
import { RESULT_CHART_SIZE, RESULT_CHART_TYPE } from "./chart-layout.js";

export function reliabilityCurveSvg(records, fit, missionTime, labels = {}, options = {}) {
  const mode = options.mode === "failure" ? "failure" : "reliability";
  const requestedWidth = Number(options.width);
  const width = Number.isFinite(requestedWidth) ? Math.max(480, requestedWidth) : RESULT_CHART_SIZE.full.width;
  const maxDataTime = Math.max(...records.map(record => record.time), Number(missionTime) || 0, 1);
  const maxT = maxDataTime * 1.12;
  const points = curvePoints(fit.beta, fit.eta, maxT, mode, 120);
  const missionReliability = reliabilityAt(
    Number(missionTime),
    fit.beta,
    fit.eta
  );
  const missionFailureProbability = failureProbabilityAt(
    Number(missionTime),
    fit.beta,
    fit.eta
  );
  return reliabilityCurveFromDataSvg(
    points,
    {
      missionTime: Number(missionTime),
      missionReliability,
      missionFailureProbability
    },
    labels,
    { ...options, mode, width }
  );
}

export function reliabilityCurveFromDataSvg(
  points,
  mission,
  labels = {},
  options = {}
) {
  const mode = options.mode === "failure"
    ? "failure"
    : "reliability";
  const requestedWidth = Number(options.width);
  const width = Number.isFinite(requestedWidth)
    ? Math.max(480, requestedWidth)
    : RESULT_CHART_SIZE.full.width;
  const height = RESULT_CHART_SIZE.split.height;
  const m = { l: 58, r: 16, t: 28, b: 36 };
  const maxT = Math.max(
    ...points.map(point => point.time),
    Number(mission.missionTime) || 0,
    1
  );
  const sx = time => m.l + (time / maxT) * (width - m.l - m.r);
  const sy = value => height - m.b - value * (height - m.t - m.b);
  const curve = points.map((point, index) => `${index ? "L" : "M"} ${sx(point.time).toFixed(1)} ${sy(point.value).toFixed(1)}`).join(" ");
  const missionTime = Number(mission.missionTime);
  const missionReliability = Number(mission.missionReliability);
  const missionFailureProbability = Number(
    mission.missionFailureProbability
  );
  const missionValue = mode === "failure" ? missionFailureProbability : missionReliability;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(value => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(value)}" y2="${sy(value)}" class="grid"/><text x="${m.l - 8}" y="${sy(value) + 3}" text-anchor="end">${Math.round(value * 100)}%</text>`).join("");
  const xTicks = [0, maxT / 2, maxT].map(time => `<line x1="${sx(time).toFixed(1)}" x2="${sx(time).toFixed(1)}" y1="${height - m.b}" y2="${height - m.b + 4}" class="axis"/><text x="${sx(time).toFixed(1)}" y="${height - m.b + 16}" text-anchor="middle">${formatNumber(time)}</text>`).join("");
  const targetReliability = Number(options.targetReliability);
  const target = Number.isFinite(targetReliability)
    ? (mode === "failure" ? 1 - targetReliability : targetReliability)
    : NaN;
  const targetLabel = mode === "failure"
    ? labels.targetFailureProbability || "Target Failure Probability"
    : labels.targetReliability || "Target Reliability";
  const targetLine = Number.isFinite(target) && target > 0 && target < 1
    ? `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(target).toFixed(1)}" y2="${sy(target).toFixed(1)}" class="target"/><text x="${width - m.r - 4}" y="${(sy(target) - 7).toFixed(1)}" text-anchor="end">${escapeHtml(targetLabel)} = ${(target * 100).toFixed(1)}%</text>`
    : "";
  const hoverPoints = points.filter((_, index) => index % 4 === 0).map(point => `<circle cx="${sx(point.time).toFixed(1)}" cy="${sy(point.value).toFixed(1)}" r="8" class="hover"><title>${curveTooltip(point, labels)}</title></circle>`).join("");
  const chartLabel = mode === "failure"
    ? labels.cumulativeFailureFt || "Cumulative Failure F(t)"
    : labels.reliabilityRt || "Reliability R(t)";
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chartLabel)}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.fit{fill:none;stroke:#2563eb;stroke-width:2.2}.target{stroke:#b45309;stroke-dasharray:4 4}.mission{stroke:#0f766e;stroke-dasharray:5 5}.point{fill:#0f766e}.hover{fill:transparent;stroke:transparent}text{font:${RESULT_CHART_TYPE.axisFontSize}px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.legend-text{font-size:${RESULT_CHART_TYPE.legendFontSize}px;font-weight:650}</style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${grid}${xTicks}
    <line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${height - m.b}" class="axis"/>
    ${targetLine}
    <path d="${curve}" class="fit"><title>${escapeHtml(chartLabel)}</title></path>
    ${hoverPoints}
    <line x1="${sx(Number(missionTime)).toFixed(1)}" x2="${sx(Number(missionTime)).toFixed(1)}" y1="${m.t}" y2="${height - m.b}" class="mission"/>
    <circle cx="${sx(Number(missionTime)).toFixed(1)}" cy="${sy(missionValue).toFixed(1)}" r="5" class="point"><title>${missionTooltip(Number(missionTime), missionReliability, missionFailureProbability, labels)}</title></circle>
    <g transform="translate(${width / 2 - 72} 13)"><line x1="0" x2="18" y1="0" y2="0" class="fit"/><text x="24" y="3" class="legend-text">${escapeHtml(chartLabel)}</text></g>
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(labels.time || "Time")}</text>
    <text transform="translate(14 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(chartLabel)}</text>
    <text x="${sx(Number(missionTime)).toFixed(1)}" y="${m.t + 10}" text-anchor="middle">${escapeHtml(labels.missionTime || "Mission Time")}</text>
  </svg>`;
}

export function targetGapSummary(predictedReliability, targetReliability) {
  return buildTargetGap(predictedReliability, targetReliability);
}

function curveTooltip(point, labels) {
  return escapeHtml([
    `${labels.time || "Time"}: ${formatNumber(point.time)} ${labels.unit || ""}`.trim(),
    `${labels.reliabilityRt || "Reliability R(t)"}: ${formatPercent(point.reliability)}`,
    `${labels.cumulativeFailureFt || "Cumulative Failure F(t)"}: ${formatPercent(point.failureProbability)}`
  ].join("\n"));
}

function missionTooltip(time, reliability, failureProbability, labels) {
  return escapeHtml([
    `${labels.time || "Time"}: ${formatNumber(time)} ${labels.unit || ""}`.trim(),
    `${labels.reliabilityRt || "Reliability R(t)"}: ${formatPercent(reliability)}`,
    `${labels.cumulativeFailureFt || "Cumulative Failure F(t)"}: ${formatPercent(failureProbability)}`
  ].join("\n"));
}

function formatPercent(value) {
  const percent = value * 100;
  if (Math.abs(percent) > 0 && Math.abs(percent) < 0.01) return `${percent.toExponential(2)}%`;
  return `${percent.toFixed(2)}%`;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
