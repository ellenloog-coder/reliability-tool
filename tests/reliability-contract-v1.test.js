import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF,
  CALCULATION_STATUSES,
  DECISION_STATUSES,
  EVIDENCE_GAP_STATUSES,
  RELIABILITY_CONTRACT_V1_SCHEMA,
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_ENGINE_VERSION,
  RELIABILITY_FIXTURE_VERSION,
  RELIABILITY_MODULES,
  RELIABILITY_REASON_CODE_REGISTRY,
  RELIABILITY_REASON_CODES,
  VALIDATION_STATUSES
} from "../src/reliability/engine/index.js";

const expectedReasonCodes = Object.freeze([
  "TARGET_RELIABILITY_NOT_PROVIDED",
  "TARGET_RELIABILITY_INVALID",
  "MISSION_RELIABILITY_INVALID",
  "MISSION_RELIABILITY_MEETS_TARGET",
  "MISSION_RELIABILITY_BELOW_TARGET",
  "TARGET_MTBF_NOT_PROVIDED",
  "TARGET_MTBF_INVALID",
  "MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE",
  "MTBF_METRIC_INVALID",
  "MTBF_MEETS_TARGET_POINT_ESTIMATE",
  "MTBF_BELOW_TARGET_POINT_ESTIMATE",
  "PLAN_WORKFLOW_DOES_NOT_EVALUATE_EVIDENCE",
  "CONFIDENCE_REQUIREMENT_MISSING_OR_INVALID",
  "TARGET_RELIABILITY_MISSING_OR_INVALID",
  "TARGET_MTBF_MISSING_OR_INVALID",
  "DEMONSTRATION_METRIC_INVALID",
  "RELIABILITY_LOWER_BOUND_MEETS_TARGET",
  "RELIABILITY_LOWER_BOUND_BELOW_TARGET",
  "MTBF_LOWER_BOUND_MEETS_TARGET",
  "MTBF_LOWER_BOUND_BELOW_TARGET",
  "ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT",
  "ACHIEVED_CONFIDENCE_BELOW_REQUIREMENT",
  "ZERO_OBSERVED_FAILURES",
  "EVIDENCE_GAP_REMAINS"
]);

const lifeSuccess = () => analyzeLifeData({
  rows: [
    { Time: 100, Status: "failure" },
    { Time: 140, Status: "failure" },
    { Time: 180, Status: "failure" },
    { Time: 220, Status: "failure" },
    { Time: 260, Status: "censored" }
  ],
  mapping: { time: "Time", status: "Status" },
  settings: {
    timeUnit: "hours",
    missionTime: 150,
    targetReliability: 0.8
  }
});

const mtbfSuccess = () => analyzeMTBF({
  inputMode: "summary",
  totalExposure: 5000,
  failureCount: 5,
  missionTime: 100,
  targetMTBF: 900,
  timeUnit: "hours"
});

const demonstrationSuccess = () => analyzeDemonstration({
  method: "sample",
  workflow: "evaluate",
  inputs: {
    unitsTested: 22,
    observedFailures: 0,
    targetReliability: 0.9,
    confidenceLevel: 0.9
  }
});

test("Contract v1 exports frozen versions, status domains, and schema", () => {
  assert.equal(RELIABILITY_ENGINE_VERSION, "1.0.0");
  assert.equal(RELIABILITY_CONTRACT_VERSION, "1.0.0");
  assert.equal(RELIABILITY_FIXTURE_VERSION, "1.0.0");
  assert.deepEqual(RELIABILITY_MODULES, ["life-data", "mtbf", "demonstration"]);
  assert.deepEqual(VALIDATION_STATUSES, ["VALID", "WARNING", "INVALID"]);
  assert.deepEqual(CALCULATION_STATUSES, ["COMPLETED", "ERROR"]);
  assert.deepEqual(EVIDENCE_GAP_STATUSES, ["NOT_AVAILABLE", "SATISFIED", "GAP_REMAINS"]);
  assert(Object.isFrozen(RELIABILITY_CONTRACT_V1_SCHEMA));
  assert.deepEqual(
    RELIABILITY_CONTRACT_V1_SCHEMA.result.required,
    ["validation", "calculation", "decision", "insight", "compatibility", "metadata"]
  );
});

