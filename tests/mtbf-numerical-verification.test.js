import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeExponentialMTBF, compareTargetMTBF, summarizeUnitExposure, updateMTBFMission } from "../src/reliability/mtbf.js";
import { mtbfCurvePoints, mtbfReliabilityCurveSvg } from "../src/reliability/mtbf-plotting.js";
import { detectMTBFColumns, validateMTBFSummaryInput, validateMTBFUnitRows } from "../src/reliability/mtbf-validation.js";
import { parseDelimitedText, parseFile } from "../src/reliability/parser.js";
import { buildMTBFInsight } from "../src/reliability/mtbf-insight.js";
import { buildMTBFReportHtml } from "../src/reliability/mtbf-report.js";
import { relError } from "./helpers.js";

const fixtures = JSON.parse(await readFile(new URL("../verification/fixtures/mtbf-fixtures.json", import.meta.url), "utf8"));
const expectedResults = JSON.parse(await readFile(new URL("../verification/fixtures/mtbf-expected-results.json", import.meta.url), "utf8"));
const expectedById = new Map(expectedResults.map(item => [item.id, item]));

test("MTBF fixtures cover release-readiness scenarios", () => {
  assert(fixtures.length >= 18);
  for (const expected of expectedResults.filter(item => item.valid)) {
    for (const key of ["id", "inputMode", "timeUnit", "totalExposure", "failureCount", "missionTime", "targetResult", "expectedWarnings"]) {
      assert(Object.hasOwn(expected, key), `${expected.id} missing ${key}`);
    }
  }
  assert(fixtures.some(item => item.id === "summary_zero_failure"));
  assert(fixtures.some(item => item.id === "unit_invalid_exposure_time"));
  assert(fixtures.some(item => item.id === "unit_invalid_status"));
});

test("production MTBF outputs match independent Python expected results", () => {
  for (const fixture of fixtures) {
    const expected = expectedById.get(fixture.id);
    const actual = productionResult(fixture);
    assert.equal(actual.valid, expected.valid, fixture.id);
    if (!expected.valid) continue;
    assert.equal(actual.totalExposure, expected.totalExposure, fixture.id);
    assert.equal(actual.failureCount, expected.failureCount, fixture.id);
    assert.equal(actual.targetResult, expected.targetResult, fixture.id);
    if (expected.failureRate === null) {
      assert.equal(actual.failureRate, null, fixture.id);
      assert.equal(actual.mtbf, null, fixture.id);
      assert.equal(actual.missionReliability, null, fixture.id);
      assert.equal(actual.missionFailureProbability, null, fixture.id);
    } else {
      assert(relError(actual.failureRate, expected.failureRate) < 1e-12, `${fixture.id} failure rate`);
      assert(relError(actual.mtbf, expected.mtbf) < 1e-12, `${fixture.id} MTBF`);
      assert(Math.abs(actual.missionReliability - expected.missionReliability) < 1e-12, `${fixture.id} R(t)`);
      assert(Math.abs(actual.missionFailureProbability - expected.missionFailureProbability) < 1e-12, `${fixture.id} F(t)`);
      assert(Math.abs(actual.missionReliability + actual.missionFailureProbability - 1) < 1e-12, `${fixture.id} complement`);
    }
  }
});

test("Summary and Unit-Level equivalent fixtures produce identical MTBF results", () => {
  const pair = fixtures.filter(item => item.equivalenceGroup === "equiv_1000_2").map(productionResult);
  assert.equal(pair.length, 2);
  for (const metric of ["totalExposure", "failureCount", "failureRate", "mtbf", "missionReliability", "missionFailureProbability", "targetResult"]) {
    assert.equal(pair[0][metric], pair[1][metric], metric);
  }
});

test("MTBF summary validation blocks finite-number boundary errors", () => {
  const invalids = [
    { totalExposure: "", failureCount: 1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 0, failureCount: 1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: -1, failureCount: 1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: "NaN", failureCount: 1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: "Infinity", failureCount: 1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: -1, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1.2, missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: "NaN", missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: "Infinity", missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: "", missionTime: 1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: 0, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: -1, targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: "NaN", targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: "Infinity", targetMTBF: "", timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: 1, targetMTBF: 0, timeUnit: "hours" },
    { totalExposure: 1, failureCount: 1, missionTime: 1, targetMTBF: -1, timeUnit: "hours" }
  ];
  for (const input of invalids) {
    assert(validateMTBFSummaryInput(input).errors.length > 0);
  }
});

