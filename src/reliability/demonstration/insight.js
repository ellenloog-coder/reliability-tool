import { evaluateDemonstrationResult } from "../decision/demonstration-rule.js";

const RESULT_KEYS = {
  WAITING: "Waiting for calculation",
  PLAN: "Required evidence calculated",
  DEMONSTRATED: "Target demonstrated at the selected confidence level",
  NOT_DEMONSTRATED: "Target not demonstrated at the selected confidence level",
  REVIEW_REQUIRED: "Engineering review is required before interpreting the demonstration result",
  NOT_EVALUATED: "Demonstration evidence was not evaluated"
};

const SAMPLE_MEANING = "The result is based on the exact binomial model, the selected target reliability, and the selected confidence level.";
const TIME_MEANING = "The result is based on the exponential constant failure-rate model, the selected target, and the selected confidence level.";

export function buildStructuredDemoInsight({
  validation,
  calculation,
  decision
}) {
  if (!calculation || !decision) {
    return {
      explanationKeys: [RESULT_KEYS.WAITING],
      recommendationKeys: [],
      limitations: [],
      parameters: {
        resultText: RESULT_KEYS.WAITING,
        meaningText: "No engineering interpretation is generated until a real demonstration calculation is completed.",
        evidenceText: "",
        assumptions: [],
        method: null,
        workflow: null
      }
    };
  }

  const sample = calculation.model === "Exact Binomial";
  const plan = decision.reasonCodes.includes(
    "PLAN_WORKFLOW_DOES_NOT_EVALUATE_EVIDENCE"
  );
  const resultText = plan
    ? RESULT_KEYS.PLAN
    : RESULT_KEYS[decision.status] || RESULT_KEYS.REVIEW_REQUIRED;
  const assumptions = sample
    ? [
        "Independent pass/fail observations",
        "Same mission definition for all units",
        "No time-to-failure modeling"
      ]
    : [
        "Exponential constant failure-rate assumption",
        "Independent failure events",
        "Accumulated exposure time is treated as reliable"
      ];
  const modelLimitations = sample
    ? [
        "No time-to-failure modeling",
        "No reliability growth evaluation",
        "Statistical demonstration does not confirm a physical failure mechanism"
      ]
    : [
        "No failure-rate trend evaluation",
        "No repairable-system growth modeling",
        "Statistical demonstration does not confirm a physical failure mechanism"
      ];
  const recommendationKeys = [
    "Confirm mission definition",
    "Confirm failure classification"
  ];
  if (
    decision.status === "NOT_DEMONSTRATED"
    || decision.evidenceGap?.status === "GAP_REMAINS"
  ) {
    recommendationKeys.push("Continue testing to close the evidence gap");
  }
  if (!sample) {
    recommendationKeys.push("Review whether the exponential assumption is appropriate");
  }
  recommendationKeys.push(
    "Use Life Data if failure times and censoring information are available"
  );
  if (sample && Number(calculation.evidence?.allowableFailures) > 0) {
    recommendationKeys.push("Review the allowable-failure rule with stakeholders");
  }
  if (
    decision.limitations.includes(
      "MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"
    )
  ) {
    recommendationKeys.push(
      "Use the lower confidence bound instead of an infinite point estimate"
    );
  }

  const evidenceText = formatEvidence(calculation, sample, plan);
  return {
    explanationKeys: [resultText, sample ? SAMPLE_MEANING : TIME_MEANING],
    recommendationKeys,
    limitations: [...new Set([...modelLimitations, ...decision.limitations])],
    parameters: {
      resultText,
      meaningText: sample ? SAMPLE_MEANING : TIME_MEANING,
      evidenceText,
      assumptions,
      method: sample ? "sample" : "time",
      workflow: plan ? "plan" : "evaluate",
      validationStatus: validation?.status ?? null,
      decisionStatus: decision.status,
      decisionReasonCodes: [...decision.reasonCodes],
      evidenceGapStatus: decision.evidenceGap?.status ?? "NOT_AVAILABLE",
      allowableFailures: calculation.evidence?.allowableFailures ?? null,
      missingOptionalMissionTime: sample
        && plan
        && !calculation.requirement?.missionTime
    }
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Compatibility adapter that adds result/meaning/evidence/recommendedActions/
 * flags for unchanged page and report consumers. New consumers should use
 * buildStructuredDemoInsight().
 */
export function buildDemoInsight(input) {
  if (input?.calculation || input?.decision) {
    return withLegacyPresentation(buildStructuredDemoInsight(input));
  }
  if (!input?.result) {
    return withLegacyPresentation(buildStructuredDemoInsight({
      validation: input?.validation,
      calculation: null,
      decision: null
    }));
  }
  const calculation = legacyCalculationView(
    input.result,
    input.method,
    input.workflow
  );
  const decision = evaluateDemonstrationResult(input.result);
  return withLegacyPresentation(buildStructuredDemoInsight({
    validation: input.validation || {
      status: "VALID",
      errors: [],
      warnings: []
    },
    calculation,
    decision
  }));
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Legacy Insight field projection; do not add new business rules here.
 */
function withLegacyPresentation(structured) {
  const legacyLimitations = structured.limitations.filter(
    item => item.includes("modeling")
      || item.includes("evaluation")
      || item.includes("physical failure mechanism")
  );
  return {
    ...structured,
    structuredLimitations: structured.limitations,
    result: structured.parameters.resultText,
    meaning: structured.parameters.meaningText,
    evidence: structured.parameters.evidenceText,
    assumptions: structured.parameters.assumptions,
    limitations: legacyLimitations,
    recommendedActions: structured.recommendationKeys,
    flags: {
      smallEvidenceMargin: false,
      allowableFailures: Number(structured.parameters.allowableFailures) > 0,
      missingOptionalMissionTime:
        structured.parameters.missingOptionalMissionTime === true
    }
  };
}

function legacyCalculationView(result, method, workflow) {
  const sample = method === "sample";
  const plan = workflow === "plan";
  return {
    model: sample ? "Exact Binomial" : "Exponential / Poisson",
    metrics: sample
      ? {
          requiredSampleSize: result.requiredSampleSize,
          achievedConfidenceAtRequiredN: result.achievedConfidenceAtRequiredN,
          reliabilityLowerBound: result.reliabilityLowerBound,
          achievedConfidenceAtTarget: result.achievedConfidenceAtTarget
        }
      : {
          requiredTotalTestTime: result.requiredTotalTestTime,
          requiredExposureFactor: result.requiredExposureFactor,
          mtbfLowerBound: result.mtbfLowerBound,
          achievedConfidenceAtTarget: result.achievedConfidenceAtTarget
        },
    evidence: {
      allowableFailures: result.allowableFailures,
      observedFailures: result.observedFailures,
      evidenceGap: result.evidenceGap
    },
    requirement: {
      targetReliability: result.targetReliability,
      targetMTBF: result.targetMTBF,
      missionTime: result.missionTime,
      requiredConfidence: result.requiredConfidence ?? result.confidenceLevel
    },
    assumptions: {
      pointEstimateNotEstimable: result.pointEstimateNotEstimable === true
    },
    workflow: plan ? "plan" : "evaluate"
  };
}

function formatEvidence(calculation, sample, plan) {
  const metrics = calculation.metrics || {};
  if (sample && plan) {
    return `Required sample size is n = ${metrics.requiredSampleSize}; achieved confidence is ${formatPercent(metrics.achievedConfidenceAtRequiredN)}.`;
  }
  if (sample) {
    return `Reliability lower bound is ${formatPercent(metrics.reliabilityLowerBound)}; achieved confidence at target is ${formatPercent(metrics.achievedConfidenceAtTarget)}.`;
  }
  if (plan) {
    return `Required total test time is ${formatNumber(metrics.requiredTotalTestTime)}; exposure factor is ${formatNumber(metrics.requiredExposureFactor)}.`;
  }
  return `MTBF lower bound is ${formatNumber(metrics.mtbfLowerBound)}; achieved confidence at target is ${formatPercent(metrics.achievedConfidenceAtTarget)}.`;
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, {
    maximumSignificantDigits: 6
  });
}
