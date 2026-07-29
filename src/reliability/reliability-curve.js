import { buildTargetGap, curvePoints } from "./reliability-table.js";
import { failureProbabilityAt, reliabilityAt } from "./metrics.js";

export function reliabilityCurveSvg(records, fit, missionTime, labels = {}, options = {}) {
  const mode = options.mode === "failure" ? "failure" : "reliability";
  const width = 760;
  const height = 350;
  const m = { l: 64, r: 24, t: 28, b: 58 };
  const maxDataTime = Math.max(...records.map(record => record.time), Number(missionTime) || 0, 1);
  const maxT = maxDataTime * 1.12;
  const points = curvePoints(fit.beta, fit.eta, maxT, mode, 120);
  const sx = time => m.l + (time / maxT) * (width - m.l - m.r);
  const sy = value => height - m.b - value * (height - m.t - m.b);
  const curve = points.map((point, index) => `${index ? "L" : "M"} ${sx(point.time).toFixed(1)} ${sy(point.value).toFixed(1)}`).join(" ");
  const missionReliability = reliabilityAt(Number(missionTime), fit.beta, fit.eta);
  const missionFailureProbability = failureProbabilityAt(Number(missionTime), fit.beta, fit.eta);
  const missionValue = mode === "failure" ? missionFailureProbability : missionReliability;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(value => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(value)}" y2="${sy(value)}" class="grid"/><text x="${m.l - 10}" y="${sy(value) + 4}" text-anchor="end">${Math.round(value * 100)}%</text>`).join("");
  const target = mode === "reliability" ? Number(options.targetReliability) : NaN;
  const targetLine = Number.isFinite(target) && target > 0 && target < 1
    ? `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(target).toFixed(1)}" y2="${sy(target).toFixed(1)}" class="target"/><text x="${width - m.r - 4}" y="${(sy(target) - 7).toFixed(1)}" text-anchor="end">${escapeHtml(labels.targetReliability || "Target Reliability")} = ${(target * 100).toFixed(1)}%</text>`
    : "";
  const hoverPoints = points.filter((_, index) => index % 4 === 0).map(point => `<circle cx="${sx(point.time).toFixed(1)}" cy="${sy(point.value).toFixed(1)}" r="8" class="hover"><title>${curveTooltip(point, labels)}</title></circle>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(labels.reliabilityCurve || "Reliability Curve")}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.fit{fill:none;stroke:#2563eb;stroke-width:2.4}.target{stroke:#b45309;stroke-dasharray:4 4}.mission{stroke:#0f766e;stroke-dasharray:5 5}.point{fill:#0f766e}.hover{fill:transparent;stroke:transparent}text{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.legend-text{font-weight:700}</style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${grid}
    <line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${height - m.b}" class="axis"/>
    ${targetLine}
    <path d="${curve}" class="fit"><title>${escapeHtml(mode === "failure" ? labels.cumulativeFailureFt || "Cumulative Failure F(t)" : labels.reliabilityRt || "Reliability R(t)")}</title></path>
    ${hoverPoints}
    <line x1="${sx(Number(missionTime)).toFixed(1)}" x2="${sx(Number(missionTime)).toFixed(1)}" y1="${m.t}" y2="${height - m.b}" class="mission"/>
    <circle cx="${sx(Number(missionTime)).toFixed(1)}" cy="${sy(missionValue).toFixed(1)}" r="5" class="point"><title>${missionTooltip(Number(missionTime), missionReliability, missionFailureProbability, labels)}</title></circle>
    <g transform="translate(${width - 300} 24)"><line x1="0" x2="24" y1="0" y2="0" class="fit"/><text x="32" y="4" class="legend-text">${escapeHtml(mode === "failure" ? labels.cumulativeFailureFt || "Cumulative Failure F(t)" : labels.reliabilityRt || "Reliability R(t)")}</text></g>
    <text x="${width / 2}" y="${height - 14}" text-anchor="middle">${escapeHtml(labels.time || "Time")}</text>
    <text transform="translate(18 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(mode === "failure" ? labels.cumulativeFailureFt || "Cumulative Failure F(t)" : labels.reliabilityRt || "Reliability R(t)")}</text>
    <text x="${sx(Number(missionTime)).toFixed(1)}" y="${m.t + 12}" text-anchor="middle">${escapeHtml(labels.missionTime || "Mission Time")}</text>
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
