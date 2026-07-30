import { calculateMissionReliability } from "./mtbf.js";
import { RESULT_CHART_SIZE, RESULT_CHART_TYPE } from "./chart-layout.js";

export function mtbfReliabilityCurveSvg(result, labels = {}) {
  if (!result?.estimable || !Number.isFinite(result.failureRate)) return "";
  const { width, height } = RESULT_CHART_SIZE.full;
  const m = { l: 58, r: 16, t: 28, b: 36 };
  const maxT = Math.max(result.missionTime, result.mtbf * 4, 1) * 1.08;
  const sx = time => m.l + (time / maxT) * (width - m.l - m.r);
  const sy = reliability => height - m.b - reliability * (height - m.t - m.b);
  const curve = Array.from({ length: 100 }, (_, index) => {
    const time = maxT * index / 99;
    return `${index ? "L" : "M"} ${sx(time).toFixed(1)} ${sy(calculateMissionReliability(result.failureRate, Math.max(time, Number.EPSILON))).toFixed(1)}`;
  }).join(" ");
  const missionR = result.missionReliability;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(r => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(r)}" y2="${sy(r)}" class="grid"/><text x="${m.l - 10}" y="${sy(r) + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`).join("");
  const xTicks = [0, maxT / 2, maxT].map(time => `<line x1="${sx(time).toFixed(1)}" x2="${sx(time).toFixed(1)}" y1="${height - m.b}" y2="${height - m.b + 4}" class="axis"/><text x="${sx(time).toFixed(1)}" y="${height - m.b + 16}" text-anchor="middle">${formatNumber(time)}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(labels.reliabilityCurve || "Reliability Curve")}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.fit{fill:none;stroke:#2563eb;stroke-width:2.4}.mission{stroke:#0f766e;stroke-dasharray:5 5}.point{fill:#0f766e}text{font:${RESULT_CHART_TYPE.axisFontSize}px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.legend-text{font-size:${RESULT_CHART_TYPE.legendFontSize}px;font-weight:650}</style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${grid}${xTicks}
    <line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${height - m.b}" class="axis"/>
    <path d="${curve}" class="fit"><title>${escapeHtml(labels.reliabilityCurve || "Reliability Curve")}</title></path>
    <line x1="${sx(result.missionTime)}" x2="${sx(result.missionTime)}" y1="${m.t}" y2="${height - m.b}" class="mission"/>
    <circle cx="${sx(result.missionTime)}" cy="${sy(missionR)}" r="5" class="point"><title>R(${result.missionTime}) = ${(missionR * 100).toFixed(2)}%</title></circle>
    <g transform="translate(${width / 2 - 72} 13)"><line x1="0" x2="18" y1="0" y2="0" class="fit"/><text x="24" y="3" class="legend-text">${escapeHtml(labels.exponentialCurve || "Exponential reliability curve")}</text></g>
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(labels.time || "Time")}</text>
    <text transform="translate(14 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(labels.reliability || "Reliability")}</text>
    <text x="${sx(result.missionTime).toFixed(1)}" y="${m.t + 10}" text-anchor="middle">${escapeHtml(labels.missionTime || "Mission Time")}</text>
  </svg>`;
}

export function mtbfCurvePoints(result, count = 50) {
  if (!result?.estimable) return [];
  const maxT = Math.max(result.missionTime, result.mtbf * 4, 1);
  return Array.from({ length: count }, (_, index) => {
    const time = maxT * index / (count - 1);
    const reliability = index === 0 ? 1 : calculateMissionReliability(result.failureRate, time);
    return { time, reliability, failureProbability: 1 - reliability };
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumSignificantDigits: 4 });
}
