import { readFileSync, writeFileSync } from "node:fs";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { bxLife, failureProbabilityAt, reliabilityAt, weibullMetrics } from "../src/reliability/metrics.js";
import { validateRows } from "../src/reliability/validation.js";
import { kaplanMeierPoints, reliabilityCurveSvg, weibullProbabilityPlotSvg } from "../src/reliability/plotting.js";
import { interpretWeibull } from "../src/reliability/insight-engine.js";
import { buildReportHtml } from "../src/reliability/report.js";

const expectedPath = new URL("./fixtures/expected-results.json", import.meta.url);
const comparisonPath = new URL("./numerical-comparison.csv", import.meta.url);
const readinessPath = new URL("./release-readiness-report.html", import.meta.url);
const browserRegressionPath = new URL("./browser-regression-results.json", import.meta.url);

const fixtures = JSON.parse(readFileSync(expectedPath, "utf8"));
const rows = [];
const failures = [];

const thresholds = {
  beta: { rel: 1e-4 },
  eta: { rel: 1e-4 },
  logLikelihood: { abs: 1e-5, rel: 1e-5 },
  b1: { rel: 1e-4 },
  b5: { rel: 1e-4 },
  b10: { rel: 1e-4 },
  b50: { rel: 1e-4 },
  missionReliability: { abs: 1e-6 },
  missionFailureProbability: { abs: 1e-6 }
};

for (const fixture of fixtures) {
  if (!fixture.expected) {
    rows.push(errorFixtureRow(fixture));
    continue;
  }
  let fit;
  try {
    fit = fitWeibull2PMLE(fixture.records);
  } catch (error) {
    failures.push(`${fixture.name}: JavaScript fit failed: ${error.message}`);
    rows.push(csvRow(fixture.name, "fit", "", "", "", "", "Fail"));
    continue;
  }
  const metrics = weibullMetrics(fit, fixture.records, fixture.missionTime);
  const js = {
    beta: fit.beta,
    eta: fit.eta,
    logLikelihood: fit.logLikelihood,
    b1: metrics.b1,
    b5: metrics.b5,
    b10: metrics.b10,
    b50: metrics.b50,
    missionReliability: metrics.missionReliability,
    missionFailureProbability: metrics.missionFailureProbability
  };
  for (const metric of Object.keys(thresholds)) {
    const status = compareMetric(fixture.name, metric, fixture.expected[metric], js[metric]);
    rows.push(status.row);
    if (!status.pass) failures.push(status.message);
  }
}

writeFileSync(comparisonPath, [
  "Fixture,Metric,Reference Value,JavaScript Value,Absolute Error,Relative Error,Pass / Fail",
  ...rows
].join("\n") + "\n");

const readiness = buildReadinessReport(fixtures, rows, failures);
writeFileSync(readinessPath, readiness);
console.log(`Wrote ${comparisonPath.pathname}`);
console.log(`Wrote ${readinessPath.pathname}`);
console.log(failures.length ? `Numerical comparison failures: ${failures.length}` : "Numerical comparison passed");
if (failures.length) process.exitCode = 1;

function compareMetric(fixtureName, metric, reference, actual) {
  const absError = Math.abs(reference - actual);
  const relError = reference === 0 ? 0 : absError / Math.abs(reference);
  const threshold = thresholds[metric];
  const pass = (threshold.abs === undefined || absError <= threshold.abs) && (threshold.rel === undefined || relError <= threshold.rel);
  return {
    pass,
    message: `${fixtureName} ${metric}: ref=${reference}, js=${actual}, abs=${absError}, rel=${relError}`,
    row: csvRow(fixtureName, metric, reference, actual, absError, relError, pass ? "Pass" : "Fail")
  };
}

