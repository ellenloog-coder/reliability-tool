import {
  evaluateBinomialDemonstration,
  planBinomialDemonstration
} from "../demonstration/sample-demonstration.js";
import {
  evaluateExponentialDemonstration,
  planExponentialDemonstration,
  targetReliabilityToMTBF
} from "../demonstration/time-demonstration.js";
import {
  normalizePercentInput,
  validateDemoInputs
} from "../demonstration/validation.js";
import { evaluateDemonstrationResult } from "../decision/demonstration-rule.js";
import {
  buildDemoInsight,
  buildStructuredDemoInsight
} from "../demonstration/insight.js";
import { calculationFailure, engineMetadata, validationEnvelope } from "./result.js";

function normalizedCalculationInput(method, workflow, targetDefinition, inputs) {
  const common = {
    ...inputs,
    targetReliability: normalizePercentInput(inputs.targetReliability),
    confidenceLevel: normalizePercentInput(inputs.confidenceLevel),
    allowableFailures: inputs.allowableFailures === "" ? 0 : Number(inputs.allowableFailures),
    missionTime: inputs.missionTime === "" || inputs.missionTime == null
      ? null
      : Number(inputs.missionTime),
    timeUnit: inputs.timeUnit || "hours",
    targetDefinition
  };
  if (method === "sample") {
    return workflow === "plan"
      ? common
      : {
          ...common,
          unitsTested: Number(inputs.unitsTested),
          observedFailures: Number(inputs.observedFailures || 0)
        };
  }
  return workflow === "plan"
    ? {
        ...common,
        targetMTBF: Number(inputs.targetMTBF),
        numberOfUnits: inputs.numberOfUnits === "" || inputs.numberOfUnits == null
          ? null
          : Number(inputs.numberOfUnits)
      }
    : {
        ...common,
        targetMTBF: Number(inputs.targetMTBF),
        totalTestTime: Number(inputs.totalTestTime),
        observedFailures: Number(inputs.observedFailures || 0)
      };
}

function calculate(method, workflow, input) {
  if (method === "sample") {
    return workflow === "plan"
      ? planBinomialDemonstration(input)
      : evaluateBinomialDemonstration(input);
  }
  return workflow === "plan"
    ? planExponentialDemonstration(input)
    : evaluateExponentialDemonstration(input);
}

export function previewDemonstrationTarget({
  targetDefinition,
  targetReliability,
  missionTime
}) {
  if (targetDefinition !== "reliability") return null;
  const reliability = normalizePercentInput(targetReliability);
  const time = Number(missionTime);
  if (
    !Number.isFinite(reliability)
    || reliability <= 0
    || reliability >= 1
    || !Number.isFinite(time)
    || time <= 0
  ) {
    return null;
  }
  return targetReliabilityToMTBF(reliability, time);
}

