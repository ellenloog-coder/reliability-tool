import { normalizeStatus } from "./status-normalizer.js";

export const LIFE_DATA_ANALYZE_PATH =
  "/api/reliability/life-data/analyze";

const REQUIRED_RESPONSE_FIELDS = Object.freeze([
  "validation",
  "validation_issues",
  "calculation",
  "decision",
  "reason_codes",
  "insight",
  "warnings",
  "assumptions",
  "limitations",
  "charts",
  "report_payload",
  "compatibility",
  "metadata"
]);

export class LifeDataAuthorityError extends Error {
  constructor(code, message, {
    kind = "system",
    status = null,
    details = null,
    silent = false
  } = {}) {
    super(message);
    this.name = "LifeDataAuthorityError";
    this.code = code;
    this.kind = kind;
    this.status = status;
    this.details = details;
    this.silent = silent;
  }
}

export function createLifeDataAuthorityController({
  config,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  now = () => new Date().toISOString(),
  createRequestId = () => globalThis.crypto.randomUUID()
}) {
  let revision = 0;
  let active = null;

  async function analyze(input) {
    if (config.authoritySource !== "backend") {
      throw new LifeDataAuthorityError(
        "BACKEND_AUTHORITY_DISABLED",
        "Life Data Backend authority is not enabled.",
        { kind: "configuration" }
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new LifeDataAuthorityError(
        "BACKEND_UNAVAILABLE",
        "The Reliability Backend is unavailable.",
        { kind: "network" }
      );
    }

    if (active) active.controller.abort("superseded");
    const controller = new AbortController();
    const context = {
      revision: ++revision,
      clientRequestId: createRequestId(),
      startedAt: now(),
      controller,
      inputFingerprint: null
    };
    active = context;
    let timeout = null;
    try {
      context.inputFingerprint = await fingerprintLifeDataInput(
        input,
        cryptoImpl
      );
      assertCurrent(context, active);
      timeout = setTimeout(
        () => controller.abort("timeout"),
        config.timeoutMs
      );
      const response = await fetchImpl(
        `${config.backendUrl}${LIFE_DATA_ANALYZE_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-Request-ID": context.clientRequestId
          },
          body: JSON.stringify(input),
          signal: controller.signal
        }
      );
      const body = await readJsonResponse(response);
      assertCurrent(context, active);
      const validationFailure = response.status === 422
        && isPlainObject(body?.validation);
      if (!response.ok && !validationFailure) {
        throw httpError(response.status, body);
      }
      validateAuthoritySnapshot(body, context, config);
      assertCurrent(context, active);
      const snapshot = bindSnapshotProvenance(body, context);
      return {
        ok: response.ok,
        validationFailure,
        snapshot,
        context: publicContext(context)
      };
    } catch (error) {
      if (error instanceof LifeDataAuthorityError) throw error;
      if (controller.signal.aborted) {
        const timeoutAbort = controller.signal.reason === "timeout";
        throw new LifeDataAuthorityError(
          timeoutAbort ? "BACKEND_TIMEOUT" : "REQUEST_ABORTED",
          timeoutAbort
            ? "The Reliability Backend request timed out."
            : "The previous Life Data request was cancelled.",
          {
            kind: timeoutAbort ? "timeout" : "abort",
            silent: !timeoutAbort
          }
        );
      }
      throw new LifeDataAuthorityError(
        "BACKEND_UNAVAILABLE",
        "The Reliability Backend could not be reached.",
        { kind: "network", details: error?.message || null }
      );
    } finally {
      clearTimeout(timeout);
      if (active === context) active = null;
    }
  }

  function cancel(reason = "cancelled") {
    if (!active) return false;
    active.controller.abort(reason);
    active = null;
    return true;
  }

  return {
    analyze,
    cancel,
    current: () => active ? publicContext(active) : null
  };
}

export async function fingerprintLifeDataInput(
  input,
  cryptoImpl = globalThis.crypto
) {
  if (!cryptoImpl?.subtle) {
    throw new LifeDataAuthorityError(
      "FINGERPRINT_UNAVAILABLE",
      "Secure input fingerprinting is unavailable.",
      { kind: "configuration" }
    );
  }
  const semantic = semanticFingerprintInput(input);
  const canonical = canonicalJson(semantic);
  const digest = await cryptoImpl.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}

export function validateAuthoritySnapshot(body, context, config) {
  if (!isPlainObject(body)) {
    malformed("Backend response must be a JSON object.");
  }
  for (const field of REQUIRED_RESPONSE_FIELDS) {
    if (!Object.hasOwn(body, field)) {
      malformed(`Backend response is missing ${field}.`);
    }
  }
  const metadata = body.metadata;
  if (!isPlainObject(metadata)) malformed("Backend metadata is missing.");
  for (const field of [
    "analysis_id",
    "module",
    "backend_engine_version",
    "contract_version",
    "input_fingerprint",
    "created_at",
    "client_request_id"
  ]) {
    if (!hasText(metadata[field])) {
      malformed(`Backend metadata is missing ${field}.`);
    }
  }
  if (metadata.module !== "life-data") {
    throw new LifeDataAuthorityError(
      "MODULE_MISMATCH",
      "The Backend response belongs to a different module.",
      { kind: "contract" }
    );
  }
  if (metadata.client_request_id !== context.clientRequestId) {
    throw new LifeDataAuthorityError(
      "STALE_RESPONSE",
      "A stale Life Data response was rejected.",
      { kind: "stale", silent: true }
    );
  }
  if (metadata.input_fingerprint !== context.inputFingerprint) {
    throw new LifeDataAuthorityError(
      "FINGERPRINT_MISMATCH",
      "The Backend response does not match the current input.",
      { kind: "contract" }
    );
  }
  if (!config.contractAllowlist.includes(metadata.contract_version)) {
    throw new LifeDataAuthorityError(
      "CONTRACT_VERSION_MISMATCH",
      "The Reliability Backend contract version is not compatible.",
      { kind: "contract" }
    );
  }
  if (!matchesVersion(
    metadata.backend_engine_version,
    config.backendEnginePattern
  )) {
    throw new LifeDataAuthorityError(
      "BACKEND_VERSION_MISMATCH",
      "The Reliability Backend engine version is not compatible.",
      { kind: "contract" }
    );
  }
  if (!isPlainObject(body.validation)
    || !Array.isArray(body.validation.errors)
    || !Array.isArray(body.validation.warnings)) {
    malformed("Backend validation result is malformed.");
  }
  if (body.validation.status === "INVALID") {
    for (const field of [
      "calculation",
      "decision",
      "insight",
      "charts",
      "report_payload"
    ]) {
      if (body[field] !== null) {
        malformed(`Invalid analysis must return ${field} as null.`);
      }
    }
    return true;
  }
  for (const field of [
    "calculation",
    "decision",
    "insight",
    "charts",
    "report_payload",
    "compatibility"
  ]) {
    if (!isPlainObject(body[field])) {
      malformed(`Backend response field ${field} is malformed.`);
    }
  }
  assertFiniteSerializable(body);
  return true;
}

function bindSnapshotProvenance(body, context) {
  const snapshot = structuredClone(body);
  const authority = Object.freeze({
    analysis_id: snapshot.metadata.analysis_id,
    input_fingerprint: snapshot.metadata.input_fingerprint,
    client_request_id: context.clientRequestId,
    revision: context.revision
  });
  snapshot.authority = authority;
  if (snapshot.charts) snapshot.charts.authority = authority;
  if (snapshot.report_payload) {
    snapshot.report_payload.authority = authority;
  }
  return deepFreeze(snapshot);
}

function semanticFingerprintInput(input) {
  const settings = { ...(input?.settings || {}) };
  const mapping = input?.mapping || {};
  return {
    module: "life-data",
    method: {
      distribution: settings.distribution ?? "weibull-2p",
      confidenceLevel: null,
      bLifePercentiles: [0.01, 0.05, 0.1, 0.5]
    },
    settings: semanticSettings(settings),
    rows: (input?.rows || []).map(row =>
      semanticRow(row, mapping)
    )
  };
}

function semanticSettings(settings) {
  const output = {};
  for (const key of [
    "timeUnit",
    "missionTime",
    "targetReliability"
  ]) {
    if (Object.hasOwn(settings, key)) {
      output[key] = normalizeNumericValue(settings[key]);
    }
  }
  return output;
}

function semanticRow(row, mapping) {
  const output = {};
  for (const field of [
    "sampleId",
    "time",
    "status",
    "failureMode",
    "testCondition"
  ]) {
    const column = mapping[field];
    if (!column || !Object.hasOwn(row, column)) continue;
    const value = row[column];
    output[field] = field === "time"
      ? normalizeNumericValue(value)
      : field === "status"
        ? normalizeStatus(value) || value
        : value;
  }
  return output;
}

function normalizeNumericValue(value) {
  if (typeof value !== "string") return value;
  const text = value.trim().replace(/,/g, "");
  if (!/^[+\-]?\d*\.?\d+(?:e[+\-]?\d+)?$/i.test(text)) {
    return value;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : value;
}

function canonicalJson(value) {
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
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${serialize(value[key])}`
    ).join(",")}}`;
  }
  throw new TypeError(
    `Unsupported fingerprint value type: ${typeof value}.`
  );
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new LifeDataAuthorityError(
      "MALFORMED_BACKEND_RESPONSE",
      "The Reliability Backend returned malformed JSON.",
      { kind: "contract", status: response.status }
    );
  }
}

function httpError(status, body) {
  const code = body?.error?.code || `HTTP_${status}`;
  const message = body?.error?.message
    || `The Reliability Backend returned HTTP ${status}.`;
  return new LifeDataAuthorityError(code, message, {
    kind: status >= 500 ? "backend" : "request",
    status,
    details: body?.error?.details || null
  });
}

function assertCurrent(context, active) {
  if (active !== context) {
    throw new LifeDataAuthorityError(
      "STALE_RESPONSE",
      "A stale Life Data response was rejected.",
      { kind: "stale", silent: true }
    );
  }
}

function malformed(message) {
  throw new LifeDataAuthorityError(
    "MALFORMED_BACKEND_RESPONSE",
    message,
    { kind: "contract" }
  );
}

function matchesVersion(version, rule) {
  if (rule instanceof RegExp) {
    rule.lastIndex = 0;
    return rule.test(version);
  }
  if (typeof rule === "function") return Boolean(rule(version));
  return false;
}

function assertFiniteSerializable(value, path = "$") {
  if (value === undefined) malformed(`Undefined value at ${path}.`);
  if (typeof value === "number" && !Number.isFinite(value)) {
    malformed(`Non-finite value at ${path}.`);
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertFiniteSerializable(item, `${path}[${index}]`)
    );
    return;
  }
  Object.entries(value).forEach(([key, item]) =>
    assertFiniteSerializable(item, `${path}.${key}`)
  );
}

function publicContext(context) {
  return Object.freeze({
    revision: context.revision,
    client_request_id: context.clientRequestId,
    input_fingerprint: context.inputFingerprint,
    started_at: context.startedAt
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object"
    || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function hasText(value) {
  return typeof value === "string" && value.length > 0;
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value);
}
