import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeDemonstration,
  analyzeLifeData,
  analyzeMTBF,
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_ENGINE_VERSION,
  RELIABILITY_FIXTURE_VERSION
} from "../src/reliability/engine/index.js";
import { adaptLifeDataFacadeResult } from "../src/reliability/adapters/life-data-ui-adapter.js";
import { adaptMTBFFacadeResult } from "../src/reliability/adapters/mtbf-ui-adapter.js";
import { adaptDemonstrationFacadeResult } from "../src/reliability/adapters/demonstration-ui-adapter.js";
import {
  buildWeibullFittedLine,
  weibullProbabilityPlotSvg
} from "../src/reliability/probability-plot.js";
import { calculateKaplanMeierPositions } from "../src/reliability/plotting-positions.js";
import { curvePoints, reliabilityTableRows } from "../src/reliability/reliability-table.js";
import { reliabilityCurveSvg } from "../src/reliability/reliability-curve.js";
import { mtbfCurvePoints, mtbfReliabilityCurveSvg } from "../src/reliability/mtbf-plotting.js";
import { demonstrationEvidenceChartSvg } from "../src/reliability/demonstration/plotting.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE_ID = "browser-engine-reference-v1-20260730-dirty-53ce11e";
const BASELINE_DIR = join(ROOT, "verification", "baselines", "browser-engine-v1");
const ABSOLUTE_TOLERANCE = 1e-12;
const RELATIVE_TOLERANCE = 1e-10;

const scenarios = readJson("verification/fixtures/reliability-engineering-scenarios-v1.json");
const lifeFixtures = readJson("verification/fixtures/expected-results.json");
const mtbfFixtures = readJson("verification/fixtures/mtbf-fixtures.json");
const demonstrationFixtures = readJson("verification/fixtures/demonstration-fixtures.json");

export function buildBrowserEngineBaseline() {
  return {
    "life-data": moduleSnapshot("life-data", buildLifeDataCases()),
    mtbf: moduleSnapshot("mtbf", buildMTBFCases()),
    demonstration: moduleSnapshot("demonstration", buildDemonstrationCases())
  };
}

export function verifyFrozenBrowserEngineBaseline() {
  const actual = buildBrowserEngineBaseline();
  const manifest = readBaseline("manifest.json");
  const failures = [];
  for (const [module, snapshot] of Object.entries(actual)) {
    const expected = readBaseline(`${module}.json`);
    compareValues(expected, snapshot, module, failures);
    for (const item of snapshot.cases) {
      if (item.valueAudit.nonFiniteNumberPaths.length) {
        failures.push(
          `${module}.${item.id}: non-finite values at ${item.valueAudit.nonFiniteNumberPaths.join(", ")}`
        );
      }
      if (item.valueAudit.undefinedPaths.length) {
        failures.push(
          `${module}.${item.id}: undefined values at ${item.valueAudit.undefinedPaths.join(", ")}`
        );
      }
    }
    const content = readFileSync(join(BASELINE_DIR, `${module}.json`), "utf8");
    if (sha256(content) !== manifest.file_sha256[module]) {
      failures.push(`${module}: frozen file SHA-256 does not match manifest`);
    }
  }
  if (failures.length) {
    throw new Error([
      `Browser Engine baseline mismatch (${failures.length} difference(s)).`,
      ...failures.slice(0, 40),
      failures.length > 40 ? `... ${failures.length - 40} additional difference(s)` : ""
    ].filter(Boolean).join("\n"));
  }
  return {
    baselineId: BASELINE_ID,
    modules: Object.keys(actual),
    cases: Object.fromEntries(
      Object.entries(actual).map(([module, value]) => [module, value.cases.length])
    )
  };
}

