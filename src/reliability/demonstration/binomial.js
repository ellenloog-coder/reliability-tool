const LANCZOS = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7
];

export function logGamma(value) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("logGamma requires a finite positive value.");
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const z = value - 1;
  for (let i = 0; i < LANCZOS.length; i += 1) x += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function binomialLogPMF(k, n, p) {
  validateBinomial(k, n, p);
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  if (p === 0) return k === 0 ? 0 : Number.NEGATIVE_INFINITY;
  if (p === 1) return k === n ? 0 : Number.NEGATIVE_INFINITY;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p);
}

export function binomialCDF(k, n, p) {
  if (!Number.isInteger(k)) k = Math.floor(k);
  validateBinomial(Math.max(0, Math.min(k, n)), n, p);
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p === 0) return 1;
  if (p === 1) return 0;
  const lowerTerms = k + 1;
  const upperTerms = n - k;
  if (lowerTerms <= upperTerms) {
    let term = Math.exp(n * Math.log1p(-p));
    let sum = term;
    for (let i = 0; i < k; i += 1) {
      term *= ((n - i) / (i + 1)) * (p / (1 - p));
      sum += term;
    }
    return clampProbability(sum);
  }
  let term = Math.exp(n * Math.log(p));
  let upper = term;
  for (let i = n; i > k + 1; i -= 1) {
    term *= (i / (n - i + 1)) * ((1 - p) / p);
    upper += term;
  }
  return clampProbability(1 - upper);
}

export function validateProbability(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number >= 1) throw new Error(`${label} must be greater than 0 and less than 1.`);
  return number;
}

export function validateNonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer.`);
  return number;
}

export function validatePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function validateBinomial(k, n, p) {
  if (!Number.isInteger(n) || n < 0) throw new Error("Binomial n must be a non-negative integer.");
  if (!Number.isInteger(k)) throw new Error("Binomial k must be an integer.");
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error("Binomial probability must be between 0 and 1.");
}

function clampProbability(value) {
  if (!Number.isFinite(value)) throw new Error("Probability calculation produced a non-finite value.");
  return Math.min(1, Math.max(0, value));
}
