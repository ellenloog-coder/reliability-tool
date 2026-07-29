export function fitWeibull2PMLE(records, options = {}) {
  const failures = records.filter(record => record.status === "failure");
  const r = failures.length;
  if (!r) throw new Error("Weibull 2P MLE requires at least one failure.");
  if (new Set(records.map(record => record.time)).size < 2) throw new Error("Weibull 2P MLE cannot be estimated when all times are identical.");

  const maxTime = Math.max(...records.map(record => record.time));
  const scaled = records.map(record => ({ ...record, time: record.time / maxTime }));
  const failedLogs = scaled.filter(record => record.status === "failure").map(record => Math.log(record.time));
  const meanFailureLog = failedLogs.reduce((sum, value) => sum + value, 0) / r;
  const lower = options.lower ?? 0.05;
  const upper = options.upper ?? 50;
  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 200;

  function score(beta) {
    let maxExponent = -Infinity;
    const exponents = scaled.map(record => beta * Math.log(record.time));
    exponents.forEach(value => { if (value > maxExponent) maxExponent = value; });
    let sumW = 0;
    let sumWLog = 0;
    scaled.forEach((record, index) => {
      const w = Math.exp(exponents[index] - maxExponent);
      sumW += w;
      sumWLog += w * Math.log(record.time);
    });
    return 1 / beta + meanFailureLog - sumWLog / sumW;
  }

  let lo = lower;
  let hi = upper;
  let fLo = score(lo);
  let fHi = score(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) {
    throw new Error("Weibull beta solver could not bracket a root.");
  }

  let beta = (lo + hi) / 2;
  let iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    beta = (lo + hi) / 2;
    const fMid = score(beta);
    if (!Number.isFinite(fMid)) throw new Error("Weibull beta solver produced a non-finite score.");
    if (Math.abs(fMid) < tolerance || Math.abs(hi - lo) < tolerance * Math.max(1, beta)) break;
    if (fLo * fMid > 0) {
      lo = beta;
      fLo = fMid;
    } else {
      hi = beta;
      fHi = fMid;
    }
  }
  if (iterations >= maxIterations) throw new Error("Weibull beta solver did not converge.");

  const sumScaledBeta = scaled.reduce((sum, record) => sum + Math.exp(beta * Math.log(record.time)), 0);
  const etaScaled = Math.pow(sumScaledBeta / r, 1 / beta);
  const eta = etaScaled * maxTime;
  if (![beta, eta].every(value => Number.isFinite(value) && value > 0)) throw new Error("Weibull MLE produced invalid parameters.");
  return { beta, eta, converged: true, iterations: iterations + 1, logLikelihood: weibullLogLikelihood(records, beta, eta) };
}

export function weibullLogLikelihood(records, beta, eta) {
  return records.reduce((sum, record) => {
    const z = Math.pow(record.time / eta, beta);
    if (record.status === "failure") {
      return sum + Math.log(beta) - Math.log(eta) + (beta - 1) * Math.log(record.time / eta) - z;
    }
    return sum - z;
  }, 0);
}