export function updateFrozenBrowserEngineBaseline() {
  const snapshots = buildBrowserEngineBaseline();
  mkdirSync(BASELINE_DIR, { recursive: true });
  for (const [module, snapshot] of Object.entries(snapshots)) {
    writeJson(join(BASELINE_DIR, `${module}.json`), snapshot);
  }
  const digests = Object.fromEntries(
    Object.keys(snapshots).map(module => {
      const content = readFileSync(join(BASELINE_DIR, `${module}.json`), "utf8");
      return [module, sha256(content)];
    })
  );
  const manifest = {
    baseline_id: BASELINE_ID,
    baseline_schema_version: "1.0.0",
    captured_at: "2026-07-30T03:36:03Z",
    freeze_completed_at: "2026-07-30T03:46:12Z",
    git: {
      branch: "main",
      commit: "53ce11ea9a1f4632a0fed7fc3b07f7c5104c4c8a",
      upstream: "origin/main",
      ahead: 0,
      behind: 0,
      working_tree_state: "DIRTY",
      note: "The reference was captured from the preserved local working tree; no reset, clean, checkout, commit, or push was performed.",
      modified_files_at_capture: [
        "index.html",
        "src/reliability/app.js",
        "src/reliability/demonstration/plotting.js",
        "src/reliability/i18n.js",
        "src/reliability/mtbf-plotting.js",
        "src/reliability/plotting.js",
        "src/reliability/probability-plot.js",
        "src/reliability/reliability-curve.js",
        "src/reliability/report.js",
        "styles.css",
        "tests/life-data-visualization.test.js",
        "tests/reliability-report.test.js",
        "tests/reliability.test.js"
      ],
      untracked_paths_at_capture: [
        "output/",
        "src/reliability/chart-layout.js",
        "src/reliability/help-content.js",
        "src/reliability/help-drawer.js",
        "tests/help-content-and-drawer.test.js"
      ]
    },
    runtime: {
      package_version: "15.10.0",
      application_start: "python3 -m http.server <port> --bind 127.0.0.1",
      test_command: "npm test",
      tests_at_capture: {
        total: 238,
        passed: 238,
        failed: 0,
        skipped: 0
      },
      tests_after_baseline_verification: {
        total: 241,
        passed: 241,
        failed: 0,
        skipped: 0
      }
    },
    reference: {
      engine_version: RELIABILITY_ENGINE_VERSION,
      contract_version: RELIABILITY_CONTRACT_VERSION,
      fixture_version: RELIABILITY_FIXTURE_VERSION,
      modules: ["life-data", "mtbf", "demonstration"],
      excluded_modules: ["alt"],
      entry_points: {
        "life-data": "src/reliability/engine/life-data-engine.js#analyzeLifeData",
        mtbf: "src/reliability/engine/mtbf-engine.js#analyzeMTBF",
        demonstration: "src/reliability/engine/demonstration-engine.js#analyzeDemonstration"
      }
    },
    comparison_policy: {
      strings_booleans_null_integers: "exact",
      object_keys_and_array_order: "exact",
      reason_code_order: "exact",
      numeric_absolute_tolerance: ABSOLUTE_TOLERANCE,
      numeric_relative_tolerance: RELATIVE_TOLERANCE,
      non_finite_numbers: "forbidden",
      undefined_values: "captured explicitly as {$baselineType:\"undefined\"}; forbidden in authority layers",
      missing_fields: "significant; a missing key is not equivalent to null"
    },
    authority_boundary: {
      authoritative: [
        "input",
        "validation",
        "calculation",
        "decision",
        "insight",
        "assumptions",
        "warnings",
        "chart numeric source data",
        "report consumer payload"
      ],
      compatibility: "Frozen for migration parity but deprecated for new consumers.",
      presentation: "English/Chinese labels, formatted strings, HTML, CSS, and SVG markup are presentation references, not backend authority.",
      localization_rule: "The backend-equivalence target is language-neutral data, statuses, reason codes, and numeric values. EN/CN text is rendered from the same authoritative result."
    },
    input_contracts: inputContracts(),
    output_rules: outputRules(),
    file_sha256: digests
  };
  writeJson(join(BASELINE_DIR, "manifest.json"), manifest);
  return manifest;
}

function buildLifeDataCases() {
  const cases = scenarios.lifeData.map(scenario => {
    const source = fixtureBy(lifeFixtures, "name", scenario.sourceFixture);
    const input = lifeInput(source, scenario.targetReliability);
    return lifeDataCase(scenario.id, scenario.covers, input);
  });
  cases.push(lifeDataCase(
    "life_invalid_empty_data",
    ["invalid", "empty_data", "downstream_nullability"],
    {
      rows: [],
      mapping: { sampleId: "Sample", time: "Time", status: "Status" },
      settings: { timeUnit: "hours", missionTime: 100, targetReliability: 0.9 }
    }
  ));
  return cases;
}

