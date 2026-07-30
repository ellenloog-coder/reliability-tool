import {
  evaluateReliabilityTarget
} from "../../../src/reliability/decision/reliability-rule.js";

export function decideLifeData(calculation, settings) {
  return evaluateReliabilityTarget(calculation.metrics, {
    targetReliability: settings.targetReliability ?? ""
  });
}