test("MTBF parser coverage includes CSV, TSV, XLSX, automatic mapping, manual mapping, and status aliases", async () => {
  const csv = parseDelimitedText("Unit ID,Exposure Time,Status\n U1 ,10, Breakdown \nU2,20, Operating");
  const csvValidation = validateMTBFUnitRows(csv.rows, detectMTBFColumns(csv.headers), { timeUnit: "hours" });
  assert.equal(csvValidation.failureCount, 1);
  assert.equal(csvValidation.censoredCount, 1);

  const tsv = parseDelimitedText("设备编号\t运行时间\t状态\nA\t100\t失效\nB\t200\t未失效", "\t");
  const tsvValidation = validateMTBFUnitRows(tsv.rows, detectMTBFColumns(tsv.headers), { timeUnit: "hours" });
  assert.equal(tsvValidation.totalExposure, 300);

  const xlsxBuffer = await readFile(new URL("../examples/mtbf-example.xlsx", import.meta.url));
  const xlsx = await parseFile(new File([xlsxBuffer], "mtbf-example.xlsx"));
  const xlsxValidation = validateMTBFUnitRows(xlsx.rows, detectMTBFColumns(xlsx.headers), { timeUnit: "hours" });
  assert.equal(xlsxValidation.totalExposure, 9270);
  assert.equal(xlsxValidation.failureCount, 4);
  assert.equal(xlsxValidation.censoredCount, 6);

  const manualMapping = { unitId: "A", exposureTime: "B", status: "C" };
  const manual = validateMTBFUnitRows([{ A: "M1", B: "10", C: "No Failure" }], manualMapping, { timeUnit: "hours" });
  assert.equal(manual.censoredCount, 1);
});

test("MTBF reliability curve has 100 monotonic exponential points and zero-failure has no curve", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 100, targetMTBF: 2000 });
  const points = mtbfCurvePoints(result, 100);
  assert.equal(points.length, 100);
  assert.equal(points[0].reliability, 1);
  for (let index = 1; index < points.length; index += 1) {
    assert(points[index].reliability <= points[index - 1].reliability + 1e-12);
    assert(points[index].failureProbability >= points[index - 1].failureProbability - 1e-12);
    assert(points[index].reliability >= 0 && points[index].reliability <= 1);
    assert(Math.abs(points[index].reliability + points[index].failureProbability - 1) < 1e-12);
  }
  const svg = mtbfReliabilityCurveSvg(result, { time: "小时", reliability: "可靠度", reliabilityCurve: "可靠性曲线", exponentialCurve: "指数可靠性曲线" });
  assert(svg.includes("指数可靠性曲线"));
  assert(!svg.includes("Weibull"));
  const zero = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 0, missionTime: 100 });
  assert.equal(mtbfReliabilityCurveSvg(zero), "");
});

test("MTBF mission and target updates only refresh derived result fields", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, missionTime: 100, targetMTBF: 2000 });
  const missionUpdated = updateMTBFMission(result, 200, 2000);
  assert.equal(missionUpdated.totalExposure, result.totalExposure);
  assert.equal(missionUpdated.failureCount, result.failureCount);
  assert.equal(missionUpdated.failureRate, result.failureRate);
  assert.equal(missionUpdated.mtbf, result.mtbf);
  assert.notEqual(missionUpdated.missionReliability, result.missionReliability);

  const targetAbove = compareTargetMTBF(result.mtbf, result.mtbf + 1);
  const targetEqual = compareTargetMTBF(result.mtbf, result.mtbf);
  const targetBelow = compareTargetMTBF(result.mtbf, result.mtbf - 1);
  assert.equal(targetAbove.status, "Below Target");
  assert.equal(targetEqual.status, "Meets Target");
  assert.equal(targetBelow.status, "Meets Target");
});