test("Reason Code Registry exactly preserves Contract v1 codes and metadata", () => {
  assert.deepEqual(
    RELIABILITY_REASON_CODE_REGISTRY.map(entry => entry.code),
    expectedReasonCodes
  );
  assert.equal(
    new Set(RELIABILITY_REASON_CODE_REGISTRY.map(entry => entry.code)).size,
    RELIABILITY_REASON_CODE_REGISTRY.length
  );
  for (const entry of RELIABILITY_REASON_CODE_REGISTRY) {
    assert(RELIABILITY_MODULES.includes(entry.module), entry.code);
    assert(["INFO", "WARNING", "ERROR"].includes(entry.severity), entry.code);
    assert.equal(typeof entry.meaning, "string", entry.code);
    assert(entry.meaning.length > 0, entry.code);
    assert.equal(RELIABILITY_REASON_CODES[entry.code], entry);
    assert(Object.isFrozen(entry), entry.code);
  }
});

test("successful Facades satisfy the frozen output shape and module extensions", () => {
  const results = [lifeSuccess(), mtbfSuccess(), demonstrationSuccess()];
  for (const result of results) assertContractResult(result);

  assertRequiredKeys(results[0].calculation, ["parameters", "supplementalMTBF"]);
  assert.equal("parameters" in results[1].calculation, false);
  assertRequiredKeys(results[2].calculation, ["evidence", "requirement", "assumptions"]);
  assertRequiredKeys(results[2].decision, ["actualEvidence", "evidenceGap", "limitations"]);
});

test("Validation INVALID enforces downstream nullability for every Facade", () => {
  const results = [
    analyzeLifeData({
      rows: [],
      mapping: { time: "Time", status: "Status" },
      settings: { timeUnit: "hours" }
    }),
    analyzeMTBF({
      inputMode: "summary",
      totalExposure: 0,
      failureCount: 0,
      missionTime: 100,
      targetMTBF: "",
      timeUnit: "hours"
    }),
    analyzeDemonstration({
      method: "sample",
      workflow: "evaluate",
      inputs: {
        unitsTested: 0,
        observedFailures: 0,
        targetReliability: 0.9,
        confidenceLevel: 0.9
      }
    })
  ];

  for (const result of results) {
    assertContractResult(result);
    assert.equal(result.validation.status, "INVALID");
    assert.equal(result.calculation, null);
    assert.equal(result.decision, null);
    assert.equal(result.insight, null);
  }
});

test("Calculation ERROR has the frozen error structure and null downstream layers", () => {
  const result = analyzeDemonstration({
    method: "sample",
    workflow: "plan",
    inputs: {
      targetReliability: 0.99999,
      confidenceLevel: 0.999,
      allowableFailures: 0,
      maxSampleSize: 100
    }
  });

  assertContractResult(result);
  assert.equal(result.calculation.status, "ERROR");
  assert.deepEqual(Object.keys(result.calculation).sort(), ["error", "status"]);
  assert.equal(result.calculation.error.code, "CALCULATION_ERROR");
  assert.equal(typeof result.calculation.error.message, "string");
  assert(result.calculation.error.message.length > 0);
  assert.equal(result.decision, null);
  assert.equal(result.insight, null);
});

test("Contract v1 rejects non-finite and undefined values at the Facade boundary", () => {
  const results = [
    lifeSuccess(),
    mtbfSuccess(),
    demonstrationSuccess(),
    analyzeMTBF({
      inputMode: "summary",
      totalExposure: 1000,
      failureCount: 0,
      missionTime: 100,
      targetMTBF: 900,
      timeUnit: "hours"
    })
  ];

  for (const result of results) {
    assertNoNonFiniteOrUndefined(result);
  }
});

