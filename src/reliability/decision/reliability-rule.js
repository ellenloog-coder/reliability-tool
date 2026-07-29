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
 * Builds the pre-Engine target-comparison shape for compatibility consumers.
 */
function legacyDecision(status, invalidTarget = false) {
  if (status === "MEETS_REQUIREMENT") {
    return {
      status: "Meets Target",
      message: "Predicted reliability meets the provided target reliability."
    };
  }
  if (status === "DOES_NOT_MEET_REQUIREMENT") {
    return {
      status: "Below Target",
      message: "Predicted reliability is below the provided target reliability."
    };
  }
  return invalidTarget
    ? {
        status: "Target not provided",
        message: "Reliability risk not assessed — target reliability must be between 0 and 1."
      }
    : {
        status: "Target not provided",
        message: "Reliability risk not assessed — no target reliability was provided."
      };
}

export function evaluateReliabilityTarget(metrics, requirement = {}) {
  const actualValue = Number(metrics?.missionReliability);
  const rawTarget = requirement?.targetReliability;
  if (rawTarget === null || rawTarget === undefined || rawTarget === "") {
    const status = "NOT_EVALUATED";
    return createDecisionResult({
      status,
      reasonCodes: ["TARGET_RELIABILITY_NOT_PROVIDED"],
      requirement: { targetReliability: null },
      actualValue: Number.isFinite(actualValue) ? actualValue : null,
      existingDecision: legacyDecision(status)
    });
  }

  const target = Number(rawTarget);
  if (!Number.isFinite(target) || target <= 0 || target >= 1) {
    const status = "NOT_EVALUATED";
    return createDecisionResult({
      status,
      reasonCodes: ["TARGET_RELIABILITY_INVALID"],
      requirement: { targetReliability: null },
      actualValue: Number.isFinite(actualValue) ? actualValue : null,
      existingDecision: legacyDecision(status, true)
    });
  }

  if (!Number.isFinite(actualValue) || actualValue < 0 || actualValue > 1) {
    return createDecisionResult({
      status: "REVIEW_REQUIRED",
      reasonCodes: ["MISSION_RELIABILITY_INVALID"],
      requirement: { targetReliability: target },
      actualValue: null,
      existingDecision: {
        status: "Target not provided",
        message: "Reliability risk not assessed — predicted reliability is not available."
      }
    });
  }

  const status = nearlyAtLeast(actualValue, target)
    ? "MEETS_REQUIREMENT"
    : "DOES_NOT_MEET_REQUIREMENT";
  return createDecisionResult({
    status,
    reasonCodes: [
      status === "MEETS_REQUIREMENT"
        ? "MISSION_RELIABILITY_MEETS_TARGET"
        : "MISSION_RELIABILITY_BELOW_TARGET"
    ],
    requirement: { targetReliability: target },
    actualValue,
    existingDecision: legacyDecision(status)
  });
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Prefer evaluateReliabilityTarget() and consume the structured Decision.
 */
export function toLegacyReliabilityTargetDecision(decision) {
  return decision.existingDecision;
}
