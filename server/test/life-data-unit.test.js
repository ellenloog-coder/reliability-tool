import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  analyzeBackendLifeData,
  assertSerializableFinite
} from "../reliability/life-data/analyze.js";
import { adaptLifeDataRequest } from "../reliability/life-data/adapter.js";

const reference = JSON.parse(readFileSync(
  new URL(
    "../../verification/baselines/browser-engine-v1/life-data.json",
    import.meta.url
  ),
  "utf8"
));

test("backend orchestration is independent from the browser Facade and browser globals", () => {
  const source = [
    "server/reliability/life-data/analyze.js",
    "server/reliability/life-data/adapter.js",
    "server/reliability/life-data/validation.js",
    "server/reliability/life-data/calculation.js",
    "server/reliability/life-data/decision.js",
    "server/reliability/life-data/insight.js",
    "server/reliability/life-data/charts.js",
    "server/reliability/life-data/report-payload.js"
  ].map(path => readFileSync(
    new URL(`../../${path}`, import.meta.url),
    "utf8"
  )).join("\n");
  assert.doesNotMatch(source, /analyzeLifeData\s*\(/);
  assert.doesNotMatch(source, /\b(?:window|document|localStorage)\b/);
  assert.doesNotMatch(source, /headless|playwright|puppeteer/i);
});

test("invalid frozen input preserves downstream nullability", () => {
  const fixture = reference.cases.find(item =>
    item.id === "life_invalid_empty_data"
  );
  const result = analyzeBackendLifeData(fixture.input);
  assert.equal(result.validation.status, "INVALID");
  assert.equal(result.calculation, null);
  assert.equal(result.decision, null);
  assert.equal(result.insight, null);
  assert.equal(result.charts, null);
  assert.equal(result.report_payload, null);
});

test("report payload and charts come from the same analysis snapshot", () => {
  const fixture = reference.cases.find(item =>
    item.id === "life_target_meets"
  );
  const result = analyzeBackendLifeData(fixture.input);
  assert.strictEqual(
    result.report_payload.metrics,
    result.compatibility.metrics
  );
  assert.strictEqual(
    result.report_payload.insight,
    result.compatibility.insight
  );
  assert.strictEqual(
    result.report_payload.tables,
    result.charts.reliabilityTable
  );
  assert.deepEqual(result.reason_codes, result.decision.reasonCodes);
  assert.deepEqual(result.limitations, result.insight.limitations);
});

test("reference-compatible mission-time fallback is preserved and recorded", () => {
  const fixture = structuredClone(
    reference.cases.find(item => item.id === "life_target_meets").input
  );
  fixture.settings.missionTime = "not-a-number";
  const result = analyzeBackendLifeData(fixture);
  assert.equal(result.validation.status, "VALID");
  assert(Number.isFinite(result.calculation.metrics.missionTime));
  assert.notEqual(result.calculation.metrics.missionTime, "not-a-number");
});

test("finite serializer rejects non-finite numbers and undefined", () => {
  assert.throws(
    () => assertSerializableFinite({ value: Number.NaN }),
    /Non-finite/
  );
  assert.throws(
    () => assertSerializableFinite({ value: undefined }),
    /Undefined/
  );
  for (const fixture of reference.cases) {
    assert.doesNotThrow(() =>
      assertSerializableFinite(analyzeBackendLifeData(fixture.input))
    );
  }
});

test("method applicability is explicit for unsupported distribution, confidence, and B-life requests", () => {
  const base = structuredClone(reference.cases[0].input);
  for (const settings of [
    { distribution: "weibull-3p" },
    { confidenceLevel: 0.95 },
    { bLifePercentiles: [0.1, 0.5] }
  ]) {
    assert.throws(
      () => adaptLifeDataRequest({
        ...base,
        settings: { ...base.settings, ...settings }
      }),
      error =>
        error.status === 422
        && error.code === "METHOD_NOT_APPLICABLE"
    );
  }
});
