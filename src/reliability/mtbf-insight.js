const RESULT_TEXT = {
  WAITING: "MTBF point estimate not available",
  CALCULATED: "MTBF point estimate calculated",
  LIMITED: "Limited failure information",
  MEETS_REQUIREMENT: "Observed MTBF meets the target point estimate",
  DOES_NOT_MEET_REQUIREMENT: "Observed MTBF is below the target point estimate",
  REVIEW_REQUIRED: "MTBF point estimate not available"
};

const MODEL_LIMITATIONS = [
  "The model does not evaluate changing failure rates.",
  "The result does not represent individual product lifetime.",
  "Unit-Level Data currently treats each row as one unit exposure record with a final Failure or Censored status. It does not model repeated failures of the same repairable system.",
  "Physical failure analysis is still required."
];

const ASSUMPTIONS = [
  "Exponential / constant failure-rate assumption",
  "Failure events are treated as independent.",
  "Accumulated exposure time is treated as reliable."
];

export function buildStructuredMTBFInsight({
  validation,
  calculation,
  decision
}) {
  if (!calculation || !decision) {
    return {
      explanationKeys: [RESULT_TEXT.WAITING],
      recommendationKeys: [],
      limitations: [],
      parameters: {
        resultText: RESULT_TEXT.WAITING,
        meaningText: "No MTBF result is available.",
        evidenceText: "No MTBF result is available.",
        assumptions: [],
        validationStatus: validation?.status ?? null,
        decisionStatus: decision?.status ?? null,
        decisionReasonCodes: [...(decision?.reasonCodes || [])]
      }
    };
  }

  const reasonCodes = [...(decision.reasonCodes || [])];
  const metrics = calculation.metrics || {};
  const input = validation?.normalizedInput || calculation.input || {};
  const failureCount = finiteNumber(input.failureCount);
  const pointEstimateAvailable = metrics.mtbf !== null
    && metrics.mtbf !== undefined;
  const limitedFailureInformation = pointEstimateAvailable
    && failureCount !== null
    && failureCount > 0
    && failureCount < 5;
  const resultText = resultTextFor(
    decision,
    pointEstimateAvailable,
    limitedFailureInformation
  );
  const meaningText = meaningTextFor(
    pointEstimateAvailable,
    limitedFailureInformation
  );
  const recommendationKeys = recommendationsFor(
    reasonCodes,
    limitedFailureInformation,
    pointEstimateAvailable
  );
  const limitations = [...MODEL_LIMITATIONS];

  if (
    reasonCodes.includes("MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE")
    || !pointEstimateAvailable
  ) {
    limitations.unshift(
      "A confidence-based reliability demonstration is required to quantify zero-failure evidence."
    );
  }
  if (
    reasonCodes.includes("MTBF_MEETS_TARGET_POINT_ESTIMATE")
    || reasonCodes.includes("MTBF_BELOW_TARGET_POINT_ESTIMATE")
  ) {
    limitations.push(
      "The current comparison does not include statistical confidence bounds."
    );
  }

  const evidenceText = formatEvidence(input, metrics);
  return {
    explanationKeys: [resultText, meaningText, ...reasonCodes],
    recommendationKeys,
    limitations: [...new Set(limitations)],
    parameters: {
      resultText,
      meaningText,
      evidenceText,
      assumptions: ASSUMPTIONS,
      validationStatus: validation?.status ?? null,
      decisionStatus: decision.status,
      decisionReasonCodes: reasonCodes,
      totalExposure: finiteNumber(input.totalExposure),
      failureCount,
      mtbf: metrics.mtbf ?? null,
      missionReliability: metrics.missionReliability ?? null,
      failureRate: metrics.failureRate ?? null,
      pointEstimateAvailable,
      limitedFailureInformation
    }
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Compatibility adapter that adds result/meaning/evidence/recommendedActions/
 * flags for unchanged page and report consumers. New consumers should use
 * buildStructuredMTBFInsight().
 */
export function buildMTBFInsight(result, targetComparison = null) {
  if (result?.calculation || result?.decision || result?.validation) {
    return withLegacyPresentation(buildStructuredMTBFInsight(result));
  }

  const validation = {
    status: "VALID",
    errors: [],
    warnings: [...(result?.warnings || [])],
    normalizedInput: {
      totalExposure: result?.totalExposure ?? null,
      failureCount: result?.failureCount ?? null
    }
  };
  const calculation = result
    ? {
        status: "COMPLETED",
        model: result.model,
        metrics: {
          mtbf: result.mtbf,
          mtbfLowerBound: result.mtbfLowerBound ?? null,
          missionReliability: result.missionReliability,
          failureRate: result.failureRate
        }
      }
    : null;
  const decision = legacyDecisionView(targetComparison);

  return withLegacyPresentation(buildStructuredMTBFInsight({
    validation,
    calculation,
    decision
  }));
}

function resultTextFor(decision, pointEstimateAvailable, limited) {
  if (decision.status === "MEETS_REQUIREMENT") {
    return RESULT_TEXT.MEETS_REQUIREMENT;
  }
  if (decision.status === "DOES_NOT_MEET_REQUIREMENT") {
    return RESULT_TEXT.DOES_NOT_MEET_REQUIREMENT;
  }
  if (decision.status === "REVIEW_REQUIRED") {
    return RESULT_TEXT.REVIEW_REQUIRED;
  }
  if (!pointEstimateAvailable) return RESULT_TEXT.WAITING;
  return limited ? RESULT_TEXT.LIMITED : RESULT_TEXT.CALCULATED;
}

function meaningTextFor(pointEstimateAvailable, limited) {
  if (!pointEstimateAvailable) {
    return "The test accumulated operating exposure without an observed failure, but this does not establish infinite MTBF.";
  }
  if (limited) {
    return "The MTBF point estimate is based on a small number of observed failures and may be unstable.";
  }
  return "The estimate summarizes observed failure frequency under the constant failure-rate assumption.";
}

function recommendationsFor(reasonCodes, limited, pointEstimateAvailable) {
  if (
    reasonCodes.includes("MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE")
    || (
      !pointEstimateAvailable
      && !reasonCodes.includes("MTBF_METRIC_INVALID")
    )
  ) {
    return [
      "Use Reliability Demonstration for zero-failure test evaluation.",
      "Continue accumulating exposure or define a target reliability and confidence level."
    ];
  }

  const recommendations = limited
    ? [
        "Continue accumulating exposure.",
        "Review failure classification.",
        "Consider reliability demonstration or confidence-bound analysis."
      ]
    : [
        "Review operating context and failure definitions.",
        "Check whether the constant failure-rate assumption is appropriate.",
        "Use confidence-bound analysis before qualification claims."
      ];

  if (reasonCodes.includes("MTBF_METRIC_INVALID")) {
    return [
      "Review failure classification.",
      "Continue accumulating exposure."
    ];
  }
  if (
    reasonCodes.includes("TARGET_MTBF_NOT_PROVIDED")
    || reasonCodes.includes("TARGET_MTBF_INVALID")
  ) {
    recommendations.push(
      "Continue accumulating exposure or define a target reliability and confidence level."
    );
  }
  return [...new Set(recommendations)];
}

function formatEvidence(input, metrics) {
  const totalExposure = finiteNumber(input.totalExposure);
  const failureCount = finiteNumber(input.failureCount);
  if (totalExposure === null || failureCount === null) {
    return "No MTBF result is available.";
  }
  if (metrics.mtbf === null || metrics.mtbf === undefined) {
    return `T = ${totalExposure}, r = ${failureCount}.`;
  }
  return `T = ${totalExposure}, r = ${failureCount}, MTBF = ${metrics.mtbf}.`;
}

function legacyDecisionView(targetComparison) {
  const statusMap = {
    "Meets Target": {
      status: "MEETS_REQUIREMENT",
      reasonCodes: ["MTBF_MEETS_TARGET_POINT_ESTIMATE"]
    },
    "Below Target": {
      status: "DOES_NOT_MEET_REQUIREMENT",
      reasonCodes: ["MTBF_BELOW_TARGET_POINT_ESTIMATE"]
    },
    "Not Estimable": {
      status: "REVIEW_REQUIRED",
      reasonCodes: ["MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE"]
    }
  };
  return statusMap[targetComparison?.status] || {
    status: "NOT_EVALUATED",
    reasonCodes: ["TARGET_MTBF_NOT_PROVIDED"]
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Legacy Insight field projection; do not add new business rules here.
 */
function withLegacyPresentation(structured) {
  return {
    ...structured,
    result: structured.parameters.resultText,
    meaning: structured.parameters.meaningText,
    evidence: structured.parameters.evidenceText,
    assumptions: structured.parameters.assumptions,
    recommendedActions: structured.recommendationKeys,
    flags: {
      pointEstimateAvailable:
        structured.parameters.pointEstimateAvailable === true,
      limitedFailureInformation:
        structured.parameters.limitedFailureInformation === true,
      targetDecisionAvailable: [
        "MEETS_REQUIREMENT",
        "DOES_NOT_MEET_REQUIREMENT"
      ].includes(structured.parameters.decisionStatus),
      reviewRequired:
        structured.parameters.decisionStatus === "REVIEW_REQUIRED"
    }
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
