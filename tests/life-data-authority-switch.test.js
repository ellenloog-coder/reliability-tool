import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createLifeDataAuthorityController,
  fingerprintLifeDataInput,
  LifeDataAuthorityError
} from "../src/reliability/life-data-authority.js";
import {
  resolveLifeDataAuthorityConfig
} from "../src/reliability/backend-authority-config.js";
import {
  analyzeBackendLifeData
} from "../server/reliability/life-data/analyze.js";

const input = {
  rows: [
    { Sample: "S1", Time: 120, Status: "failure" },
    { Sample: "S2", Time: 220, Status: "failure" },
    { Sample: "S3", Time: 340, Status: "failure" },
    { Sample: "S4", Time: 510, Status: "failure" },
    { Sample: "S5", Time: 760, Status: "failure" },
    { Sample: "S6", Time: 940, Status: "failure" },
    { Sample: "S7", Time: 1180, Status: "censored" }
  ],
  mapping: {
    sampleId: "Sample",
    time: "Time",
    status: "Status"
  },
  settings: {
    timeUnit: "hours",
    missionTime: 500,
    targetReliability: 0.6
  },
  presentation: {
    productName: "Authority test",
    lang: "en",
    customPercentile: "20",
    customTime: "700"
  }
};

const config = Object.freeze({
  authoritySource: "backend",
  backendUrl: "http://127.0.0.1:8030",
  timeoutMs: 100,
  contractAllowlist: ["1.0.0"],
  backendEnginePattern: /^1\.0\.0-shadow\.\d+$/
});

test("Life Data Backend success binds one authority snapshot", async () => {
  const controller = controllerWithBackend();
  const result = await controller.analyze(input);
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.metadata.module, "life-data");
  assert.equal(
    result.snapshot.authority.analysis_id,
    result.snapshot.metadata.analysis_id
  );
  assert.strictEqual(
    result.snapshot.charts.authority,
    result.snapshot.authority
  );
  assert.strictEqual(
    result.snapshot.report_payload.authority,
    result.snapshot.authority
  );
  assert.equal(
    result.snapshot.report_payload.authority.input_fingerprint,
    result.snapshot.metadata.input_fingerprint
  );
  assert(result.snapshot.report_payload.tables.percentiles.rows
    .some(row => row.metric === "B20"));
  assert(result.snapshot.report_payload.tables.selectedTimes.rows
    .some(row => row.time === 700));
});

test("Backend validation failure remains a 422 validation result", async () => {
  const invalid = structuredClone(input);
  invalid.rows = [];
  const result = await controllerWithBackend().analyze(invalid);
  assert.equal(result.ok, false);
  assert.equal(result.validationFailure, true);
  assert.equal(result.snapshot.validation.status, "INVALID");
  assert.equal(result.snapshot.calculation, null);
  assert.equal(result.snapshot.decision, null);
  assert.equal(result.snapshot.report_payload, null);
});

