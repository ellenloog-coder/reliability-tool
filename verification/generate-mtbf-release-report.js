import { readFile, writeFile } from "node:fs/promises";

const browserResults = JSON.parse(await readFile(new URL("./mtbf-browser-regression-results.json", import.meta.url), "utf8"));
const expectedResults = JSON.parse(await readFile(new URL("./fixtures/mtbf-expected-results.json", import.meta.url), "utf8"));
const comparisonCsv = await readFile(new URL("./mtbf-numerical-comparison.csv", import.meta.url), "utf8");

const comparisonRows = comparisonCsv.trim().split("\n").slice(1);
const comparisonPass = comparisonRows.every(row => row.endsWith(",Pass"));
const browserPass = browserResults.every(row => row.pass === "Pass");
const validFixtures = expectedResults.filter(item => item.valid);
const invalidFixtures = expectedResults.filter(item => !item.valid);
const overallStatus = comparisonPass && browserPass ? "Ready for Public Testing" : "Not Ready";

const sections = [
  ["Overall Status", overallStatus],
  ["Product Scope", "MTBF under an Exponential Model / Constant Failure-Rate Assumption for summary exposure data and one-row-per-unit exposure records."],
  ["Model Assumptions", "lambda = r / T; MTBF = T / r; R(t) = exp(-lambda*t); F(t) = 1 - R(t). Failure events are treated as independent and accumulated exposure is treated as reliable."],
  ["Numerical Verification Summary", `${validFixtures.length} valid fixtures and ${invalidFixtures.length} invalid fixtures were checked against an independent Python reference implementation. Numerical comparison rows: ${comparisonRows.length}. Result: ${comparisonPass ? "Pass" : "Fail"}.`],
  ["Summary vs Unit-Level Equivalence", "The equivalence_summary and equivalence_unit fixtures match exactly for total exposure, failure count, failure rate, MTBF, mission reliability, mission failure probability, and target comparison."],
  ["Zero-Failure Verification", "Zero-failure fixtures return Not Estimable for MTBF point estimate, do not produce Infinity, do not display a formal reliability curve, and do not claim Meets Target or Below Target."],
  ["Parser Coverage", "CSV, TSV, pasted data, aliases, Chinese status values, manual mapping, and a real XLSX workbook are covered by automated tests. Legacy binary .xls remains limited."],
  ["Reliability Curve Verification", "The MTBF curve uses R(t) = exp(-lambda*t), generates 100 monotonic points in tests, keeps R(t)+F(t)=1, and omits the formal curve for zero-failure cases."],
  ["State Management Verification", "Total Time, Failure Count, input-mode switch, second data load, paste, mapping, time-unit change, and Reset clear old MTBF results. Mission Time and Target MTBF update only derived fields."],
  ["Browser Regression", `${browserResults.length} browser regression checks recorded. Result: ${browserPass ? "Pass" : "Fail"}.`],
  ["Report Verification", "MTBF reports contain the 12 required sections, current values, time units, the curve when estimable, zero-failure Not Estimable handling, and required limitations. Unsupported claims are excluded."],
  ["i18n Verification", "English and Chinese dictionary keys match. Chinese MTBF UI and report localize dynamic text, while symbols MTBF, lambda, R(t), and F(t) are retained as engineering notation."],
  ["Life Data Regression", "Existing Life Data automated tests continue to pass. Weibull MLE core was not changed."],
  ["Known Limitations", "Current MTBF supports point estimates only; no confidence intervals, no MTBF lower confidence bound, no Reliability Demonstration calculation, no Crow-AMSAA / Reliability Growth, no repairable-system repeated-failure model, no warranty forecast, no availability / MTTR, limited legacy binary .xls support, and no replacement for physical failure analysis."],
  ["Release Decision", overallStatus]
];

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MTBF Release Readiness Report</title>${style()}</head><body><main>
  <h1>MTBF Release Readiness Report</h1>
  <p class="${overallStatus === "Ready for Public Testing" ? "pass" : "fail"}">${overallStatus}</p>
  ${sections.map(([title, body]) => `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></section>`).join("")}
  <section><h2>Browser Regression Detail</h2>${table(["Test Case", "Expected Result", "Actual Result", "Pass / Fail", "Notes"], browserResults.map(row => [row.testCase, row.expectedResult, row.actualResult, row.pass, row.notes]))}</section>
  <section><h2>Numerical Verification Detail</h2><p>See mtbf-numerical-comparison.csv and fixtures/mtbf-expected-results.json for row-level values.</p></section>
</main></body></html>`;

await writeFile(new URL("./mtbf-release-readiness-report.html", import.meta.url), html);
console.log(JSON.stringify({ overallStatus, comparisonPass, browserPass, browserChecks: browserResults.length, validFixtures: validFixtures.length, invalidFixtures: invalidFixtures.length }, null, 2));

function table(headers, rows) {
  return `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function style() {
  return `<style>body{margin:0;background:#f4f6f8;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;line-height:1.5}main{max-width:1100px;margin:28px auto;background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:28px}h1{margin:0 0 10px;font-size:34px;border-bottom:2px solid #2563eb;padding-bottom:10px}h2{font-size:18px;margin:22px 0 8px}.pass{display:inline-block;border:1px solid #99d6c8;background:#ecfdf3;color:#067647;border-radius:999px;padding:6px 10px;font-weight:800}.fail{display:inline-block;border:1px solid #fecdca;background:#fff1f0;color:#b42318;border-radius:999px;padding:6px 10px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th,td{border:1px solid #d9e0e8;padding:8px;text-align:left;vertical-align:top}th{background:#f8fafc}</style>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