test("MTBF insight and report include model boundary and avoid unsupported claims", () => {
  const result = analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 4, censoredCount: null, totalUnits: null, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" });
  const targetComparison = compareTargetMTBF(result.mtbf, 2000);
  const insight = buildMTBFInsight(result, targetComparison);
  for (const key of [
    "explanationKeys",
    "recommendationKeys",
    "limitations",
    "parameters",
    "assumptions",
    "evidence",
    "meaning",
    "recommendedActions",
    "result",
    "flags"
  ]) {
    assert(Object.hasOwn(insight, key), key);
  }
  assert(insight.evidence.includes("T = 10000"));
  assert(insight.evidence.includes("r = 4"));
  assert(insight.evidence.includes("MTBF = 2500"));
  assert(!JSON.stringify(insight).includes("High Risk"));
  assert(insight.limitations.some(item => item.includes("repairable system")));

  const report = buildMTBFReportHtml({
    inputMode: "summary",
    inputSummary: { totalExposure: 10000, failureCount: 4, censoredCount: null, totalUnits: null, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" },
    result,
    targetComparison,
    insight,
    curveSvg: mtbfReliabilityCurveSvg(result),
    mapping: { totalExposure: "Total Time on Test", failureCount: "Failure Count" },
    lang: "en"
  });
  for (const required of ["Exponential constant failure-rate model", "Point estimate only", "No statistical confidence bounds", "MTBF Point Estimate", "Failures per hour", "Data Structure / Appendix", "processed locally"]) {
    assert(report.includes(required), required);
  }
  for (const forbidden of ["Confidence Interval", "Lower Confidence Bound", "Model Fit = Good", "Standards Compliant", "Qualification Passed", "Infinite MTBF", "Guaranteed Lifetime"]) {
    assert(!report.includes(forbidden), forbidden);
  }

  const zhReport = buildMTBFReportHtml({
    inputMode: "summary",
    inputSummary: { totalExposure: 10000, failureCount: 0, censoredCount: null, totalUnits: null, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" },
    result: analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 0, censoredCount: null, totalUnits: null, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" }),
    targetComparison: compareTargetMTBF(null, 2000),
    insight: buildMTBFInsight(analyzeExponentialMTBF({ totalExposure: 10000, failureCount: 0, censoredCount: null, totalUnits: null, missionTime: 100, targetMTBF: 2000, timeUnit: "hours" })),
    curveSvg: "",
    mapping: { totalExposure: "总测试时间", failureCount: "失效数" },
    lang: "zh"
  });
  assert(zhReport.includes("MTBF 点估计"));
  assert(zhReport.includes("无法估计"));
  assert(zhReport.includes("当前单元级数据"));
  assert(!zhReport.includes("Unit-Level Data currently"));
  assert(!zhReport.includes("Not Estimable"));
});

function productionResult(fixture) {
  let validation;
  let input;
  if (fixture.inputMode === "summary") {
    validation = validateMTBFSummaryInput(fixture);
    if (validation.errors.length) return { valid: false, errors: validation.errors };
    input = validation.input;
  } else {
    const rows = fixture.rows.map(row => ({ "Unit ID": row.unitId, "Exposure Time": row.exposureTime, Status: row.status }));
    validation = validateMTBFUnitRows(rows, { unitId: "Unit ID", exposureTime: "Exposure Time", status: "Status" }, { timeUnit: fixture.timeUnit });
    if (validation.errors.length) return { valid: false, errors: validation.errors };
    input = { ...summarizeUnitExposure(validation.records, fixture.timeUnit), missionTime: fixture.missionTime, targetMTBF: fixture.targetMTBF };
  }
  const result = analyzeExponentialMTBF(input);
  return {
    valid: true,
    totalExposure: result.totalExposure,
    failureCount: result.failureCount,
    failureRate: result.failureRate,
    mtbf: result.mtbf,
    missionReliability: result.missionReliability,
    missionFailureProbability: result.missionFailureProbability,
    targetResult: compareTargetMTBF(result.mtbf, input.targetMTBF).status
  };
}