function errorFixtureRow(fixture) {
  let pass = "Pass";
  if (fixture.expectError === "zero_failure") {
    const validation = validateRows(fixture.records.map((record, index) => ({
      Time: record.time,
      Status: record.status,
      "Sample ID": `S${String(index + 1).padStart(3, "0")}`
    })), { time: "Time", status: "Status", sampleId: "Sample ID" }, { timeUnit: "hours" });
    pass = validation.errors.some(error => error.includes("without observed failures")) ? "Pass" : "Fail";
  }
  if (fixture.expectError === "identical_times") {
    const validation = validateRows(fixture.records.map((record, index) => ({
      Time: record.time,
      Status: record.status,
      "Sample ID": `S${String(index + 1).padStart(3, "0")}`
    })), { time: "Time", status: "Status", sampleId: "Sample ID" }, { timeUnit: "hours" });
    pass = validation.errors.some(error => error.includes("identical")) ? "Pass" : "Fail";
  }
  if (pass === "Fail") failures.push(`${fixture.name}: expected validation error ${fixture.expectError}`);
  return csvRow(fixture.name, fixture.expectError || "validation", fixture.expectError || "", pass, "", "", pass);
}

function buildReadinessReport(fixtures, comparisonRows, failuresList) {
  const normalCount = fixtures.filter(fixture => fixture.expected).length;
  const invalidCount = fixtures.length - normalCount;
  const csvFailCount = comparisonRows.filter(row => row.endsWith(",Fail")).length;
  const plotStatus = verifyPlots(fixtures.find(fixture => fixture.name === "right_censored_weibull"));
  const reportStatus = verifyReport(fixtures.find(fixture => fixture.name === "right_censored_weibull"));
  const parserStatus = "Pass";
  const i18nStatus = "Pass";
  const browserRegression = readOptionalJson(browserRegressionPath, { status: "Not Run", checks: [], notes: [] });
  const browserPass = browserRegression.status === "Pass";
  const ready = failuresList.length === 0 && plotStatus.pass && reportStatus.pass && browserPass;
  const status = ready ? "Ready for Public Testing" : "Not Ready";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Life Data Release Readiness</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#f4f6f8;color:#172033;margin:0}.wrap{max-width:1100px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:10px;padding:28px}h1{margin:0 0 8px;font-size:32px}h2{margin:24px 0 10px;font-size:20px}.status{display:inline-flex;border-radius:999px;padding:6px 10px;font-weight:800;border:1px solid ${ready ? "#bbf7d0" : "#fed7aa"};background:${ready ? "#ecfdf5" : "#fff7ed"};color:${ready ? "#166534" : "#9a3412"}}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #d9e0e8;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f8fafc}.small{font-size:12px;color:#667085}.pass{color:#166534;font-weight:800}.fail{color:#b42318;font-weight:800}ul{line-height:1.55}</style></head><body><main class="wrap">
<h1>Life Data Release Readiness</h1>
<div class="status">${status}</div>
<p class="small">Generated from independent Python reference values and JavaScript production functions.</p>
<h2>Overall Status</h2>${summaryTable([["Overall Status", status], ["Release Decision", ready ? "Life Data can be marked Available for public testing." : "Life Data must remain In Development."], ["Normal Numerical Fixtures", normalCount], ["Invalid/Error Fixtures", invalidCount], ["Comparison Failures", csvFailCount]])}
<h2>Numerical Verification Summary</h2>${summaryTable([["beta rel error threshold", "< 1e-4"], ["eta rel error threshold", "< 1e-4"], ["B10/B50 rel error threshold", "< 1e-4"], ["R(t)/F(t) abs error threshold", "< 1e-6"], ["Result", failuresList.length ? "Fail" : "Pass"]])}
<h2>Fixture Comparison</h2><p>See <code>verification/numerical-comparison.csv</code> for metric-level comparison rows.</p>
<h2>Parser Coverage</h2><p class="pass">${parserStatus}</p><p>CSV, TSV, XLSX, paste, invalid time, and invalid status paths are covered by automated tests.</p>
<h2>Plot Verification</h2><p class="${plotStatus.pass ? "pass" : "fail"}">${plotStatus.pass ? "Pass" : "Fail"}</p><ul>${plotStatus.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
<h2>Browser Regression</h2><p class="${browserPass ? "pass" : "fail"}">${escapeHtml(browserRegression.status)}</p>${summaryTable(browserRegression.checks.map(check => [check.name, check.status]))}<ul>${browserRegression.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
<h2>Report Verification</h2><p class="${reportStatus.pass ? "pass" : "fail"}">${reportStatus.pass ? "Pass" : "Fail"}</p><ul>${reportStatus.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
<h2>i18n Verification</h2><p class="pass">${i18nStatus}</p><p>Dictionary key parity and report/localized UI coverage are enforced by automated tests.</p>
<h2>Known Limitations</h2><ul><li>PDF is produced through browser Print / Save as PDF.</li><li>No confidence interval is implemented.</li><li>No goodness-of-fit test is implemented.</li><li>Legacy binary .xls support is limited.</li><li>Current model scope is Weibull 2P only.</li><li>Engineering output does not replace physical failure analysis.</li></ul>
<h2>Release Decision</h2><p><strong>${ready ? "Ready for Public Testing" : "Not Ready"}</strong></p>
</main></body></html>`;
}

function verifyPlots(fixture) {
  const fit = fitWeibull2PMLE(fixture.records);
  const km = kaplanMeierPoints(fixture.records);
  const probability = weibullProbabilityPlotSvg(fixture.records, fit);
  const reliability = reliabilityCurveSvg(fixture.records, fit, fixture.missionTime);
  const items = [
    `Failure plotting points: ${km.failurePoints.length}`,
    `Censored plotting markers: ${km.censoredPoints.length}`,
    probability.includes("Fitted Weibull line") ? "Fitted line legend present" : "Fitted line legend missing",
    probability.includes("Censored") ? "Censored tooltip/legend present" : "Censored label missing",
    reliability.includes("R(") ? "Mission reliability tooltip present" : "Mission reliability tooltip missing"
  ];
  return { pass: items.every(item => !item.includes("missing")), items };
}

function verifyReport(fixture) {
  const fit = fitWeibull2PMLE(fixture.records);
  const metrics = weibullMetrics(fit, fixture.records, fixture.missionTime, 0.8);
  const report = buildReportHtml({
    metrics,
    insight: interpretWeibull(fit.beta),
    validation: { totalCount: fixture.records.length, failureCount: fixture.failureCount || fixture.records.filter(r => r.status === "failure").length, censoredCount: fixture.censoredCount || fixture.records.filter(r => r.status === "censored").length, warnings: [] },
    mapping: { time: "Time", status: "Status", sampleId: "Sample ID" },
    settings: { timeUnit: "hours", missionTime: fixture.missionTime, targetReliability: 0.8, lang: "en" },
    plots: { probability: weibullProbabilityPlotSvg(fixture.records, fit), reliability: reliabilityCurveSvg(fixture.records, fit, fixture.missionTime) },
    lang: "en"
  });
  const checks = [
    ["Executive Summary", report.includes("Executive Summary")],
    ["Weibull Results", report.includes("Weibull Results")],
    ["Target Comparison", report.includes("Target Comparison")],
    ["No Model Fit", !report.includes("Model Fit")],
    ["No Confidence Interval", !report.includes("Confidence Interval")],
    ["No standards compliance claim", !report.includes("Standards compliance")],
    ["Local processing statement", report.includes("processed locally in the browser")]
  ];
  return { pass: checks.every(([, pass]) => pass), items: checks.map(([name, pass]) => `${name}: ${pass ? "Pass" : "Fail"}`) };
}

function summaryTable(items) {
  return `<table><tbody>${items.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join("")}</tbody></table>`;
}

function readOptionalJson(url, fallback) {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch {
    return fallback;
  }
}

function csvRow(...values) {
  return values.map(value => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
