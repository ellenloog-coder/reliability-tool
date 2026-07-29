export const RELIABILITY_ENGINE_VERSION = "1.0.0";
export const RELIABILITY_CONTRACT_VERSION = "1.0.0";
export const RELIABILITY_FIXTURE_VERSION = "1.0.0";

export const RELIABILITY_MODULES = Object.freeze([
  "life-data",
  "mtbf",
  "demonstration"
]);

export const VALIDATION_STATUSES = Object.freeze([
  "VALID",
  "WARNING",
  "INVALID"
]);

export const CALCULATION_STATUSES = Object.freeze([
  "COMPLETED",
  "ERROR"
]);

export const DECISION_STATUSES = Object.freeze({
  "life-data": Object.freeze([
    "MEETS_REQUIREMENT",
    "DOES_NOT_MEET_REQUIREMENT",
    "NOT_EVALUATED",
    "REVIEW_REQUIRED"
  ]),
  mtbf: Object.freeze([
    "MEETS_REQUIREMENT",
    "DOES_NOT_MEET_REQUIREMENT",
    "NOT_EVALUATED",
    "REVIEW_REQUIRED"
  ]),
  demonstration: Object.freeze([
    "DEMONSTRATED",
    "NOT_DEMONSTRATED",
    "NOT_EVALUATED",
    "REVIEW_REQUIRED"
  ])
});

export const EVIDENCE_GAP_STATUSES = Object.freeze([
  "NOT_AVAILABLE",
  "SATISFIED",
  "GAP_REMAINS"
]);

export const RELIABILITY_REASON_CODE_REGISTRY = Object.freeze([
  reason("TARGET_RELIABILITY_NOT_PROVIDED", "life-data", "No reliability target was supplied, so the target decision was not evaluated.", "INFO"),
  reason("TARGET_RELIABILITY_INVALID", "life-data", "The supplied reliability target is outside the valid probability range.", "WARNING"),
  reason("MISSION_RELIABILITY_INVALID", "life-data", "The calculated mission reliability is unavailable or outside the valid probability range.", "ERROR"),
  reason("MISSION_RELIABILITY_MEETS_TARGET", "life-data", "The calculated mission reliability meets the supplied target.", "INFO"),
  reason("MISSION_RELIABILITY_BELOW_TARGET", "life-data", "The calculated mission reliability is below the supplied target.", "WARNING"),

  reason("TARGET_MTBF_NOT_PROVIDED", "mtbf", "No MTBF target was supplied, so the target decision was not evaluated.", "INFO"),
  reason("TARGET_MTBF_INVALID", "mtbf", "The supplied MTBF target is not a finite positive number.", "WARNING"),
  reason("MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE", "mtbf", "A finite MTBF point estimate is not estimable because no failures were observed.", "WARNING"),
  reason("MTBF_METRIC_INVALID", "mtbf", "The MTBF metric required for the decision is unavailable or invalid.", "ERROR"),
  reason("MTBF_MEETS_TARGET_POINT_ESTIMATE", "mtbf", "The MTBF point estimate meets the supplied target.", "INFO"),
  reason("MTBF_BELOW_TARGET_POINT_ESTIMATE", "mtbf", "The MTBF point estimate is below the supplied target.", "WARNING"),

  reason("PLAN_WORKFLOW_DOES_NOT_EVALUATE_EVIDENCE", "demonstration", "A planning workflow calculates a plan and does not evaluate observed evidence.", "INFO"),
  reason("CONFIDENCE_REQUIREMENT_MISSING_OR_INVALID", "demonstration", "The confidence requirement is missing or invalid.", "ERROR"),
  reason("TARGET_RELIABILITY_MISSING_OR_INVALID", "demonstration", "The reliability target is missing or invalid.", "ERROR"),
  reason("TARGET_MTBF_MISSING_OR_INVALID", "demonstration", "The MTBF target is missing or invalid.", "ERROR"),
  reason("DEMONSTRATION_METRIC_INVALID", "demonstration", "The lower-bound metric required for the demonstration decision is invalid.", "ERROR"),
  reason("RELIABILITY_LOWER_BOUND_MEETS_TARGET", "demonstration", "The reliability lower bound meets the reliability target.", "INFO"),
  reason("RELIABILITY_LOWER_BOUND_BELOW_TARGET", "demonstration", "The reliability lower bound is below the reliability target.", "WARNING"),
  reason("MTBF_LOWER_BOUND_MEETS_TARGET", "demonstration", "The MTBF lower bound meets the MTBF target.", "INFO"),
  reason("MTBF_LOWER_BOUND_BELOW_TARGET", "demonstration", "The MTBF lower bound is below the MTBF target.", "WARNING"),
  reason("ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT", "demonstration", "The achieved confidence meets the confidence requirement.", "INFO"),
  reason("ACHIEVED_CONFIDENCE_BELOW_REQUIREMENT", "demonstration", "The achieved confidence is below the confidence requirement.", "WARNING"),
  reason("ZERO_OBSERVED_FAILURES", "demonstration", "No failures were observed in the evaluated demonstration evidence.", "INFO"),
  reason("EVIDENCE_GAP_REMAINS", "demonstration", "Additional sample units or test exposure are required.", "WARNING")
]);

export const RELIABILITY_REASON_CODES = Object.freeze(
  Object.fromEntries(RELIABILITY_REASON_CODE_REGISTRY.map(entry => [entry.code, entry]))
);

export const RELIABILITY_CONTRACT_V1_SCHEMA = deepFreeze({
  result: {
    required: [
      "validation",
      "calculation",
      "decision",
      "insight",
      "compatibility",
      "metadata"
    ],
    optional: [],
    nullable: ["calculation", "decision", "insight"]
  },
  validation: {
    required: ["status", "errors", "warnings"],
    optional: ["counts", "records", "normalizedInput"],
    nullable: []
  },
  calculation: {
    requiredWhenCompleted: ["status", "model", "metrics"],
    requiredWhenError: ["status", "error"],
    optional: [
      "parameters",
      "supplementalMTBF",
      "evidence",
      "requirement",
      "assumptions"
    ],
    nullable: []
  },
  decision: {
    required: [
      "status",
      "reasonCodes",
      "requirement",
      "actualValue",
      "existingDecision"
    ],
    optional: ["actualEvidence", "evidenceGap", "limitations"],
    nullable: ["actualValue"]
  },
  insight: {
    required: [
      "explanationKeys",
      "recommendationKeys",
      "limitations",
      "parameters"
    ],
    optional: [],
    nullable: []
  },
  metadata: {
    required: [
      "engineVersion",
      "contractVersion",
      "fixtureVersion",
      "module"
    ],
    optional: [],
    nullable: []
  }
});

function reason(code, module, meaning, severity) {
  return Object.freeze({ code, module, meaning, severity });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
