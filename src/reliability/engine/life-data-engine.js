import { defaultMissionTime, weibullMetrics } from "../metrics.js";
import { calculateMtbf } from "../mtbf.js";
import { evaluateReliabilityTarget } from "../decision/reliability-rule.js";
import {
  buildStructuredLifeDataInsight,
  interpretWeibull
} from "../insight-engine.js";
import { validateRows } from "../validation.js";
import { fitWeibull2PMLE } from "../weibull-mle.js";
import { calculationFailure, engineMetadata, validationEnvelope } from "./result.js";

export function analyzeLifeData(input) {
  const settings = input?.settings || {};
  const validation = validateRows(input?.rows || [], input?.mapping || {}, settings);
  const validationResult = validationEnvelope(validation, {
    counts: {
      total: validation.totalCount,
      failures: validation.failureCount,
      censored: validation.censoredCount
    },
    records: validation.records
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
      fit: null,
      metrics: null,
      mtbf: null,
      insight: null
    },
    metadata: engineMetadata("life-data")
  };
  if (validationResult.status === "INVALID") return base;

  try {
    const missionTime = Number(settings.missionTime) || defaultMissionTime(validation.records);
    const parameters = fitWeibull2PMLE(validation.records);
    const legacyMetrics = weibullMetrics(
      parameters,
      validation.records,
      missionTime,
      settings.targetReliability ?? ""
    );
    const { targetComparison: _legacyTargetComparison, ...metrics } = legacyMetrics;
    const decision = evaluateReliabilityTarget(metrics, {
      targetReliability: settings.targetReliability ?? ""
    });
    const calculation = {
      status: "COMPLETED",
      model: "Weibull 2P MLE",
      parameters,
      metrics,
      supplementalMTBF: calculateMtbf(validation.records, missionTime)
    };
    const insight = buildStructuredLifeDataInsight({
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
        fit: parameters,
        metrics: {
          ...metrics,
          targetComparison: decision.existingDecision
        },
        mtbf: calculation.supplementalMTBF,
        insight: interpretWeibull({
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
