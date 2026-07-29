import test from "node:test";
import assert from "node:assert/strict";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { bxLife, compareReliabilityTarget, failureProbabilityAt, reliabilityAt, weibullMetrics } from "../src/reliability/metrics.js";
import { expectedFixtures, fixture, relError } from "./helpers.js";

test("B-life and mission metrics match independent reference fixtures", () => {
  for (const item of expectedFixtures.filter(entry => entry.expected)) {
    const fit = fitWeibull2PMLE(item.records);
    const metrics = weibullMetrics(fit, item.records, item.missionTime);
    for (const key of ["b1", "b5", "b10", "b50"]) {
      assert(relError(metrics[key], item.expected[key]) < 1e-4, `${item.name} ${key}`);
    }
    assert(Math.abs(metrics.missionReliability - item.expected.missionReliability) < 1e-6, item.name);
    assert(Math.abs(metrics.missionFailureProbability - item.expected.missionFailureProbability) < 1e-6, item.name);
  }
});

test("R(t) and F(t) are complements", () => {
  const beta = 1.5;
  const eta = 800;
  assert(Math.abs(reliabilityAt(400, beta, eta) + failureProbabilityAt(400, beta, eta) - 1) < 1e-12);
  assert(bxLife(0.01, beta, eta) < bxLife(0.05, beta, eta));
  assert(bxLife(0.05, beta, eta) < bxLife(0.10, beta, eta));
  assert(bxLife(0.10, beta, eta) < bxLife(0.50, beta, eta));
});

test("mission time update changes R/F but not fitted B-lives", () => {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  const a = weibullMetrics(fit, item.records, 500);
  const b = weibullMetrics(fit, item.records, 900);
  assert.notEqual(a.missionReliability, b.missionReliability);
  assert.equal(a.b10, b.b10);
  assert.equal(a.b50, b.b50);
});

test("target comparison returns only allowed statuses", () => {
  assert.equal(compareReliabilityTarget(0.95, "").status, "Target not provided");
  assert.equal(compareReliabilityTarget(0.95, 0.9).status, "Meets Target");
  assert.equal(compareReliabilityTarget(0.85, 0.9).status, "Below Target");
});
