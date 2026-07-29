import { createDecisionResult } from "./decision-result.js";

const SAMPLE_TOLERANCE = 1e-10;

function validProbability(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) < 1;
}

function evidenceGapResult(method, gap) {
  if (!gap) return { status: "NOT_AVAILABLE" };
  const amount = method === "sample"
    ? Number(gap.additionalUnitsRequired)
    : Number(gap.additionalTotalTestTimeRequired);
  return {
    ...gap,
    status: Number.isFinite(amount) && amount <= 0
      ? "SATISFIED"
      : "GAP_REMAINS"
  };
}

function notEvaluated(requirement, reasonCode) {
  return createDecisionResult({
    status: "NOT_EVALUATED",
    reasonCodes: [reasonCode],
    requirement,
    actualValue: null,
    existingDecision: { demonstrated: null }
  });
}

export function evaluateDemonstrationDecision({
  method,
  workflow = "evaluate",
  metrics = {},
  evidence = {},
  requirement = {},
  assumptions = {}
}) {
  const gap = evidenceGapResult(method, evidence.evidenceGap);
  if (workflow !== "evaluate") {
    return {
      ...notEvaluated(requirement, "PLAN_WORKFLOW_DOES_NOT_EVALUATE_EVIDENCE"),
      actualEvidence: evidence,
      evidenceGap: gap,
      limitations: []
    };
  }

  const requiredConfidence = Number(requirement.requiredConfidence);
  if (!validProbability(requiredConfidence)) {
    return {
      ...notEvaluated(requirement, "CONFIDENCE_REQUIREMENT_MISSING_OR_INVALID"),
      actualEvidence: evidence,
      evidenceGap: gap,
      limitations: []
    };
  }

  let target;
  let actual;
  let tolerance;
  let metReason;
  let notMetReason;
  if (method === "sample") {
    target = Number(requirement.targetReliability);
    if (!validProbability(target)) {
      return {
        ...notEvaluated(requirement, "TARGET_RELIABILITY_MISSING_OR_INVALID"),
        actualEvidence: evidence,
        evidenceGap: gap,
        limitations: []
      };
    }
    actual = Number(metrics.reliabilityLowerBound);
    tolerance = SAMPLE_TOLERANCE;
    metReason = "RELIABILITY_LOWER_BOUND_MEETS_TARGET";
    notMetReason = "RELIABILITY_LOWER_BOUND_BELOW_TARGET";
  } else {
    if (
      requirement.targetDefinition === "reliability"
      && !validProbability(requirement.targetReliability)
    ) {
      return {
        ...notEvaluated(requirement, "TARGET_RELIABILITY_MISSING_OR_INVALID"),
        actualEvidence: evidence,
        evidenceGap: gap,
        limitations: []
      };
    }
    target = Number(requirement.targetMTBF);
    if (!Number.isFinite(target) || target <= 0) {
      return {
        ...notEvaluated(requirement, "TARGET_MTBF_MISSING_OR_INVALID"),
        actualEvidence: evidence,
        evidenceGap: gap,
        limitations: []
      };
    }
    actual = Number(metrics.mtbfLowerBound);
    tolerance = Math.max(1e-12, Math.abs(target) * 1e-12);
    metReason = "MTBF_LOWER_BOUND_MEETS_TARGET";
    notMetReason = "MTBF_LOWER_BOUND_BELOW_TARGET";
  }

  if (!Number.isFinite(actual) || actual < 0) {
    return {
      status: "REVIEW_REQUIRED",
      reasonCodes: ["DEMONSTRATION_METRIC_INVALID"],
      requirement,
      actualValue: null,
      actualEvidence: evidence,
      evidenceGap: gap,
      limitations: [],
      existingDecision: { demonstrated: null }
    };
  }

  const demonstrated = actual + tolerance >= target;
  const achievedConfidence = Number(metrics.achievedConfidenceAtTarget);
  const confidenceMet = Number.isFinite(achievedConfidence)
    && achievedConfidence + 1e-12 >= requiredConfidence;
  const reasonCodes = [
    demonstrated ? metReason : notMetReason,
    confidenceMet
      ? "ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT"
      : "ACHIEVED_CONFIDENCE_BELOW_REQUIREMENT"
  ];
  const limitations = [];
  if (Number(evidence.observedFailures) === 0) {
    reasonCodes.push("ZERO_OBSERVED_FAILURES");
    if (method === "time" && assumptions.pointEstimateNotEstimable) {
      limitations.push("MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE");
    }
  }
  if (gap.status === "GAP_REMAINS") reasonCodes.push("EVIDENCE_GAP_REMAINS");

  return {
    status: demonstrated ? "DEMONSTRATED" : "NOT_DEMONSTRATED",
    reasonCodes,
    requirement,
    actualValue: actual,
    actualEvidence: evidence,
    evidenceGap: gap,
    limitations,
    existingDecision: { demonstrated }
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Adapts the historical monolithic Demonstration result into Decision input.
 * New callers should use evaluateDemonstrationDecision().
 */
export function evaluateDemonstrationResult(result) {
  if (!result) {
    return evaluateDemonstrationDecision({
      method: "sample",
      workflow: "evaluate",
      requirement: {}
    });
  }
  const sample = result.method === "sample";
  return evaluateDemonstrationDecision({
    method: sample ? "sample" : "time",
    workflow: result.workflow,
    metrics: sample
      ? {
          reliabilityLowerBound: result.reliabilityLowerBound,
          achievedConfidenceAtTarget: result.achievedConfidenceAtTarget
        }
      : {
          mtbfLowerBound: result.mtbfLowerBound,
          reliabilityLowerBoundAtMissionTime: result.reliabilityLowerBoundAtMissionTime,
          achievedConfidenceAtTarget: result.achievedConfidenceAtTarget
        },
    evidence: sample
      ? {
          unitsTested: result.unitsTested,
          observedFailures: result.observedFailures,
          evidenceGap: result.evidenceGap
        }
      : {
          totalTestTime: result.totalTestTime,
          observedFailures: result.observedFailures,
          evidenceGap: result.evidenceGap
        },
    requirement: sample
      ? {
          targetReliability: result.targetReliability,
          requiredConfidence: result.requiredConfidence
        }
      : {
          targetDefinition: result.targetDefinition,
          targetMTBF: result.targetMTBF,
          targetReliability: result.targetReliability,
          missionTime: result.missionTime,
          requiredConfidence: result.requiredConfidence
        },
    assumptions: {
      pointEstimateNotEstimable: result.pointEstimateNotEstimable === true
    }
  });
}
