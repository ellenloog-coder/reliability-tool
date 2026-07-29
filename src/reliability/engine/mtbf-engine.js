import {
  analyzeExponentialMTBF,
  summarizeUnitExposure
} from "../mtbf.js";
import { evaluateMTBFTarget } from "../decision/mtbf-rule.js";
import {
  validateMTBFSummaryInput,
  validateMTBFUnitRows
} from "../mtbf-validation.js";
import {
  buildMTBFInsight,
  buildStructuredMTBFInsight
} from "../mtbf-insight.js";
import { calculationFailure, engineMetadata, validationEnvelope } from "./result.js";

function unique(items) {
  return [...new Set(items)];
}

function validateInput(input) {
  if (input?.inputMode !== "unit") {
    const validation = validateMTBFSummaryInput(input || {});
    return {
      validation,
      normalizedInput: validation.input
    };
  }

  const mapping = input.mapping || {
    unitId: "unitId",
    exposureTime: "exposureTime",
    status: "status",
    failureMode: "failureMode",
    testCondition: "testCondition",
    notes: "notes"
  };
  const rowValidation = validateMTBFUnitRows(
    input.rows || [],
    mapping,
    { timeUnit: input.timeUnit }
  );
  const summary = summarizeUnitExposure(rowValidation.records, input.timeUnit);
  const normalizedInput = {
    ...summary,
    missionTime: Number(input.missionTime),
    targetMTBF: input.targetMTBF === "" || input.targetMTBF == null
      ? null
      : Number(input.targetMTBF)
  };
  const summaryValidation = validateMTBFSummaryInput(normalizedInput);
  return {
    validation: {
      ...rowValidation,
      errors: unique([...rowValidation.errors, ...summaryValidation.errors]),
      warnings: unique([...rowValidation.warnings, ...summaryValidation.warnings])
    },
    normalizedInput: {
      ...summaryValidation.input,
      censoredCount: summary.censoredCount,
      totalUnits: summary.totalUnits
    }
  };
}

export function analyzeMTBF(input) {
  const { validation, normalizedInput } = validateInput(input);
  const validationResult = validationEnvelope(validation, {
    normalizedInput
  });
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
      inputSummary: normalizedInput,
      result: null,
      targetComparison: null,
      insight: null
    },
    metadata: engineMetadata("mtbf")
  };
  if (validationResult.status === "INVALID") return base;

  try {
    const result = analyzeExponentialMTBF(normalizedInput);
    const metrics = {
      mtbf: result.mtbf,
      mtbfLowerBound: result.mtbfLowerBound ?? null,
      missionReliability: result.missionReliability,
      failureRate: result.failureRate
    };
    const decision = evaluateMTBFTarget(result, {
      targetMTBF: normalizedInput.targetMTBF
    });
    const calculation = {
      status: "COMPLETED",
      model: result.model,
      metrics
    };
    const insight = buildStructuredMTBFInsight({
      validation: validationResult,
      calculation,
      decision
    });
    const targetComparison = decision.existingDecision;
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
        inputSummary: normalizedInput,
        result: {
          ...result,
          targetComparison
        },
        targetComparison,
        insight: buildMTBFInsight({
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
