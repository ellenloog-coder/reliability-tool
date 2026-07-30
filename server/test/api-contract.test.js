import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { withServer, postJson, withoutRequestMetadata } from "./helpers.js";

const reference = JSON.parse(readFileSync(
  new URL(
    "../../verification/baselines/browser-engine-v1/life-data.json",
    import.meta.url
  ),
  "utf8"
));
const validInput = reference.cases.find(item =>
  item.id === "life_target_meets"
).input;

test("POST Life Data returns the complete analysis snapshot contract", async () => {
  await withServer({}, async baseUrl => {
    const { response, body } = await postJson(baseUrl, validInput);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type"),
      /^application\/json/
    );
    for (const key of [
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
      "metadata"
    ]) {
      assert(Object.hasOwn(body, key), key);
    }
    assert.equal(body.metadata.module, "life-data");
    assert.equal(body.metadata.reference_engine_version, "1.0.0");
    assert.equal(body.metadata.backend_engine_version, "1.0.0-shadow.1");
    assert.equal(body.metadata.contract_version, "1.0.0");
    assert.equal(body.metadata.fixture_version, "1.0.0");
    assert.match(body.metadata.analysis_id, /^[0-9a-f-]{36}$/);
    assert.match(
      body.metadata.client_request_id,
      /^[0-9a-f-]{36}$/
    );
    assert.match(body.metadata.input_fingerprint, /^[0-9a-f]{64}$/);
    assert.match(body.metadata.created_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(body).includes("undefined"), false);
    assert.equal(JSON.stringify(body).includes("Infinity"), false);
    assert.equal(JSON.stringify(body).includes("NaN"), false);
  });
});

test("right-censored and numeric-string inputs retain frozen semantics", async () => {
  const input = structuredClone(validInput);
  input.rows = input.rows.map(row => ({
    ...row,
    Time: String(row.Time),
    Status: row.Status === "failure" ? "Failed" : "Right Censored"
  }));
  input.settings.missionTime = String(input.settings.missionTime);
  input.settings.targetReliability = String(
    input.settings.targetReliability
  );
  await withServer({}, async baseUrl => {
    const expected = await postJson(baseUrl, validInput);
    const actual = await postJson(baseUrl, input);
    assert.equal(actual.response.status, 200);
    assert.deepEqual(
      withoutRequestMetadata(actual.body),
      withoutRequestMetadata(expected.body)
    );
    assert.equal(
      actual.body.metadata.input_fingerprint,
      expected.body.metadata.input_fingerprint
    );
  });
});

test("validation failures return 422 with frozen nullability", async () => {
  const cases = [
    reference.cases.find(item => item.id === "life_invalid_empty_data").input,
    {
      ...structuredClone(validInput),
      rows: [{ Sample: "S1", Time: "bad", Status: "failure" }]
    },
    {
      ...structuredClone(validInput),
      rows: [{ Sample: "S1", Time: 100, Status: "unknown" }]
    },
    {
      ...structuredClone(validInput),
      rows: [
        { Sample: "S1", Time: 100, Status: "failure" },
        { Sample: "S2", Time: 100, Status: "failure" }
      ]
    }
  ];
  await withServer({}, async baseUrl => {
    for (const input of cases) {
      const { response, body } = await postJson(baseUrl, input);
      assert.equal(response.status, 422);
      assert.equal(body.validation.status, "INVALID");
      assert(body.validation_issues.every(item =>
        ["ERROR", "WARNING"].includes(item.severity)
        && typeof item.code === "string"
        && typeof item.message === "string"
      ));
      assert.equal(body.calculation, null);
      assert.equal(body.decision, null);
      assert.equal(body.insight, null);
    }
  });
});

test("invalid target preserves frozen non-evaluated Decision behavior", async () => {
  const input = structuredClone(validInput);
  input.settings.targetReliability = 2;
  await withServer({}, async baseUrl => {
    const { response, body } = await postJson(baseUrl, input);
    assert.equal(response.status, 200);
    assert.equal(body.validation.status, "VALID");
    assert.equal(body.decision.status, "NOT_EVALUATED");
    assert.deepEqual(
      body.reason_codes,
      ["TARGET_RELIABILITY_INVALID"]
    );
  });
});

test("invalid mission time preserves the frozen default-mission fallback", async () => {
  const input = structuredClone(validInput);
  input.settings.missionTime = "not-a-number";
  await withServer({}, async baseUrl => {
    const { response, body } = await postJson(baseUrl, input);
    assert.equal(response.status, 200);
    assert.equal(body.validation.status, "VALID");
    assert(Number.isFinite(body.calculation.metrics.missionTime));
    assert.notEqual(
      body.calculation.metrics.missionTime,
      input.settings.missionTime
    );
  });
});

