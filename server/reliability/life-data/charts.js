import {
  buildWeibullFittedLine
} from "../../../src/reliability/probability-plot.js";
import {
  calculateKaplanMeierPositions
} from "../../../src/reliability/plotting-positions.js";
import {
  curvePoints,
  reliabilityTableRows
} from "../../../src/reliability/reliability-table.js";
import { lifePercentileRows } from "../../../src/reliability/life-percentiles.js";
import { buildTargetGap } from "../../../src/reliability/reliability-table.js";

export function buildLifeDataCharts(
  validation,
  calculation,
  presentation = null,
  targetReliability = undefined
) {
  const records = validation.records;
  const fit = calculation.parameters;
  const missionTime = calculation.metrics.missionTime;
  const times = records.map(record => record.time);
  const minTime = Math.min(...times) * 0.9;
  const maxTime = Math.max(...times) * 1.1;
  const curveMaxTime = Math.max(...times, missionTime, 1) * 1.12;
  const charts = {
    probability: {
      observed: calculateKaplanMeierPositions(records),
      fitted: buildWeibullFittedLine(
        fit.beta,
        fit.eta,
        [minTime, maxTime],
        80
      )
    },
    reliability: curvePoints(
      fit.beta,
      fit.eta,
      curveMaxTime,
      "reliability",
      120
    ),
    cumulativeFailure: curvePoints(
      fit.beta,
      fit.eta,
      curveMaxTime,
      "failure",
      120
    ),
    reliabilityTable: reliabilityTableRows(
      fit.beta,
      fit.eta,
      records,
      missionTime
    )
  };
  if (presentation) {
    const targetGap = buildTargetGap(
      calculation.metrics.missionReliability,
      targetReliability
    );
    charts.uiTables = {
      percentiles: lifePercentileRows(
        fit.beta,
        fit.eta,
        presentation.customPercentile
      ),
      selectedTimes: reliabilityTableRows(
        fit.beta,
        fit.eta,
        records,
        missionTime,
        presentation.customTime
      ),
      targetGap: targetGap
        ? {
            ...targetGap,
            predictedFailureProbability:
              calculation.metrics.missionFailureProbability,
            targetFailureProbability:
              1 - targetGap.targetReliability,
            failureGapPercentagePoints:
              -targetGap.gapPercentagePoints
          }
        : null
    };
  }
  return charts;
}
