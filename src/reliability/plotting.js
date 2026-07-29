import { reliabilityAt } from "./metrics.js";

export function kaplanMeierPoints(records) {
  const grouped = new Map();
  records.forEach(record => {
    const group = grouped.get(record.time) || { time: record.time, failures: 0, censored: 0 };
    if (record.status === "failure") group.failures += 1;
    else group.censored += 1;
    grouped.set(record.time, group);
  });
  const groups = Array.from(grouped.values()).sort((a, b) => a.time - b.time);
  let atRisk = records.length;
  let survival = 1;
  const failurePoints = [];
  const censoredPoints = [];
  groups.forEach(group => {
    if (group.failures > 0 && atRisk > 0) {
      survival *= (1 - group.failures / atRisk);
      failurePoints.push({ time: group.time, failureProbability: 1 - survival, survival, count: group.failures });
    }
    if (group.censored > 0) censoredPoints.push({ time: group.time, survival, count: group.censored });
    atRisk -= group.failures + group.censored;
  });
  return { failurePoints, censoredPoints };
}

export function weibullProbabilityPlotSvg(records, fit, labels = {}) {
  const width = 720;
  const height = 320;
  const m = { l: 58, r: 22, t: 24, b: 54 };
  const km = kaplanMeierPoints(records);
  const times = records.map(record => record.time);
  const minT = Math.min(...times) * 0.85;
  const maxT = Math.max(...times) * 1.15;
  const xMin = Math.log(minT);
  const xMax = Math.log(maxT);
  const yVals = km.failurePoints.map(point => weibullY(point.failureProbability)).filter(Number.isFinite);
  const yMin = Math.min(...yVals, weibullY(0.01));
  const yMax = Math.max(...yVals, weibullY(0.99));
  const sx = time => m.l + ((Math.log(time) - xMin) / (xMax - xMin)) * (width - m.l - m.r);
  const sy = y => height - m.b - ((y - yMin) / (yMax - yMin)) * (height - m.t - m.b);
  const line = [minT, maxT].map((time, index) => `${index ? "L" : "M"} ${sx(time).toFixed(1)} ${sy(weibullY(1 - reliabilityAt(time, fit.beta, fit.eta))).toFixed(1)}`).join(" ");
  const ticks = [0.01, 0.05, 0.1, 0.2, 0.5, 0.8, 0.95].filter(p => weibullY(p) >= yMin && weibullY(p) <= yMax);
  const grid = ticks.map(p => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(weibullY(p))}" y2="${sy(weibullY(p))}" class="grid"/><text x="${m.l - 10}" y="${sy(weibullY(p)) + 4}" text-anchor="end">${Math.round(p * 100)}%</text>`).join("");
  const failureMarkers = km.failurePoints.map(point => `<circle cx="${sx(point.time)}" cy="${sy(weibullY(point.failureProbability))}" r="4.5" class="fail"><title>${labels.failure || "Failure"}: ${point.time}, F=${(point.failureProbability * 100).toFixed(1)}%</title></circle>`).join("");
  const censoredMarkers = km.censoredPoints.map(point => `<path d="M ${sx(point.time) - 5} ${sy(weibullY(Math.max(0.01, 1 - point.survival))) - 5} l 10 10 M ${sx(point.time) + 5} ${sy(weibullY(Math.max(0.01, 1 - point.survival))) - 5} l -10 10" class="cens"><title>${labels.censored || "Censored"}: ${point.time}</title></path>`).join("");
  return chartFrame(width, height, labels.time || "Time", labels.failureProbability || "Cumulative failure probability", grid, `<path d="${line}" class="fit"/>${failureMarkers}${censoredMarkers}${legend(labels)}`);
}

export function reliabilityCurveSvg(records, fit, missionTime, labels = {}) {
  const width = 720;
  const height = 320;
  const m = { l: 58, r: 22, t: 24, b: 54 };
  const maxT = Math.max(...records.map(record => record.time), missionTime) * 1.12;
  const sx = time => m.l + (time / maxT) * (width - m.l - m.r);
  const sy = r => height - m.b - r * (height - m.t - m.b);
  const curve = Array.from({ length: 90 }, (_, index) => {
    const time = maxT * index / 89;
    return `${index ? "L" : "M"} ${sx(time).toFixed(1)} ${sy(reliabilityAt(time, fit.beta, fit.eta)).toFixed(1)}`;
  }).join(" ");
  const rMission = reliabilityAt(missionTime, fit.beta, fit.eta);
  const grid = [0, 0.25, 0.5, 0.75, 1].map(r => `<line x1="${m.l}" x2="${width - m.r}" y1="${sy(r)}" y2="${sy(r)}" class="grid"/><text x="${m.l - 10}" y="${sy(r) + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`).join("");
  const body = `<path d="${curve}" class="fit"/><line x1="${sx(missionTime)}" x2="${sx(missionTime)}" y1="${m.t}" y2="${height - m.b}" class="mission"/><circle cx="${sx(missionTime)}" cy="${sy(rMission)}" r="5" class="point"><title>R(${missionTime}) = ${(rMission * 100).toFixed(2)}%</title></circle>`;
  return chartFrame(width, height, labels.time || "Time", labels.reliability || "Reliability", grid, body);
}

function chartFrame(width, height, xLabel, yLabel, grid, body) {
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${xLabel} chart`)}">
    <style>.axis{stroke:#98a2b3}.grid{stroke:#e4e7ec}.fit{fill:none;stroke:#2563eb;stroke-width:2.4}.fail{fill:#b42318}.cens{stroke:#3538cd;stroke-width:2;fill:none}.mission{stroke:#0f766e;stroke-dasharray:5 5}.point{fill:#0f766e}text{font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;fill:#475467}.legend-text{font-weight:700}</style>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${grid}
    <line x1="58" x2="${width - 22}" y1="${height - 54}" y2="${height - 54}" class="axis"/>
    <line x1="58" x2="58" y1="24" y2="${height - 54}" class="axis"/>
    <text x="${width / 2}" y="${height - 14}" text-anchor="middle">${escapeHtml(xLabel)}</text>
    <text transform="translate(16 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(yLabel)}</text>
    ${body}
  </svg>`;
}

function legend(labels) {
  return `<g transform="translate(360 24)"><line x1="0" x2="22" y1="0" y2="0" class="fit"/><text x="28" y="4" class="legend-text">${escapeHtml(labels.weibullLine || "Fitted Weibull line")}</text><circle cx="178" cy="0" r="4.5" class="fail"/><text x="188" y="4" class="legend-text">${escapeHtml(labels.failure || "Failure")}</text><path d="M 274 -5 l 10 10 M 284 -5 l -10 10" class="cens"/><text x="290" y="4" class="legend-text">${escapeHtml(labels.censored || "Censored")}</text></g>`;
}

function weibullY(p) {
  return Math.log(-Math.log(1 - Math.min(0.999, Math.max(0.001, p))));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
