import test from "node:test";
import assert from "node:assert/strict";
import { interpretWeibull } from "../src/reliability/insight-engine.js";

test("insight classification uses configured beta bands without risk labels", () => {
  assert.equal(interpretWeibull(0.7).result, "Decreasing failure-rate behavior");
  assert.equal(interpretWeibull(1.0).result, "Approximately constant failure-rate behavior");
  assert.equal(interpretWeibull(1.4).result, "Increasing failure-rate behavior");
  assert(!JSON.stringify(interpretWeibull(1.4)).includes("High Risk"));
});

test("insight output includes the required schema", () => {
  const insight = interpretWeibull(1.4);
  for (const key of [
    "explanationKeys",
    "recommendationKeys",
    "parameters",
    "result",
    "meaning",
    "evidence",
    "possibleConsiderations",
    "limitations",
    "recommendedActions",
    "flags"
  ]) {
    assert(Object.hasOwn(insight, key));
  }
});
