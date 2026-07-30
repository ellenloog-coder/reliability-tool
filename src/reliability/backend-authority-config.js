const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONTRACT_ALLOWLIST = Object.freeze(["1.0.0"]);
const DEFAULT_BACKEND_ENGINE_PATTERN = /^1\.0\.0(?:-[0-9A-Za-z.-]+)?$/;

export function resolveLifeDataAuthorityConfig({
  location = globalThis.location,
  runtimeConfig = globalThis.__RELIABILITY_CONFIG__
} = {}) {
  const supplied = runtimeConfig?.lifeData || {};
  const localDevelopment = isLocalHost(location?.hostname);
  const authoritySource = supplied.authoritySource
    || "backend";
  const backendUrl = supplied.backendUrl
    || (localDevelopment
      ? "http://127.0.0.1:8030"
      : location?.origin || "");
  const timeoutMs = positiveInteger(
    supplied.timeoutMs,
    DEFAULT_TIMEOUT_MS
  );
  const contractAllowlist = Array.isArray(
    supplied.contractAllowlist
  ) && supplied.contractAllowlist.length
    ? [...supplied.contractAllowlist]
    : [...DEFAULT_CONTRACT_ALLOWLIST];

  return Object.freeze({
    authoritySource,
    backendUrl: String(backendUrl).replace(/\/+$/, ""),
    timeoutMs,
    contractAllowlist: Object.freeze(contractAllowlist),
    backendEnginePattern: supplied.backendEnginePattern
      || DEFAULT_BACKEND_ENGINE_PATTERN,
    environment: localDevelopment ? "development" : "production"
  });
}

export function lifeDataBackendEnabled(config) {
  return config?.authoritySource === "backend";
}

function isLocalHost(hostname) {
  return hostname === "127.0.0.1"
    || hostname === "localhost"
    || hostname === "::1";
}

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : fallback;
}
