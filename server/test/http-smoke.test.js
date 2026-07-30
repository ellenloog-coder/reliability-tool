import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { withServer, postJson } from "./helpers.js";

const reference = JSON.parse(readFileSync(
  new URL(
    "../../verification/baselines/browser-engine-v1/life-data.json",
    import.meta.url
  ),
  "utf8"
));

test("HTTP smoke: a real local server returns Life Data analysis and no unrelated API success", async () => {
  const input = reference.cases.find(item =>
    item.id === "life_right_censored"
  ).input;
  await withServer({}, async baseUrl => {
    const analysis = await postJson(baseUrl, input);
    assert.equal(analysis.response.status, 200);
    assert.equal(analysis.body.metadata.module, "life-data");
    assert.equal(analysis.body.validation.counts.censored, 3);

    for (const path of [
      "/api/reliability/mtbf/analyze",
      "/api/reliability/demonstration/analyze",
      "/api/reliability/alt/analyze"
    ]) {
      const response = await postJson(baseUrl, {}, { path });
      assert.equal(response.response.status, 404);
      assert.equal(response.body.error.code, "NOT_FOUND");
    }
  });
});
