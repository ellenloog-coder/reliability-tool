import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  analyzeBackendLifeData
} from "../reliability/life-data/analyze.js";
import {
  compareParity,
  formatParityFailure
} from "./parity-helpers.js";

const reference = JSON.parse(readFileSync(
  new URL(
    "../../verification/baselines/browser-engine-v1/life-data.json",
    import.meta.url
  ),
  "utf8"
));

const parityResults = [];

for (const fixture of reference.cases) {
  test(`Life Data Shadow Parity: ${fixture.id}`, () => {
    const backend = analyzeBackendLifeData(fixture.input, {
      analysisId: `parity-${fixture.id}`,
      createdAt: "2026-07-30T00:00:00.000Z"
    });
    const comparisons = [
      ["validation", fixture.output.validation, backend.validation],
      ["calculation", fixture.output.calculation, backend.calculation],
      ["decision", fixture.output.decision, backend.decision],
      ["reasonCodes", fixture.output.decision?.reasonCodes || [], backend.reason_codes],
      ["insight", fixture.output.insight, backend.insight],
      ["compatibility", fixture.output.compatibility, backend.compatibility],
      ["charts", authorityCharts(fixture.chartData), backend.charts],
      ["report_payload", authorityReport(fixture.reportConsumer), backend.report_payload]
    ];
    const allDifferences = [];
    const allNumericDifferences = [];
    const layerResults = {};
    for (const [layer, expected, actual] of comparisons) {
      const result = compareParity(expected, actual, {
        path: `$.${layer}`
      });
      allDifferences.push(...result.differences);
      allNumericDifferences.push(...result.numericDifferences);
      layerResults[layer] = result.differences.length === 0;
    }
    parityResults.push({
      fixtureId: fixture.id,
      layers: layerResults,
      maximumAbsoluteDifference: Math.max(
        0,
        ...allNumericDifferences.map(item => item.absoluteDifference)
      ),
      maximumRelativeDifference: Math.max(
        0,
        ...allNumericDifferences.map(item => item.relativeDifference)
      )
    });
    assert.equal(
      allDifferences.length,
      0,
      formatParityFailure(fixture.id, allDifferences)
    );
  });
}

test("Life Data Shadow Parity covers exactly the frozen eight fixtures", () => {
  assert.equal(reference.baseline_id, "browser-engine-reference-v1-20260730-dirty-53ce11e");
  assert.equal(reference.cases.length, 8);
  assert.equal(parityResults.length, 8);
  assert(parityResults.every(item =>
    Object.values(item.layers).every(Boolean)
  ));
  assert.equal(
    Math.max(...parityResults.map(item => item.maximumAbsoluteDifference)),
    0
  );
  assert.equal(
    Math.max(...parityResults.map(item => item.maximumRelativeDifference)),
    0
  );
});

function authorityCharts(value) {
  if (!value) return null;
  const copy = structuredClone(value);
  delete copy.presentationDigests;
  return copy;
}

function authorityReport(value) {
  if (!value) return null;
  const copy = structuredClone(value);
  delete copy.plotDigests;
  return copy;
}
