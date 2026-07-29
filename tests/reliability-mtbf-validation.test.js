import test from "node:test";
import assert from "node:assert/strict";
import { parseDelimitedText } from "../src/reliability/parser.js";
import { normalizeStatus } from "../src/reliability/status-normalizer.js";
import { detectMTBFColumns, validateMTBFSummaryInput, validateMTBFUnitRows } from "../src/reliability/mtbf-validation.js";

test("MTBF column detection supports required and optional aliases", () => {
  const mapping = detectMTBFColumns(["Unit ID", "Operating Time", "Result", "Mode", "Environment", "Comments"]);
  assert.deepEqual(mapping, {
    unitId: "Unit ID",
    exposureTime: "Operating Time",
    status: "Result",
    failureMode: "Mode",
    testCondition: "Environment",
    notes: "Comments"
  });
});

test("MTBF summary validation accepts zero failure and blocks invalid entries", () => {
  const zero = validateMTBFSummaryInput({ totalExposure: "1000", failureCount: "0", missionTime: "100", targetMTBF: "", timeUnit: "hours" });
  assert.equal(zero.errors.length, 0);
  assert.equal(zero.input.failureCount, 0);
  assert(zero.warnings.some(warning => warning.includes("zero-failure")));

  const bad = validateMTBFSummaryInput({ totalExposure: "-1", failureCount: "1.5", missionTime: "0", targetMTBF: "-10", timeUnit: "weeks" });
  assert(bad.errors.some(error => error.includes("Total Time on Test")));
  assert(bad.errors.some(error => error.includes("Failure Count")));
  assert(bad.errors.some(error => error.includes("Mission Time")));
  assert(bad.errors.some(error => error.includes("Target MTBF")));
  assert(bad.errors.some(error => error.includes("Unsupported time unit")));
});

test("MTBF unit validation normalizes Breakdown, Operating, No Failure, and Chinese censored status", () => {
  assert.equal(normalizeStatus("Breakdown"), "failure");
  assert.equal(normalizeStatus("Operating"), "censored");
  assert.equal(normalizeStatus("No Failure"), "censored");
  assert.equal(normalizeStatus("正常运行"), "censored");

  const parsed = parseDelimitedText("Unit ID,Exposure Time,Status\nU1,100,Breakdown\nU2,200,Operating\nU3,300,No Failure\nU4,400,正常运行");
  const validation = validateMTBFUnitRows(parsed.rows, detectMTBFColumns(parsed.headers), { timeUnit: "hours" });
  assert.equal(validation.errors.length, 0);
  assert.equal(validation.failureCount, 1);
  assert.equal(validation.censoredCount, 3);
  assert.equal(validation.totalExposure, 1000);
});

test("MTBF unit validation blocks invalid exposure and status values", () => {
  const parsed = parseDelimitedText("Unit ID,Exposure Time,Status\nU1,bad,Failure\nU2,100,Maybe");
  const validation = validateMTBFUnitRows(parsed.rows, detectMTBFColumns(parsed.headers), { timeUnit: "hours" });
  assert(validation.errors.some(error => error.includes("invalid Exposure Time")));
  assert(validation.errors.some(error => error.includes("unrecognized Status")));
});
