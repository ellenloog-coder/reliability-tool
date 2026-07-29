import { readFile, writeFile } from "node:fs/promises";
import { analyzeExponentialMTBF, compareTargetMTBF, summarizeUnitExposure, updateMTBFMission } from "../src/reliability/mtbf.js";
import { mtbfCurvePoints } from "../src/reliability/mtbf-plotting.js";
import { detectMTBFColumns, validateMTBFSummaryInput, validateMTBFUnitRows } from "../src/reliability/mtbf-validation.js";

const fixtures = JSON.parse(await readFile(new URL("./fixtures/mtbf-fixtures.json", import.meta.url), "utf8"));
const expected = JSON.parse(await readFile(new URL("./fixtures/mtbf-expected-results.json", import.meta.url), "utf8"));
const expectedById = new Map(expected.map(item => [item.id, item]));
const rows = [["Fixture", "Input Mode", "Metric", "Reference Value", "JavaScript Value", "Absolute Error", "Relative Error", "Pass / Fail"]];
const summaryRows = [];

for (const fixture of fixtures) {
  const reference = expectedById.get(fixture.id);
  const production = productionResult(fixture);
  if (!reference.valid || !production.valid) {
    pushRow(fixture, "valid", reference.valid, production.valid, reference.valid === production.valid);
    const expectedInvalid = Boolean(fixture.expectInvalid);
    summaryRows.push({ fixture: fixture.id, pass: reference.valid === production.valid && production.valid !== expectedInvalid });
    continue;
  }
  const checks = [
    ["totalExposure", reference.totalExposure, production.totalExposure, "absolute", 1e-12],
    ["failureCount", reference.failureCount, production.failureCount, "exact"],
    ["failureRate", reference.failureRate, production.failureRate, "relative", 1e-12],
    ["MTBF", reference.mtbf, production.mtbf, "relative", 1e-12],
    ["missionReliability", reference.missionReliability, production.missionReliability, "absolute", 1e-12],
    ["missionFailureProbability", reference.missionFailureProbability, production.missionFailureProbability, "absolute", 1e-12],
    ["targetComparison", reference.targetResult, production.targetResult, "exact"]
  ];
  let fixturePass = true;
  for (const [metric, ref, actual, mode, tolerance] of checks) {
    const pass = compareMetric(ref, actual, mode, tolerance);
    fixturePass = fixturePass && pass;
    pushRow(fixture, metric, ref, actual, pass.absoluteError, pass.relativeError, pass.pass);
  }
  summaryRows.push({ fixture: fixture.id, pass: fixturePass });
}

await writeFile(new URL("./mtbf-numerical-comparison.csv", import.meta.url), rows.map(row => row.map(csvCell).join(",")).join("\n") + "\n");

const equivalencePass = checkEquivalence();
const curvePass = checkCurve();
const passed = summaryRows.every(row => row.pass) && equivalencePass && curvePass;
console.log(JSON.stringify({
  fixtures: summaryRows.length,
  passedFixtures: summaryRows.filter(row => row.pass).length,
  equivalencePass,
  curvePass,
  passed
}, null, 2));

function productionResult(fixture) {
  let validation;
  let input;
  if (fixture.inputMode === "summary") {
    validation = validateMTBFSummaryInput(fixture);
    if (validation.errors.length) return { valid: false, errors: validation.errors };
    input = validation.input;
  } else {
    const headers = ["Unit ID", "Exposure Time", "Status"];
    const rows = fixture.rows.map(row => ({ "Unit ID": row.unitId, "Exposure Time": row.exposureTime, Status: row.status }));
    const mapping = detectMTBFColumns(headers);
    validation = validateMTBFUnitRows(rows, mapping, { timeUnit: fixture.timeUnit });
    if (validation.errors.length) return { valid: false, errors: validation.errors };
    input = { ...summarizeUnitExposure(validation.records, fixture.timeUnit), missionTime: fixture.missionTime, targetMTBF: fixture.targetMTBF };
  }
  const result = analyzeExponentialMTBF(input);
  const target = compareTargetMTBF(result.mtbf, input.targetMTBF);
  return {
    valid: true,
    totalExposure: result.totalExposure,
    failureCount: result.failureCount,
    failureRate: result.failureRate,
    mtbf: result.mtbf,
    missionReliability: result.missionReliability,
    missionFailureProbability: result.missionFailureProbability,
    targetResult: target.status
  };
}

function checkEquivalence() {
  const group = fixtures.filter(item => item.equivalenceGroup === "equiv_1000_2");
  const results = group.map(productionResult);
  if (results.length !== 2 || results.some(result => !result.valid)) return false;
  return ["totalExposure", "failureCount", "failureRate", "mtbf", "missionReliability", "missionFailureProbability", "targetResult"]
    .every(key => Object.is(results[0][key], results[1][key]));
}

function checkCurve() {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 100, targetMTBF: 2000 });
  const points = mtbfCurvePoints(result, 100);
  if (points.length !== 100) return false;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point.reliability < 0 || point.reliability > 1) return false;
    if (point.failureProbability < 0 || point.failureProbability > 1) return false;
    if (Math.abs(point.reliability + point.failureProbability - 1) > 1e-12) return false;
    if (index > 0 && point.reliability > points[index - 1].reliability + 1e-12) return false;
    if (index > 0 && point.failureProbability < points[index - 1].failureProbability - 1e-12) return false;
  }
  const updated = updateMTBFMission(result, 200, 2000);
  return updated.failureRate === result.failureRate && updated.mtbf === result.mtbf && updated.missionReliability !== result.missionReliability;
}

function compareMetric(reference, actual, mode, tolerance = 0) {
  if (mode === "exact") {
    const pass = Object.is(reference, actual);
    return { pass, absoluteError: pass ? 0 : "n/a", relativeError: pass ? 0 : "n/a" };
  }
  if (reference === null || actual === null) {
    const pass = reference === actual;
    return { pass, absoluteError: pass ? 0 : "n/a", relativeError: pass ? 0 : "n/a" };
  }
  const absoluteError = Math.abs(Number(reference) - Number(actual));
  const relativeError = reference === 0 ? absoluteError : absoluteError / Math.abs(Number(reference));
  const pass = mode === "absolute" ? absoluteError < tolerance : relativeError < tolerance;
  return { pass, absoluteError, relativeError };
}

function pushRow(fixture, metric, reference, actual, absoluteOrPass, relativeError = "", pass = null) {
  if (typeof absoluteOrPass === "boolean") {
    rows.push([fixture.id, fixture.inputMode, metric, reference, actual, "", "", absoluteOrPass ? "Pass" : "Fail"]);
  } else {
    rows.push([fixture.id, fixture.inputMode, metric, reference ?? "", actual ?? "", absoluteOrPass, relativeError, pass ? "Pass" : "Fail"]);
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}