function lifeDataCase(id, covers, input) {
  const facade = analyzeLifeData(input);
  const adapted = adaptLifeDataFacadeResult(facade);
  const chartData = facade.calculation?.status === "COMPLETED"
    ? lifeChartData(facade, input)
    : null;
  const reportConsumer = adapted.ok ? {
    validation: adapted.validation,
    metrics: adapted.state.metrics,
    insight: adapted.state.insight,
    mapping: input.mapping,
    settings: input.settings,
    tables: chartData?.reliabilityTable ?? null,
    plotDigests: chartData?.presentationDigests ?? null,
    curveMode: "reliability"
  } : null;
  return normalizeSnapshot({
    id,
    covers,
    input,
    output: facade,
    chartData,
    reportConsumer,
    valueAudit: auditValues(facade)
  });
}

function lifeChartData(facade, input) {
  const records = facade.validation.records;
  const fit = facade.calculation.parameters;
  const missionTime = facade.calculation.metrics.missionTime;
  const times = records.map(record => record.time);
  const minTime = Math.min(...times) * 0.9;
  const maxTime = Math.max(...times) * 1.1;
  const curveMaxTime = Math.max(...times, missionTime, 1) * 1.12;
  const probabilitySvg = weibullProbabilityPlotSvg(records, fit);
  const reliabilitySvg = reliabilityCurveSvg(records, fit, missionTime, {}, {
    mode: "reliability",
    targetReliability: input.settings.targetReliability
  });
  const failureSvg = reliabilityCurveSvg(records, fit, missionTime, {}, {
    mode: "failure",
    targetReliability: input.settings.targetReliability
  });
  return {
    probability: {
      observed: calculateKaplanMeierPositions(records),
      fitted: buildWeibullFittedLine(fit.beta, fit.eta, [minTime, maxTime], 80)
    },
    reliability: curvePoints(fit.beta, fit.eta, curveMaxTime, "reliability", 120),
    cumulativeFailure: curvePoints(fit.beta, fit.eta, curveMaxTime, "failure", 120),
    reliabilityTable: reliabilityTableRows(
      fit.beta,
      fit.eta,
      records,
      missionTime
    ),
    presentationDigests: {
      probabilitySvgSha256: sha256(probabilitySvg),
      reliabilitySvgSha256: sha256(reliabilitySvg),
      cumulativeFailureSvgSha256: sha256(failureSvg)
    }
  };
}

function buildMTBFCases() {
  const cases = [];
  for (const scenario of scenarios.mtbf) {
    const sourceIds = scenario.sourceFixture
      ? [scenario.sourceFixture]
      : scenario.sourceFixtures;
    for (const sourceId of sourceIds) {
      const suffix = sourceIds.length > 1 ? `__${sourceId}` : "";
      cases.push(mtbfCase(
        `${scenario.id}${suffix}`,
        scenario.covers,
        fixtureBy(mtbfFixtures, "id", sourceId)
      ));
    }
  }
  cases.push(mtbfCase(
    "mtbf_invalid_total_exposure",
    ["invalid", "finite_positive_input", "downstream_nullability"],
    {
      inputMode: "summary",
      timeUnit: "hours",
      totalExposure: 0,
      failureCount: 1,
      missionTime: 100,
      targetMTBF: 1000
    }
  ));
  return cases;
}

function mtbfCase(id, covers, input) {
  const facade = analyzeMTBF(input);
  const adapted = adaptMTBFFacadeResult(facade);
  const legacyResult = facade.compatibility.result;
  const curve = legacyResult ? mtbfCurvePoints(legacyResult, 50) : [];
  const curveSvg = legacyResult ? mtbfReliabilityCurveSvg(legacyResult) : "";
  const reportConsumer = adapted.ok ? {
    inputMode: input.inputMode,
    inputSummary: adapted.inputSummary,
    result: adapted.state.result,
    targetComparison: adapted.state.targetComparison,
    insight: adapted.state.insight,
    mapping: input.mapping || {},
    curveData: curve,
    curveSvgSha256: sha256(curveSvg)
  } : null;
  return normalizeSnapshot({
    id,
    covers,
    input,
    output: facade,
    chartData: {
      reliability: curve,
      presentationDigest: sha256(curveSvg)
    },
    reportConsumer,
    valueAudit: auditValues(facade)
  });
}

