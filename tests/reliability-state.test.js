import test from "node:test";
import assert from "node:assert/strict";
import { invalidateAnalysisState, loadDataState, resetLifeDataState } from "../src/reliability/state.js";

function analyzedState() {
  return {
    headers: ["Time", "Status"],
    rows: [{ Time: "10", Status: "Failure" }],
    sourceName: "first.csv",
    sourceKey: "",
    mapping: { time: "Time", status: "Status" },
    validation: { totalCount: 1 },
    fit: { beta: 1 },
    metrics: { b10: 10 },
    mtbf: { mtbf: 10 },
    insight: { result: "x" },
    plots: { probability: "<svg></svg>" },
    reportHtml: "<html></html>"
  };
}

test("mapping change invalidates old analysis results", () => {
  const state = analyzedState();
  invalidateAnalysisState(state);
  assert.equal(state.fit, null);
  assert.equal(state.metrics, null);
  assert.equal(state.plots, null);
  assert.equal(state.reportHtml, null);
});

test("second upload clears old results and replaces source data", () => {
  const state = analyzedState();
  loadDataState(state, {
    headers: ["Life", "Result"],
    rows: [{ Life: "20", Result: "Censored" }],
    sourceName: "second.csv",
    mapping: { time: "Life", status: "Result" }
  });
  assert.equal(state.sourceName, "second.csv");
  assert.equal(state.fit, null);
  assert.deepEqual(state.mapping, { time: "Life", status: "Result" });
});

test("reset clears data, mapping, validation, and results", () => {
  const state = analyzedState();
  resetLifeDataState(state);
  assert.deepEqual(state.headers, []);
  assert.deepEqual(state.rows, []);
  assert.deepEqual(state.mapping, {});
  assert.equal(state.validation, null);
  assert.equal(state.fit, null);
});
