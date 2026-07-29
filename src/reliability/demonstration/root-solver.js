export function solveMonotonicRoot({ fn, lower, upper, target = 0, tolerance = 1e-10, maxIterations = 120, increasing = true }) {
  if (typeof fn !== "function") throw new Error("Root solver requires a function.");
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) throw new Error("Root solver requires finite lower < upper bounds.");
  let lo = lower;
  let hi = upper;
  let flo = fn(lo) - target;
  let fhi = fn(hi) - target;
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) throw new Error("Root solver received non-finite function values.");
  const bracketed = increasing ? flo <= 0 && fhi >= 0 : flo >= 0 && fhi <= 0;
  if (!bracketed) throw new Error("Root is not bracketed within the provided bounds.");
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const mid = (lo + hi) / 2;
    const fmid = fn(mid) - target;
    if (!Number.isFinite(fmid)) throw new Error("Root solver received a non-finite midpoint value.");
    if (Math.abs(fmid) <= tolerance || Math.abs(hi - lo) <= tolerance) return mid;
    if (increasing) {
      if (fmid < 0) lo = mid;
      else hi = mid;
    } else if (fmid > 0) lo = mid;
    else hi = mid;
  }
  throw new Error("Root solver did not converge.");
}