test("malformed Backend response is rejected", async () => {
  const controller = makeController(async () =>
    new Response("{", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
  await assert.rejects(
    controller.analyze(input),
    errorCode("MALFORMED_BACKEND_RESPONSE")
  );
});

test("Backend unavailable is distinct from validation", async () => {
  const controller = makeController(async () => {
    throw new TypeError("connection refused");
  });
  await assert.rejects(
    controller.analyze(input),
    error => error.code === "BACKEND_UNAVAILABLE"
      && error.kind === "network"
  );
});

test("HTTP 400, 415, 422 method, and 500 remain distinct", async () => {
  for (const [status, code] of [
    [400, "UNKNOWN_FIELD"],
    [415, "UNSUPPORTED_CONTENT_TYPE"],
    [422, "METHOD_NOT_APPLICABLE"],
    [500, "INTERNAL_ERROR"]
  ]) {
    const controller = makeController(async () => jsonResponse({
      error: { code, message: code }
    }, status));
    await assert.rejects(
      controller.analyze(input),
      error => error.code === code && error.status === status
    );
  }
});

test("timeout aborts request and returns timeout state", async () => {
  const controller = makeController(
    (_url, options) => abortingPromise(options.signal),
    { timeoutMs: 5 }
  );
  await assert.rejects(
    controller.analyze(input),
    error => error.code === "BACKEND_TIMEOUT"
      && error.kind === "timeout"
  );
});

test("new request aborts the previous request", async () => {
  let call = 0;
  const controller = makeController((url, options) => {
    call += 1;
    if (call === 1) return abortingPromise(options.signal);
    return backendResponse(options);
  });
  const first = controller.analyze(input);
  await waitFor(() => call === 1);
  const second = controller.analyze({
    ...structuredClone(input),
    settings: { ...input.settings, missionTime: 600 }
  });
  await assert.rejects(
    first,
    error => error.code === "REQUEST_ABORTED"
      || error.code === "STALE_RESPONSE"
  );
  assert.equal((await second).ok, true);
});

test("stale and out-of-order response cannot replace current result", async () => {
  const deferred = [];
  const controller = makeController((_url, options) =>
    new Promise(resolve => deferred.push({
      resolve,
      options
    }))
  );
  const first = controller.analyze(input);
  await waitFor(() => deferred.length === 1);
  const secondInput = {
    ...structuredClone(input),
    settings: { ...input.settings, missionTime: 650 }
  };
  const second = controller.analyze(secondInput);
  await waitFor(() => deferred.length === 2);
  deferred[1].resolve(await backendResponse(deferred[1].options));
  const current = await second;
  deferred[0].resolve(await backendResponse(deferred[0].options));
  await assert.rejects(first, errorCode("STALE_RESPONSE"));
  assert.equal(
    current.snapshot.calculation.metrics.missionTime,
    650
  );
});

test("fingerprint mismatch is rejected", async () => {
  const controller = makeController(async (_url, options) => {
    const response = await backendResponse(options);
    const body = await response.json();
    body.metadata.input_fingerprint = "0".repeat(64);
    return jsonResponse(body);
  });
  await assert.rejects(
    controller.analyze(input),
    errorCode("FINGERPRINT_MISMATCH")
  );
});

test("contract and Backend version mismatches are rejected", async () => {
  for (const [field, value, code] of [
    ["contract_version", "2.0.0", "CONTRACT_VERSION_MISMATCH"],
    ["backend_engine_version", "9.0.0", "BACKEND_VERSION_MISMATCH"]
  ]) {
    const controller = makeController(async (_url, options) => {
      const response = await backendResponse(options);
      const body = await response.json();
      body.metadata[field] = value;
      return jsonResponse(body);
    });
    await assert.rejects(controller.analyze(input), errorCode(code));
  }
});

test("missing required fields are rejected", async () => {
  const controller = makeController(async (_url, options) => {
    const response = await backendResponse(options);
    const body = await response.json();
    delete body.report_payload;
    return jsonResponse(body);
  });
  await assert.rejects(
    controller.analyze(input),
    errorCode("MALFORMED_BACKEND_RESPONSE")
  );
});

test("repeated requests are deterministic except request metadata", async () => {
  const controller = controllerWithBackend();
  const first = await controller.analyze(input);
  const second = await controller.analyze(input);
  assert.equal(
    first.snapshot.metadata.input_fingerprint,
    second.snapshot.metadata.input_fingerprint
  );
  assert.deepEqual(
    stableSnapshot(first.snapshot),
    stableSnapshot(second.snapshot)
  );
});

test("browser fingerprint matches Backend semantic fingerprint", async () => {
  const browserFingerprint = await fingerprintLifeDataInput(input);
  const backend = analyzeBackendLifeData(input);
  assert.equal(
    browserFingerprint,
    backend.metadata.input_fingerprint
  );
});

test("configuration is Backend-authoritative without browser fallback", () => {
  const local = resolveLifeDataAuthorityConfig({
    location: {
      hostname: "127.0.0.1",
      origin: "http://127.0.0.1:8020"
    },
    runtimeConfig: undefined
  });
  assert.equal(local.authoritySource, "backend");
  assert.equal(local.backendUrl, "http://127.0.0.1:8030");
  assert.equal(local.timeoutMs, 10_000);

  const production = resolveLifeDataAuthorityConfig({
    location: {
      hostname: "reliability.example",
      origin: "https://reliability.example"
    },
    runtimeConfig: undefined
  });
  assert.equal(production.authoritySource, "backend");
  assert.equal(
    production.backendUrl,
    "https://reliability.example"
  );
});

test("app uses Backend authority only for Life Data", async () => {
  const app = await readFile(
    new URL("../src/reliability/app.js", import.meta.url),
    "utf8"
  );
  assert.match(app, /lifeDataAuthority\.analyze\(/);
  assert.doesNotMatch(app, /\banalyzeLifeData\(/);
  assert.match(app, /\banalyzeMTBF\(/);
  assert.match(app, /\banalyzeDemonstration\(/);
  assert.match(app, /renderAltPanel\(/);
  assert.doesNotMatch(app, /fallback/i);
  assert.match(
    app,
    /state\.tables = snapshot\.report_payload\.tables/
  );
  assert.match(
    app,
    /const payload = state\.authoritySnapshot\?\.report_payload/
  );
  assert.doesNotMatch(app, /\bbuildLifeTables\(/);
  assert.doesNotMatch(app, /\breliabilityCurveSvg\(/);
  assert.doesNotMatch(app, /\bweibullProbabilityPlotSvg\(/);
});

test("privacy copy describes the actual Life Data Backend flow", async () => {
  const [html, i18n, help] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(
      new URL("../src/reliability/i18n.js", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../src/reliability/help-content.js", import.meta.url),
      "utf8"
    )
  ]);
  assert.match(html, /lifeDataBackendPrivacy/);
  assert.match(i18n, /configured Reliability Backend/);
  assert.match(i18n, /已配置的 Reliability Backend/);
  assert.match(help, /Life Data analysis inputs are sent/);
  assert.match(help, /寿命数据分析输入会发送/);
  assert.doesNotMatch(
    html,
    /All calculations run locally in this browser/
  );
});

function controllerWithBackend() {
  return makeController((_url, options) =>
    backendResponse(options)
  );
}

function makeController(fetchImpl, overrides = {}) {
  let requestId = 0;
  return createLifeDataAuthorityController({
    config: { ...config, ...overrides },
    fetchImpl,
    createRequestId: () => `request-${++requestId}`,
    now: () => "2026-07-30T00:00:00.000Z"
  });
}

async function backendResponse(options) {
  const payload = JSON.parse(options.body);
  const clientRequestId =
    options.headers["X-Client-Request-ID"];
  const body = analyzeBackendLifeData(payload, {
    analysisId: `analysis-${clientRequestId}`,
    createdAt: "2026-07-30T00:00:01.000Z",
    clientRequestId
  });
  return jsonResponse(
    body,
    body.validation.status === "INVALID" ? 422 : 200
  );
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function abortingPromise(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function errorCode(code) {
  return error => error instanceof LifeDataAuthorityError
    && error.code === code;
}

function stableSnapshot(snapshot) {
  const copy = structuredClone(snapshot);
  delete copy.metadata.analysis_id;
  delete copy.metadata.client_request_id;
  delete copy.metadata.created_at;
  delete copy.authority;
  delete copy.charts.authority;
  delete copy.report_payload.authority;
  return copy;
}

async function waitFor(predicate) {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for test condition.");
}
