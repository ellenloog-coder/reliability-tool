import test from "node:test";
import assert from "node:assert/strict";
import { detectColumns, validateRows } from "../src/reliability/validation.js";

test("detectColumns recognizes required and optional aliases", () => {
  const headers = ["Run_Time", "Result", "Unit", "Defect", "Temperature"];
  assert.deepEqual(detectColumns(headers), {
    time: "Run_Time",
    status: "Result",
    sampleId: "Unit",
    failureMode: "Defect",
    testCondition: "Temperature"
  });
});

test("invalid time and invalid status are blocking errors", () => {
  const rows = [
    { Time: "NaN", Status: "Failure" },
    { Time: "-1", Status: "Censored" },
    { Time: "10", Status: "Maybe" }
  ];
  const result = validateRows(rows, { time: "Time", status: "Status" }, { timeUnit: "hours" });
  assert.equal(result.invalidTimeCount, 2);
  assert.equal(result.invalidStatusCount, 1);
  assert(result.errors.some(error => error.includes("invalid Time")));
  assert(result.errors.some(error => error.includes("unrecognized Status")));
});

test("zero failure and identical times are blocking errors", () => {
  const zero = validateRows([{ Time: "10", Status: "Censored" }], { time: "Time", status: "Status" }, { timeUnit: "hours" });
  assert(zero.errors.some(error => error.includes("without observed failures")));

  const identical = validateRows([{ Time: "10", Status: "Failure" }, { Time: "10", Status: "Failure" }], { time: "Time", status: "Status" }, { timeUnit: "hours" });
  assert(identical.errors.some(error => error.includes("identical")));
});

test("limited failures and all-failure data produce non-blocking notices", () => {
  const result = validateRows([{ Time: "10", Status: "Failure" }, { Time: "20", Status: "Failure" }], { time: "Time", status: "Status" }, { timeUnit: "hours" });
  assert.equal(result.errors.length, 0);
  assert(result.warnings.some(warning => warning.includes("Limited failure information")));
  assert(result.warnings.some(warning => warning.includes("No right-censored observations")));
});
