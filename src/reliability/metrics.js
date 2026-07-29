export function reliabilityAt(time, beta, eta) {
  return Math.exp(-Math.pow(time / eta, beta));
}

export function failureProbabilityAt(time, beta, eta) {
  return 1 - reliabilityAt(time, beta, eta);
}

export function bxLife(x, beta, eta) {
  return eta * Math.pow(-Math.log(1 - x), 1 / beta);
}

export function weibullMetrics(fit, records, missionTime, targetReliability = null) {
  const failures = records.filter(record => record.status === "failure").length;
  const censored = records.filter(record => record.status === "censored").length;
  const reliability = reliabilityAt(missionTime, fit.beta, fit.eta);
  return {
    beta: fit.beta,
    eta: fit.eta,
    b1: bxLife(0.01, fit.beta, fit.eta),
    b5: bxLife(0.05, fit.beta, fit.eta),
    b10: bxLife(0.10, fit.beta, fit.eta),
    b50: bxLife(0.50, fit.beta, fit.eta),
    missionTime,
    missionReliability: reliability,
    missionFailureProbability: 1 - reliability,
    failureCount: failures,
    censoredCount: censored,
    totalCount: records.length,
    targetComparison: compareReliabilityTarget(reliability, targetReliability)
  };
}

export function defaultMissionTime(records) {
  const times = records.map(record => record.time).sort((a, b) => a - b);
  if (!times.length) return 0;
  const middle = Math.floor(times.length / 2);
  return times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Use evaluateReliabilityTarget() through analyzeLifeData().
 */
export function compareReliabilityTarget(predictedReliability, targetReliability) {
  return toLegacyReliabilityTargetDecision(evaluateReliabilityTarget(
    { missionReliability: predictedReliability },
    { targetReliability }
  ));
}
import {
  evaluateReliabilityTarget,
  toLegacyReliabilityTargetDecision
} from "./decision/reliability-rule.js";
