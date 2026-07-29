import { failureProbabilityAt, reliabilityAt } from "./metrics.js";

export function calculateReliabilityAtTimes(beta, eta, times, missionTime = null) {
  return uniquePositiveTimes(times).map(time => {
    const reliability = reliabilityAt(time, beta, eta);
    return {
      time,
      reliability,
      failureProbability: 1 - reliability,
      isMissionTime: Number.isFinite(Number(missionTime)) && Math.abs(time - Number(missionTime)) <= Math.max(1e-12, Math.abs(time) * 1e-12)
    };
  });
}

export function selectedReliabilityTimes(records, missionTime, customTime = "") {
  const sorted = records.map(record => record.time).filter(time => Number.isFinite(time) && time > 0).sort((a, b) => a - b);
  const base = [];
  if (sorted.length) {
    base.push(sorted[0]);
    base.push(sorted[Math.floor(sorted.length / 2)]);
    if (Number.isFinite(Number(missionTime)) && Number(missionTime) > 0) base.push(Number(missionTime));
    base.push(sorted[sorted.length - 1]);
    base.push(roundNice(sorted[sorted.length - 1] * 1.25));
  }
  if (customTime === "" || customTime === null || customTime === undefined) return { times: uniquePositiveTimes(base), error: "" };
  const value = Number(customTime);
  if (!Number.isFinite(value) || value <= 0) return { times: uniquePositiveTimes(base), error: "Custom time must be a finite positive number." };
  return { times: uniquePositiveTimes([...base, value]), error: "" };
}

export function buildTargetGap(predictedReliability, targetReliability) {
  if (targetReliability === "" || targetReliability === null || targetReliability === undefined) return null;
  const target = Number(targetReliability);
  if (!Number.isFinite(target) || target <= 0 || target >= 1) return null;
  return {
    predictedReliability,
    targetReliability: target,
    gap: predictedReliability - target,
    gapPercentagePoints: (predictedReliability - target) * 100
  };
}

export function reliabilityTableRows(beta, eta, records, missionTime, customTime = "") {
  const selected = selectedReliabilityTimes(records, missionTime, customTime);
  return {
    rows: calculateReliabilityAtTimes(beta, eta, selected.times, missionTime),
    error: selected.error
  };
}

export function curvePoints(beta, eta, maxTime, mode = "reliability", count = 100) {
  return Array.from({ length: count }, (_, index) => {
    const time = maxTime * index / (count - 1);
    const reliability = index === 0 ? 1 : reliabilityAt(time, beta, eta);
    const failureProbability = failureProbabilityAt(time, beta, eta);
    return {
      time,
      reliability,
      failureProbability,
      value: mode === "failure" ? failureProbability : reliability
    };
  });
}

function uniquePositiveTimes(times) {
  return Array.from(new Set(times.map(time => Number(time)).filter(time => Number.isFinite(time) && time > 0).map(time => roundForUniqueness(time)))).sort((a, b) => a - b);
}

function roundForUniqueness(value) {
  return Number(value.toPrecision(12));
}

function roundNice(value) {
  if (!Number.isFinite(value) || value <= 0) return value;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude * 2) / 2 * magnitude;
}
