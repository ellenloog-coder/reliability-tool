import { createDecisionResult } from "./decision-result.js";

const FLOATING_POINT_FACTOR = 8;

function nearlyAtLeast(actual, target) {
  const tolerance = Number.EPSILON
    * Math.max(1, Math.abs(actual), Math.abs(target))
    * FLOATING_POINT_FACTOR;
  return actual >= target - tolerance;
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Builds the pre-Engine MTBF target shape for compatibility consumers.
 */
function legacyDecision(status, invalidRequirement = false) {
  if (status === "MEETS_REQUIREMENT") {
    return {
      status: "Meets Target",
      message: "Observed MTBF meets the target point estimate. The current comparison does not include statistical confidence bounds."
    };
  }
  if (status === "DOES_NOT_MEET_REQUIREMENT") {
    return {
      status: "Below Target",
      message: "Observed MTBF is below the target point estimate. The current comparison does not include statistical confidence bounds."
    };
  }
  if (status === "REVIEW_REQUIRED") {
    return {
      status: "Not Estimable",
      message: "Target comparison not performed because the MTBF point estimate is not available."
    };
  }
  return invalidRequirement
    ? {
        status: "Target not provided",
        message: "Target comparison not performed — target MTBF must be a finite positive number."
      }
    : {
        status: "Target not provided",
        message: "Target comparison not performed — no target MTBF was provided."
      };
}

export function evaluateMTBFTarget(metrics, requirement = {}) {
  const rawTarget = requirement?.targetMTBF;
  const rawActual = metrics?.mtbf;
  const availableActual = rawActual === null || rawActual === undefined || rawActual === ""
    ? null
    : Number(rawActual);

  if (rawTarget === null || rawTarget === undefined || rawTarget === "") {
    const status = "NOT_EVALUATED";
    return createDecisionResult({
      status,
      reasonCodes: ["TARGET_MTBF_NOT_PROVIDED"],
      requirement: { targetMTBF: null },
      actualValue: Number.isFinite(availableActual) ? availableActual : null,
      existingDecision: legacyDecision(status)
    });
  }

  const target = Number(rawTarget);
  if (!Number.isFinite(target) || target <= 0) {
    const status = "NOT_EVALUATED";
    return createDecisionResult({
      status,
      reasonCodes: ["TARGET_MTBF_INVALID"],
      requirement: { targetMTBF: null },
      actualValue: Number.isFinite(availableActual) ? availableActual : null,
      existingDecision: legacyDecision(status, true)
    });
  }

  const actual = availableActual;
  if (!Number.isFinite(actual) || actual <= 0) {
    const zeroFailure = metrics?.estimable === false
      && Number(metrics?.failureCount) === 0;
    const status = "REVIEW_REQUIRED";
    return createDecisionResult({
      status,
      reasonCodes: [
        zeroFailure
          ? "MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"
          : "MTBF_METRIC_INVALID"
      ],
      requirement: { targetMTBF: target },
      actualValue: null,
      existingDecision: legacyDecision(status)
    });
  }

  const status = nearlyAtLeast(actual, target)
    ? "MEETS_REQUIREMENT"
    : "DOES_NOT_MEET_REQUIREMENT";
  return createDecisionResult({
    status,
    reasonCodes: [
      status === "MEETS_REQUIREMENT"
        ? "MTBF_MEETS_TARGET_POINT_ESTIMATE"
        : "MTBF_BELOW_TARGET_POINT_ESTIMATE"
    ],
    requirement: { targetMTBF: target },
    actualValue: actual,
    existingDecision: legacyDecision(status)
  });
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Prefer evaluateMTBFTarget() and consume the structured Decision.
 */
export function toLegacyMTBFTargetDecision(decision) {
  return decision.existingDecision;
}
