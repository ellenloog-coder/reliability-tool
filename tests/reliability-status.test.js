import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStatus } from "../src/reliability/status-normalizer.js";

test("status normalization handles supported failure aliases", () => {
  for (const value of ["Fail", "Failed", "Failure", "Event", "1", "Yes", "失效", "故障", "失败"]) {
    assert.equal(normalizeStatus(` ${value} `), "failure");
  }
});

test("status normalization handles supported censored aliases", () => {
  for (const value of ["Censored", "Censor", "Suspended", "Suspend", "Survived", "Right Censored", "0", "No", "截尾", "删失", "未失效", "仍在运行"]) {
    assert.equal(normalizeStatus(` ${value} `), "censored");
  }
});

test("unknown status is not guessed", () => {
  assert.equal(normalizeStatus("Maybe"), null);
});