function assertContractResult(result) {
  assertRequiredKeys(result, RELIABILITY_CONTRACT_V1_SCHEMA.result.required);
  assert.equal(typeof result.compatibility, "object");
  assert.notEqual(result.compatibility, null);
  assertMetadata(result.metadata);
  assertValidation(result.validation);

  if (result.calculation === null) {
    assert.equal(result.validation.status, "INVALID");
    assert.equal(result.decision, null);
    assert.equal(result.insight, null);
    return;
  }

  assert(CALCULATION_STATUSES.includes(result.calculation.status));
  if (result.calculation.status === "ERROR") {
    assertRequiredKeys(result.calculation, ["status", "error"]);
    assert.equal(result.decision, null);
    assert.equal(result.insight, null);
    return;
  }

  assertRequiredKeys(result.calculation, ["status", "model", "metrics"]);
  assert.equal(typeof result.calculation.model, "string");
  assertPlainObject(result.calculation.metrics);
  assertDecision(result.decision, result.metadata.module);
  assertInsight(result.insight);
  assertNoNonFiniteOrUndefined(result);
}

function assertMetadata(metadata) {
  assertRequiredKeys(metadata, RELIABILITY_CONTRACT_V1_SCHEMA.metadata.required);
  assert.equal(metadata.engineVersion, RELIABILITY_ENGINE_VERSION);
  assert.equal(metadata.contractVersion, RELIABILITY_CONTRACT_VERSION);
  assert.equal(metadata.fixtureVersion, RELIABILITY_FIXTURE_VERSION);
  assert(RELIABILITY_MODULES.includes(metadata.module));
}

function assertValidation(validation) {
  assertRequiredKeys(validation, RELIABILITY_CONTRACT_V1_SCHEMA.validation.required);
  assert(VALIDATION_STATUSES.includes(validation.status));
  assertStringArray(validation.errors);
  assertStringArray(validation.warnings);
}

function assertDecision(decision, module) {
  assertPlainObject(decision);
  assertRequiredKeys(decision, RELIABILITY_CONTRACT_V1_SCHEMA.decision.required);
  assert(DECISION_STATUSES[module].includes(decision.status));
  assertStringArray(decision.reasonCodes);
  assertPlainObject(decision.requirement);
  assert(decision.actualValue === null || Number.isFinite(decision.actualValue));
  assertPlainObject(decision.existingDecision);
  for (const code of decision.reasonCodes) {
    const registryEntry = RELIABILITY_REASON_CODES[code];
    assert(registryEntry, `${module}: unregistered reason code ${code}`);
    assert.equal(registryEntry.module, module, `${module}: ${code}`);
  }
  if (decision.evidenceGap?.status) {
    assert(EVIDENCE_GAP_STATUSES.includes(decision.evidenceGap.status));
  }
}

function assertInsight(insight) {
  assertPlainObject(insight);
  assertRequiredKeys(insight, RELIABILITY_CONTRACT_V1_SCHEMA.insight.required);
  assertStringArray(insight.explanationKeys);
  assertStringArray(insight.recommendationKeys);
  assertStringArray(insight.limitations);
  assertPlainObject(insight.parameters);
}

function assertRequiredKeys(value, required) {
  assertPlainObject(value);
  for (const key of required) assert.equal(key in value, true, `missing required field: ${key}`);
}

function assertPlainObject(value) {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
}

function assertStringArray(value) {
  assert(Array.isArray(value));
  for (const item of value) assert.equal(typeof item, "string");
}

function assertNoNonFiniteOrUndefined(value, path = "result") {
  if (value === undefined) assert.fail(`${path} must not be undefined`);
  if (typeof value === "number") {
    assert(Number.isFinite(value), `${path} must be finite or null`);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assertNoNonFiniteOrUndefined(item, `${path}.${key}`);
  }
}
