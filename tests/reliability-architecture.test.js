import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const reliabilityRoot = new URL("../src/reliability/", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, reliabilityRoot), "utf8");
}

async function directorySources(relativePath) {
  const directory = new URL(relativePath, reliabilityRoot);
  const names = (await readdir(directory)).filter(name => name.endsWith(".js"));
  return Promise.all(names.map(async name => ({
    name,
    text: await readFile(new URL(name, directory), "utf8")
  })));
}

test("app.js uses Facades and does not invoke core analysis or Decision rules", async () => {
  const app = await source("app.js");
  for (const facade of [
    "analyzeLifeData",
    "analyzeMTBF",
    "analyzeDemonstration"
  ]) {
    assert.match(app, new RegExp(`\\b${facade}\\(`), facade);
  }
  for (const forbiddenImport of [
    /from\s+["'][^"']*\/decision\//,
    /from\s+["'][^"']*weibull-mle\.js["']/,
    /from\s+["'][^"']*sample-demonstration\.js["']/,
    /from\s+["'][^"']*time-demonstration\.js["']/
  ]) {
    assert.doesNotMatch(app, forbiddenImport);
  }
  for (const forbiddenCall of [
    "fitWeibull2PMLE(",
    "weibullMetrics(",
    "analyzeExponentialMTBF(",
    "evaluateReliabilityTarget(",
    "evaluateMTBFTarget(",
    "evaluateDemonstrationDecision(",
    "planBinomialDemonstration(",
    "evaluateBinomialDemonstration(",
    "planExponentialDemonstration(",
    "evaluateExponentialDemonstration("
  ]) {
    assert.equal(app.includes(forbiddenCall), false, forbiddenCall);
  }
});

test("UI adapters contain mapping and formatting but no calculation dependencies", async () => {
  const adapters = await directorySources("adapters/");
  assert.deepEqual(
    adapters.map(item => item.name).sort(),
    [
      "demonstration-ui-adapter.js",
      "life-data-ui-adapter.js",
      "mtbf-ui-adapter.js"
    ]
  );
  for (const adapter of adapters) {
    for (const forbiddenImport of [
      /from\s+["'][^"']*\/engine\//,
      /from\s+["'][^"']*\/decision\//,
      /from\s+["'][^"']*weibull-mle\.js["']/,
      /from\s+["'][^"']*metrics\.js["']/,
      /from\s+["'][^"']*mtbf\.js["']/,
      /from\s+["'][^"']*(sample|time)-demonstration\.js["']/
    ]) {
      assert.doesNotMatch(adapter.text, forbiddenImport, adapter.name);
    }
    for (const forbiddenFormula of [
      "Math.exp(",
      "Math.log(",
      "Math.pow(",
      "fitWeibull",
      "evaluateReliabilityTarget(",
      "evaluateMTBFTarget(",
      "evaluateDemonstrationDecision("
    ]) {
      assert.equal(
        adapter.text.includes(forbiddenFormula),
        false,
        `${adapter.name}: ${forbiddenFormula}`
      );
    }
  }
});

test("Decision modules have no UI, Adapter, Insight, report, or plotting dependency", async () => {
  const decisions = await directorySources("decision/");
  for (const decision of decisions) {
    for (const forbiddenDependency of [
      /from\s+["'][^"']*app\.js["']/,
      /from\s+["'][^"']*adapters\//,
      /from\s+["'][^"']*i18n\.js["']/,
      /from\s+["'][^"']*insight/,
      /from\s+["'][^"']*report/,
      /from\s+["'][^"']*plot/
    ]) {
      assert.doesNotMatch(
        decision.text,
        forbiddenDependency,
        decision.name
      );
    }
    assert.equal(decision.text.includes("document."), false, decision.name);
    assert.equal(decision.text.includes("window."), false, decision.name);
  }
});

test("legacy Decision, compatibility, and Insight paths are explicitly marked", async () => {
  const paths = [
    "decision/decision-result.js",
    "decision/reliability-rule.js",
    "decision/mtbf-rule.js",
    "decision/demonstration-rule.js",
    "metrics.js",
    "mtbf.js",
    "insight-engine.js",
    "mtbf-insight.js",
    "demonstration/insight.js",
    "engine/life-data-engine.js",
    "engine/mtbf-engine.js",
    "engine/demonstration-engine.js"
  ];
  for (const path of paths) {
    assert.match(
      await source(path),
      /@deprecated RELIABILITY_LEGACY_BOUNDARY/,
      path
    );
  }
});

test("Reliability Engine Contract documents the fixed layer sequence", async () => {
  const contract = await readFile(
    new URL("../docs/reliability-engine-contract.md", import.meta.url),
    "utf8"
  );
  assert.match(
    contract,
    /Validation\s+↓\s+Calculation\s+↓\s+Decision\s+↓\s+Insight\s+↓\s+UI Adapter\s+↓\s+UI State/
  );
  assert.match(contract, /RELIABILITY_LEGACY_BOUNDARY/);
  assert.match(contract, /No legacy field may be removed/);
});
