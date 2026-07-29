import { weibullInterpretationConfig } from "../../knowledge/reliability/weibull-interpretation.js";

const TARGET_COMPARISON_LIMITATION =
  "Point-estimate comparison only; confidence bounds are not included.";

export function buildStructuredLifeDataInsight({
  validation,
  calculation,
  decision,
  config = weibullInterpretationConfig
}) {
  const beta = Number(
    calculation?.parameters?.beta
      ?? calculation?.metrics?.beta
  );
  if (!calculation || !Number.isFinite(beta)) {
    return {
      explanationKeys: [],
      recommendationKeys: [],
      limitations: [],
      parameters: {
        resultText: null,
        meaningText: null,
        evidenceText: null,
        possibleConsiderations: [],
        primaryLimitation: null,
        beta: null,
        eta: calculation?.parameters?.eta ?? null,
        trend: null,
        validationStatus: validation?.status ?? null,
        decisionStatus: decision?.status ?? null,
        decisionReasonCodes: [...(decision?.reasonCodes || [])]
      }
    };
  }

  const interpretation = betaInterpretation(beta, config);
  const decisionReasonCodes = [...(decision?.reasonCodes || [])];
  const recommendationKeys = [
    interpretation.possibleConsiderations.length
      ? `Review possible considerations: ${interpretation.possibleConsiderations.join(", ")}.`
      : "Do not claim a confirmed physical mechanism from β alone.",
    "Review right-censoring, sample size, and test stress coverage.",
    "Compare predicted reliability only against an explicit mission requirement or target."
  ];
  const limitations = [interpretation.rule.limitations
    || "Possible mechanism does not mean root cause is confirmed. Confirm with failure analysis, test conditions, and engineering review."];

  if (
    decisionReasonCodes.includes("MISSION_RELIABILITY_MEETS_TARGET")
    || decisionReasonCodes.includes("MISSION_RELIABILITY_BELOW_TARGET")
  ) {
    limitations.push(TARGET_COMPARISON_LIMITATION);
  }
  if (decisionReasonCodes.includes("MISSION_RELIABILITY_INVALID")) {
    limitations.push(
      "Predicted mission reliability is unavailable for engineering decision."
    );
  }

  const evidenceText =
    `The fitted Weibull shape β is ${beta.toFixed(3)}. `
    + `The configured random-failure band is ${interpretation.band}.`;
  return {
    explanationKeys: [
      interpretation.rule.result,
      interpretation.rule.meaning,
      ...decisionReasonCodes
    ],
    recommendationKeys,
    limitations: [...new Set(limitations)],
    parameters: {
      resultText: interpretation.rule.result,
      meaningText: interpretation.rule.meaning,
      evidenceText,
      possibleConsiderations: interpretation.possibleConsiderations,
      primaryLimitation: limitations[0],
      beta,
      eta: calculation.parameters?.eta
        ?? calculation.metrics?.eta
        ?? null,
      trend: interpretation.trend,
      randomFailureBand: {
        lower: config.lowerRandomLimit,
        upper: config.upperRandomLimit
      },
      validationStatus: validation?.status ?? null,
      decisionStatus: decision?.status ?? null,
      decisionReasonCodes
    }
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Compatibility adapter that adds result/meaning/evidence/recommendedActions/
 * flags for unchanged page and report consumers. New consumers should use
 * buildStructuredLifeDataInsight().
 */
export function interpretWeibull(betaOrInput, context = {}) {
  if (
    betaOrInput?.calculation
    || betaOrInput?.decision
    || betaOrInput?.validation
  ) {
    return withLegacyPresentation(buildStructuredLifeDataInsight({
      ...betaOrInput,
      config: betaOrInput.config || context.config
    }));
  }

  const beta = Number(betaOrInput);
  const calculation = Number.isFinite(beta)
    ? {
        status: "COMPLETED",
        model: "Weibull 2P MLE",
        parameters: {
          beta,
          eta: context.eta ?? null
        },
        metrics: {
          beta,
          eta: context.eta ?? null,
          missionReliability: context.missionReliability ?? null
        }
      }
    : null;
  const decision = context.decision || {
    status: "NOT_EVALUATED",
    reasonCodes: ["TARGET_RELIABILITY_NOT_PROVIDED"]
  };
  return withLegacyPresentation(buildStructuredLifeDataInsight({
    validation: context.validation || null,
    calculation,
    decision,
    config: context.config || weibullInterpretationConfig
  }));
}

function betaInterpretation(beta, config) {
  let trend = "APPROXIMATELY_CONSTANT";
  let rule = config.rules.random;
  if (beta < config.lowerRandomLimit) {
    trend = "DECREASING";
    rule = config.rules.decreasing;
  }
  if (beta > config.upperRandomLimit) {
    trend = "INCREASING";
    rule = config.rules.increasing;
  }
  return {
    trend,
    rule,
    band: `${config.lowerRandomLimit} to ${config.upperRandomLimit}`,
    possibleConsiderations:
      rule.possibleConsiderations || rule.mechanisms || []
  };
}

/**
 * @deprecated RELIABILITY_LEGACY_BOUNDARY
 * Legacy Insight field projection; do not add new business rules here.
 */
function withLegacyPresentation(structured) {
  return {
    ...structured,
    structuredLimitations: structured.limitations,
    result: structured.parameters.resultText,
    meaning: structured.parameters.meaningText,
    evidence: structured.parameters.evidenceText,
    possibleConsiderations:
      structured.parameters.possibleConsiderations || [],
    limitations: structured.parameters.primaryLimitation,
    recommendedActions: structured.recommendationKeys,
    flags: {
      decreasingFailureRate:
        structured.parameters.trend === "DECREASING",
      approximatelyConstantFailureRate:
        structured.parameters.trend === "APPROXIMATELY_CONSTANT",
      increasingFailureRate:
        structured.parameters.trend === "INCREASING",
      targetDecisionAvailable: [
        "MEETS_REQUIREMENT",
        "DOES_NOT_MEET_REQUIREMENT"
      ].includes(structured.parameters.decisionStatus),
      reviewRequired:
        structured.parameters.decisionStatus === "REVIEW_REQUIRED"
    }
  };
}
