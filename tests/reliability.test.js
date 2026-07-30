import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDelimitedText, parseFile } from "../src/reliability/parser.js";
import { normalizeStatus } from "../src/reliability/status-normalizer.js";
import { detectColumns, validateRows } from "../src/reliability/validation.js";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { bxLife, compareReliabilityTarget, failureProbabilityAt, reliabilityAt, weibullMetrics } from "../src/reliability/metrics.js";
import { calculateMtbf } from "../src/reliability/mtbf.js";
import { interpretWeibull } from "../src/reliability/insight-engine.js";
import { buildReportHtml } from "../src/reliability/report.js";
import { dictionary } from "../src/reliability/i18n.js";

const uncensored = [120, 220, 340, 510, 760, 940, 1180, 1450].map((time, index) => ({ sampleId: `S${index + 1}`, time, status: "failure" }));
const censored = [
  { time: 120, status: "failure" }, { time: 220, status: "failure" }, { time: 340, status: "failure" },
  { time: 510, status: "failure" }, { time: 760, status: "failure" }, { time: 940, status: "failure" },
  { time: 1180, status: "censored" }, { time: 1450, status: "censored" }, { time: 1600, status: "censored" }
];

test("status normalization handles failure and censored aliases", () => {
  assert.equal(normalizeStatus(" Failed "), "failure");
  assert.equal(normalizeStatus("Right Censored"), "censored");
  assert.equal(normalizeStatus("未失效"), "censored");
  assert.equal(normalizeStatus("unknown"), null);
});

test("parser, column detection, counts, invalid time rejection", () => {
  const parsed = parseDelimitedText("Sample ID,Time,Status\nS1,10,Fail\nS2,bad,Censored\nS1,20,No");
  const mapping = detectColumns(parsed.headers);
  const validation = validateRows(parsed.rows, mapping, { timeUnit: "hours" });
  assert.equal(validation.failureCount, 1);
  assert.equal(validation.censoredCount, 1);
  assert.equal(validation.invalidTimeCount, 1);
  assert(validation.errors.some(error => error.includes("invalid Time")));
  assert(validation.warnings.some(warning => warning.includes("Duplicate Sample ID")));
});

test("CSV, TSV, and XLSX parser produce usable rows", async () => {
  const csv = parseDelimitedText("Sample ID,Time,Status\nS1,10,Failure\nS2,20,Censored", ",");
  assert.deepEqual(csv.headers, ["Sample ID", "Time", "Status"]);
  assert.equal(csv.rows.length, 2);

  const tsv = parseDelimitedText("Sample ID\tTime\tStatus\nS1\t10\tFailure\nS2\t20\tCensored", "\t");
  assert.deepEqual(tsv.headers, ["Sample ID", "Time", "Status"]);
  assert.equal(tsv.rows[1].Status, "Censored");

  const buffer = await readFile(new URL("../examples/life-data-example.xlsx", import.meta.url));
  const file = new File([buffer], "life-data-example.xlsx");
  const xlsx = await parseFile(file);
  assert.deepEqual(xlsx.headers, ["Sample ID", "Time", "Status", "Failure Mode", "Test Condition"]);
  assert.equal(xlsx.rows.length, 15);
});

test("invalid status and zero-failure Weibull validation are blocking", () => {
  const badStatus = parseDelimitedText("Time,Status\n10,Maybe\n20,Censored");
  const badValidation = validateRows(badStatus.rows, detectColumns(badStatus.headers), { timeUnit: "hours" });
  assert(badValidation.errors.some(error => error.includes("unrecognized Status")));

  const zeroFailure = parseDelimitedText("Time,Status\n10,Censored\n20,No");
  const zeroValidation = validateRows(zeroFailure.rows, detectColumns(zeroFailure.headers), { timeUnit: "hours" });
  assert.equal(zeroValidation.failureCount, 0);
  assert(zeroValidation.errors.some(error => error.includes("without observed failures")));
});

