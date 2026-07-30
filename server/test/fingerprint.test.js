import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeBackendLifeData
} from "../reliability/life-data/analyze.js";

const base = {
  rows: [
    { Sample: "S1", Time: 100, Status: "failure" },
    { Sample: "S2", Time: 200, Status: "censored" },
    { Sample: "S3", Time: 300, Status: "failure" },
    { Sample: "S4", Time: 400, Status: "failure" },
    { Sample: "S5", Time: 500, Status: "failure" },
    { Sample: "S6", Time: 600, Status: "failure" }
  ],
  mapping: {
    sampleId: "Sample",
    time: "Time",
    status: "Status"
  },
  settings: {
    timeUnit: "hours",
    missionTime: 250,
    targetReliability: 0.8
  }
};

test("fingerprint is stable across key order, numeric strings, status aliases, mapping names, and presentation", () => {
  const equivalent = {
    presentation: {
      language: "zh",
      theme: "dark",
      displayPrecision: 2
    },
    settings: {
      bLifePercentiles: ["0.01", "0.05", "0.1", "0.5"],
      distribution: "weibull-2p",
      targetReliability: "0.8",
      missionTime: "250",
      timeUnit: "hours",
      confidenceLevel: null
    },
    mapping: {
      status: "event",
      time: "life",
      sampleId: "id"
    },
    rows: base.rows.map(row => ({
      event: row.Status === "failure" ? "Failed" : "Right Censored",
      ignoredColumn: "not mapped",
      life: String(row.Time),
      id: row.Sample
    }))
  };
  assert.equal(
    fingerprint(base),
    fingerprint(equivalent)
  );
});

test("fingerprint changes for row order, target, and null versus missing core settings", () => {
  const reordered = structuredClone(base);
  reordered.rows.reverse();
  assert.notEqual(fingerprint(base), fingerprint(reordered));

  const changedTarget = structuredClone(base);
  changedTarget.settings.targetReliability = 0.9;
  assert.notEqual(fingerprint(base), fingerprint(changedTarget));

  const missingTarget = structuredClone(base);
  delete missingTarget.settings.targetReliability;
  const nullTarget = structuredClone(base);
  nullTarget.settings.targetReliability = null;
  assert.notEqual(fingerprint(missingTarget), fingerprint(nullTarget));
});

test("analysis id and created_at are unique metadata and do not affect fingerprint", () => {
  const first = analyzeBackendLifeData(base);
  const second = analyzeBackendLifeData(base);
  assert.notEqual(first.metadata.analysis_id, second.metadata.analysis_id);
  assert.match(first.metadata.created_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    first.metadata.input_fingerprint,
    second.metadata.input_fingerprint
  );
});

function fingerprint(input) {
  return analyzeBackendLifeData(input, {
    analysisId: "fixed",
    createdAt: "2026-07-30T00:00:00.000Z"
  }).metadata.input_fingerprint;
}
