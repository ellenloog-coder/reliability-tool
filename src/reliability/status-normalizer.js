export const FAILURE_VALUES = new Set([
  "fail", "failed", "failure", "event", "breakdown", "1", "yes",
  "失效", "故障", "失败"
]);

export const CENSORED_VALUES = new Set([
  "censored", "censor", "suspended", "suspend", "survived", "operating", "no failure", "right censored",
  "0", "no", "截尾", "删失", "未失效", "正常运行", "仍在运行"
]);

export function normalizeStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (FAILURE_VALUES.has(normalized)) return "failure";
  if (CENSORED_VALUES.has(normalized)) return "censored";
  return null;
}