test("Weibull MLE converges for uncensored data with reference values", () => {
  const fit = fitWeibull2PMLE(uncensored);
  assert.equal(fit.converged, true);
  assert(Math.abs(fit.beta - 1.5525325137) / 1.5525325137 < 1e-4);
  assert(Math.abs(fit.eta - 767.6377532) / 767.6377532 < 1e-4);
});

test("right-censored data changes Weibull beta and eta", () => {
  const fitA = fitWeibull2PMLE(uncensored);
  const fitB = fitWeibull2PMLE(censored);
  assert(Math.abs(fitA.beta - fitB.beta) > 0.05);
  assert(Math.abs(fitA.eta - fitB.eta) > 100);
});

test("B-life and reliability formulas are consistent", () => {
  const beta = 1.5;
  const eta = 800;
  const b1 = bxLife(0.01, beta, eta);
  const b5 = bxLife(0.05, beta, eta);
  const b10 = bxLife(0.10, beta, eta);
  const b50 = bxLife(0.50, beta, eta);
  assert(b1 < b5);
  assert(b5 < b10);
  assert(b10 < b50);
  assert(Math.abs(b10 - 178.4604205) / 178.4604205 < 1e-4);
  assert(Math.abs(failureProbabilityAt(400, beta, eta) - (1 - reliabilityAt(400, beta, eta))) < 1e-12);
});

test("MTBF calculation and zero-failure handling", () => {
  const mtbf = calculateMtbf([{ time: 100, status: "failure" }, { time: 200, status: "censored" }], 50);
  assert.equal(mtbf.totalTime, 300);
  assert.equal(mtbf.mtbf, 300);
  assert(mtbf.missionReliability > 0);
  const zero = calculateMtbf([{ time: 100, status: "censored" }], 50);
  assert.equal(zero.mtbf, null);
  assert.equal(zero.lambda, null);
});

test("insight classification uses configured beta bands", () => {
  assert.equal(interpretWeibull(0.7).result, "Decreasing failure-rate behavior");
  assert.equal(interpretWeibull(1.0).result, "Approximately constant failure-rate behavior");
  assert.equal(interpretWeibull(1.4).result, "Increasing failure-rate behavior");
});

test("mission target comparison", () => {
  assert.equal(compareReliabilityTarget(0.95, "").status, "Target not provided");
  assert.equal(compareReliabilityTarget(0.95, 0.9).status, "Meets Target");
  assert.equal(compareReliabilityTarget(0.85, 0.9).status, "Below Target");
  const fit = fitWeibull2PMLE(uncensored);
  const metrics = weibullMetrics(fit, uncensored, 500, 0.8);
  assert(metrics.missionReliability > 0 && metrics.missionReliability < 1);
});

test("report content uses Life Data structure without fake fit fields", () => {
  const fit = fitWeibull2PMLE(censored);
  const metrics = weibullMetrics(fit, censored, 500, 0.8);
  const validation = { totalCount: censored.length, failureCount: 6, censoredCount: 3, warnings: [] };
  const report = buildReportHtml({
    metrics,
    insight: interpretWeibull(fit.beta),
    validation,
    mapping: { time: "Time", status: "Status" },
    settings: { timeUnit: "hours", missionTime: 500, targetReliability: 0.8, lang: "en" },
    plots: { probability: "<svg></svg>", reliability: "<svg></svg>" },
    lang: "en"
  });
  assert(report.includes("Weibull 2P MLE"));
  assert(report.includes("Target Comparison"));
  assert(report.includes("Data Information / Appendix"));
  assert(!report.includes('<th scope="row">time</th>'));
  assert(!report.includes('<th scope="row">status</th>'));
  assert(!report.includes("Model Fit = Good"));
  assert(!report.includes("MTBF Results"));
  assert(!report.includes("Confidence Interval"));
});

test("i18n English and Chinese dictionaries have matching keys", () => {
  const en = Object.keys(dictionary.en).sort();
  const zh = Object.keys(dictionary.zh).sort();
  assert.deepEqual(zh, en);
});
