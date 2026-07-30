import {
  defaultMissionTime,
  weibullMetrics
} from "../../../src/reliability/metrics.js";
import { calculateMtbf } from "../../../src/reliability/mtbf.js";
import { fitWeibull2PMLE } from "../../../src/reliability/weibull-mle.js";

export function calculateLifeData(validation, settings) {
  const missionTime = Number(settings.missionTime)
    || defaultMissionTime(validation.records);
  const parameters = fitWeibull2PMLE(validation.records);
  const legacyMetrics = weibullMetrics(
    parameters,
    validation.records,
    missionTime,
    settings.targetReliability ?? ""
  );
  const { targetComparison: _legacyDecision, ...metrics } = legacyMetrics;
  return {
    status: "COMPLETED",
    model: "Weibull 2P MLE",
    parameters,
    metrics,
    supplementalMTBF: calculateMtbf(validation.records, missionTime)
  };
}
