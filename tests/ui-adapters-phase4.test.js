import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF
} from "../src/reliability/engine/index.js";
import {
  adaptLifeDataFacadeResult,
  lifeDataKpiRows
} from "../src/reliability/adapters/life-data-ui-adapter.js";
import {
  adaptMTBFFacadeResult,
  mtbfExposureRows,
  mtbfKpiRows,
  mtbfTargetRows
} from "../src/reliability/adapters/mtbf-ui-adapter.js";
import {
  adaptDemonstrationFacadeResult,
  demonstrationGapRows,
  demonstrationKpiRows
} from "../src/reliability/adapters/demonstration-ui-adapter.js";

const commonView = {
  ui: key => key,
  fmt: value => String(value),
  pct: value => `${(Number(value) * 100).toFixed(2)}%`,
  unitLabel: unit => unit
};

test("Life Data UI adapter maps facade compatibility and KPI rows", () => {
  const facade = analyzeLifeData({
    rows: [
      { Sample: "S1", Time: 100, Status: "failure" },
      { Sample: "S2", Time: 180, Status: "failure" },
      { Sample: "S3", Time: 240, Status: "failure" },
      { Sample: "S4", Time: 320, Status: "censored" },
      { Sample: "S5", Time: 410, Status: "failure" }
    ],
    mapping: {
      sampleId: "Sample",
      time: "Time",
      status: "Status"
    },
    settings: {
      timeUnit: "hours",
      missionTime: 200,
      targetReliability: 0.8
    }
  });
  const adapted = adaptLifeDataFacadeResult(facade);
  const rows = lifeDataKpiRows(adapted.state.metrics, "hours", commonView);

  assert.equal(adapted.ok, true);
  assert.equal(adapted.state.fit.beta, facade.calculation.parameters.beta);
  assert.equal(adapted.state.metrics.targetComparison.status, "Below Target");
  assert.equal(adapted.page.records.length, 5);
  assert.equal(rows[0][1], "Weibull 2P");
  assert.equal(rows.some(([label]) => label === "B10"), true);
});

test("MTBF UI adapter maps result, exposure, KPI, and target models", () => {
  const facade = analyzeMTBF({
    inputMode: "unit",
    rows: [
      { unitId: "A", exposureTime: 4000, status: "failure" },
      { unitId: "B", exposureTime: 6000, status: "censored" }
    ],
    missionTime: 100,
    targetMTBF: 8000,
    timeUnit: "hours"
  });
  const adapted = adaptMTBFFacadeResult(facade);
  const view = {
    ...commonView,
    formatRate: value => String(value),
    failureRateUnitLabel: unit => `per-${unit}`,
    localizeStatus: status => status,
    localizeMessage: message => message
  };
  const kpis = mtbfKpiRows(adapted.state.result, "hours", view);
  const exposure = mtbfExposureRows(adapted.inputSummary, "unit", view);
  const target = mtbfTargetRows({
    targetComparison: adapted.state.targetComparison,
    targetMTBF: 8000,
    timeUnit: "hours"
  }, view);

  assert.equal(adapted.ok, true);
  assert.equal(adapted.state.result.totalUnits, 2);
  assert.equal(adapted.state.result.censoredCount, 1);
  assert.equal(kpis[0][1], "10000 hours");
  assert.equal(exposure[0][1], "unitLevelData");
  assert.equal(target.warning, false);
  assert.equal(target.rows[1][1], "Meets Target");
});

test("Demonstration UI adapter maps legacy result and workflow KPI rows", () => {
  const facade = analyzeDemonstration({
    method: "sample",
    workflow: "plan",
    inputs: {
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      allowableFailures: 0,
      missionTime: "",
      timeUnit: "hours"
    }
  });
  const adapted = adaptDemonstrationFacadeResult(facade);
  const rows = demonstrationKpiRows({
    result: adapted.state.result,
    method: "sample",
    workflow: "plan",
    inputs: {
      confidenceLevel: 0.9,
      timeUnit: "hours"
    }
  }, {
    ...commonView,
    displayPercent: value => `${value}`,
    normalizePercentInput: Number,
    methodLabel: () => "sample",
    workflowLabel: () => "plan",
    demonstratedLabel: value => String(value),
    acceptanceRule: result => result.acceptanceRule
  });

  assert.equal(adapted.ok, true);
  assert.equal(adapted.state.result.requiredSampleSize, 22);
  assert.equal(rows[0][0], "requiredSampleSize");
  assert.equal(rows[0][1], 22);
});

test("Demonstration gap adapter preserves evaluate evidence fields", () => {
  const facade = analyzeDemonstration({
    method: "sample",
    workflow: "evaluate",
    inputs: {
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      unitsTested: 10,
      observedFailures: 0,
      allowableFailures: 0,
      missionTime: "",
      timeUnit: "hours"
    }
  });
  const adapted = adaptDemonstrationFacadeResult(facade);
  const rows = demonstrationGapRows(
    adapted.state.result,
    "hours",
    {
      ...commonView,
      localizeRuntimeText: text => text
    }
  );

  assert.equal(rows[0][0], "additionalUnitsRequired");
  assert.equal(rows[0][1], 12);
  assert.match(rows[1][1], /no additional failures/i);
});

test("UI adapters expose invalid facade validation without legacy mapping", () => {
  const life = adaptLifeDataFacadeResult(analyzeLifeData({
    rows: [],
    mapping: { time: "Time", status: "Status" },
    settings: { timeUnit: "hours" }
  }));
  const mtbf = adaptMTBFFacadeResult(analyzeMTBF({
    inputMode: "summary",
    totalExposure: 0,
    failureCount: 0,
    missionTime: 100,
    targetMTBF: "",
    timeUnit: "hours"
  }));
  const demonstration = adaptDemonstrationFacadeResult(analyzeDemonstration({
    method: "sample",
    workflow: "evaluate",
    inputs: {
      targetReliability: 0.9,
      confidenceLevel: 0.9,
      unitsTested: 0,
      observedFailures: 0
    }
  }));

  for (const adapted of [life, mtbf, demonstration]) {
    assert.equal(adapted.ok, false);
    assert.equal(adapted.state, null);
  }
});
