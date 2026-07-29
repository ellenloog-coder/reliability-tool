import test from "node:test";
import assert from "node:assert/strict";
import { fitWeibull2PMLE } from "../src/reliability/weibull-mle.js";
import { reliabilityAt } from "../src/reliability/metrics.js";
import { kaplanMeierPoints, reliabilityCurveSvg, weibullProbabilityPlotSvg } from "../src/reliability/plotting.js";
import { fixture } from "./helpers.js";

test("Kaplan-Meier plotting positions separate failures and censored records", () => {
  const item = fixture("right_censored_weibull");
  const km = kaplanMeierPoints(item.records);
  assert.equal(km.failurePoints.length, 6);
  assert.equal(km.censoredPoints.length, 3);
  assert(km.failurePoints.every(point => point.failureProbability > 0 && point.failureProbability < 1));
});

test("Weibull probability plot contains failure, censored, and fitted-line legend", () => {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  const svg = weibullProbabilityPlotSvg(item.records, fit);
  assert(svg.includes("Fitted Weibull line"));
  assert(svg.includes("Failure"));
  assert(svg.includes("Censored"));
});

test("Reliability curve is monotonic and has mission marker tooltip", () => {
  const item = fixture("right_censored_weibull");
  const fit = fitWeibull2PMLE(item.records);
  const values = [0, 100, 500, 900, 1400].map(time => reliabilityAt(time, fit.beta, fit.eta));
  for (let i = 1; i < values.length; i += 1) assert(values[i] <= values[i - 1]);
  const svg = reliabilityCurveSvg(item.records, fit, item.missionTime);
  assert(svg.includes(`R(${item.missionTime})`));
});
