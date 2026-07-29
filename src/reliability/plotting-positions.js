const PROBABILITY_EPSILON = 1e-6;

export function transformToWeibullCoordinates(time, cumulativeFailureProbability) {
  if (!Number.isFinite(time) || time <= 0) throw new Error("Time must be a finite positive number.");
  return {
    transformedX: Math.log(time),
    transformedY: weibullProbabilityY(cumulativeFailureProbability)
  };
}

export function weibullProbabilityY(probability) {
  const p = clampProbability(probability);
  return Math.log(-Math.log(1 - p));
}

export function weibullProbabilityTicks() {
  return [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99];
}

export function calculateKaplanMeierPositions(records) {
  const sorted = [...records].sort((a, b) => a.time - b.time || statusOrder(a.status) - statusOrder(b.status));
  const grouped = new Map();
  sorted.forEach(record => {
    const group = grouped.get(record.time) || { time: record.time, failures: [], censored: [] };
    if (record.status === "failure") group.failures.push(record);
    else group.censored.push(record);
    grouped.set(record.time, group);
  });

  const groups = Array.from(grouped.values()).sort((a, b) => a.time - b.time);
  let atRisk = records.length;
  let survivalProbability = 1;
  const failurePositions = [];
  const censoredMarkers = [];

  groups.forEach(group => {
    if (group.failures.length > 0 && atRisk > 0) {
      survivalProbability *= Math.max(0, 1 - group.failures.length / atRisk);
      const cumulativeFailureProbability = clampProbability(1 - survivalProbability);
      group.failures.forEach(record => {
        const transformed = transformToWeibullCoordinates(record.time, cumulativeFailureProbability);
        failurePositions.push({
          sampleId: record.sampleId,
          time: record.time,
          status: record.status,
          failureMode: record.failureMode,
          testCondition: record.testCondition,
          survivalProbability: 1 - cumulativeFailureProbability,
          cumulativeFailureProbability,
          transformedX: transformed.transformedX,
          transformedY: transformed.transformedY
        });
      });
    }
    group.censored.forEach(record => {
      censoredMarkers.push({
        sampleId: record.sampleId,
        time: record.time,
        status: record.status,
        failureMode: record.failureMode,
        testCondition: record.testCondition,
        survivalProbability,
        transformedX: Math.log(record.time)
      });
    });
    atRisk -= group.failures.length + group.censored.length;
  });

  return { failurePositions, censoredMarkers };
}

export function clampProbability(probability) {
  return Math.min(1 - PROBABILITY_EPSILON, Math.max(PROBABILITY_EPSILON, Number(probability)));
}

function statusOrder(status) {
  return status === "failure" ? 0 : 1;
}