test("malformed JSON, unsupported content type, structure, unknown fields, and method applicability are distinguished", async () => {
  await withServer({}, async baseUrl => {
    const malformed = await postJson(baseUrl, "{", { raw: true });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.error.code, "MALFORMED_JSON");

    const unsupported = await postJson(baseUrl, "plain", {
      raw: true,
      headers: { "Content-Type": "text/plain" }
    });
    assert.equal(unsupported.response.status, 415);
    assert.equal(
      unsupported.body.error.code,
      "UNSUPPORTED_CONTENT_TYPE"
    );

    const structure = await postJson(baseUrl, []);
    assert.equal(structure.response.status, 400);
    assert.equal(
      structure.body.error.code,
      "UNRECOGNIZED_REQUEST_STRUCTURE"
    );

    const missing = await postJson(baseUrl, { rows: [] });
    assert.equal(missing.response.status, 400);
    assert.equal(
      missing.body.error.code,
      "UNRECOGNIZED_REQUEST_STRUCTURE"
    );

    const unknown = await postJson(baseUrl, {
      ...validInput,
      unknown: true
    });
    assert.equal(unknown.response.status, 400);
    assert.equal(unknown.body.error.code, "UNKNOWN_FIELD");

    const method = await postJson(baseUrl, {
      ...validInput,
      settings: {
        ...validInput.settings,
        distribution: "weibull-3p"
      }
    });
    assert.equal(method.response.status, 422);
    assert.equal(method.body.error.code, "METHOD_NOT_APPLICABLE");
  });
});

test("request body limit and CORS policy are enforced", async () => {
  await withServer(
    { bodyLimitBytes: 128 },
    async baseUrl => {
      const oversized = await postJson(baseUrl, {
        rows: Array.from({ length: 20 }, (_, index) => ({
          Time: index + 1,
          Status: "failure"
        })),
        mapping: { time: "Time", status: "Status" }
      });
      assert.equal(oversized.response.status, 413);
      assert.equal(
        oversized.body.error.code,
        "REQUEST_BODY_TOO_LARGE"
      );
    }
  );
  await withServer({}, async baseUrl => {
    const denied = await postJson(baseUrl, validInput, {
      headers: { Origin: "https://example.com" }
    });
    assert.equal(denied.response.status, 403);
    assert.equal(denied.body.error.code, "ORIGIN_NOT_ALLOWED");

    const allowed = await postJson(baseUrl, validInput, {
      headers: { Origin: "http://127.0.0.1:8020" }
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(
      allowed.response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:8020"
    );

    const preflight = await fetch(
      `${baseUrl}/api/reliability/life-data/analyze`,
      {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:8020" }
      }
    );
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      "http://localhost:8020"
    );
  });
});

test("repeated requests are deterministic except request metadata", async () => {
  await withServer({}, async baseUrl => {
    const first = await postJson(baseUrl, validInput);
    const second = await postJson(baseUrl, validInput);
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.notEqual(
      first.body.metadata.analysis_id,
      second.body.metadata.analysis_id
    );
    assert.deepEqual(
      withoutRequestMetadata(first.body),
      withoutRequestMetadata(second.body)
    );
  });
});

test("client request id is echoed and presentation tables share the response snapshot", async () => {
  const payload = {
    ...structuredClone(validInput),
    presentation: {
      productName: "Backend authority",
      lang: "en",
      customPercentile: "20",
      customTime: "700"
    }
  };
  await withServer({}, async baseUrl => {
    const { response, body } = await postJson(baseUrl, payload, {
      headers: { "X-Client-Request-ID": "client-request-42" }
    });
    assert.equal(response.status, 200);
    assert.equal(
      body.metadata.client_request_id,
      "client-request-42"
    );
    assert(body.charts.uiTables.percentiles.rows
      .some(row => row.metric === "B20"));
    assert(body.report_payload.tables.selectedTimes.rows
      .some(row => row.time === 700));
    assert.strictEqual(
      body.report_payload.metrics.missionReliability,
      body.calculation.metrics.missionReliability
    );
    assert.deepEqual(
      body.report_payload.tables,
      body.charts.uiTables
    );
  });
});

test("internal errors return sanitized 500 responses without stack or local paths", async () => {
  await withServer(
    {
      analyzeLifeData() {
        throw new Error(
          "secret /Users/ellen/private.js\nSTACK_SHOULD_NOT_LEAK"
        );
      }
    },
    async baseUrl => {
      const { response, body } = await postJson(baseUrl, validInput);
      const serialized = JSON.stringify(body);
      assert.equal(response.status, 500);
      assert.equal(body.error.code, "INTERNAL_ERROR");
      assert.equal(serialized.includes("/Users/"), false);
      assert.equal(serialized.includes("STACK_SHOULD_NOT_LEAK"), false);
      assert.equal(serialized.includes("stack"), false);
    }
  );
});
