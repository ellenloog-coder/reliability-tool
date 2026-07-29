import { binomialCDF, validateNonNegativeInteger, validatePositiveInteger, validateProbability } from "./binomial.js";
import { solveMonotonicRoot } from "./root-solver.js";
import { evaluateDemonstrationDecision } from "../decision/demonstration-rule.js";

const MAX_SAMPLE_SIZE = 1_000_000;
const DEMONSTRATION_TOLERANCE = 1e-10;

export function planBinomialDemonstration(input) {
  const targetReliability = validateProbability(input.targetReliability, "Target Reliability");
  const confidenceLevel = validateProbability(input.confidenceLevel, "Confidence Level");
  const allowableFailures = validateNonNegativeInteger(input.allowableFailures ?? 0, "Allowable Failures");
  const failureProbability = 1 - targetReliability;
  const maxSamples = input.maxSampleSize || MAX_SAMPLE_SIZE;
  let upper = Math.max(allowableFailures + 1, 1);
  while (!samplePlanMeets(upper, allowableFailures, failureProbability, confidenceLevel)) {
    upper *= 2;
    if (upper > maxSamples) throw new Error("Unable to find a sample size within the current maximum limit.");
  }
  let lower = allowableFailures + 1;
  while (lower < upper) {
    const mid = Math.floor((lower + upper) / 2);
    if (samplePlanMeets(mid, allowableFailures, failureProbability, confidenceLevel)) upper = mid;
    else lower = mid + 1;
  }
  const requiredSampleSize = lower;
  const achievedConfidenceAtRequiredN = achievedBinomialConfidence(requiredSampleSize, allowableFailures, targetReliability);
  const previousN = requiredSampleSize - 1;
  const achievedConfidenceAtPreviousN = previousN > allowableFailures
    ? achievedBinomialConfidence(previousN, allowableFailures, targetReliability)
    : 0;
  return {
    method: "sample",
    workflow: "plan",
    requiredSampleSize,
    targetReliability,
    confidenceLevel,
    allowableFailures,
    achievedConfidenceAtRequiredN,
    achievedConfidenceAtPreviousN,
    acceptanceRule: `Test ${requiredSampleSize} units and observe no more than ${allowableFailures} failures.`,
    minimalityVerified: !samplePlanMeets(previousN, allowableFailures, failureProbability, confidenceLevel)
  };
}

export function evaluateBinomialDemonstration(input) {
  const unitsTested = validatePositiveInteger(input.unitsTested, "Units Tested");
  const observedFailures = validateNonNegativeInteger(input.observedFailures ?? 0, "Observed Failures");
  if (observedFailures > unitsTested) throw new Error("Observed Failures cannot be greater than Units Tested.");
  const targetReliability = validateProbability(input.targetReliability, "Target Reliability");
  const requiredConfidence = validateProbability(input.confidenceLevel, "Confidence Level");
  const observedSuccesses = unitsTested - observedFailures;
  const observedPassRate = observedSuccesses / unitsTested;
  const reliabilityLowerBound = calculateReliabilityLowerBound({ unitsTested, observedFailures, confidenceLevel: requiredConfidence });
  const achievedConfidenceAtTarget = achievedBinomialConfidence(unitsTested, observedFailures, targetReliability);
  const evidenceGap = calculateSampleEvidenceGap({
    unitsTested,
    observedFailures,
    targetReliability,
    confidenceLevel: requiredConfidence
  });
  const decision = evaluateDemonstrationDecision({
    method: "sample",
    workflow: "evaluate",
    metrics: { reliabilityLowerBound, achievedConfidenceAtTarget },
    evidence: { unitsTested, observedFailures, evidenceGap },
    requirement: { targetReliability, requiredConfidence }
  });
  return {
    method: "sample",
    workflow: "evaluate",
    unitsTested,
    observedFailures,
    observedSuccesses,
    observedPassRate,
    reliabilityLowerBound,
    targetReliability,
    requiredConfidence,
    achievedConfidenceAtTarget,
    demonstrated: decision.existingDecision.demonstrated,
    evidenceGap
  };
}

export function calculateReliabilityLowerBound({ unitsTested, observedFailures, confidenceLevel }) {
  const n = validatePositiveInteger(unitsTested, "Units Tested");
  const d = validateNonNegativeInteger(observedFailures, "Observed Failures");
  if (d > n) throw new Error("Observed Failures cannot be greater than Units Tested.");
  const cl = validateProbability(confidenceLevel, "Confidence Level");
  const successes = n - d;
  if (successes === 0) return 0;
  return solveMonotonicRoot({
    fn: reliability => 1 - binomialCDF(d, n, 1 - reliability),
    lower: 0,
    upper: 1,
    target: cl,
    increasing: false,
    tolerance: 1e-11
  });
}

export function achievedBinomialConfidence(sampleSize, failuresAllowedOrObserved, targetReliability) {
  const n = validatePositiveInteger(sampleSize, "Sample Size");
  const d = validateNonNegativeInteger(failuresAllowedOrObserved, "Failures");
  const r = validateProbability(targetReliability, "Target Reliability");
  if (d >= n) return 0;
  return Math.max(0, Math.min(1, 1 - binomialCDF(d, n, 1 - r)));
}

export function calculateSampleEvidenceGap(input) {
  const currentUnits = validatePositiveInteger(input.unitsTested, "Units Tested");
  const observedFailures = validateNonNegativeInteger(input.observedFailures ?? 0, "Observed Failures");
  const targetReliability = validateProbability(input.targetReliability, "Target Reliability");
  const confidenceLevel = validateProbability(input.confidenceLevel, "Confidence Level");
  if (observedFailures > currentUnits) throw new Error("Observed Failures cannot be greater than Units Tested.");
  const currentLower = calculateReliabilityLowerBound({ unitsTested: currentUnits, observedFailures, confidenceLevel });
  if (currentLower + DEMONSTRATION_TOLERANCE >= targetReliability) {
    return { additionalUnitsRequired: 0, requiredTotalUnits: currentUnits, assumption: "No additional units are required." };
  }
  let upper = currentUnits + 1;
  while (calculateReliabilityLowerBound({ unitsTested: upper, observedFailures, confidenceLevel }) + DEMONSTRATION_TOLERANCE < targetReliability) {
    upper *= 2;
    if (upper > MAX_SAMPLE_SIZE) throw new Error("Unable to calculate additional units within the current maximum limit.");
  }
  let lower = currentUnits + 1;
  while (lower < upper) {
    const mid = Math.floor((lower + upper) / 2);
    if (calculateReliabilityLowerBound({ unitsTested: mid, observedFailures, confidenceLevel }) + DEMONSTRATION_TOLERANCE >= targetReliability) upper = mid;
    else lower = mid + 1;
  }
  return {
    additionalUnitsRequired: Math.max(0, lower - currentUnits),
    requiredTotalUnits: lower,
    assumption: "This estimate assumes no additional failures occur in the added units."
  };
}

function samplePlanMeets(sampleSize, allowableFailures, failureProbability, confidenceLevel) {
  if (sampleSize <= allowableFailures) return false;
  return binomialCDF(allowableFailures, sampleSize, failureProbability) <= 1 - confidenceLevel;
}
