import { readFileSync, writeFileSync } from "node:fs";
import { planBinomialDemonstration, evaluateBinomialDemonstration } from "../src/reliability/demonstration/sample-demonstration.js";
import { planExponentialDemonstration, evaluateExponentialDemonstration } from "../src/reliability/demonstration/time-demonstration.js";

const fixtures = JSON.parse(readFileSync("verification/fixtures/demonstration-fixtures.json", "utf8"));
const expected = new Map(JSON.parse(readFileSync("verification/fixtures/demonstration-expected-results.json", "utf8")).map(item => [item.fixtureId, item]));
const writeReport = process.argv.includes("--write-report");
const knownArguments = new Set(["--verify", "--write-report"]);
const unknownArguments = process.argv.slice(2).filter(argument => !knownArguments.has(argument));

if (unknownArguments.length) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

const rows = [];
let failures = 0;

for (const fixture of fixtures) {
  const reference = expected.get(fixture.fixtureId);
  const actual = runFixture(fixture);
  const comparison = compareFixture(reference, actual);
  if (!comparison.pass) failures += 1;
  rows.push({
    fixtureId: fixture.fixtureId,
    method: fixture.method,
    workflow: fixture.workflow,
    expectedStatus: reference.status,
    actualStatus: actual.status,
    maxAbsError: comparison.maxAbsError,
    maxRelError: comparison.maxRelError,
    failedField: comparison.failedField,
    status: comparison.pass ? "PASS" : "FAIL",
    notes: actual.error || ""
  });
}

if (writeReport) {
  writeFileSync("verification/demonstration-numerical-comparison.csv", toCsv(rows));
}
console.log(`Demonstration numerical comparison: ${rows.length - failures}/${rows.length} passed`);
if (failures) process.exitCode = 1;

function runFixture(fixture) {
  try {
    const fn = fixture.method === "sample"
      ? fixture.workflow === "plan" ? planBinomialDemonstration : evaluateBinomialDemonstration
      : fixture.workflow === "plan" ? planExponentialDemonstration : evaluateExponentialDemonstration;
    return { status: "ok", outputs: fn(fixture.inputs) };
  } catch (error) {
    return { status: "error", outputs: {}, error: error.message };
  }
}

function compareFixture(reference, actual) {
  if (!reference) return { pass: false, maxAbsError: "", maxRelError: "", failedField: "missing reference" };
  if (reference.status !== actual.status) return { pass: false, maxAbsError: "", maxRelError: "", failedField: "status" };
  if (reference.status === "error") return { pass: true, maxAbsError: 0, maxRelError: 0, failedField: "" };
  const failures = [];
  const stats = { maxAbsError: 0, maxRelError: 0 };
  compareObject(reference.outputs, actual.outputs, "", failures, stats);
  return {
    pass: failures.length === 0,
    maxAbsError: stats.maxAbsError,
    maxRelError: stats.maxRelError,
    failedField: failures[0] || ""
  };
}

function compareObject(expectedObject, actualObject, prefix, failures, stats) {
  for (const [key, expectedValue] of Object.entries(expectedObject)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const actualValue = actualObject?.[key];
    if (expectedValue === null) {
      if (actualValue !== null && actualValue !== undefined) failures.push(path);
    } else if (typeof expectedValue === "number") {
      if (!Number.isFinite(actualValue)) {
        failures.push(path);
        continue;
      }
      const abs = Math.abs(actualValue - expectedValue);
      const rel = Math.abs(expectedValue) > 0 ? abs / Math.abs(expectedValue) : abs;
      stats.maxAbsError = Math.max(stats.maxAbsError, abs);
      stats.maxRelError = Math.max(stats.maxRelError, rel);
      if (abs > absoluteTolerance(path) && rel > relativeTolerance(path)) failures.push(path);
    } else if (typeof expectedValue === "boolean") {
      if (actualValue !== expectedValue) failures.push(path);
    } else if (typeof expectedValue === "object") {
      compareObject(expectedValue, actualValue, path, failures, stats);
    }
  }
}

function absoluteTolerance(path) {
  if (path.includes("requiredSampleSize") || path.includes("additionalUnitsRequired") || path.includes("requiredTotalUnits")) return 0;
  if (path.includes("achievedConfidence")) return 1e-12;
  if (path.includes("reliabilityLowerBound")) return 1e-10;
  if (path.includes("Reliability")) return 1e-10;
  if (path.includes("demonstrated")) return 0;
  return 1e-8;
}

function relativeTolerance(path) {
  if (path.includes("requiredSampleSize") || path.includes("additionalUnitsRequired") || path.includes("requiredTotalUnits")) return 0;
  if (path.includes("requiredExposureFactor") || path.includes("requiredTotalTestTime") || path.includes("mtbfLowerBound") || path.includes("additionalTotalTestTimeRequired")) return 1e-10;
  return 1e-10;
}

function toCsv(items) {
  const headers = Object.keys(items[0]);
  return `${headers.join(",")}\n${items.map(item => headers.map(header => csvCell(item[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}
