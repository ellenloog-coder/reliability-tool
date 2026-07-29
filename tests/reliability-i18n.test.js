import test from "node:test";
import assert from "node:assert/strict";
import { dictionary, t } from "../src/reliability/i18n.js";

test("English and Chinese dictionaries have matching keys", () => {
  assert.deepEqual(Object.keys(dictionary.zh).sort(), Object.keys(dictionary.en).sort());
});

test("status labels, chart labels, and report labels are translated", () => {
  for (const key of ["available", "inDevelopment", "comingSoon", "chartFailureProbability", "weibullLine", "reportTitle", "targetComparison"]) {
    assert.notEqual(t("en", key), key);
    assert.notEqual(t("zh", key), key);
    assert.notEqual(t("en", key), t("zh", key));
  }
});
