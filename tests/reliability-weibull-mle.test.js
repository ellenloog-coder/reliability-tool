import test from "node:test";
import assert from "node:assert/strict";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { expectedFixtures, relError } from "./helpers.js";

test("Weibull MLE matches independent reference fixtures", () => {
  for (const item of expectedFixtures.filter(entry => entry.expected)) {
    const fit = fitWeibull2PMLE(item.records);
    assert.equal(fit.converged, true, item.name);
    assert(relError(fit.beta, item.expected.beta) < 1e-4, `${item.name} beta`);
    assert(relError(fit.eta, item.expected.eta) < 1e-4, `${item.name} eta`);
  }
});

test("right-censored data changes beta and eta", () => {
  const uncensored = expectedFixtures.find(entry => entry.name === "uncensored_weibull").records;
  const censored = expectedFixtures.find(entry => entry.name === "right_censored_weibull").records;
  const fitA = fitWeibull2PMLE(uncensored);
  const fitB = fitWeibull2PMLE(censored);
  assert(Math.abs(fitA.beta - fitB.beta) > 0.05);
  assert(Math.abs(fitA.eta - fitB.eta) > 100);
});

test("solver rejects no-failure and identical-time records", () => {
  assert.throws(() => fitWeibull2PMLE([{ time: 10, status: "censored" }]), /at least one failure/);
  assert.throws(() => fitWeibull2PMLE([{ time: 10, status: "failure" }, { time: 10, status: "censored" }]), /identical/);
});
