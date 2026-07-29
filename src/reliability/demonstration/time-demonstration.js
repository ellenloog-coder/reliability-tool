import { poissonCDF, requiredPoissonMean } from "./poisson.js";
import { validateNonNegativeInteger, validateProbability } from "./binomial.js";
import { evaluateDemonstrationDecision } from "../decision/demonstration-rule.js";

export function planExponentialDemonstration(input) {
  const target = resolveTargetMTBF(input);
  const confidenceLevel = validateProbability(input.confidenceLevel, "Confidence Level");
  const allowableFailures = validateNonNegativeInteger(input.allowableFailures ?? 0, "Allowable Failures");
  const numberOfUnits = input.numberOfUnits === "" || input.numberOfUnits == null ? null : validatePositiveInteger(input.numberOfUnits, "Number of Units");
  const requiredExposureFactor = requiredPoissonMean(allowableFailures, confidenceLevel);
  const requiredTotalTestTime = requiredExposureFactor * target.targetMTBF;
  return {
    method: "time",
    workflow: "plan",
    targetDefinition: target.targetDefinition,
    targetMTBF: target.targetMTBF,
    targetReliability: target.targetReliability,
    missionTime: target.missionTime,
    confidenceLevel,
    allowableFailures,
    numberOfUnits,
    requiredExposureFactor,
    chiSquareEquivalentQuantile: 2 * requiredExposureFactor,
    requiredTotalTestTime,
    estimatedTimePerUnit: numberOfUnits ? requiredTotalTestTime / numberOfUnits : null,
    achievedConfidence: 1 - poissonCDF(allowableFailures, requiredExposureFactor),
    acceptanceRule: `Accumulate at least ${formatInteger(requiredTotalTestTime)} operating time units and observe no more than ${allowableFailures} failures.`
  };
}

export function evaluateExponentialDemonstration(input) {
  const target = resolveTargetMTBF(input);
  const totalTestTime = validatePositiveNumber(input.totalTestTime, "Total Test Time");
  const observedFailures = validateNonNegativeInteger(input.observedFailures ?? 0, "Observed Failures");
  const requiredConfidence = validateProbability(input.confidenceLevel, "Confidence Level");
  const requiredExposureFactor = requiredPoissonMean(observedFailures, requiredConfidence);
  const mtbfLowerBound = calculateMTBFLowerBound({ totalTestTime, observedFailures, confidenceLevel: requiredConfidence });
  const achievedConfidenceAtTarget = achievedExponentialConfidence(totalTestTime, observedFailures, target.targetMTBF);
  const reliabilityLowerBoundAtMissionTime = target.missionTime ? Math.exp(-target.missionTime / mtbfLowerBound) : null;
  const mtbfPointEstimate = observedFailures > 0 ? totalTestTime / observedFailures : null;
  const evidenceGap = calculateTimeEvidenceGap({
    totalTestTime,
    observedFailures,
    targetMTBF: target.targetMTBF,
    confidenceLevel: requiredConfidence,
    requiredExposureFactor
  });
  const decision = evaluateDemonstrationDecision({
    method: "time",
    workflow: "evaluate",
    metrics: {
      mtbfLowerBound,
      reliabilityLowerBoundAtMissionTime,
      achievedConfidenceAtTarget
    },
    evidence: { totalTestTime, observedFailures, evidenceGap },
    requirement: {
      targetDefinition: target.targetDefinition,
      targetMTBF: target.targetMTBF,
      targetReliability: target.targetReliability,
      missionTime: target.missionTime,
      requiredConfidence
    },
    assumptions: { pointEstimateNotEstimable: observedFailures === 0 }
  });
  return {
    method: "time",
    workflow: "evaluate",
    targetDefinition: target.targetDefinition,
    totalTestTime,
    observedFailures,
    mtbfPointEstimate,
    mtbfLowerBound,
    targetMTBF: target.targetMTBF,
    targetReliability: target.targetReliability,
    missionTime: target.missionTime,
    reliabilityLowerBoundAtMissionTime,
    requiredExposureFactor,
    chiSquareEquivalentQuantile: 2 * requiredExposureFactor,
    requiredConfidence,
    achievedConfidenceAtTarget,
    demonstrated: decision.existingDecision.demonstrated,
    pointEstimateNotEstimable: observedFailures === 0,
    evidenceGap
  };
}

export function calculateMTBFLowerBound({ totalTestTime, observedFailures, confidenceLevel }) {
  const time = validatePositiveNumber(totalTestTime, "Total Test Time");
  const failures = validateNonNegativeInteger(observedFailures ?? 0, "Observed Failures");
  const cl = validateProbability(confidenceLevel, "Confidence Level");
  return time / requiredPoissonMean(failures, cl);
}

export function achievedExponentialConfidence(totalTestTime, observedFailures, targetMTBF) {
  const time = validatePositiveNumber(totalTestTime, "Total Test Time");
  const failures = validateNonNegativeInteger(observedFailures ?? 0, "Observed Failures");
  const mtbf = validatePositiveNumber(targetMTBF, "Target MTBF");
  return Math.max(0, Math.min(1, 1 - poissonCDF(failures, time / mtbf)));
}

export function targetReliabilityToMTBF(targetReliability, missionTime) {
  const reliability = validateProbability(targetReliability, "Target Reliability");
  const mission = validatePositiveNumber(missionTime, "Mission Time");
  return -mission / Math.log(reliability);
}

export function calculateTimeEvidenceGap({ totalTestTime, observedFailures, targetMTBF, confidenceLevel, requiredExposureFactor = null }) {
  const current = validatePositiveNumber(totalTestTime, "Total Test Time");
  const failures = validateNonNegativeInteger(observedFailures ?? 0, "Observed Failures");
  const mtbf = validatePositiveNumber(targetMTBF, "Target MTBF");
  const cl = validateProbability(confidenceLevel, "Confidence Level");
  const factor = requiredExposureFactor ?? requiredPoissonMean(failures, cl);
  const requiredTotalTestTime = factor * mtbf;
  return {
    additionalTotalTestTimeRequired: Math.max(0, requiredTotalTestTime - current),
    requiredTotalTestTime,
    assumption: requiredTotalTestTime <= current
      ? "No additional exposure is required."
      : "This estimate assumes no additional failures occur during the additional exposure."
  };
}

export function resolveTargetMTBF(input) {
  const targetDefinition = input.targetDefinition === "reliability" ? "reliability" : "mtbf";
  if (targetDefinition === "reliability") {
    const targetReliability = validateProbability(input.targetReliability, "Target Reliability");
    const missionTime = validatePositiveNumber(input.missionTime, "Mission Time");
    return {
      targetDefinition,
      targetReliability,
      missionTime,
      targetMTBF: targetReliabilityToMTBF(targetReliability, missionTime)
    };
  }
  return {
    targetDefinition,
    targetReliability: null,
    missionTime: input.missionTime ? validatePositiveNumber(input.missionTime, "Mission Time") : null,
    targetMTBF: validatePositiveNumber(input.targetMTBF, "Target MTBF")
  };
}

export function validatePositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a finite positive number.`);
  return number;
}

export function validatePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function formatInteger(value) {
  return Math.ceil(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