function buildDemonstrationCases() {
  const cases = [];
  for (const scenario of scenarios.demonstration) {
    const sourceIds = scenario.sourceFixture
      ? [scenario.sourceFixture]
      : scenario.sourceFixtures;
    for (const sourceId of sourceIds) {
      const source = fixtureBy(demonstrationFixtures, "fixtureId", sourceId);
      const suffix = sourceIds.length > 1 ? `__${sourceId}` : "";
      cases.push(demonstrationCase(
        `${scenario.id}${suffix}`,
        scenario.covers,
        demonstrationInput(source)
      ));
    }
  }
  cases.push(demonstrationCase(
    "demonstration_invalid_missing_target",
    ["invalid", "missing_target", "downstream_nullability"],
    {
      method: "sample",
      workflow: "evaluate",
      targetDefinition: "reliability",
      inputs: {
        targetReliability: "",
        confidenceLevel: 0.9,
        allowableFailures: 0,
        unitsTested: 22,
        observedFailures: 0,
        timeUnit: "hours"
      }
    }
  ));
  return cases;
}

function demonstrationCase(id, covers, input) {
  const facade = analyzeDemonstration(input);
  const adapted = adaptDemonstrationFacadeResult(facade);
  const legacyResult = facade.compatibility.result;
  const chartSvg = legacyResult ? demonstrationEvidenceChartSvg(legacyResult) : "";
  const chartSource = legacyResult ? {
    method: legacyResult.method,
    workflow: legacyResult.workflow,
    requirement: facade.calculation.requirement,
    evidence: facade.calculation.evidence,
    metrics: facade.calculation.metrics,
    evidenceGap: facade.decision.evidenceGap ?? null
  } : null;
  const reportConsumer = adapted.ok ? {
    result: adapted.state.result,
    insight: adapted.state.insight,
    inputs: input.inputs,
    chartSource,
    chartSvgSha256: sha256(chartSvg)
  } : null;
  return normalizeSnapshot({
    id,
    covers,
    input,
    output: facade,
    chartData: {
      source: chartSource,
      presentationDigest: sha256(chartSvg)
    },
    reportConsumer,
    valueAudit: auditValues(facade)
  });
}

function moduleSnapshot(module, cases) {
  return normalizeSnapshot({
    baseline_id: BASELINE_ID,
    module,
    reference_engine_version: RELIABILITY_ENGINE_VERSION,
    contract_version: RELIABILITY_CONTRACT_VERSION,
    fixture_version: RELIABILITY_FIXTURE_VERSION,
    cases
  });
}

function inputContracts() {
  return {
    "life-data": {
      entry_point: "analyzeLifeData(input)",
      required_top_level: ["rows", "mapping"],
      settings: {
        timeUnit: "optional string; current UI supplies hours/cycles/days",
        missionTime: "optional positive finite number; defaults from valid records",
        targetReliability: "optional probability in (0,1); empty means no decision"
      },
      mapping: {
        time: "required mapped column",
        status: "required mapped column",
        sampleId: "optional",
        failureMode: "optional",
        testCondition: "optional"
      },
      supported_statuses: ["failure aliases", "right-censored aliases"]
    },
    mtbf: {
      entry_point: "analyzeMTBF(input)",
      summary: {
        inputMode: "summary or omitted",
        totalExposure: "required positive finite number",
        failureCount: "required non-negative integer",
        missionTime: "required positive finite number",
        targetMTBF: "optional positive finite number",
        timeUnit: "optional string"
      },
      unit: {
        inputMode: "unit",
        rows: "required array",
        mapping: "exposureTime/status required; remaining mappings optional",
        missionTime: "required positive finite number",
        targetMTBF: "optional positive finite number"
      }
    },
    demonstration: {
      entry_point: "analyzeDemonstration(input)",
      method: ["sample", "time"],
      workflow: ["plan", "evaluate"],
      targetDefinition: ["reliability", "mtbf"],
      common_inputs: ["confidenceLevel", "allowableFailures", "timeUnit"],
      sample_plan: ["targetReliability"],
      sample_evaluate: ["targetReliability", "unitsTested", "observedFailures"],
      time_plan: ["targetMTBF or targetReliability+missionTime", "optional numberOfUnits"],
      time_evaluate: ["targetMTBF or targetReliability+missionTime", "totalTestTime", "observedFailures"]
    }
  };
}

