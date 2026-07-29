import { failureProbabilityAt } from "./metrics.js";
import { calculateKaplanMeierPositions, transformToWeibullCoordinates, weibullProbabilityTicks, weibullProbabilityY } from "./plotting-positions.js";

export function buildWeibullFittedLine(beta, eta, timeRange, count = 80) {
  const [minTime, maxTime] = timeRange;
  return Array.from({ length: count }, (_, index) => {
    const fraction = index / (count - 1);
    const time = Math.exp(Math.log(minTime) + fraction * (Math.log(maxTime) - Math.log(minTime)));
    const cumulativeFailureProbability = failureProbabilityAt(time, beta, eta);
    const transformed = transformToWeibullCoordinates(time, cumulativeFailureProbability);
    return { time, cumulativeFailureProbability, ...transformed };
  });
}

export function weibullProbabilityPlotSvg(records, fit, labels = {}) {
  const width = 760;
  const height = 350;
  const m = { l: 64, r: 24, t: 28, b: 60 };
  const positions = calculateKaplanMeierPositions(records);
  const times = records.map(record => record.time).filter(time => Number.isFinite(time) && time > 0);
  const minT = Math.max(Math.min(...times) * 0.9, Number.MIN_VALUE);
  const maxT = Math.max(...times) * 1.1;
  const xMin = Math.log(minT);
  const xMax = Math.log(maxT);
  const yTickValues = weibullProbabilityTicks();
  const yMin = weibullProbabilityY(0.01);
  const yMax = weibullProbabilityY(0.99);
  const sx = time => m.l + ((Math.log(time) - xMin) / (xMax - xMin || 1)) * (width - m.l - m.r);
  const sy = probability => height - m.b - ((weibullProbabilityY(probability) - yMin) / (yMax - yMin)) * (height - m.t - m.b);
  const syTransformed = y => height - m.b - ((y - yMin) / (yMax - yMin)) * (height - m.t - m.b);
  const fitted = buildWeibullFittedLine(fit.beta, fit.eta, [minT, maxT]);
  const fittedPath = fitted.map((point, index) => `${index ? "L" : "M"} ${sx(point.time).toFixed(1)} ${syTransformed(point.transformedY).toFixed(1)}`).join(" ");
  const yGrid = yTickValues.map(p => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(p).toFixed(1)}" y2="${sy(p).toFixed(1)}" class="grid"/><text x="${m.l - 10}" y="${(sy(p) + 4).toFixed(1)}" text-anchor="end">${formatPercentTick(p)}</text>`).join("");
  const xTicks = logTicks(minT, maxT).map(time => `<line x1="${sx(time).toFixed(1)}" x2="${sx(time).toFixed(1)}" y1="${height - m.b}" y2="${height - m.b + 5}" class="axis"/><text x="${sx(time).toFixed(1)}" y="${height - 36}" text-anchor="middle">${formatTick(time)}</text>`).join("");
  const failureMarkers = positions.failurePositions.map(point => `<circle cx="${sx(point.time).toFixed(1)}" cy="${sy(point.cumulativeFailureProbability).toFixed(1)}" r="4.5" class="fail"><title>${failureTooltip(point, labels)}</title></circle>`).join("");
  const rugY = height - m.b - 9;
  const censoredMarkers = positions.censoredMarkers.map(point => `<path d="M ${sx(point.time).toFixed(1)} ${rugY - 6} L ${(sx(point.time) - 5).toFixed(1)} ${rugY + 4} L ${(sx(point.time) + 5).toFixed(1)} ${rugY + 4} Z" class="cens-fill"><title>${censoredTooltip(point, labels)}</title></path>`).join("");
  const legendX = m.l;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(labels.probPlot || "Weibull Probability Plot")}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.fit{fill:none;stroke:#2563eb;stroke-width:2.4}.fail{fill:#b42318}.cens-fill{fill:#3538cd;stroke:#3538cd}.rug{stroke:#3538cd;stroke-width:1.5}.mission{stroke:#0f766e;stroke-dasharray:5 5}.point{fill:#0f766e}text{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.legend-text{font-weight:700}</style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${yGrid}${xTicks}
    <line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" class="axis"/>
    <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${height - m.b}" class="axis"/>
    <path d="${fittedPath}" class="fit"><title>${escapeHtml(labels.weibullLine || "Weibull 2P fitted line")}</title></path>
    ${failureMarkers}
    <line x1="${m.l}" x2="${width - m.r}" y1="${rugY + 5}" y2="${rugY + 5}" class="rug"/>
    ${censoredMarkers}
    <g transform="translate(${legendX} 24)"><line x1="0" x2="22" y1="0" y2="0" class="fit"/><text x="28" y="4" class="legend-text">${escapeHtml(labels.weibullLine || "Weibull 2P fitted line")}</text><circle cx="220" cy="0" r="4.5" class="fail"/><text x="232" y="4" class="legend-text">${escapeHtml(labels.failureObservation || "Failure Observation")}</text><path d="M 410 -6 L 405 4 L 415 4 Z" class="cens-fill"/><text x="424" y="4" class="legend-text">${escapeHtml(labels.rightCensored || "Right-censored")}</text></g>
    <text x="${width / 2}" y="${height - 12}" text-anchor="middle">${escapeHtml(labels.time || "Time")}</text>
    <text transform="translate(18 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(labels.cumulativeFailureProbability || "Cumulative failure probability")}</text>
  </svg>`;
}

function failureTooltip(point, labels) {
  return escapeHtml([
    `${labels.sample || "Sample"}: ${point.sampleId || labels.notProvided || "Not provided"}`,
    `${labels.failureTime || "Failure Time"}: ${formatNumber(point.time)} ${labels.unit || ""}`.trim(),
    `${labels.estimatedCumulativeFailure || "Estimated Cumulative Failure"}: ${(point.cumulativeFailureProbability * 100).toFixed(1)}%`,
    `${labels.status || "Status"}: ${labels.failure || "Failure"}`,
    `${labels.failureMode || "Failure Mode"}: ${point.failureMode || labels.notProvided || "Not provided"}`,
    `${labels.testCondition || "Test Condition"}: ${point.testCondition || labels.notProvided || "Not provided"}`
  ].join("\n"));
}

function censoredTooltip(point, labels) {
  return escapeHtml([
    `${labels.sample || "Sample"}: ${point.sampleId || labels.notProvided || "Not provided"}`,
    `${labels.time || "Time"}: ${formatNumber(point.time)} ${labels.unit || ""}`.trim(),
    `${labels.status || "Status"}: ${labels.rightCensored || "Right-censored"}`,
    `${labels.failureMode || "Failure Mode"}: ${point.failureMode || labels.notProvided || "Not provided"}`,
    `${labels.testCondition || "Test Condition"}: ${point.testCondition || labels.notProvided || "Not provided"}`
  ].join("\n"));
}

function logTicks(minT, maxT) {
  const ticks = [minT, Math.sqrt(minT * maxT), maxT];
  return Array.from(new Set(ticks.map(time => Number(time.toPrecision(5)))));
}

function formatTick(value) {
  return Number(value).toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function formatPercentTick(value) {
  return `${Number(value * 100).toLocaleString(undefined, { maximumSignificantDigits: 3 })}%`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
