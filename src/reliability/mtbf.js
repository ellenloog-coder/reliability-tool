export function calculateMissionReliability(failureRate, missionTime) {
  if (!Number.isFinite(failureRate) || failureRate < 0) throw new Error("Failure rate must be a finite non-negative number.");
  if (!Number.isFinite(missionTime) || missionTime <= 0) throw new Error("Mission time must be a finite positive number.");
  const reliability = Math.exp(-failureRate * missionTime);
  return Math.min(1, Math.max(0, reliability));
}

export function analyzeExponentialMTBF(input) {
  const totalExposure = Number(input.totalExposure);
  const failureCount = Number(input.failureCount);
  const missionTime = Number(input.missionTime);
  const censoredCount = input.censoredCount ?? null;
  const totalUnits = input.totalUnits ?? null;
  if (!Number.isFinite(totalExposure) || totalExposure <= 0) throw new Error("Total Time on Test must be a finite positive number.");
  if (!Number.isInteger(failureCount) || failureCount < 0) throw new Error("Failure Count must be a non-negative integer.");
  if (!Number.isFinite(missionTime) || missionTime <= 0) throw new Error("Mission Time must be a finite positive number.");
  if (failureCount === 0) {
    return {
      model: "Exponential / constant failure-rate assumption",
      totalExposure,
      totalTime: totalExposure,
      failureCount: 0,
      censoredCount,
      totalUnits,
      failureRate: null,
      lambda: null,
      mtbf: null,
      missionTime,
      missionReliability: null,
      missionFailureProbability: null,
      estimable: false,
      warnings: ["A finite MTBF point estimate cannot be calculated from a zero-failure test. Use Reliability Demonstration to evaluate the evidence against a defined reliability target and confidence level."]
    };
  }
  const failureRate = failureCount / totalExposure;
  const mtbf = totalExposure / failureCount;
  const missionReliability = calculateMissionReliability(failureRate, missionTime);
  return {
    model: "Exponential / constant failure-rate assumption",
    totalExposure,
    totalTime: totalExposure,
    failureCount,
    censoredCount,
    totalUnits,
    failureRate,
    lambda: failureRate,
    mtbf,
    missionTime,
    missionReliability,
    missionFailureProbability: 1 - missionReliability,
    estimable: true,
    warnings: ["MTBF is not the same as product lifetime."]
  };
}

export function summarizeUnitExposure(records, timeUnit = "hours") {
  const totalExposure = records.reduce((sum, record) => sum + record.exposureTime, 0);
  const failureCount = records.filter(record => record.status === "failure").length;
  const censoredCount = records.filter(record => record.status === "censored").length;
  return { totalExposure, failureCount, censoredCount, totalUnits: records.length, timeUnit };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Use evaluateMTBFTarget() through analyzeMTBF().
 */
export function compareTargetMTBF(observedMTBF, targetMTBF) {
  return toLegacyMTBFTargetDecision(evaluateMTBFTarget(
    { mtbf: observedMTBF },
    { targetMTBF }
  ));
}

export function updateMTBFMission(result, missionTime, targetMTBF = "") {
  if (!result) return null;
  if (!result.estimable) {
    return { ...result, missionTime, targetComparison: compareTargetMTBF(null, targetMTBF) };
  }
  const missionReliability = calculateMissionReliability(result.failureRate, Number(missionTime));
  return {
    ...result,
    missionTime: Number(missionTime),
    missionReliability,
    missionFailureProbability: 1 - missionReliability,
    targetComparison: compareTargetMTBF(result.mtbf, targetMTBF)
  };
}

export function calculateMtbf(records, missionTime = null) {
  const input = {
    totalExposure: records.reduce((sum, record) => sum + record.time, 0),
    failureCount: records.filter(record => record.status === "failure").length,
    censoredCount: records.filter(record => record.status === "censored").length,
    totalUnits: records.length,
    missionTime: missionTime || 1
  };
  return analyzeExponentialMTBF(input);
}

export function mtbfAssumptionWarnings(weibullFit, config) {
  if (!weibullFit) return [];
  const { lowerRandomLimit, upperRandomLimit } = config;
  return weibullFit.beta < lowerRandomLimit || weibullFit.beta > upperRandomLimit
    ? ["The constant failure-rate assumption may not be appropriate."]
    : [];
}
import {
  evaluateMTBFTarget,
  toLegacyMTBFTargetDecision
} from "./decision/mtbf-rule.js";
