import { achievedBinomialConfidence } from "./sample-demonstration.js";
import { achievedExponentialConfidence } from "./time-demonstration.js";
import { RESULT_CHART_SIZE, RESULT_CHART_TYPE } from "../chart-layout.js";

export function demonstrationEvidenceChartSvg(result, labels = {}) {
  if (!result) return "";
  const { width, height } = RESULT_CHART_SIZE.full;
  const m = { l: 58, r: 16, t: 28, b: 36 };
  const sample = result.method === "sample";
  const plan = result.workflow === "plan";
  const requiredConfidence = result.confidenceLevel ?? result.requiredConfidence;
  const markerX = sample
    ? (plan ? result.requiredSampleSize : result.unitsTested)
    : (plan ? result.requiredTotalTestTime : result.totalTestTime);
  const gapX = !plan && result.evidenceGap
    ? sample
      ? result.evidenceGap.requiredTotalUnits
      : result.evidenceGap.requiredTotalTestTime
    : null;
  const maxX = Math.max(markerX * 1.35, (gapX || 0) * 1.12, sample ? 5 : 1);
  const pointCount = 120;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const x = maxX * index / (pointCount - 1);
    const effectiveX = sample ? Math.max(1, Math.round(x)) : x;
    const confidence = sample
      ? achievedBinomialConfidence(effectiveX, plan ? result.allowableFailures : result.observedFailures, result.targetReliability)
      : achievedExponentialConfidence(Math.max(effectiveX, Number.EPSILON), plan ? result.allowableFailures : result.observedFailures, result.targetMTBF);
    return { x: effectiveX, confidence };
  });
  const sx = x => m.l + (x / maxX) * (width - m.l - m.r);
  const sy = y => height - m.b - y * (height - m.t - m.b);
  const path = points.map((point, index) => `${index ? "L" : "M"} ${sx(point.x).toFixed(1)} ${sy(point.confidence).toFixed(1)}`).join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map(value => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(value).toFixed(1)}" y2="${sy(value).toFixed(1)}" class="grid"/><text x="${m.l - 10}" y="${(sy(value) + 4).toFixed(1)}" text-anchor="end">${Math.round(value * 100)}%</text>`).join("");
  const xTicks = [0, maxX / 2, maxX].map(value => `<line x1="${sx(value).toFixed(1)}" x2="${sx(value).toFixed(1)}" y1="${height - m.b}" y2="${height - m.b + 4}" class="axis"/><text x="${sx(value).toFixed(1)}" y="${height - m.b + 16}" text-anchor="middle">${formatNumber(value)}</text>`).join("");
  const markerConfidence = sample
    ? achievedBinomialConfidence(markerX, plan ? result.allowableFailures : result.observedFailures, result.targetReliability)
    : achievedExponentialConfidence(markerX, plan ? result.allowableFailures : result.observedFailures, result.targetMTBF);
  const gapMarker = !plan && gapX && gapX > markerX
    ? `<line x1="${sx(gapX).toFixed(1)}" x2="${sx(gapX).toFixed(1)}" y1="${m.t}" y2="${height - m.b}" class="gap-marker"/><circle cx="${sx(gapX).toFixed(1)}" cy="${sy(requiredConfidence).toFixed(1)}" r="5" class="gap-point"><title>${escapeHtml(`${labels.evidenceGap || "Evidence Gap"}\n${labels.x || "X"}: ${formatNumber(gapX)}\n${labels.requiredConfidence || "Required Confidence"}: ${formatPercent(requiredConfidence)}`)}</title></circle>`
    : "";
  const hover = points.filter((_, index) => index % 5 === 0).map(point => `<circle cx="${sx(point.x).toFixed(1)}" cy="${sy(point.confidence).toFixed(1)}" r="8" class="hover"><title>${escapeHtml(`${labels.x || "X"}: ${formatNumber(point.x)}\n${labels.achievedConfidence || "Achieved Confidence"}: ${formatPercent(point.confidence)}`)}</title></circle>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(labels.evidenceChart || "Demonstration Evidence")}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.curve{fill:none;stroke:#2563eb;stroke-width:2.4}.req{stroke:#b45309;stroke-dasharray:4 4}.marker{stroke:#0f766e;stroke-dasharray:5 5}.gap-marker{stroke:#b42318;stroke-dasharray:3 4}.point{fill:#0f766e}.gap-point{fill:#b42318}.hover{fill:transparent;stroke:transparent}text{font:${RESULT_CHART_TYPE.axisFontSize}px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.label{font-size:${RESULT_CHART_TYPE.legendFontSize}px;font-weight:650}</style>
    <rect width="${width}" height="${height}" fill="#fff"/>
    ${grid}${xTicks}
    <line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${width - m.r}" y1="${sy(requiredConfidence).toFixed(1)}" y2="${sy(requiredConfidence).toFixed(1)}" class="req"/>
    <path d="${path}" class="curve"/>
    ${hover}
    <line x1="${sx(markerX).toFixed(1)}" x2="${sx(markerX).toFixed(1)}" y1="${m.t}" y2="${height - m.b}" class="marker"/>
    <circle cx="${sx(markerX).toFixed(1)}" cy="${sy(markerConfidence).toFixed(1)}" r="5" class="point"><title>${escapeHtml(`${labels.x || "X"}: ${formatNumber(markerX)}\n${labels.achievedConfidence || "Achieved Confidence"}: ${formatPercent(markerConfidence)}`)}</title></circle>
    ${gapMarker}
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(labels.x || (sample ? "Sample Size" : "Total Test Time"))}</text>
    <text transform="translate(14 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(labels.achievedConfidence || "Achieved Confidence")}</text>
    <text x="${m.l + 4}" y="${(sy(requiredConfidence) - 7).toFixed(1)}" text-anchor="start" class="label">${escapeHtml(labels.requiredConfidence || "Required Confidence")} ${formatPercent(requiredConfidence)}</text>
  </svg>`;
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
