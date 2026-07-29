import { solveMonotonicRoot } from "./root-solver.js";

export function poissonLogPMF(k, mean) {
  if (!Number.isInteger(k) || k < 0) throw new Error("Poisson k must be a non-negative integer.");
  if (!Number.isFinite(mean) || mean < 0) throw new Error("Poisson mean must be finite and non-negative.");
  if (mean === 0) return k === 0 ? 0 : Number.NEGATIVE_INFINITY;
  return -mean + k * Math.log(mean) - logFactorial(k);
}

export function poissonCDF(k, mean) {
  if (!Number.isInteger(k)) k = Math.floor(k);
  if (k < 0) return 0;
  if (!Number.isFinite(mean) || mean < 0) throw new Error("Poisson mean must be finite and non-negative.");
  if (mean === 0) return 1;
  let term = Math.exp(-mean);
  let sum = term;
  for (let i = 1; i <= k; i += 1) {
    term *= mean / i;
    sum += term;
    if (term === 0) break;
  }
  if (sum > 0 && Number.isFinite(sum)) return Math.min(1, Math.max(0, sum));
  const logTerms = [];
  for (let i = 0; i <= k; i += 1) logTerms.push(poissonLogPMF(i, mean));
  return Math.exp(logSumExp(logTerms));
}

export function poissonUpperTail(k, mean) {
  return Math.max(0, Math.min(1, 1 - poissonCDF(k, mean)));
}

export function requiredPoissonMean(eventsAllowed, confidenceLevel) {
  if (!Number.isInteger(eventsAllowed) || eventsAllowed < 0) throw new Error("Allowable failures must be a non-negative integer.");
  const cl = Number(confidenceLevel);
  if (!Number.isFinite(cl) || cl <= 0 || cl >= 1) throw new Error("Confidence Level must be greater than 0 and less than 1.");
  const targetCdf = 1 - cl;
  let upper = Math.max(1, -Math.log(targetCdf) + eventsAllowed + 1);
  while (poissonCDF(eventsAllowed, upper) > targetCdf) {
    upper *= 2;
    if (upper > 1e8) throw new Error("Unable to bracket Poisson exposure factor within current limits.");
  }
  return solveMonotonicRoot({
    fn: mean => poissonCDF(eventsAllowed, mean),
    lower: 0,
    upper,
    target: targetCdf,
    increasing: false,
    tolerance: 1e-11
  });
}

function logFactorial(k) {
  let total = 0;
  for (let i = 2; i <= k; i += 1) total += Math.log(i);
  return total;
}

function logSumExp(values) {
  const max = Math.max(...values);
  if (!Number.isFinite(max)) return max;
  return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0));
}