function outputRules() {
  return {
    required_top_level: [
      "validation",
      "calculation",
      "decision",
      "insight",
      "compatibility",
      "metadata"
    ],
    invalid_validation: {
      calculation: null,
      decision: null,
      insight: null
    },
    calculation_error: {
      calculation_status: "ERROR",
      error_required: ["code", "message"],
      decision: null,
      insight: null
    },
    finite_rule: "Every numeric value emitted by authority layers must be finite.",
    null_rule: "Null is significant and only accepted where emitted by the frozen fixtures/Contract v1.",
    missing_rule: "Missing, null, zero, empty string, and false are distinct.",
    decision_rule: "Decision status and ordered reasonCodes are exact migration acceptance fields.",
    insight_rule: "explanationKeys, recommendationKeys, limitations, and parameters are frozen structurally.",
    warning_rule: "Warning and assumption strings are frozen because legacy UI/report consumers currently expose them."
  };
}

function lifeInput(source, targetReliability) {
  return {
    rows: source.records.map((record, index) => ({
      Sample: `S${index + 1}`,
      Time: record.time,
      Status: record.status
    })),
    mapping: {
      sampleId: "Sample",
      time: "Time",
      status: "Status"
    },
    settings: {
      timeUnit: "hours",
      missionTime: source.missionTime,
      targetReliability
    }
  };
}

function demonstrationInput(source) {
  return {
    method: source.method,
    workflow: source.workflow,
    targetDefinition: source.inputs.targetDefinition,
    inputs: {
      ...source.inputs,
      timeUnit: source.inputs.timeUnit || "hours"
    }
  };
}

function auditValues(value) {
  const result = {
    nonFiniteNumberPaths: [],
    undefinedPaths: []
  };
  walk(value, "$", result);
  return result;
}

function walk(value, path, result) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) result.nonFiniteNumberPaths.push(path);
    return;
  }
  if (value === undefined) {
    result.undefinedPaths.push(path);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, result));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    walk(item, `${path}.${key}`, result);
  }
}

function normalizeSnapshot(value) {
  if (value === undefined) return { $baselineType: "undefined" };
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { $baselineType: String(value) };
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeSnapshot);
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, normalizeSnapshot(value[key])])
  );
}

function compareValues(expected, actual, path, failures) {
  if (isPresentationReference(path)) return;
  if (typeof expected === "number" && typeof actual === "number") {
    const difference = Math.abs(expected - actual);
    const scale = Math.max(Math.abs(expected), Math.abs(actual), 1);
    if (
      difference > ABSOLUTE_TOLERANCE
      && difference > RELATIVE_TOLERANCE * scale
    ) {
      failures.push(`${path}: expected ${expected}, received ${actual}`);
    }
    return;
  }
  if (
    expected === null
    || actual === null
    || typeof expected !== "object"
    || typeof actual !== "object"
  ) {
    if (!Object.is(expected, actual)) {
      failures.push(`${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
    return;
  }
  const expectedArray = Array.isArray(expected);
  const actualArray = Array.isArray(actual);
  if (expectedArray !== actualArray) {
    failures.push(`${path}: array/object type mismatch`);
    return;
  }
  if (expectedArray) {
    if (expected.length !== actual.length) {
      failures.push(`${path}: expected length ${expected.length}, received ${actual.length}`);
      return;
    }
    expected.forEach((item, index) => {
      compareValues(item, actual[index], `${path}[${index}]`, failures);
    });
    return;
  }
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (expectedKeys.join("\0") !== actualKeys.join("\0")) {
    failures.push(`${path}: keys differ; expected [${expectedKeys}], received [${actualKeys}]`);
    return;
  }
  for (const key of expectedKeys) {
    compareValues(expected[key], actual[key], `${path}.${key}`, failures);
  }
}

function isPresentationReference(path) {
  return (
    path.endsWith(".presentationDigest")
    || path.endsWith(".presentationDigests")
    || /SvgSha256$/.test(path)
  );
}

function fixtureBy(items, key, value) {
  const fixture = items.find(item => item[key] === value);
  if (!fixture) throw new Error(`Missing source fixture: ${value}`);
  return fixture;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

function readBaseline(fileName) {
  return JSON.parse(readFileSync(join(BASELINE_DIR, fileName), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || "--verify";
  if (mode === "--update") {
    const manifest = updateFrozenBrowserEngineBaseline();
    console.log(`Updated ${manifest.baseline_id}`);
  } else if (mode === "--verify") {
    const result = verifyFrozenBrowserEngineBaseline();
    console.log(`Verified ${result.baselineId}: ${JSON.stringify(result.cases)}`);
  } else {
    throw new Error("Usage: node verification/browser-engine-baseline.mjs [--verify|--update]");
  }
}
