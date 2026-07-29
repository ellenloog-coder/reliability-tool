import { bxLife } from "./metrics.js";

export function calculateLifePercentile(beta, eta, percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p <= 0 || p >= 100) throw new Error("Custom percentile must be greater than 0 and less than 100.");
  return bxLife(p / 100, beta, eta);
}

export function lifePercentileRows(beta, eta, customPercentile = "") {
  const base = [1, 5, 10, 50].map(percent => ({
    percent,
    metric: `B${percent}`,
    estimatedTime: calculateLifePercentile(beta, eta, percent),
    custom: false
  }));
  if (customPercentile === "" || customPercentile === null || customPercentile === undefined) return { rows: base, error: "" };
  try {
    const percent = Number(customPercentile);
    return {
      rows: [...base, { percent, metric: `B${formatPercentLabel(percent)}`, estimatedTime: calculateLifePercentile(beta, eta, percent), custom: true }],
      error: ""
    };
  } catch (error) {
    return { rows: base, error: error.message };
  }
}

function formatPercentLabel(percent) {
  return Number.isInteger(percent) ? String(percent) : String(percent).replace(/0+$/, "").replace(/\.$/, "");
}
