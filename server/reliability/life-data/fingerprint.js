import { createHash } from "node:crypto";

export function createInputFingerprint(value) {
  const canonical = canonicalJson(value);
  return {
    algorithm: "sha256",
    canonical,
    value: createHash("sha256").update(canonical).digest("hex")
  };
}

export function canonicalJson(value) {
  return serialize(value);
}

function serialize(value) {
  if (value === null) return "null";
  if (value === undefined) return '{"$type":"missing"}';
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Fingerprint input contains a non-finite number.");
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${serialize(value[key])}`
    ).join(",")}}`;
  }
  throw new TypeError(`Unsupported fingerprint value type: ${typeof value}.`);
}