function calculationView(result) {
  const sample = result.method === "sample";
  const plan = result.workflow === "plan";
  if (sample && plan) {
    return {
      metrics: {
        requiredSampleSize: result.requiredSampleSize,
        achievedConfidenceAtRequiredN: result.achievedConfidenceAtRequiredN,
        achievedConfidenceAtPreviousN: result.achievedConfidenceAtPreviousN,
        minimalityVerified: result.minimalityVerified
      },
      evidence: {
        allowableFailures: result.allowableFailures
      },
      requirement: {
        targetReliability: result.targetReliability,
        requiredConfidence: result.confidenceLevel
      },
      assumptions: {
        acceptanceRule: result.acceptanceRule
      }
    };
  }
  if (sample) {
    return {
      metrics: {
        observedPassRate: result.observedPassRate,
        reliabilityLowerBound: result.reliabilityLowerBound,
        achievedConfidenceAtTarget: result.achievedConfidenceAtTarget
      },
      evidence: {
        unitsTested: result.unitsTested,
        observedFailures: result.observedFailures,
        observedSuccesses: result.observedSuccesses,
        evidenceGap: result.evidenceGap
      },
      requirement: {
        targetReliability: result.targetReliability,
        requiredConfidence: result.requiredConfidence
      },
      assumptions: {
        evidenceGapAssumption: result.evidenceGap?.assumption ?? null
      }
    };
  }
  if (plan) {
    return {
      metrics: {
        requiredExposureFactor: result.requiredExposureFactor,
        chiSquareEquivalentQuantile: result.chiSquareEquivalentQuantile,
        requiredTotalTestTime: result.requiredTotalTestTime,
        estimatedTimePerUnit: result.estimatedTimePerUnit,
        achievedConfidence: result.achievedConfidence
      },
      evidence: {
        allowableFailures: result.allowableFailures,
        numberOfUnits: result.numberOfUnits
      },
      requirement: {
        targetDefinition: result.targetDefinition,
        targetMTBF: result.targetMTBF,
        targetReliability: result.targetReliability,
        missionTime: result.missionTime,
        requiredConfidence: result.confidenceLevel
      },
      assumptions: {
        acceptanceRule: result.acceptanceRule
      }
    };
  }
  return {
    metrics: {
      mtbfPointEstimate: result.mtbfPointEstimate,
      mtbfLowerBound: result.mtbfLowerBound,
      reliabilityLowerBoundAtMissionTime: result.reliabilityLowerBoundAtMissionTime,
      achievedConfidenceAtTarget: result.achievedConfidenceAtTarget,
      requiredExposureFactor: result.requiredExposureFactor,
      chiSquareEquivalentQuantile: result.chiSquareEquivalentQuantile
    },
    evidence: {
      totalTestTime: result.totalTestTime,
      observedFailures: result.observedFailures,
      evidenceGap: result.evidenceGap
    },
    requirement: {
      targetDefinition: result.targetDefinition,
      targetMTBF: result.targetMTBF,
      targetReliability: result.targetReliability,
      missionTime: result.missionTime,
      requiredConfidence: result.requiredConfidence
    },
    assumptions: {
      pointEstimateNotEstimable: result.pointEstimateNotEstimable,
      evidenceGapAssumption: result.evidenceGap?.assumption ?? null
    }
  };
}

export function analyzeDemonstration(input) {
  const method = input?.method === "time" ? "time" : "sample";
  const workflow = input?.workflow === "evaluate" ? "evaluate" : "plan";
  const inputs = {
    targetReliability: "",
    confidenceLevel: "",
    allowableFailures: "0",
    missionTime: "",
    timeUnit: "hours",
    unitsTested: "",
    observedFailures: "",
    targetMTBF: "",
    totalTestTime: "",
    numberOfUnits: "",
    ...(input?.inputs || {})
  };
  const targetDefinition = input?.targetDefinition
    || inputs.targetDefinition
    || "mtbf";
  const validation = validateDemoInputs({
    method,
    workflow,
    targetDefinition,
    inputs
  });
  const validationResult = validationEnvelope(validation);
  const base = {
    validation: validationResult,
    calculation: null,
    decision: null,
    insight: null,
    /**
     * @deprecated RELIABILITY_LEGACY_BOUNDARY
     * UI/report bridge only. New consumers use validation/calculation/decision/insight.
     */
    compatibility: {
      validation,
      result: null,
      insight: null
    },
    metadata: engineMetadata("demonstration")
  };
  if (validationResult.status === "INVALID") return base;

  try {
    const calculationInput = normalizedCalculationInput(
      method,
      workflow,
      targetDefinition,
      inputs
    );
    const result = calculate(method, workflow, calculationInput);
    result.missionTime = calculationInput.missionTime || result.missionTime || null;
    result.timeUnit = inputs.timeUnit;
    const structured = calculationView(result);
    const decision = evaluateDemonstrationResult(result);
    const calculation = {
      status: "COMPLETED",
      model: method === "sample" ? "Exact Binomial" : "Exponential / Poisson",
      ...structured
    };
    const insight = buildStructuredDemoInsight({
      validation: validationResult,
      calculation,
      decision
    });
    return {
      ...base,
      calculation,
      decision,
      insight,
      /**
       * @deprecated RELIABILITY_LEGACY_BOUNDARY
       * UI/report bridge only. Do not place new calculations or decisions here.
       */
      compatibility: {
        validation,
        result,
        insight: buildDemoInsight({
          validation: validationResult,
          calculation,
          decision
        })
      }
    };
  } catch (error) {
    return { ...base, calculation: calculationFailure(error) };
  }
}
