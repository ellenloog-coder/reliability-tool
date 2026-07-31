import { parseDelimitedText, parseFile } from "./parser.js";
import { detectColumns, validateRows } from "./validation.js";
import { defaultMissionTime } from "./metrics.js";
import { summarizeUnitExposure } from "./mtbf.js";
import { detectMTBFColumns, validateMTBFSummaryInput, validateMTBFUnitRows } from "./mtbf-validation.js";
import { buildMTBFInsight } from "./mtbf-insight.js";
import { mtbfReliabilityCurveSvg } from "./mtbf-plotting.js";
import { buildMTBFReportHtml } from "./mtbf-report.js";
import {
  weibullProbabilityPlotFromDataSvg
} from "./probability-plot.js";
import {
  reliabilityCurveFromDataSvg
} from "./reliability-curve.js";
import { RESULT_CHART_SIZE } from "./chart-layout.js";
import { buildReportHtml, downloadHtml, printReport } from "./report.js";
import { t } from "./i18n.js";
import { invalidateAnalysisState, loadDataState, resetLifeDataState } from "./state.js";
import { createMTBFState, invalidateMTBFResult, loadMTBFUnitDataState, resetMTBFState } from "./mtbf-state.js";
import { createDemoState, invalidateDemoResult, resetDemoState } from "./demonstration/state.js";
import { validateDemoInputs, normalizePercentInput } from "./demonstration/validation.js";
import { buildDemoInsight } from "./demonstration/insight.js";
import { demonstrationEvidenceChartSvg } from "./demonstration/plotting.js";
import { buildDemoReportHtml } from "./demonstration/report.js";
import {
  analyzeDemonstration,
  analyzeMTBF,
  previewDemonstrationTarget
} from "./engine/index.js";
import {
  adaptLifeDataFacadeResult,
  lifeDataKpiRows
} from "./adapters/life-data-ui-adapter.js";
import {
  adaptMTBFFacadeResult,
  mtbfExposureRows,
  mtbfKpiRows,
  mtbfTargetRows
} from "./adapters/mtbf-ui-adapter.js";
import {
  adaptDemonstrationFacadeResult,
  demonstrationGapRows,
  demonstrationKpiRows
} from "./adapters/demonstration-ui-adapter.js";
import { createHelpDrawer } from "./help-drawer.js";
import {
  lifeDataBackendEnabled,
  resolveLifeDataAuthorityConfig
} from "./backend-authority-config.js";
import {
  createLifeDataAuthorityController,
  LifeDataAuthorityError
} from "./life-data-authority.js";

const templateHeaders = ["Sample ID", "Time", "Status", "Failure Mode", "Test Condition"];
const exampleText = `Sample ID,Time,Status,Failure Mode,Test Condition
S001,320,Failure,Seal crack,85C life test
S002,540,Failure,Seal crack,85C life test
S003,760,Censored,,85C life test
S004,810,Failure,Capacity loss,85C life test
S005,1000,Censored,,85C life test
S006,1140,Failure,Connector fatigue,85C life test
S007,1200,Censored,,85C life test
S008,1275,Failure,Capacity loss,85C life test
S009,1400,Censored,,85C life test
S010,1500,Censored,,85C life test
S011,1660,Failure,Capacity loss,85C life test
S012,1800,Censored,,85C life test
S013,1960,Failure,Seal crack,85C life test
S014,2100,Censored,,85C life test
S015,2250,Censored,,85C life test`;

const mtbfTemplateHeaders = ["Unit ID", "Exposure Time", "Status", "Failure Mode", "Test Condition", "Notes"];
const mtbfExampleText = `Unit ID,Exposure Time,Status,Failure Mode,Test Condition,Notes
U001,820,Failure,Power module,Field return,Observed shutdown
U002,1000,Censored,,Field return,Still operating
U003,960,Operating,,Field return,No Failure
U004,740,Breakdown,Fan assembly,Chamber run,Corrective action opened
U005,1200,No Failure,,Chamber run,正常运行
U006,690,Failure,Connector,Field return,Intermittent
U007,1100,Censored,,Chamber run,
U008,980,正常运行,,Chamber run,
U009,530,Breakdown,Seal,Field return,
U010,1250,Operating,,Chamber run,`;

const state = {
  lang: localStorage.getItem("reliability.ui.lang") || "en",
  mode: "life",
  headers: [],
  rows: [],
  sourceName: "",
  sourceKey: "",
  mapping: {},
  validation: null,
  fit: null,
  metrics: null,
  mtbf: null,
  insight: null,
  plots: null,
  reportHtml: null,
  tables: null,
  curveMode: "reliability",
  customPercentile: "",
  customTime: "",
  authoritySnapshot: null,
  authorityStatus: "idle",
  authorityError: null
};

const mtbfState = createMTBFState();
const demoState = createDemoState();
const lifeDataAuthorityConfig =
  resolveLifeDataAuthorityConfig();
const lifeDataAuthority = createLifeDataAuthorityController({
  config: lifeDataAuthorityConfig
});
let helpDrawer = null;
let lifeDataUiRevision = 0;
const resultTabs = ["overview", "weibull", "weibull-plot", "curve", "b-life", "reliability-table", "statistics", "data"];
let activeResultTab = "overview";
let isSidebarCollapsed = false;
const moduleDashboardState = {
  mtbf: { collapsed: false, activeTab: "overview" },
  demo: { collapsed: false, activeTab: "overview" },
  alt: { collapsed: true, activeTab: "overview" }
};

const $ = id => document.getElementById(id);
const ui = key => t(state.lang, key);

window.getReliabilityCopilotSummary = function getReliabilityCopilotSummary() {
  const zh = state.lang === "zh";
  const metrics = {};
  const add = (zhKey, enKey, value) => {
    if (value !== null && value !== undefined && String(value).trim() && String(value).trim() !== "-") {
      metrics[zh ? zhKey : enKey] = String(value).trim().slice(0, 160);
    }
  };
  let hasResults = false;
  let interpretation = "";

  add("当前模块", "current module", state.mode);
  if (state.mode === "life") {
    hasResults = Boolean(state.metrics);
    add("有效记录数", "valid record count", state.validation?.totalCount);
    add("失效数", "failure count", state.validation?.failureCount);
    add("删失数", "censored count", state.validation?.censoredCount);
    add("Weibull β", "Weibull beta", state.metrics?.beta);
    add("Weibull η", "Weibull eta", state.metrics?.eta);
    add("B10 寿命", "B10 life", state.metrics?.b10);
    add("任务时间", "mission time", state.metrics?.missionTime);
    add("任务可靠度", "mission reliability", state.metrics?.missionReliability);
    add("目标比较", "target comparison", state.metrics?.targetComparison?.status);
    interpretation = state.metrics
      ? `${zh ? "页面已完成 Weibull 2P 分析，参数和目标比较必须以页面计算为准。" : "The page has completed Weibull 2P analysis; its parameters and target comparison remain authoritative."} ${state.metrics.targetComparison?.message || ""}`
      : (zh ? "页面尚未完成寿命数据分析。" : "Life-data analysis has not been completed on the page.");
  } else if (state.mode === "mtbf") {
    hasResults = Boolean(mtbfState.result);
    add("输入方式", "input mode", mtbfState.inputMode);
    add("总暴露时间", "total exposure", mtbfState.result?.totalExposure);
    add("失效数", "failure count", mtbfState.result?.failureCount);
    add("MTBF", "MTBF", mtbfState.result?.mtbf);
    add("失效率", "failure rate", mtbfState.result?.failureRate);
    add("任务时间", "mission time", mtbfState.result?.missionTime);
    add("任务可靠度", "mission reliability", mtbfState.result?.missionReliability);
    add("目标比较", "target comparison", mtbfState.targetComparison?.status);
    interpretation = mtbfState.result
      ? `${zh ? "页面已按恒定失效率假设完成 MTBF 分析；MTBF 不等同于单件寿命。" : "The page has completed MTBF analysis under a constant-failure-rate assumption; MTBF is not individual product life."} ${mtbfState.targetComparison?.message || ""}`
      : (zh ? "页面尚未完成 MTBF 分析。" : "MTBF analysis has not been completed on the page.");
  } else if (state.mode === "demo") {
    hasResults = Boolean(demoState.result);
    add("验证方法", "demonstration method", demoState.method);
    add("工作流", "workflow", demoState.workflow);
    add("目标可靠度", "target reliability", demoState.result?.targetReliability);
    add("置信水平", "confidence level", demoState.result?.confidenceLevel || demoState.result?.requiredConfidence);
    add("允许失效数", "allowable failures", demoState.result?.allowableFailures);
    add("所需样本量", "required sample size", demoState.result?.requiredSampleSize);
    add("所需总试验时间", "required total test time", demoState.result?.requiredTotalTestTime);
    add("验证结论", "demonstration result", demoState.result?.demonstrated);
    add("证据缺口", "evidence gap", demoState.result?.evidenceGap?.additionalUnitsRequired ?? demoState.result?.evidenceGap?.additionalTotalTestTimeRequired);
    interpretation = demoState.result
      ? (zh ? "页面已完成可靠性验证计划或证据评估；正式资格判定仍需依据适用要求和试验证据。" : "The page has completed a reliability-demonstration plan or evidence evaluation; formal qualification still depends on applicable requirements and test evidence.")
      : (zh ? "页面尚未完成可靠性验证计算。" : "Reliability-demonstration calculation has not been completed on the page.");
  } else {
    interpretation = zh ? "当前模块没有可供解释的计算结果。" : "The current module has no calculated result to interpret.";
  }

  return {
    current_tool: "reliability_analysis",
    analysis_type: state.mode,
    available_context: ["analysis module", "validation counts", "calculated reliability metrics", "target comparison", "model boundary"],
    summary_metrics: metrics,
    deterministic_interpretation: interpretation.slice(0, 1800),
    has_results: hasResults
  };
};

function init() {
  applyLanguage();
  bindEvents();
  renderMapping();
  renderValidation();
  renderPreview();
  renderEmptyResults();
  renderMtbfPanel();
  renderDemoPanel();
  renderAltPanel();
  setResultTab(activeResultTab);
  setSidebarCollapsed(isSidebarCollapsed);
  helpDrawer = createHelpDrawer({
    lang: state.lang,
    onOpenChange: ({ open, panel }) => {
      $("userManualButton").classList.toggle("active", open && panel === "manual");
      $("faqButton").classList.toggle("active", open && panel === "faq");
    }
  });
}

function bindEvents() {
  $("fileInput").addEventListener("change", handleFile);
  $("pasteInput").addEventListener("input", handlePaste);
  $("loadExampleButton").addEventListener("click", loadExample);
  $("downloadCsvButton").addEventListener("click", () => downloadText("reliability-template.csv", `${templateHeaders.join(",")}\nS001,100,Failure,,\nS002,200,Censored,,`));
  $("downloadXlsxButton").addEventListener("click", () => downloadXlsxTemplate());
  $("runButton").addEventListener("click", runAnalysis);
  $("resetButton").addEventListener("click", reset);
  $("sidebarToggle").addEventListener("click", () => setSidebarCollapsed(!isSidebarCollapsed));
  $("missionTime").addEventListener("input", updateMissionOnly);
  $("targetReliability").addEventListener("input", updateMissionOnly);
  $("timeUnit").addEventListener("change", async () => {
    updateValidation();
    if (state.authoritySnapshot || lifeDataAuthority.current()) {
      await requestLifeDataAuthoritySnapshot();
    }
  });
  $("customPercentile").addEventListener("input", updateCustomPercentile);
  $("customTime").addEventListener("input", updateCustomTime);
  $("exportHtmlButton").addEventListener("click", () => state.reportHtml && downloadHtml(state.reportHtml));
  $("exportPdfButton").addEventListener("click", () => state.reportHtml && printReport(state.reportHtml));
  $("printButton").addEventListener("click", () => state.reportHtml && printReport(state.reportHtml));
  $("languageSelect").addEventListener("change", event => setLanguage(event.target.value));
  $("userManualButton").addEventListener("click", () => helpDrawer?.open("manual", $("userManualButton")));
  $("faqButton").addEventListener("click", () => helpDrawer?.open("faq", $("faqButton")));
  $("analysisToolsButton").addEventListener("click", () => {
    setAnalysisToolsOpen($("analysisToolsButton").getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("click", event => {
    if (!$("analysisTools").contains(event.target)) setAnalysisToolsOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || $("analysisToolsButton").getAttribute("aria-expanded") !== "true") return;
    setAnalysisToolsOpen(false);
    $("analysisToolsButton").focus();
  });
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelectorAll("[data-result-tab-target]").forEach(button => {
    button.addEventListener("click", () => setResultTab(button.dataset.resultTabTarget));
    button.addEventListener("keydown", handleResultTabKeydown);
  });
}

function setAnalysisToolsOpen(open) {
  $("analysisToolsButton").setAttribute("aria-expanded", String(open));
  $("analysisToolsMenu").hidden = !open;
}

async function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseFile(file);
    loadParsedData(parsed, file.name, "");
  } catch (error) {
    renderMessage("dataCheck", error.message, "error");
  }
}

function handlePaste() {
  const text = $("pasteInput").value;
  if (!text.trim()) return;
  try {
    loadParsedData(parseDelimitedText(text), ui("pastedData"), "pastedData");
  } catch (error) {
    renderMessage("dataCheck", error.message, "error");
  }
}

function loadExample() {
  $("pasteInput").value = exampleText;
  loadParsedData(parseDelimitedText(exampleText), ui("exampleLifeData"), "exampleLifeData");
}

function loadParsedData(parsed, sourceName, sourceKey = "") {
  lifeDataAuthority.cancel("input-changed");
  clearLifeDataAuthorityResult();
  loadDataState(state, {
    headers: parsed.headers,
    rows: parsed.rows,
    sourceName,
    sourceKey,
    mapping: detectColumns(parsed.headers)
  });
  renderMapping();
  updateValidation();
  renderPreview();
  renderEmptyResults();
  updateSteps(2);
}

function renderMapping() {
  const fields = [
    ["time", ui("timeColumn")],
    ["status", ui("statusColumn")],
    ["sampleId", ui("sampleId")],
    ["failureMode", ui("failureMode")],
    ["testCondition", ui("testCondition")]
  ];
  $("mappingGrid").innerHTML = fields.map(([key, label]) => `<div class="field"><label for="map-${key}">${label}</label><select id="map-${key}">${selectOptions(state.headers, state.mapping[key])}</select></div>`).join("");
  fields.forEach(([key]) => $(`map-${key}`).addEventListener("change", event => {
    lifeDataAuthority.cancel("input-changed");
    state.mapping[key] = event.target.value;
    invalidateAnalysisState(state);
    clearLifeDataAuthorityResult();
    updateValidation();
    renderPreview();
    renderEmptyResults();
    renderMtbfPanel();
  }));
  $("sourceName").textContent = state.sourceKey ? ui(state.sourceKey) : (state.sourceName || ui("noDataLoaded"));
  $("sourceMeta").textContent = `${state.rows.length} ${ui("samples")} · ${state.headers.length} ${ui("columns")}`;
  $("readyState").textContent = state.rows.length ? ui("ready") : ui("waiting");
}

function selectOptions(headers, selected) {
  return `<option value="">${ui("notMapped")}</option>${headers.map(header => `<option value="${escapeHtml(header)}" ${header === selected ? "selected" : ""}>${escapeHtml(header)}</option>`).join("")}`;
}

function updateValidation() {
  if (!state.rows.length || !state.mapping.time || !state.mapping.status) {
    state.validation = null;
    renderValidation();
    updateRunState();
    return;
  }
  state.validation = validateRows(state.rows, state.mapping, { timeUnit: $("timeUnit").value });
  if (state.validation.records.length && !$("missionTime").value) $("missionTime").value = round(defaultMissionTime(state.validation.records), 4);
  renderValidation();
  updateRunState();
}

function renderValidation() {
  const check = $("dataCheck");
  if (!state.rows.length) {
    check.innerHTML = `<div class="info-item"><b>${escapeHtml(ui("noDataLoaded"))}</b><span>${escapeHtml(ui("uploadPasteExample"))}</span></div>`;
    return;
  }
  if (!state.mapping.time || !state.mapping.status) {
    check.innerHTML = `<div class="info-item warn"><b>${escapeHtml(ui("mappingRequired"))}</b><span>${escapeHtml(ui("selectTimeStatus"))}</span></div>`;
    return;
  }
  const v = state.validation;
  const items = [
    [`${v.totalCount} ${ui("validRecords")}`, `${v.invalidTimeCount} ${ui("invalidTimeValues")} · ${v.emptyRows} ${ui("emptyRows")}`],
    [`${v.failureCount} ${ui("failures")} / ${v.censoredCount} ${ui("censored")}`, v.censoredCount ? ui("rightCensoredDetected") : ui("noRightCensored")],
    [ui("recommendedMethod"), v.failureCount ? "Weibull 2P" : "MTBF / Demonstration"]
  ];
  check.innerHTML = items.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("")
    + v.errors.slice(0, 5).map(error => `<div class="info-item error"><b>${escapeHtml(ui("error"))}</b><span>${escapeHtml(localizeRuntimeText(error))}</span></div>`).join("")
    + v.warnings.slice(0, 5).map(warning => `<div class="info-item warn"><b>${escapeHtml(ui("notice"))}</b><span>${escapeHtml(localizeRuntimeText(warning))}</span></div>`).join("");
}

async function runAnalysis() {
  updateValidation();
  if (!state.validation || state.validation.errors.length) return;
  await requestLifeDataAuthoritySnapshot({
    collapseOnSuccess: true
  });
}

async function updateMissionOnly() {
  if (!state.validation
    || (!state.authoritySnapshot
      && !lifeDataAuthority.current())) return;
  await requestLifeDataAuthoritySnapshot();
}

function lifeDataEngineInput() {
  return {
    rows: state.rows,
    mapping: state.mapping,
    settings: {
      timeUnit: $("timeUnit").value,
      missionTime: $("missionTime").value,
      targetReliability: $("targetReliability").value
    },
    presentation: {
      productName: $("productName").value,
      lang: state.lang,
      customPercentile: state.customPercentile,
      customTime: state.customTime
    }
  };
}

async function requestLifeDataAuthoritySnapshot({
  collapseOnSuccess = false
} = {}) {
  if (!lifeDataBackendEnabled(lifeDataAuthorityConfig)) {
    handleLifeDataAuthorityError(new LifeDataAuthorityError(
      "BACKEND_AUTHORITY_DISABLED",
      ui("backendAuthorityDisabled"),
      { kind: "configuration" }
    ));
    return false;
  }
  const input = lifeDataEngineInput();
  const uiRevision = ++lifeDataUiRevision;
  clearLifeDataAuthorityResult();
  renderEmptyResults(ui("analyzing"));
  setLifeDataLoading(true);
  try {
    const result = await lifeDataAuthority.analyze(input);
    if (result.validationFailure) {
      applyInvalidLifeDataSnapshot(result.snapshot);
      return false;
    }
    if (!applyLifeDataAuthoritySnapshot(result.snapshot)) {
      return false;
    }
    renderResults();
    renderMtbfPanel();
    updateSteps(3);
    if (collapseOnSuccess) setSidebarCollapsed(true);
    return true;
  } catch (error) {
    if (error?.silent) return false;
    handleLifeDataAuthorityError(error);
    return false;
  } finally {
    if (uiRevision === lifeDataUiRevision) {
      setLifeDataLoading(false);
    }
  }
}

function applyLifeDataAuthoritySnapshot(snapshot) {
  const adapted = adaptLifeDataFacadeResult(snapshot, {
    validation: state.validation
  });
  state.validation = adapted.validation;
  if (!adapted.ok) {
    if (adapted.error) {
      renderMessage("dataCheck", adapted.error.message, "error");
    }
    return false;
  }

  Object.assign(state, adapted.state);
  state.authoritySnapshot = snapshot;
  state.authorityStatus = "ready";
  state.authorityError = null;
  state.plots = {
    probability: weibullProbabilityPlotFromDataSvg(
      snapshot.charts.probability,
      chartLabels()
    ),
    reliability: reliabilityCurveFromDataSvg(
      snapshot.charts.reliability,
      missionChartPoint(snapshot),
      chartLabels(),
      {
      mode: "reliability",
      width: RESULT_CHART_SIZE.split.width,
      targetReliability:
        snapshot.decision?.requirement?.targetReliability
      }
    ),
    failure: reliabilityCurveFromDataSvg(
      snapshot.charts.cumulativeFailure,
      missionChartPoint(snapshot),
      chartLabels(),
      {
      mode: "failure",
      width: RESULT_CHART_SIZE.split.width,
      targetReliability:
        snapshot.decision?.requirement?.targetReliability
      }
    )
  };
  state.tables = snapshot.report_payload.tables;
  publishLifeDataSnapshotProvenance(snapshot);
  return true;
}

function applyInvalidLifeDataSnapshot(snapshot) {
  clearLifeDataAuthorityResult();
  state.validation = snapshot.compatibility?.validation
    || state.validation;
  state.authoritySnapshot = snapshot;
  state.authorityStatus = "validation_error";
  renderValidation();
  renderEmptyResults(ui("backendValidationFailed"));
  updateRunState();
}

function missionChartPoint(snapshot) {
  return {
    missionTime: snapshot.calculation.metrics.missionTime,
    missionReliability:
      snapshot.calculation.metrics.missionReliability,
    missionFailureProbability:
      snapshot.calculation.metrics.missionFailureProbability
  };
}

function renderResults() {
  const unit = $("timeUnit").value;
  if (!state.metrics) {
    renderEmptyResults(ui("zeroFailureNoFit"));
    return;
  }
  $("summaryNote").textContent = `${state.validation.censoredCount ? ui("fitIterationNote") : ui("noCensoredFitNote")} (${state.fit.iterations})`;
  $("kpis").innerHTML = lifeDataKpiRows(
    state.metrics,
    unit,
    { ui, fmt, pct, unitLabel }
  ).map(kpi).join("");
  $("probabilityPlot").innerHTML = state.plots.probability;
  $("reliabilityCurve").innerHTML = state.plots.reliability;
  $("failureCurve").innerHTML = state.plots.failure;
  renderWeibullModelPanel();
  renderLifeVisualizationPanels();
  renderInsight();
  renderTargetComparison();
  renderStatisticalInfo();
  state.reportHtml = buildLifeDataAuthorityReport();
  setLifeDataReportActionsEnabled(Boolean(state.reportHtml));
}

function renderEmptyResults(note = "Load data to begin Weibull life data analysis.") {
  $("summaryNote").textContent = note === "Load data to begin Weibull life data analysis." ? ui("loadDataNote") : note;
  $("kpis").innerHTML = lifeDataKpiRows(
    null,
    $("timeUnit").value,
    { ui, fmt, pct, unitLabel }
  ).map(kpi).join("");
  $("probabilityPlot").textContent = ui("realPlotPlaceholder");
  $("reliabilityCurve").textContent = ui("realCurvePlaceholder");
  $("failureCurve").textContent = ui("realCurvePlaceholder");
  renderWeibullModelPanel();
  renderEmptyLifeVisualizationPanels();
  $("insightGrid").innerHTML = `<div class="insight-card"><h4>${escapeHtml(ui("insight"))}</h4><strong>${escapeHtml(ui("waitingResult"))}</strong><p>${escapeHtml(ui("waitingInsight"))}</p></div>`;
  renderTargetComparison();
  renderStatisticalInfo();
  state.reportHtml = null;
  setLifeDataReportActionsEnabled(false);
}

function setLifeDataReportActionsEnabled(enabled) {
  for (const id of [
    "exportHtmlButton",
    "exportPdfButton",
    "printButton"
  ]) {
    const button = $(id);
    if (!button) continue;
    button.disabled = !enabled;
    button.setAttribute(
      "aria-disabled",
      enabled ? "false" : "true"
    );
  }
}

function buildLifeDataAuthorityReport() {
  const payload = state.authoritySnapshot?.report_payload;
  if (!payload || payload.authority?.analysis_id
    !== state.authoritySnapshot.metadata.analysis_id) {
    return null;
  }
  return buildReportHtml({
    ...payload,
    plots: state.plots,
    lang: state.lang
  });
}

function setLifeDataLoading(loading) {
  state.authorityStatus = loading ? "loading" : state.authorityStatus;
  const button = $("runButton");
  button.disabled = loading || !state.validation
    || state.validation.errors.length > 0;
  button.setAttribute("aria-busy", loading ? "true" : "false");
  button.textContent = ui(loading ? "analyzing" : "run");
}

function handleLifeDataAuthorityError(error) {
  lifeDataAuthority.cancel("error");
  clearLifeDataAuthorityResult();
  state.authorityStatus = authorityErrorStatus(error);
  state.authorityError = {
    code: error?.code || "BACKEND_UNAVAILABLE",
    message: error?.message || ui("backendUnavailable")
  };
  renderEmptyResults(localizeAuthorityError(error));
  renderMessage(
    "dataCheck",
    localizeAuthorityError(error),
    "error"
  );
  updateRunState();
}

function clearLifeDataAuthorityResult() {
  state.fit = null;
  state.metrics = null;
  state.mtbf = null;
  state.insight = null;
  state.plots = null;
  state.tables = null;
  state.reportHtml = null;
  state.authoritySnapshot = null;
  for (const id of [
    "lifePanel",
    "probabilityPlot",
    "reliabilityCurve",
    "failureCurve",
    "exportHtmlButton",
    "exportPdfButton",
    "printButton"
  ]) {
    const node = $(id);
    if (!node) continue;
    delete node.dataset.analysisId;
    delete node.dataset.inputFingerprint;
  }
}

function publishLifeDataSnapshotProvenance(snapshot) {
  const analysisId = snapshot.metadata.analysis_id;
  const inputFingerprint = snapshot.metadata.input_fingerprint;
  for (const id of [
    "lifePanel",
    "probabilityPlot",
    "reliabilityCurve",
    "failureCurve",
    "exportHtmlButton",
    "exportPdfButton",
    "printButton"
  ]) {
    const node = $(id);
    if (!node) continue;
    node.dataset.analysisId = analysisId;
    node.dataset.inputFingerprint = inputFingerprint;
  }
}

function authorityErrorStatus(error) {
  if (error?.code === "BACKEND_TIMEOUT") return "timeout";
  if (error?.kind === "network") return "network_error";
  if (error?.kind === "contract") return "contract_error";
  return "system_error";
}

function localizeAuthorityError(error) {
  const keyByCode = {
    BACKEND_TIMEOUT: "backendTimeout",
    BACKEND_UNAVAILABLE: "backendUnavailable",
    CONTRACT_VERSION_MISMATCH: "backendContractMismatch",
    BACKEND_VERSION_MISMATCH: "backendVersionMismatch",
    FINGERPRINT_MISMATCH: "backendFingerprintMismatch",
    MALFORMED_BACKEND_RESPONSE: "backendMalformedResponse",
    BACKEND_AUTHORITY_DISABLED: "backendAuthorityDisabled",
    MALFORMED_JSON: "backendRequestError",
    UNRECOGNIZED_REQUEST_STRUCTURE: "backendRequestError",
    UNKNOWN_FIELD: "backendRequestError",
    UNSUPPORTED_CONTENT_TYPE: "backendUnsupportedContent",
    METHOD_NOT_APPLICABLE: "backendMethodNotApplicable",
    INTERNAL_ERROR: "backendInternalError"
  };
  const key = keyByCode[error?.code];
  return key ? ui(key) : (error?.message || ui("backendUnavailable"));
}

function renderInsight() {
  const i = state.insight;
  $("insightGrid").innerHTML = `
    <div class="insight-card"><h4>${escapeHtml(ui("result"))}</h4><strong>${escapeHtml(localizeInsightText(i.result))}</strong><p>${escapeHtml(ui("failureRateTrend"))}: ${escapeHtml(failureRateTrendLabel())}</p><p>${escapeHtml(localizeInsightText(i.evidence))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("meaning"))}</h4><strong>${escapeHtml(localizeInsightText(i.meaning))}</strong><p>${escapeHtml(localizeInsightText(i.limitations))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("possibleConsiderations"))}</h4>${i.possibleConsiderations.length ? `<ul>${i.possibleConsiderations.map(item => `<li>${escapeHtml(localizeInsightText(item))}</li>`).join("")}</ul>` : `<p>${escapeHtml(localizeInsightText("No confirmed physical failure mechanism is identified by beta alone."))}</p>`}</div>
    <div class="insight-card"><h4>${escapeHtml(ui("recommendedActions"))}</h4><ul>${i.recommendedActions.map(item => `<li>${escapeHtml(localizeInsightText(item))}</li>`).join("")}</ul></div>`;
}

function renderTargetComparison() {
  const comparison = state.metrics?.targetComparison || { status: "Target not provided", message: "Reliability risk not assessed — no target reliability was provided." };
  const targetReliability = state.authoritySnapshot
    ?.decision?.requirement?.targetReliability;
  const rows = [
    [ui("targetReliability"), Number.isFinite(targetReliability) ? pct(targetReliability) : ui("targetNotProvided")],
    [ui("missionReliability"), state.metrics ? pct(state.metrics.missionReliability) : "-"],
    [ui("result"), localizeTargetStatus(comparison.status)]
  ];
  $("targetComparisonPanel").innerHTML = rows.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("")
    + `<div class="info-item ${comparison.status === "Below Target" ? "warn" : ""}"><b>${escapeHtml(ui("targetComparison"))}</b><span>${escapeHtml(localizeTargetMessage(comparison.message))}</span></div>`;
}

function renderStatisticalInfo() {
  const panel = $("statisticalInfoPanel");
  if (!panel) return;
  if (!state.metrics || !state.validation) {
    panel.innerHTML = `<div class="info-item"><b>${escapeHtml(ui("resultStatisticalInfo"))}</b><span>${escapeHtml(ui("waitingResult"))}</span></div>`;
    return;
  }
  const unit = unitLabel($("timeUnit").value);
  const rows = [
    [ui("analysisMethod"), "Weibull 2P MLE"],
    [ui("totalSamples"), state.validation.totalCount],
    [ui("failureCount"), state.validation.failureCount],
    [ui("censoredCount"), state.validation.censoredCount],
    [ui("betaShape"), fmt(state.metrics.beta)],
    [ui("etaScale"), `${fmt(state.metrics.eta)} ${unit}`],
    [ui("limitations"), ui("pointEstimateComparisonOnly")]
  ];
  panel.innerHTML = rows.map(([label, value]) => `<div class="info-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("");
}

function renderWeibullModelPanel() {
  const panel = $("weibullModelPanel");
  if (!panel) return;
  if (!state.metrics || !state.validation) {
    panel.innerHTML = `<div class="info-item"><b>${escapeHtml(ui("resultWeibullModel"))}</b><span>${escapeHtml(ui("waitingResult"))}</span></div>`;
    return;
  }
  const unit = unitLabel($("timeUnit").value);
  const rows = [
    [ui("analysisMethod"), "Weibull 2P MLE"],
    [ui("model"), "Weibull 2P"],
    [ui("betaShape"), fmt(state.metrics.beta)],
    [ui("etaScale"), `${fmt(state.metrics.eta)} ${unit}`],
    [ui("failureCount"), state.validation.failureCount],
    [ui("censoredCount"), state.validation.censoredCount]
  ];
  panel.innerHTML = rows.map(([label, value]) => `<div class="info-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("");
}

function setResultTab(tab) {
  activeResultTab = resultTabs.includes(tab) ? tab : "overview";
  document.querySelectorAll("[data-result-tab-target]").forEach(button => {
    const active = button.dataset.resultTabTarget === activeResultTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-result-tab-panel]").forEach(panel => {
    const active = panel.dataset.resultTabPanel === activeResultTab;
    panel.hidden = !active;
    panel.classList.toggle("result-panel-active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });
}

function handleResultTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = resultTabs.indexOf(activeResultTab);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? resultTabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + resultTabs.length) % resultTabs.length;
  setResultTab(resultTabs[nextIndex]);
  document.querySelector(`[data-result-tab-target="${resultTabs[nextIndex]}"]`)?.focus();
}

function setSidebarCollapsed(collapsed) {
  isSidebarCollapsed = Boolean(collapsed);
  $("lifeLayout").classList.toggle("sidebar-collapsed", isSidebarCollapsed);
  $("analysisSidebar").classList.toggle("collapsed", isSidebarCollapsed);
  const toggle = $("sidebarToggle");
  const details = $("sidebarDetails");
  const label = ui(isSidebarCollapsed ? "expandSettings" : "collapseSettings");
  toggle.setAttribute("aria-expanded", isSidebarCollapsed ? "false" : "true");
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  toggle.querySelector("span").textContent = isSidebarCollapsed ? "›" : "‹";
  details.setAttribute("aria-hidden", isSidebarCollapsed ? "true" : "false");
  details.inert = isSidebarCollapsed;
}

function renderModuleResultTabs(module, tabs) {
  const activeTab = moduleDashboardState[module].activeTab;
  return `<nav class="panel result-tabs" aria-label="${escapeHtml(ui("resultNavigation"))}">
    <div class="result-tabs-scroll" role="tablist">
      ${tabs.map(([tab, labelKey]) => `<button class="result-tab ${activeTab === tab ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === tab ? "true" : "false"}" tabindex="${activeTab === tab ? "0" : "-1"}" data-module-tab="${module}" data-module-tab-target="${tab}">${escapeHtml(ui(labelKey))}</button>`).join("")}
    </div>
  </nav>`;
}

function modulePanelAttributes(module, tab) {
  const active = moduleDashboardState[module].activeTab === tab;
  return `data-module-tab-panel="${module}" data-module-tab-name="${tab}" ${active ? "" : 'hidden aria-hidden="true"'}`;
}

function bindModuleDashboard(module) {
  document.querySelectorAll(`[data-module-tab="${module}"]`).forEach(button => {
    button.addEventListener("click", () => setModuleDashboardTab(module, button.dataset.moduleTabTarget));
    button.addEventListener("keydown", event => handleModuleTabKeydown(event, module));
  });
  $(`${module}SidebarToggle`)?.addEventListener("click", () => {
    setModuleSidebarCollapsed(module, !moduleDashboardState[module].collapsed);
  });
  syncModuleDashboard(module);
}

function setModuleDashboardTab(module, tab) {
  const buttons = Array.from(document.querySelectorAll(`[data-module-tab="${module}"]`));
  if (!buttons.some(button => button.dataset.moduleTabTarget === tab)) return;
  moduleDashboardState[module].activeTab = tab;
  buttons.forEach(button => {
    const active = button.dataset.moduleTabTarget === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(`[data-module-tab-panel="${module}"]`).forEach(panel => {
    const active = panel.dataset.moduleTabName === tab;
    panel.hidden = !active;
    panel.classList.toggle("result-panel-active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });
}

function handleModuleTabKeydown(event, module) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = Array.from(document.querySelectorAll(`[data-module-tab="${module}"]`));
  const tabs = buttons.map(button => button.dataset.moduleTabTarget);
  const currentIndex = tabs.indexOf(moduleDashboardState[module].activeTab);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  setModuleDashboardTab(module, tabs[nextIndex]);
  buttons[nextIndex]?.focus();
}

function setModuleSidebarCollapsed(module, collapsed) {
  moduleDashboardState[module].collapsed = Boolean(collapsed);
  syncModuleDashboard(module);
}

function syncModuleDashboard(module) {
  const collapsed = moduleDashboardState[module].collapsed;
  const layout = document.querySelector(`[data-dashboard-layout="${module}"]`);
  const sidebar = document.querySelector(`[data-dashboard-sidebar="${module}"]`);
  const details = document.querySelector(`[data-dashboard-details="${module}"]`);
  const toggle = $(`${module}SidebarToggle`);
  if (!layout || !sidebar || !details || !toggle) return;
  layout.classList.toggle("sidebar-collapsed", collapsed);
  sidebar.classList.toggle("collapsed", collapsed);
  const label = ui(collapsed ? "expandSettings" : "collapseSettings");
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  toggle.querySelector("span").textContent = collapsed ? "›" : "‹";
  details.setAttribute("aria-hidden", collapsed ? "true" : "false");
  details.inert = collapsed;
  setModuleDashboardTab(module, moduleDashboardState[module].activeTab);
}

function unavailableDashboardPanel(titleKey, messageKey) {
  return `<section class="panel block"><h3>${escapeHtml(ui(titleKey))}</h3><div class="empty-dashboard-state"><span class="status-badge muted">${escapeHtml(ui("notAvailable"))}</span><p>${escapeHtml(ui(messageKey))}</p></div></section>`;
}

function renderLifeVisualizationPanels() {
  renderProbabilityStats();
  renderLifePercentiles();
  renderReliabilityTimes();
  renderCurveSummaries();
}

function renderEmptyLifeVisualizationPanels() {
  $("probabilityStats").innerHTML = "";
  $("probabilityPlotNote").textContent = ui("probabilityPlotLimit");
  $("lifePercentilesTable").innerHTML = `<table><tbody><tr><td>${escapeHtml(ui("waitingResult"))}</td></tr></tbody></table>`;
  $("customPercentileMessage").innerHTML = `<b>${escapeHtml(ui("customPercentile"))}</b><span>${escapeHtml(ui("customPercentileHint"))}</span>`;
  $("reliabilityTimesTable").innerHTML = `<table><tbody><tr><td>${escapeHtml(ui("waitingResult"))}</td></tr></tbody></table>`;
  $("customTimeMessage").innerHTML = `<b>${escapeHtml(ui("customTime"))}</b><span>${escapeHtml(ui("customTimeHint"))}</span>`;
  const emptySummary = `<div class="info-item"><b>${escapeHtml(ui("targetGap"))}</b><span>${escapeHtml(ui("targetNotProvidedMessage"))}</span></div>`;
  $("reliabilityTargetGapPanel").innerHTML = emptySummary;
  $("failureTargetGapPanel").innerHTML = emptySummary;
}

function renderProbabilityStats() {
  const unit = unitLabel($("timeUnit").value);
  $("probabilityStats").innerHTML = [
    `β ${fmt(state.metrics.beta)}`,
    `η ${fmt(state.metrics.eta)} ${unit}`,
    `B10 ${fmt(state.metrics.b10)} ${unit}`,
    `${ui("failures")} ${state.metrics.failureCount}`,
    `${ui("rightCensored")} ${state.metrics.censoredCount}`,
    "Weibull 2P MLE"
  ].map(item => `<span>${escapeHtml(item)}</span>`).join("");
  $("probabilityPlotNote").textContent = ui("probabilityPlotLimit");
}

function renderLifePercentiles() {
  const unit = unitLabel($("timeUnit").value);
  const rows = state.tables?.percentiles?.rows || [];
  $("lifePercentilesTable").innerHTML = `<table><thead><tr><th>${escapeHtml(ui("percentFailed"))}</th><th>${escapeHtml(ui("lifeMetric"))}</th><th>${escapeHtml(ui("estimatedTime"))}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.percent)}%</td><td>${escapeHtml(row.metric)}</td><td>${fmt(row.estimatedTime)} ${escapeHtml(unit)}</td></tr>`).join("")}</tbody></table>`;
  const error = state.tables?.percentiles?.error || "";
  $("customPercentileMessage").classList.toggle("error", Boolean(error));
  $("customPercentileMessage").innerHTML = `<b>${escapeHtml(ui("customPercentile"))}</b><span>${escapeHtml(error ? localizeCustomInputError(error) : ui("customPercentileHint"))}</span>`;
}

function renderReliabilityTimes() {
  const unit = unitLabel($("timeUnit").value);
  const rows = state.tables?.selectedTimes?.rows || [];
  $("reliabilityTimesTable").innerHTML = `<table><thead><tr><th>${escapeHtml(ui("chartTime"))}</th><th>${escapeHtml(ui("reliabilityRt"))}</th><th>${escapeHtml(ui("cumulativeFailureFt"))}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.time)} ${escapeHtml(unit)}${row.isMissionTime ? ` · ${escapeHtml(ui("missionTime"))}` : ""}</td><td>${pct(row.reliability)}</td><td>${pct(row.failureProbability)}</td></tr>`).join("")}</tbody></table>`;
  const error = state.tables?.selectedTimes?.error || "";
  $("customTimeMessage").classList.toggle("error", Boolean(error));
  $("customTimeMessage").innerHTML = `<b>${escapeHtml(ui("customTime"))}</b><span>${escapeHtml(error ? localizeCustomInputError(error) : ui("customTimeHint"))}</span>`;
}

function renderCurveSummaries() {
  const gap = state.tables?.targetGap;
  if (!gap) {
    const emptySummary = `<div class="info-item"><b>${escapeHtml(ui("targetGap"))}</b><span>${escapeHtml(ui("targetNotProvidedMessage"))}</span></div>`;
    $("reliabilityTargetGapPanel").innerHTML = emptySummary;
    $("failureTargetGapPanel").innerHTML = emptySummary;
    return;
  }
  const reliabilityGap = gap.gapPercentagePoints;
  const failureGap = gap.failureGapPercentagePoints;
  $("reliabilityTargetGapPanel").innerHTML = [
    [ui("predictedReliability"), pct(gap.predictedReliability)],
    [ui("targetReliability"), pct(gap.targetReliability)],
    [ui("gap"), `${reliabilityGap >= 0 ? "+" : ""}${reliabilityGap.toFixed(2)} ${ui("percentagePoints")}`],
    [ui("limitations"), ui("pointEstimateComparisonOnly")]
  ].map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("");
  $("failureTargetGapPanel").innerHTML = [
    [ui("predictedFailureProbability"), pct(gap.predictedFailureProbability)],
    [ui("targetFailureProbability"), pct(gap.targetFailureProbability)],
    [ui("gap"), `${failureGap >= 0 ? "+" : ""}${failureGap.toFixed(2)} ${ui("percentagePoints")}`],
    [ui("limitations"), ui("pointEstimateComparisonOnly")]
  ].map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("");
}

async function updateCustomPercentile() {
  state.customPercentile = $("customPercentile").value;
  if (!state.authoritySnapshot || !state.validation) {
    renderEmptyLifeVisualizationPanels();
    return;
  }
  await requestLifeDataAuthoritySnapshot();
}

async function updateCustomTime() {
  state.customTime = $("customTime").value;
  if (!state.authoritySnapshot || !state.validation) {
    renderEmptyLifeVisualizationPanels();
    return;
  }
  await requestLifeDataAuthoritySnapshot();
}

function failureRateTrendLabel() {
  const flags = state.insight?.flags || {};
  if (flags.decreasingFailureRate) {
    return ui("decreasingFailureRateTrend");
  }
  if (flags.approximatelyConstantFailureRate) {
    return ui("constantFailureRateTrend");
  }
  if (flags.increasingFailureRate) {
    return ui("increasingFailureRateTrend");
  }
  return "-";
}

function renderPreview() {
  const rows = state.validation?.records || [];
  if (!rows.length) {
    $("previewTable").innerHTML = `<table><tbody><tr><td>${escapeHtml(ui("noValidRows"))}</td></tr></tbody></table>`;
    return;
  }
  $("previewTable").innerHTML = `<table><thead><tr><th>${escapeHtml(ui("sampleId"))}</th><th>${escapeHtml(ui("chartTime"))}</th><th>${escapeHtml(ui("statusColumn"))}</th><th>${escapeHtml(ui("failureMode"))}</th><th>${escapeHtml(ui("testCondition"))}</th></tr></thead><tbody>${rows.slice(0, 25).map(row => `<tr><td>${escapeHtml(row.sampleId)}</td><td>${fmt(row.time)}</td><td><span class="pill ${row.status === "failure" ? "fail" : "cens"}">${escapeHtml(row.status === "failure" ? ui("failure") : ui("censoredObservation"))}</span></td><td>${escapeHtml(row.failureMode || "-")}</td><td>${escapeHtml(row.testCondition || "-")}</td></tr>`).join("")}</tbody></table>`;
}

function renderMtbfPanel() {
  const tabs = [
    ["overview", "resultOverview"],
    ["mtbf-results", "mtbfResultsTab"],
    ["mttr-results", "mttrResultsTab"],
    ["availability", "availabilityTab"],
    ["distribution", "distributionFitTab"],
    ["statistics", "resultStatisticalInfo"],
    ["data", "resultDataSummary"]
  ];
  $("mtbfPanel").innerHTML = `
    <div class="layout" data-dashboard-layout="mtbf">
      <aside class="panel sidebar" data-dashboard-sidebar="mtbf">
        <div class="sidebar-header">
          <h2 class="section-title">${escapeHtml(ui("mtbfTitle"))}</h2>
          <button class="sidebar-toggle" id="mtbfSidebarToggle" type="button" aria-expanded="true" aria-controls="mtbfSidebarDetails"><span aria-hidden="true">‹</span></button>
        </div>
        <div class="step-list dashboard-steps">
          <div class="step active"><div class="step-num">1</div><div><strong>${escapeHtml(ui("enterData"))}</strong><span>${escapeHtml(mtbfState.inputMode === "summary" ? ui("summaryInput") : ui("unitLevelData"))}</span></div></div>
          <div class="step ${mtbfState.validation && !mtbfState.validation.errors?.length ? "done" : ""}"><div class="step-num">2</div><div><strong>${escapeHtml(ui("confirmExposure"))}</strong><span>${escapeHtml(ui("mapping"))}</span></div></div>
          <div class="step ${mtbfState.result ? "done" : ""}"><div class="step-num">3</div><div><strong>${escapeHtml(ui("stepRun"))}</strong><span>${escapeHtml(ui("mtbfRunHint"))}</span></div></div>
        </div>
        <div class="sidebar-details" id="mtbfSidebarDetails" data-dashboard-details="mtbf">
        <div class="segmented" role="group" aria-label="${escapeHtml(ui("inputMode"))}">
          <button class="segment ${mtbfState.inputMode === "summary" ? "active" : ""}" id="mtbfModeSummary" type="button">${escapeHtml(ui("summaryInput"))}</button>
          <button class="segment ${mtbfState.inputMode === "unit" ? "active" : ""}" id="mtbfModeUnit" type="button">${escapeHtml(ui("unitLevelData"))}</button>
        </div>
        ${mtbfState.inputMode === "summary" ? renderMTBFSummaryForm() : renderMTBFUnitForm()}
        <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("settings"))}</h3>
        <div class="mini-grid">
          <div class="field"><label for="mtbfTimeUnit">${escapeHtml(ui("timeUnit"))}</label><select id="mtbfTimeUnit">${mtbfTimeUnitOptions()}</select></div>
          <div class="field"><label for="mtbfMissionTime">${escapeHtml(ui("missionTime"))}</label><input id="mtbfMissionTime" type="number" min="0" step="any" value="${escapeHtml(mtbfState.summary.missionTime)}" /></div>
          <div class="field"><label for="mtbfTarget">${escapeHtml(ui("targetMTBF"))}</label><input id="mtbfTarget" type="number" min="0" step="any" value="${escapeHtml(mtbfState.summary.targetMTBF)}" placeholder="${escapeHtml(ui("optionalPlaceholder"))}" /></div>
        </div>
        <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("dataCheck"))}</h3>
        <div class="info-list" id="mtbfDataCheck">${renderMTBFDataCheck()}</div>
        <p class="privacy">${escapeHtml(ui("localOnly"))}</p>
        </div>
        <div class="sidebar-footer"><button class="btn" id="mtbfResetButton" type="button">${escapeHtml(ui("reset"))}</button><button class="btn primary" id="mtbfRunButton" type="button">${escapeHtml(ui("run"))}</button></div>
      </aside>
      <main class="main">
        ${renderModuleResultTabs("mtbf", tabs)}
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "overview")}>
          <section class="panel summary">
            <h2>${escapeHtml(ui("mtbfSummary"))}</h2>
            <p>${escapeHtml(ui("mtbfIntroFull"))}</p>
            <p>${escapeHtml(ui("mtbfRepairableBoundary"))}</p>
            <div class="kpis">${renderMTBFKpis()}</div>
          </section>
          <section class="panel insight"><h3 style="margin:0 0 12px;font-size:15px">${escapeHtml(ui("insight"))}</h3><div class="insight-grid">${renderMTBFInsight()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "mtbf-results")}>
          <section class="panel block"><h3>${escapeHtml(ui("exposureSummary"))}</h3><div class="info-list result-statistics">${renderMTBFExposureSummary()}</div></section>
          <section class="panel block"><h3>${escapeHtml(ui("targetComparison"))}</h3><div class="info-list">${renderMTBFTargetComparison()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "mttr-results")}>${unavailableDashboardPanel("mttrResultsTab", "mttrUnavailable")}</div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "availability")}>${unavailableDashboardPanel("availabilityTab", "availabilityUnavailable")}</div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "distribution")}>
          <section class="panel block result-chart-panel"><h3>${escapeHtml(ui("reliabilityCurve"))}</h3><div class="chart result-chart result-chart-full" id="mtbfReliabilityChart">${mtbfState.curveSvg || escapeHtml(mtbfState.result && !mtbfState.result.estimable ? ui("mtbfZeroCurveNote") : ui("realCurvePlaceholder"))}</div><p class="plot-note">${escapeHtml(ui("exponentialCurve"))}</p></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "statistics")}>
          <section class="panel block"><h3>${escapeHtml(ui("resultStatisticalInfo"))}</h3><div class="info-list result-statistics">${renderMTBFDataCheck()}</div></section>
          <section class="panel block"><h3>${escapeHtml(ui("assumptionsNotices"))}</h3><div class="info-list"><div class="info-item"><b>${escapeHtml(ui("model"))}</b><span>${escapeHtml(ui("constantFailureRate"))}</span></div><div class="info-item"><b>${escapeHtml(ui("limitations"))}</b><span>${escapeHtml(ui("mtbfTargetLimit"))}</span></div></div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("mtbf", "data")}>
          <section class="panel block"><h3>${escapeHtml(ui("preview"))}</h3><div class="table-wrap">${renderMTBFPreview()}</div></section>
          <section class="panel block"><h3>${escapeHtml(ui("report"))}</h3><div class="report-actions"><button class="btn" id="mtbfExportHtmlButton" type="button" ${mtbfState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("exportHtml"))}</button><button class="btn" id="mtbfExportPdfButton" type="button" ${mtbfState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("exportPdf"))}</button><button class="btn" id="mtbfPrintButton" type="button" ${mtbfState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("print"))}</button></div></section>
        </div>
      </main>
    </div>`;
  bindMTBFPanelEvents();
  bindModuleDashboard("mtbf");
  updateMTBFRunState();
}

function renderMTBFSummaryForm() {
  return `<div class="mini-grid" style="margin-top:12px">
    <div class="field"><label for="mtbfTotalExposure">${escapeHtml(ui("totalTimeOnTest"))}</label><input id="mtbfTotalExposure" type="number" min="0" step="any" value="${escapeHtml(mtbfState.summary.totalExposure)}" /></div>
    <div class="field"><label for="mtbfFailureCount">${escapeHtml(ui("failureCount"))}</label><input id="mtbfFailureCount" type="number" min="0" step="1" value="${escapeHtml(mtbfState.summary.failureCount)}" /></div>
  </div>`;
}

function renderMTBFUnitForm() {
  return `<div class="upload" style="margin-top:12px">
    <strong>${escapeHtml(ui("mtbfUpload"))}</strong>
    <small>${escapeHtml(ui("mtbfProcessed"))}</small>
    <div style="margin-top:10px">
      <label class="btn primary" for="mtbfFileInput">${escapeHtml(ui("choose"))}</label>
      <input class="file-input" id="mtbfFileInput" type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv" />
    </div>
  </div>
  <div class="mini-actions">
    <button class="btn" id="mtbfTemplateXlsxButton" type="button">${escapeHtml(ui("mtbfTemplateXlsx"))}</button>
    <button class="btn" id="mtbfTemplateCsvButton" type="button">${escapeHtml(ui("mtbfTemplateCsv"))}</button>
    <button class="btn" id="mtbfLoadExampleButton" type="button">${escapeHtml(ui("mtbfLoadExample"))}</button>
  </div>
  <div class="field wide" style="margin-top:10px">
    <label for="mtbfPasteInput">${escapeHtml(ui("paste"))}</label>
    <textarea id="mtbfPasteInput" placeholder="${escapeHtml(ui("mtbfPastePlaceholder"))}"></textarea>
  </div>
  <div class="file-row"><div class="file-meta"><b id="mtbfSourceName">${escapeHtml(mtbfState.sourceKey ? ui(mtbfState.sourceKey) : (mtbfState.sourceName || ui("noDataLoaded")))}</b><span>${mtbfState.rows.length} ${escapeHtml(ui("samples"))} · ${mtbfState.headers.length} ${escapeHtml(ui("columns"))}</span></div><span class="status-ok">${escapeHtml(mtbfState.rows.length ? ui("ready") : ui("waiting"))}</span></div>
  <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("mapping"))}</h3>
  <div class="mini-grid">${renderMTBFMapping()}</div>`;
}

function renderMTBFMapping() {
  const fields = [
    ["unitId", ui("unitId")],
    ["exposureTime", ui("exposureTime")],
    ["status", ui("statusColumn")],
    ["failureMode", ui("failureMode")],
    ["testCondition", ui("testCondition")],
    ["notes", ui("notes")]
  ];
  return fields.map(([key, label]) => `<div class="field"><label for="mtbf-map-${key}">${escapeHtml(label)}</label><select id="mtbf-map-${key}" data-mtbf-map="${key}">${selectOptions(mtbfState.headers, mtbfState.mapping[key])}</select></div>`).join("");
}

function mtbfTimeUnitOptions() {
  return ["hours", "cycles", "days", "minutes", "other"].map(unit => `<option value="${unit}" ${mtbfState.summary.timeUnit === unit ? "selected" : ""}>${escapeHtml(unitLabel(unit))}</option>`).join("");
}

function renderMTBFDataCheck() {
  if (mtbfState.inputMode === "unit" && !mtbfState.rows.length) {
    return `<div class="info-item"><b>${escapeHtml(ui("noDataLoaded"))}</b><span>${escapeHtml(ui("mtbfNoData"))}</span></div>`;
  }
  if (mtbfState.inputMode === "unit" && (!mtbfState.mapping.exposureTime || !mtbfState.mapping.status)) {
    return `<div class="info-item warn"><b>${escapeHtml(ui("mappingRequired"))}</b><span>${escapeHtml(ui("mtbfMappingRequired"))}</span></div>`;
  }
  const v = mtbfState.validation;
  if (!v) return `<div class="info-item"><b>${escapeHtml(ui("waiting"))}</b><span>${escapeHtml(ui("mtbfNoData"))}</span></div>`;
  const rows = [];
  if (v.input) {
    rows.push([ui("totalTimeOnTest"), `${fmt(v.input.totalExposure)} ${unitLabel(v.input.timeUnit)}`]);
    rows.push([ui("failureCount"), fmt(v.input.failureCount)]);
  } else {
    rows.push([ui("validRecords"), `${v.records.length} ${ui("samples")}`]);
    rows.push([ui("exposureSummary"), `${fmt(v.totalExposure)} ${unitLabel(mtbfState.summary.timeUnit)} · ${v.failureCount} ${ui("failures")} · ${v.censoredCount} ${ui("censored")}`]);
  }
  return rows.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("")
    + v.errors.slice(0, 6).map(error => `<div class="info-item error"><b>${escapeHtml(ui("error"))}</b><span>${escapeHtml(localizeMTBFRuntimeText(error))}</span></div>`).join("")
    + v.warnings.slice(0, 4).map(warning => `<div class="info-item warn"><b>${escapeHtml(ui("notice"))}</b><span>${escapeHtml(localizeMTBFRuntimeText(warning))}</span></div>`).join("");
}

function renderMTBFKpis() {
  return mtbfKpiRows(
    mtbfState.result,
    mtbfState.summary.timeUnit,
    {
      ui,
      fmt,
      pct,
      unitLabel,
      formatRate,
      failureRateUnitLabel
    }
  ).map(kpi).join("");
}

function renderMTBFExposureSummary() {
  const rows = mtbfExposureRows(
    mtbfState.inputSummary,
    mtbfState.inputMode,
    { ui, fmt, unitLabel }
  );
  if (!rows) return `<div class="info-item"><b>${escapeHtml(ui("waitingResult"))}</b><span>${escapeHtml(ui("mtbfNoData"))}</span></div>`;
  return rows.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("");
}

function renderMTBFTargetComparison() {
  const model = mtbfTargetRows({
    targetComparison: mtbfState.targetComparison,
    targetMTBF: mtbfState.summary.targetMTBF,
    timeUnit: mtbfState.summary.timeUnit
  }, {
    ui,
    fmt,
    unitLabel,
    localizeStatus: localizeMTBFTargetStatus,
    localizeMessage: localizeMTBFTargetMessage
  });
  return model.rows.map(([b, s]) => `<div class="info-item ${model.warning ? "warn" : ""}"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("");
}

function renderMTBFInsight() {
  const insight = mtbfState.insight || buildMTBFInsight(mtbfState.result, mtbfState.targetComparison);
  return `
    <div class="insight-card"><h4>${escapeHtml(ui("result"))}</h4><strong>${escapeHtml(localizeMTBFInsightText(insight.result))}</strong><p>${escapeHtml(localizeMTBFInsightText(insight.evidence))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("meaning"))}</h4><strong>${escapeHtml(localizeMTBFInsightText(insight.meaning))}</strong><p>${escapeHtml(ui("mtbfBoundary"))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("assumptions"))}</h4><ul>${insight.assumptions.map(item => `<li>${escapeHtml(localizeMTBFInsightText(item))}</li>`).join("")}</ul></div>
    <div class="insight-card"><h4>${escapeHtml(ui("recommendedActions"))}</h4><ul>${insight.recommendedActions.map(item => `<li>${escapeHtml(localizeMTBFInsightText(item))}</li>`).join("")}<li>${escapeHtml(ui("mtbfRepairableBoundary"))}</li></ul></div>`;
}

function renderMTBFPreview() {
  const records = mtbfState.validation?.records || mtbfState.unitRecords || [];
  if (mtbfState.inputMode !== "unit" || !records.length) return `<table><tbody><tr><td>${escapeHtml(ui("noValidRows"))}</td></tr></tbody></table>`;
  return `<table><thead><tr><th>${escapeHtml(ui("unitId"))}</th><th>${escapeHtml(ui("exposureTime"))}</th><th>${escapeHtml(ui("statusColumn"))}</th><th>${escapeHtml(ui("failureMode"))}</th><th>${escapeHtml(ui("testCondition"))}</th><th>${escapeHtml(ui("notes"))}</th></tr></thead><tbody>${records.slice(0, 25).map(row => `<tr><td>${escapeHtml(row.unitId)}</td><td>${fmt(row.exposureTime)}</td><td><span class="pill ${row.status === "failure" ? "fail" : "cens"}">${escapeHtml(row.status === "failure" ? ui("failure") : ui("censoredObservation"))}</span></td><td>${escapeHtml(row.failureMode || "-")}</td><td>${escapeHtml(row.testCondition || "-")}</td><td>${escapeHtml(row.notes || "-")}</td></tr>`).join("")}</tbody></table>`;
}

function bindMTBFPanelEvents() {
  $("mtbfModeSummary")?.addEventListener("click", () => setMTBFInputMode("summary"));
  $("mtbfModeUnit")?.addEventListener("click", () => setMTBFInputMode("unit"));
  $("mtbfTotalExposure")?.addEventListener("input", event => handleMTBFSummaryInput("totalExposure", event.target.value));
  $("mtbfFailureCount")?.addEventListener("input", event => handleMTBFSummaryInput("failureCount", event.target.value));
  $("mtbfTimeUnit")?.addEventListener("change", event => handleMTBFTimeUnit(event.target.value));
  $("mtbfMissionTime")?.addEventListener("input", event => handleMTBFMissionTarget("missionTime", event.target.value));
  $("mtbfTarget")?.addEventListener("input", event => handleMTBFMissionTarget("targetMTBF", event.target.value));
  $("mtbfPasteInput")?.addEventListener("input", handleMTBFPaste);
  $("mtbfFileInput")?.addEventListener("change", handleMTBFFile);
  $("mtbfLoadExampleButton")?.addEventListener("click", loadMTBFExample);
  $("mtbfTemplateCsvButton")?.addEventListener("click", () => downloadText("mtbf-template.csv", `${mtbfTemplateHeaders.join(",")}\nU001,1000,Failure,,,\nU002,1000,Censored,,,\n`));
  $("mtbfTemplateXlsxButton")?.addEventListener("click", () => downloadXlsxTemplate("mtbf-template.xlsx", mtbfTemplateHeaders, [["U001", "1000", "Failure", "", "", ""], ["U002", "1000", "Censored", "", "", ""]], "MTBF"));
  document.querySelectorAll("[data-mtbf-map]").forEach(select => select.addEventListener("change", event => {
    mtbfState.mapping[event.target.dataset.mtbfMap] = event.target.value;
    invalidateMTBFResult(mtbfState);
    updateMTBFValidation();
    renderMtbfPanel();
  }));
  $("mtbfRunButton")?.addEventListener("click", runMTBFAnalysis);
  $("mtbfResetButton")?.addEventListener("click", resetMTBF);
  $("mtbfExportHtmlButton")?.addEventListener("click", () => mtbfState.reportHtml && downloadHtml(mtbfState.reportHtml, "mtbf-analysis-report.html"));
  $("mtbfExportPdfButton")?.addEventListener("click", () => mtbfState.reportHtml && printReport(mtbfState.reportHtml));
  $("mtbfPrintButton")?.addEventListener("click", () => mtbfState.reportHtml && printReport(mtbfState.reportHtml));
}

function setMTBFInputMode(inputMode) {
  if (mtbfState.inputMode === inputMode) return;
  moduleDashboardState.mtbf.collapsed = false;
  mtbfState.inputMode = inputMode;
  mtbfState.validation = null;
  mtbfState.inputSummary = null;
  invalidateMTBFResult(mtbfState);
  renderMtbfPanel();
}

function handleMTBFSummaryInput(field, value) {
  mtbfState.summary[field] = value;
  const hadResult = Boolean(mtbfState.result);
  invalidateMTBFResult(mtbfState);
  updateMTBFValidation();
  if (hadResult) renderMtbfPanel();
  else renderMTBFCheckAndRun();
}

function handleMTBFTimeUnit(value) {
  mtbfState.summary.timeUnit = value;
  invalidateMTBFResult(mtbfState);
  updateMTBFValidation();
  renderMtbfPanel();
}

function handleMTBFMissionTarget(field, value) {
  mtbfState.summary[field] = value;
  updateMTBFValidation();
  if (!mtbfState.result) {
    renderMTBFCheckAndRun();
    return;
  }
  const missionTime = Number(mtbfState.summary.missionTime);
  if (!Number.isFinite(missionTime) || missionTime <= 0) {
    renderMTBFCheckAndRun();
    return;
  }
  const engineResult = analyzeMTBF(mtbfEngineInput());
  if (!applyMTBFEngineResult(engineResult)) {
    renderMTBFCheckAndRun();
    return;
  }
  mtbfState.curveSvg = mtbfState.result.estimable ? mtbfReliabilityCurveSvg(mtbfState.result, mtbfChartLabels()) : "";
  buildMTBFReport();
  renderMtbfPanel();
}

async function handleMTBFFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseFile(file);
    loadMTBFParsedData(parsed, file.name, "");
  } catch (error) {
    renderMessage("mtbfDataCheck", localizeMTBFRuntimeText(error.message), "error");
  }
}

function handleMTBFPaste() {
  const text = $("mtbfPasteInput").value;
  if (!text.trim()) return;
  try {
    loadMTBFParsedData(parseDelimitedText(text), ui("pastedData"), "pastedData");
  } catch (error) {
    renderMessage("mtbfDataCheck", localizeMTBFRuntimeText(error.message), "error");
  }
}

function loadMTBFExample() {
  loadMTBFParsedData(parseDelimitedText(mtbfExampleText), ui("mtbfExampleData"), "mtbfExampleData");
}

function loadMTBFParsedData(parsed, sourceName, sourceKey = "") {
  loadMTBFUnitDataState(mtbfState, {
    headers: parsed.headers,
    rows: parsed.rows,
    sourceName,
    sourceKey,
    mapping: detectMTBFColumns(parsed.headers)
  });
  updateMTBFValidation();
  renderMtbfPanel();
}

function updateMTBFValidation() {
  if (mtbfState.inputMode === "summary") {
    mtbfState.validation = validateMTBFSummaryInput(mtbfState.summary);
    mtbfState.inputSummary = mtbfState.validation.input;
    return mtbfState.validation;
  }
  if (!mtbfState.rows.length || !mtbfState.mapping.exposureTime || !mtbfState.mapping.status) {
    mtbfState.validation = null;
    mtbfState.inputSummary = null;
    mtbfState.unitRecords = [];
    return null;
  }
  mtbfState.validation = validateMTBFUnitRows(mtbfState.rows, mtbfState.mapping, { timeUnit: mtbfState.summary.timeUnit });
  mtbfState.unitRecords = mtbfState.validation.records;
  const summary = summarizeUnitExposure(mtbfState.validation.records, mtbfState.summary.timeUnit);
  const common = validateMTBFSummaryInput({
    ...summary,
    missionTime: mtbfState.summary.missionTime,
    targetMTBF: mtbfState.summary.targetMTBF,
    timeUnit: mtbfState.summary.timeUnit
  });
  mtbfState.validation.errors = uniqueMessages([...mtbfState.validation.errors, ...common.errors]);
  mtbfState.validation.warnings = uniqueMessages([...mtbfState.validation.warnings, ...common.warnings]);
  mtbfState.inputSummary = { ...common.input, censoredCount: summary.censoredCount, totalUnits: summary.totalUnits };
  return mtbfState.validation;
}

function runMTBFAnalysis() {
  const validation = updateMTBFValidation();
  renderMTBFCheckAndRun();
  if (!validation || validation.errors.length) return;
  const engineResult = analyzeMTBF(mtbfEngineInput());
  if (!applyMTBFEngineResult(engineResult)) return;
  mtbfState.curveSvg = mtbfState.result.estimable ? mtbfReliabilityCurveSvg(mtbfState.result, mtbfChartLabels()) : "";
  buildMTBFReport();
  moduleDashboardState.mtbf.collapsed = true;
  moduleDashboardState.mtbf.activeTab = "overview";
  renderMtbfPanel();
}

function mtbfEngineInput() {
  if (mtbfState.inputMode === "summary") {
    return {
      inputMode: "summary",
      ...mtbfState.summary
    };
  }
  return {
    inputMode: "unit",
    rows: mtbfState.rows,
    mapping: mtbfState.mapping,
    timeUnit: mtbfState.summary.timeUnit,
    missionTime: mtbfState.summary.missionTime,
    targetMTBF: mtbfState.summary.targetMTBF
  };
}

function applyMTBFEngineResult(engineResult) {
  const adapted = adaptMTBFFacadeResult(engineResult, {
    validation: mtbfState.validation,
    inputSummary: mtbfState.inputSummary
  });
  mtbfState.validation = adapted.validation;
  mtbfState.inputSummary = adapted.inputSummary;
  if (!adapted.ok) {
    if (adapted.error) {
      renderMessage(
        "mtbfDataCheck",
        localizeMTBFRuntimeText(adapted.error.message),
        "error"
      );
    }
    return false;
  }
  Object.assign(mtbfState, adapted.state);
  return true;
}

function buildMTBFReport() {
  mtbfState.reportHtml = buildMTBFReportHtml({
    inputMode: mtbfState.inputMode,
    inputSummary: mtbfState.inputSummary,
    result: mtbfState.result,
    targetComparison: mtbfState.targetComparison,
    insight: mtbfState.insight,
    curveSvg: mtbfState.curveSvg,
    mapping: mtbfState.inputMode === "summary" ? { totalExposure: ui("totalTimeOnTest"), failureCount: ui("failureCount") } : mtbfState.mapping,
    lang: state.lang
  });
}

function renderMTBFCheckAndRun() {
  if ($("mtbfDataCheck")) $("mtbfDataCheck").innerHTML = renderMTBFDataCheck();
  updateMTBFRunState();
}

function resetMTBF() {
  resetMTBFState(mtbfState);
  moduleDashboardState.mtbf.collapsed = false;
  moduleDashboardState.mtbf.activeTab = "overview";
  renderMtbfPanel();
}

function renderDemoPanel() {
  demoState.validation = validateDemoInputs(demoState, ui);
  const tabs = [
    ["overview", "resultOverview"],
    ["plan", "verificationPlanTab"],
    ["results", "verificationResultsTab"],
    ["confidence", "confidenceIntervalTab"],
    ["conclusion", "verificationConclusionTab"],
    ["statistics", "resultStatisticalInfo"],
    ["data", "resultDataSummary"]
  ];
  $("demoPanel").innerHTML = `
    <div class="layout" data-dashboard-layout="demo">
      <aside class="panel sidebar" data-dashboard-sidebar="demo">
        <div class="sidebar-header">
          <h2 class="section-title">${escapeHtml(ui("demoTitle"))}</h2>
          <button class="sidebar-toggle" id="demoSidebarToggle" type="button" aria-expanded="true" aria-controls="demoSidebarDetails"><span aria-hidden="true">‹</span></button>
        </div>
        <div class="step-list dashboard-steps">
          <div class="step active"><div class="step-num">1</div><div><strong>${escapeHtml(ui("defineTarget"))}</strong><span>${escapeHtml(demoMethodLabel())}</span></div></div>
          <div class="step ${demoState.validation.errors.length ? "" : "done"}"><div class="step-num">2</div><div><strong>${escapeHtml(ui("defineEvidence"))}</strong><span>${escapeHtml(demoWorkflowLabel())}</span></div></div>
          <div class="step ${demoState.result ? "done" : ""}"><div class="step-num">3</div><div><strong>${escapeHtml(ui("calculatePlanEvaluate"))}</strong><span>${escapeHtml(ui("demoRunHint"))}</span></div></div>
        </div>
        <div class="sidebar-details" id="demoSidebarDetails" data-dashboard-details="demo">
        <h3 class="section-title">${escapeHtml(ui("demoMethod"))}</h3>
        <div class="segmented" role="group" aria-label="${escapeHtml(ui("demoMethod"))}">
          <button class="segment ${demoState.method === "sample" ? "active" : ""}" id="demoMethodSample" type="button">${escapeHtml(ui("sampleBasedDemo"))}</button>
          <button class="segment ${demoState.method === "time" ? "active" : ""}" id="demoMethodTime" type="button">${escapeHtml(ui("timeBasedDemo"))}</button>
        </div>
        <h3 class="section-title">${escapeHtml(ui("workflow"))}</h3>
        <div class="segmented" role="group" aria-label="${escapeHtml(ui("workflow"))}">
          <button class="segment ${demoState.workflow === "plan" ? "active" : ""}" id="demoWorkflowPlan" type="button">${escapeHtml(ui("planTest"))}</button>
          <button class="segment ${demoState.workflow === "evaluate" ? "active" : ""}" id="demoWorkflowEvaluate" type="button">${escapeHtml(ui("evaluateTestResults"))}</button>
        </div>
        ${renderDemoForm()}
        <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("dataCheck"))}</h3>
        <div class="info-list" id="demoDataCheck">${renderDemoDataCheck()}</div>
        <p class="privacy">${escapeHtml(ui("localOnly"))}</p>
        </div>
        <div class="sidebar-footer"><button class="btn" id="demoResetButton" type="button">${escapeHtml(ui("reset"))}</button><button class="btn primary" id="demoRunButton" type="button">${escapeHtml(ui("demoRunButton"))}</button></div>
      </aside>
      <main class="main">
        ${renderModuleResultTabs("demo", tabs)}
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "overview")}>
          <section class="panel summary">
            <span class="status-badge muted">${escapeHtml(ui("inDevelopment"))}</span>
            <h2>${escapeHtml(ui("demoSummary"))}</h2>
            <p>${escapeHtml(ui("demoIntroFull"))}</p>
            <div class="kpis">${renderDemoKpis()}</div>
          </section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "plan")}>
          <section class="panel block"><h3>${escapeHtml(ui("verificationPlanTab"))}</h3><div class="info-list result-statistics">${renderDemoDataCheck()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "results")}>
          <section class="panel block"><h3>${escapeHtml(ui("verificationResultsTab"))}</h3><div class="kpis">${renderDemoKpis()}</div></section>
          <section class="panel block"><h3>${escapeHtml(ui("demoEvidenceGap"))}</h3><div class="info-list">${renderDemoGap()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "confidence")}>
          <section class="panel block result-chart-panel"><h3>${escapeHtml(ui("demoEvidenceChart"))}</h3><div class="chart result-chart result-chart-full" id="demonstrationEvidenceChart">${demoState.chartSvg || escapeHtml(ui("realCurvePlaceholder"))}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "conclusion")}>
          <section class="panel insight"><h3 style="margin:0 0 12px;font-size:15px">${escapeHtml(ui("verificationConclusionTab"))}</h3><div class="insight-grid">${renderDemoInsight()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "statistics")}>
          <section class="panel block"><h3>${escapeHtml(ui("assumptionsNotices"))}</h3><div class="info-list">${renderDemoBoundaries()}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("demo", "data")}>
          <section class="panel block"><h3>${escapeHtml(ui("dataCheck"))}</h3><div class="info-list result-statistics">${renderDemoDataCheck()}</div></section>
          <section class="panel block"><h3>${escapeHtml(ui("report"))}</h3><div class="report-actions"><button class="btn" id="demoExportHtmlButton" type="button" ${demoState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("exportHtml"))}</button><button class="btn" id="demoExportPdfButton" type="button" ${demoState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("exportPdf"))}</button><button class="btn" id="demoPrintButton" type="button" ${demoState.reportHtml ? "" : "disabled"}>${escapeHtml(ui("print"))}</button></div></section>
        </div>
      </main>
    </div>`;
  bindDemoPanelEvents();
  bindModuleDashboard("demo");
  updateDemoRunState();
}

function renderDemoForm() {
  if (demoState.method === "sample") return renderDemoSampleForm();
  return renderDemoTimeForm();
}

function renderDemoSampleForm() {
  const input = demoState.inputs;
  const evidence = demoState.workflow === "plan"
    ? `<div class="field"><label for="demoAllowableFailures">${escapeHtml(ui("allowableFailures"))} · ${escapeHtml(ui("advanced"))}</label><input id="demoAllowableFailures" data-demo-input="allowableFailures" type="number" min="0" step="1" value="${escapeHtml(input.allowableFailures)}" /></div>
       <div class="field"><label for="demoMissionTime">${escapeHtml(ui("missionTime"))}</label><input id="demoMissionTime" data-demo-input="missionTime" type="number" min="0" step="any" value="${escapeHtml(input.missionTime)}" /></div>`
    : `<div class="field"><label for="demoUnitsTested">${escapeHtml(ui("unitsTested"))}</label><input id="demoUnitsTested" data-demo-input="unitsTested" type="number" min="1" step="1" value="${escapeHtml(input.unitsTested)}" /></div>
       <div class="field"><label for="demoObservedFailures">${escapeHtml(ui("observedFailures"))}</label><input id="demoObservedFailures" data-demo-input="observedFailures" type="number" min="0" step="1" value="${escapeHtml(input.observedFailures)}" /></div>
       <div class="field"><label for="demoMissionTime">${escapeHtml(ui("missionTime"))}</label><input id="demoMissionTime" data-demo-input="missionTime" type="number" min="0" step="any" value="${escapeHtml(input.missionTime)}" /></div>`;
  return `<h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("targetInputs"))}</h3>
    <div class="mini-grid">
      <div class="field"><label for="demoTargetReliability">${escapeHtml(ui("targetReliability"))}</label><input id="demoTargetReliability" data-demo-input="targetReliability" type="number" min="0" max="100" step="any" value="${escapeHtml(input.targetReliability)}" /></div>
      <div class="field"><label for="demoConfidence">${escapeHtml(ui("confidenceLevel"))}</label><input id="demoConfidence" data-demo-input="confidenceLevel" type="number" min="0" max="100" step="any" value="${escapeHtml(input.confidenceLevel)}" /></div>
      <div class="field"><label for="demoTimeUnit">${escapeHtml(ui("timeUnit"))}</label><select id="demoTimeUnit" data-demo-input="timeUnit">${demoTimeUnitOptions()}</select></div>
    </div>
    <div class="mini-actions" style="margin-top:8px">${[0.8, 0.9, 0.95, 0.99].map(value => `<button class="btn" type="button" data-demo-confidence="${value}">${Math.round(value * 100)}%</button>`).join("")}</div>
    <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("evidenceInputs"))}</h3>
    <div class="mini-grid">${evidence}</div>`;
}

function renderDemoTimeForm() {
  const input = demoState.inputs;
  const targetFields = demoState.targetDefinition === "reliability"
    ? `<div class="field"><label for="demoTargetReliability">${escapeHtml(ui("targetReliability"))}</label><input id="demoTargetReliability" data-demo-input="targetReliability" type="number" min="0" max="100" step="any" value="${escapeHtml(input.targetReliability)}" /></div>
       <div class="field"><label for="demoMissionTime">${escapeHtml(ui("missionTime"))}</label><input id="demoMissionTime" data-demo-input="missionTime" type="number" min="0" step="any" value="${escapeHtml(input.missionTime)}" /></div>`
    : `<div class="field"><label for="demoTargetMTBF">${escapeHtml(ui("targetMTBF"))}</label><input id="demoTargetMTBF" data-demo-input="targetMTBF" type="number" min="0" step="any" value="${escapeHtml(input.targetMTBF)}" /></div>`;
  const evidence = demoState.workflow === "plan"
    ? `<div class="field"><label for="demoAllowableFailures">${escapeHtml(ui("allowableFailures"))}</label><input id="demoAllowableFailures" data-demo-input="allowableFailures" type="number" min="0" step="1" value="${escapeHtml(input.allowableFailures)}" /></div>
       <div class="field"><label for="demoNumberOfUnits">${escapeHtml(ui("numberOfUnits"))}</label><input id="demoNumberOfUnits" data-demo-input="numberOfUnits" type="number" min="0" step="any" value="${escapeHtml(input.numberOfUnits)}" /></div>`
    : `<div class="field"><label for="demoTotalTestTime">${escapeHtml(ui("totalTestTime"))}</label><input id="demoTotalTestTime" data-demo-input="totalTestTime" type="number" min="0" step="any" value="${escapeHtml(input.totalTestTime)}" /></div>
       <div class="field"><label for="demoObservedFailures">${escapeHtml(ui("observedFailures"))}</label><input id="demoObservedFailures" data-demo-input="observedFailures" type="number" min="0" step="1" value="${escapeHtml(input.observedFailures)}" /></div>`;
  return `<h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("targetDefinition"))}</h3>
    <div class="segmented" role="group" aria-label="${escapeHtml(ui("targetDefinition"))}">
      <button class="segment ${demoState.targetDefinition === "mtbf" ? "active" : ""}" id="demoTargetDefMTBF" type="button">${escapeHtml(ui("targetMTBF"))}</button>
      <button class="segment ${demoState.targetDefinition === "reliability" ? "active" : ""}" id="demoTargetDefReliability" type="button">${escapeHtml(ui("reliabilityRt"))}</button>
    </div>
    <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("targetInputs"))}</h3>
    <div class="mini-grid">
      ${targetFields}
      <div class="field"><label for="demoConfidence">${escapeHtml(ui("confidenceLevel"))}</label><input id="demoConfidence" data-demo-input="confidenceLevel" type="number" min="0" max="100" step="any" value="${escapeHtml(input.confidenceLevel)}" /></div>
      <div class="field"><label for="demoTimeUnit">${escapeHtml(ui("timeUnit"))}</label><select id="demoTimeUnit" data-demo-input="timeUnit">${demoTimeUnitOptions()}</select></div>
    </div>
    <div class="mini-actions" style="margin-top:8px">${[0.8, 0.9, 0.95, 0.99].map(value => `<button class="btn" type="button" data-demo-confidence="${value}">${Math.round(value * 100)}%</button>`).join("")}</div>
    <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("evidenceInputs"))}</h3>
    <div class="mini-grid">${evidence}</div>`;
}

function renderDemoDataCheck() {
  const rows = [
    [ui("demoMethod"), demoMethodLabel()],
    [ui("workflow"), demoWorkflowLabel()],
    [ui("confidenceLevel"), displayPercent(normalizePercentInput(demoState.inputs.confidenceLevel))]
  ];
  const target = demoTargetSummary();
  if (target) rows.push([ui("targetDefinition"), target]);
  return rows.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("")
    + demoState.validation.errors.map(error => `<div class="info-item error"><b>${escapeHtml(ui("error"))}</b><span>${escapeHtml(error)}</span></div>`).join("")
    + demoState.validation.warnings.map(warning => `<div class="info-item warn"><b>${escapeHtml(ui("notice"))}</b><span>${escapeHtml(warning)}</span></div>`).join("");
}

function renderDemoKpis() {
  return demonstrationKpiRows({
    result: demoState.result,
    method: demoState.method,
    workflow: demoState.workflow,
    inputs: demoState.inputs
  }, {
    ui,
    fmt,
    pct,
    unitLabel,
    displayPercent,
    normalizePercentInput,
    methodLabel: demoMethodLabel,
    workflowLabel: demoWorkflowLabel,
    demonstratedLabel: demoDemonstratedLabel,
    acceptanceRule: demoAcceptanceRule
  }).map(kpi).join("");
}

function renderDemoGap() {
  const rows = demonstrationGapRows(
    demoState.result,
    demoState.inputs.timeUnit,
    { ui, fmt, unitLabel, localizeRuntimeText: localizeDemoRuntimeText }
  );
  if (!rows) return `<div class="info-item"><b>${escapeHtml(ui("demoEvidenceGap"))}</b><span>${escapeHtml(ui("waitingResult"))}</span></div>`;
  return rows.map(([b, s]) => `<div class="info-item"><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join("");
}

function renderDemoInsight() {
  const insight = demoState.insight || buildDemoInsight({ result: null, method: demoState.method, workflow: demoState.workflow, lang: state.lang });
  return `
    <div class="insight-card"><h4>${escapeHtml(ui("result"))}</h4><strong>${escapeHtml(localizeDemoInsightText(insight.result))}</strong><p>${escapeHtml(localizeDemoInsightText(insight.evidence))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("meaning"))}</h4><strong>${escapeHtml(localizeDemoInsightText(insight.meaning))}</strong><p>${escapeHtml(ui("demoNoMechanismClaim"))}</p></div>
    <div class="insight-card"><h4>${escapeHtml(ui("assumptions"))}</h4><ul>${(insight.assumptions || []).map(item => `<li>${escapeHtml(localizeDemoInsightText(item))}</li>`).join("")}</ul></div>
    <div class="insight-card"><h4>${escapeHtml(ui("recommendedActions"))}</h4><ul>${(insight.recommendedActions || []).map(item => `<li>${escapeHtml(localizeDemoInsightText(item))}</li>`).join("")}</ul></div>`;
}

function renderDemoBoundaries() {
  const sample = demoState.method === "sample";
  const items = sample
    ? [ui("demoSampleBoundary1"), ui("demoSampleBoundary2"), ui("demoSampleBoundary3"), ui("demoUnsupported")]
    : [ui("demoTimeBoundary1"), ui("demoTimeBoundary2"), ui("demoTimeBoundary3"), ui("demoUnsupported")];
  return items.map((item, index) => `<div class="info-item"><b>${escapeHtml(index === items.length - 1 ? ui("limitations") : ui("assumptions"))}</b><span>${escapeHtml(item)}</span></div>`).join("");
}

function bindDemoPanelEvents() {
  $("demoMethodSample")?.addEventListener("click", () => setDemoMethod("sample"));
  $("demoMethodTime")?.addEventListener("click", () => setDemoMethod("time"));
  $("demoWorkflowPlan")?.addEventListener("click", () => setDemoWorkflow("plan"));
  $("demoWorkflowEvaluate")?.addEventListener("click", () => setDemoWorkflow("evaluate"));
  $("demoTargetDefMTBF")?.addEventListener("click", () => setDemoTargetDefinition("mtbf"));
  $("demoTargetDefReliability")?.addEventListener("click", () => setDemoTargetDefinition("reliability"));
  document.querySelectorAll("[data-demo-input]").forEach(input => input.addEventListener("input", event => handleDemoInput(event.target.dataset.demoInput, event.target.value)));
  document.querySelectorAll("select[data-demo-input]").forEach(input => input.addEventListener("change", event => handleDemoInput(event.target.dataset.demoInput, event.target.value)));
  document.querySelectorAll("[data-demo-confidence]").forEach(button => button.addEventListener("click", event => handleDemoInput("confidenceLevel", event.target.dataset.demoConfidence)));
  $("demoRunButton")?.addEventListener("click", runDemoAnalysis);
  $("demoResetButton")?.addEventListener("click", resetDemo);
  $("demoExportHtmlButton")?.addEventListener("click", () => demoState.reportHtml && downloadHtml(demoState.reportHtml, "reliability-demonstration-report.html"));
  $("demoExportPdfButton")?.addEventListener("click", () => demoState.reportHtml && printReport(demoState.reportHtml));
  $("demoPrintButton")?.addEventListener("click", () => demoState.reportHtml && printReport(demoState.reportHtml));
}

function setDemoMethod(method) {
  if (demoState.method === method) return;
  moduleDashboardState.demo.collapsed = false;
  demoState.method = method;
  if (method === "sample") demoState.targetDefinition = "mtbf";
  invalidateDemoResult(demoState);
  renderDemoPanel();
}

function setDemoWorkflow(workflow) {
  if (demoState.workflow === workflow) return;
  moduleDashboardState.demo.collapsed = false;
  demoState.workflow = workflow;
  invalidateDemoResult(demoState);
  renderDemoPanel();
}

function setDemoTargetDefinition(targetDefinition) {
  if (demoState.targetDefinition === targetDefinition) return;
  moduleDashboardState.demo.collapsed = false;
  demoState.targetDefinition = targetDefinition;
  invalidateDemoResult(demoState);
  renderDemoPanel();
}

function handleDemoInput(field, value) {
  demoState.inputs[field] = value;
  invalidateDemoResult(demoState);
  demoState.validation = validateDemoInputs(demoState, ui);
  renderDemoPanel();
}

function runDemoAnalysis() {
  demoState.validation = validateDemoInputs(demoState, ui);
  if (demoState.validation.errors.length) {
    renderDemoPanel();
    return;
  }
  const engineResult = analyzeDemonstration({
    method: demoState.method,
    workflow: demoState.workflow,
    targetDefinition: demoState.targetDefinition,
    inputs: demoState.inputs
  });
  const adapted = adaptDemonstrationFacadeResult(engineResult);
  if (!adapted.ok && !adapted.error) {
    demoState.validation = {
      errors: adapted.validation.errors.map(localizeDemoEngineMessage),
      warnings: adapted.validation.warnings.map(localizeDemoEngineMessage)
    };
    renderDemoPanel();
    return;
  }
  if (adapted.error) {
    demoState.validation.errors = [
      localizeDemoRuntimeText(adapted.error.message)
    ];
    renderDemoPanel();
    return;
  }
  Object.assign(demoState, adapted.state);
  demoState.chartSvg = demonstrationEvidenceChartSvg(demoState.result, demoChartLabels());
  buildDemoReport();
  moduleDashboardState.demo.collapsed = true;
  moduleDashboardState.demo.activeTab = "overview";
  renderDemoPanel();
}

function localizeDemoEngineMessage(message) {
  const translated = ui(message);
  return translated === message
    ? localizeDemoRuntimeText(message)
    : translated;
}

function buildDemoReport() {
  demoState.reportHtml = buildDemoReportHtml({ ...demoState, lang: state.lang });
}

function resetDemo() {
  resetDemoState(demoState);
  moduleDashboardState.demo.collapsed = false;
  moduleDashboardState.demo.activeTab = "overview";
  renderDemoPanel();
}

function renderAltPanel() {
  const tabs = [
    ["overview", "resultOverview"],
    ["model-fit", "altModelFitTab"],
    ["acceleration-model", "altAccelerationModelTab"],
    ["use-prediction", "altUsePredictionTab"],
    ["diagnostics", "altDiagnosticsTab"],
    ["statistics", "resultStatisticalInfo"],
    ["data", "resultDataSummary"]
  ];
  $("altPanel").innerHTML = `
    <div class="layout" data-dashboard-layout="alt">
      <aside class="panel sidebar" data-dashboard-sidebar="alt">
        <div class="sidebar-header">
          <h2 class="section-title">${escapeHtml(ui("navAltFull"))}</h2>
          <button class="sidebar-toggle" id="altSidebarToggle" type="button" aria-expanded="true" aria-controls="altSidebarDetails"><span aria-hidden="true">‹</span></button>
        </div>
        <div class="step-list dashboard-steps">
          <div class="step active"><div class="step-num">1</div><div><strong>${escapeHtml(ui("enterData"))}</strong><span>${escapeHtml(ui("notAvailable"))}</span></div></div>
          <div class="step"><div class="step-num">2</div><div><strong>${escapeHtml(ui("altDefineModel"))}</strong><span>${escapeHtml(ui("comingSoon"))}</span></div></div>
          <div class="step"><div class="step-num">3</div><div><strong>${escapeHtml(ui("stepRun"))}</strong><span>${escapeHtml(ui("comingSoon"))}</span></div></div>
        </div>
        <div class="sidebar-details" id="altSidebarDetails" data-dashboard-details="alt">
          <div class="info-list">
            <div class="info-item"><b>${escapeHtml(ui("comingSoon"))}</b><span>${escapeHtml(ui("altBoundary"))}</span></div>
          </div>
          <h3 class="section-title" style="margin-top:14px">${escapeHtml(ui("altAccelerationModelTab"))}</h3>
          <div class="future-list"><span>Arrhenius</span><span>Peck</span><span>Coffin-Manson</span></div>
          <p class="privacy">${escapeHtml(ui("localOnly"))}</p>
        </div>
        <div class="sidebar-footer"><button class="btn" id="altResetButton" type="button">${escapeHtml(ui("reset"))}</button><button class="btn primary" id="altRunButton" type="button" disabled aria-disabled="true">${escapeHtml(ui("run"))}</button></div>
      </aside>
      <main class="main">
        ${renderModuleResultTabs("alt", tabs)}
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "overview")}>
          <section class="panel summary">
            <span class="status-badge muted">${escapeHtml(ui("comingSoon"))}</span>
            <h2>${escapeHtml(ui("navAltFull"))}</h2>
            <p>${escapeHtml(ui("altDescription"))}</p>
            <div class="kpis">${renderAltKpis()}</div>
          </section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "model-fit")}>${unavailableDashboardPanel("altModelFitTab", "altUnavailable")}</div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "acceleration-model")}>
          <section class="panel block"><h3>${escapeHtml(ui("altAccelerationModelTab"))}</h3><div class="future-list"><span>Arrhenius</span><span>Peck</span><span>Coffin-Manson</span></div><p class="eta-note">${escapeHtml(ui("altBoundary"))}</p></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "use-prediction")}>${unavailableDashboardPanel("altUsePredictionTab", "altUnavailable")}</div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "diagnostics")}>
          <section class="panel block result-chart-panel"><h3>${escapeHtml(ui("altDiagnosticsTab"))}</h3><div class="chart result-chart result-chart-full" id="altDiagnosticsChart">${escapeHtml(ui("altUnavailable"))}</div></section>
        </div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "statistics")}>${unavailableDashboardPanel("resultStatisticalInfo", "altUnavailable")}</div>
        <div class="dashboard-panel-stack" ${modulePanelAttributes("alt", "data")}>${unavailableDashboardPanel("resultDataSummary", "altUnavailable")}</div>
      </main>
    </div>`;
  $("altResetButton")?.addEventListener("click", () => {
    moduleDashboardState.alt.collapsed = true;
    moduleDashboardState.alt.activeTab = "overview";
    renderAltPanel();
  });
  bindModuleDashboard("alt");
}

function renderAltKpis() {
  return [
    [ui("altAccelerationModel"), ui("notAvailable")],
    [ui("betaParameters"), "-"],
    [ui("characteristicLife"), "-"],
    [ui("accelerationFactor"), "-"]
  ].map(kpi).join("");
}

function updateDemoRunState() {
  const button = $("demoRunButton");
  if (!button) return;
  const disabled = demoState.validation.errors.length > 0;
  button.disabled = disabled;
  button.setAttribute("aria-disabled", disabled ? "true" : "false");
}

function demoCalculationInput() {
  const input = demoState.inputs;
  const common = {
    targetReliability: normalizePercentInput(input.targetReliability),
    confidenceLevel: normalizePercentInput(input.confidenceLevel),
    allowableFailures: input.allowableFailures === "" ? 0 : Number(input.allowableFailures),
    missionTime: input.missionTime === "" ? null : Number(input.missionTime),
    timeUnit: input.timeUnit,
    targetDefinition: demoState.targetDefinition
  };
  if (demoState.method === "sample") {
    return demoState.workflow === "plan"
      ? common
      : { ...common, unitsTested: Number(input.unitsTested), observedFailures: Number(input.observedFailures || 0) };
  }
  return demoState.workflow === "plan"
    ? { ...common, targetMTBF: Number(input.targetMTBF), numberOfUnits: input.numberOfUnits === "" ? null : Number(input.numberOfUnits) }
    : { ...common, targetMTBF: Number(input.targetMTBF), totalTestTime: Number(input.totalTestTime), observedFailures: Number(input.observedFailures || 0) };
}

function demoMethodLabel() {
  return demoState.method === "sample" ? `${ui("sampleBasedDemo")} / ${ui("binomialModel")}` : `${ui("timeBasedDemo")} / ${ui("exponentialModel")}`;
}

function demoWorkflowLabel() {
  return demoState.workflow === "plan" ? ui("planTest") : ui("evaluateTestResults");
}

function demoTargetSummary() {
  const input = demoState.inputs;
  if (demoState.method === "sample") return displayPercent(normalizePercentInput(input.targetReliability));
  if (demoState.targetDefinition === "reliability" && Number.isFinite(normalizePercentInput(input.targetReliability)) && Number(input.missionTime) > 0) {
    const targetMTBF = previewDemonstrationTarget({
      targetDefinition: demoState.targetDefinition,
      targetReliability: input.targetReliability,
      missionTime: input.missionTime
    });
    return targetMTBF == null
      ? displayPercent(normalizePercentInput(input.targetReliability))
      : `${displayPercent(normalizePercentInput(input.targetReliability))} R(t), MTBF ${fmt(targetMTBF)}`;
  }
  return input.targetMTBF ? `${fmt(input.targetMTBF)} ${unitLabel(input.timeUnit)}` : "";
}

function demoTimeUnitOptions() {
  return ["hours", "cycles", "days", "minutes", "other"].map(unit => `<option value="${unit}" ${demoState.inputs.timeUnit === unit ? "selected" : ""}>${escapeHtml(unitLabel(unit))}</option>`).join("");
}

function demoChartLabels() {
  return {
    evidenceChart: ui("demoEvidenceChart"),
    x: demoState.method === "sample" ? ui("sampleSize") : ui("totalTestTime"),
    achievedConfidence: ui("achievedConfidence"),
    requiredConfidence: ui("requiredConfidence"),
    evidenceGap: ui("demoEvidenceGap")
  };
}

function demoDemonstratedLabel(value) {
  return value ? ui("targetDemonstrated") : ui("targetNotDemonstrated");
}

function demoAcceptanceRule(result) {
  if (!result || result.workflow !== "plan") return "-";
  const unit = unitLabel(demoState.inputs.timeUnit);
  if (state.lang === "zh") {
    if (result.method === "sample") return `测试 ${fmt(result.requiredSampleSize)} 个样品，失效数量不得超过 ${fmt(result.allowableFailures)} 个。`;
    return `累计至少 ${fmt(result.requiredTotalTestTime)} ${unit} 的运行暴露时间，失效数量不得超过 ${fmt(result.allowableFailures)} 个。`;
  }
  if (result.method === "sample") return result.acceptanceRule;
  return `Accumulate at least ${fmt(result.requiredTotalTestTime)} ${unit} and observe no more than ${fmt(result.allowableFailures)} failures.`;
}

function displayPercent(value) {
  return Number.isFinite(Number(value)) ? pct(Number(value)) : "-";
}

function uniqueMessages(messages) {
  return Array.from(new Set(messages));
}

function updateMTBFRunState() {
  const button = $("mtbfRunButton");
  if (!button) return;
  const validation = mtbfState.validation;
  const disabled = !validation || validation.errors.length > 0 || (mtbfState.inputMode === "unit" && (!mtbfState.mapping.exposureTime || !mtbfState.mapping.status));
  button.disabled = disabled;
  button.setAttribute("aria-disabled", disabled ? "true" : "false");
}

function updateRunState() {
  const disabled = !state.validation || state.validation.errors.length > 0 || !state.mapping.time || !state.mapping.status;
  $("runButton").disabled = disabled;
  $("runButton").setAttribute("aria-disabled", disabled ? "true" : "false");
}

function updateSteps(active) {
  document.querySelectorAll("#steps .step").forEach(step => {
    const n = Number(step.dataset.step);
    step.classList.toggle("active", n === active);
    step.classList.toggle("done", n < active);
  });
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
  ["life", "mtbf", "demo", "alt"].forEach(name => $(`${name}Panel`).classList.toggle("active", name === mode));
  setAnalysisToolsOpen(false);
  renderHero();
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("reliability.ui.lang", lang);
  applyLanguage();
  window.dispatchEvent(new Event("languagechange"));
}

function applyLanguage() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(state.lang, node.dataset.i18n); });
  $("languageSelect").value = state.lang;
  $("languageSelect").setAttribute("aria-label", ui("language"));
  $("targetReliability").placeholder = ui("targetPlaceholder");
  $("productName").placeholder = ui("optionalPlaceholder");
  renderHero();
  renderMapping();
  renderValidation();
  renderPreview();
  if (state.metrics) {
    refreshLifePlotPresentation();
    renderResults();
  }
  else renderEmptyResults();
  refreshModulePlotPresentation();
  renderMtbfPanel();
  renderDemoPanel();
  renderAltPanel();
  setSidebarCollapsed(isSidebarCollapsed);
  helpDrawer?.setLanguage(state.lang);
}

function refreshModulePlotPresentation() {
  if (mtbfState.result?.estimable) {
    mtbfState.curveSvg = mtbfReliabilityCurveSvg(mtbfState.result, mtbfChartLabels());
  }
  if (demoState.result) {
    demoState.chartSvg = demonstrationEvidenceChartSvg(demoState.result, demoChartLabels());
  }
}

function refreshLifePlotPresentation() {
  const snapshot = state.authoritySnapshot;
  if (!snapshot?.charts || !state.metrics) return;
  state.plots = {
    ...state.plots,
    probability: weibullProbabilityPlotFromDataSvg(
      snapshot.charts.probability,
      chartLabels()
    ),
    reliability: reliabilityCurveFromDataSvg(
      snapshot.charts.reliability,
      missionChartPoint(snapshot),
      chartLabels(),
      {
        mode: "reliability",
        width: RESULT_CHART_SIZE.split.width,
        targetReliability: snapshot.decision
          ?.requirement?.targetReliability
      }
    ),
    failure: reliabilityCurveFromDataSvg(
      snapshot.charts.cumulativeFailure,
      missionChartPoint(snapshot),
      chartLabels(),
      {
        mode: "failure",
        width: RESULT_CHART_SIZE.split.width,
        targetReliability: snapshot.decision
          ?.requirement?.targetReliability
      }
    )
  };
}

function renderHero() {
  const titleKey = state.mode === "mtbf"
    ? "mtbfTitle"
    : state.mode === "demo"
      ? "demoTitle"
      : state.mode === "alt"
        ? "navAltFull"
        : "title";
  const subtitleKey = state.mode === "mtbf"
    ? "mtbfSubtitle"
    : state.mode === "demo"
      ? "demoSubtitle"
      : state.mode === "alt"
        ? "altDescription"
        : "subtitle";
  const titleNode = document.querySelector(".hero h1");
  const subtitleNode = document.querySelector(".hero p");
  if (titleNode) titleNode.textContent = ui(titleKey);
  if (subtitleNode) subtitleNode.textContent = ui(subtitleKey);
}

function reset() {
  lifeDataAuthority.cancel("reset");
  resetLifeDataState(state);
  clearLifeDataAuthorityResult();
  $("pasteInput").value = "";
  $("fileInput").value = "";
  $("missionTime").value = "";
  state.customPercentile = "";
  state.customTime = "";
  state.curveMode = "reliability";
  $("customPercentile").value = "";
  $("customTime").value = "";
  renderMapping();
  renderValidation();
  renderPreview();
  renderEmptyResults();
  renderMtbfPanel();
  renderDemoPanel();
  updateSteps(1);
  updateRunState();
  setSidebarCollapsed(false);
}

function kpi([label, value]) {
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function renderMessage(id, message, type) {
  $(id).innerHTML = `<div class="info-item ${type}"><b>${type === "error" ? "Error" : "Notice"}</b><span>${escapeHtml(message)}</span></div>`;
}

function downloadText(fileName, text) {
  const blob = new Blob([text], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function downloadXlsxTemplate(fileName = "reliability-template.xlsx", headers = templateHeaders, bodyRows = [["S001", "100", "Failure", "", ""], ["S002", "200", "Censored", "", ""]], sheetName = "Life Data") {
  const rows = [headers, ...bodyRows];
  const blob = new Blob([makeSimpleXlsx(rows, sheetName)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function makeSimpleXlsx(rows, sheetName = "Life Data") {
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheetXml(rows)
  };
  return zipStore(files);
}

function sheetXml(rows) {
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = zipHeader(0x04034b50, nameBytes, data.length, crc, offset);
    chunks.push(local, nameBytes, data);
    central.push([zipHeader(0x02014b50, nameBytes, data.length, crc, offset), nameBytes]);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralOffset = offset;
  central.forEach(([header, nameBytes]) => { chunks.push(header, nameBytes); offset += header.length + nameBytes.length; });
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, central.length, true);
  view.setUint16(10, central.length, true);
  view.setUint32(12, offset - centralOffset, true);
  view.setUint32(16, centralOffset, true);
  chunks.push(end);
  return new Blob(chunks);
}

function zipHeader(signature, nameBytes, size, crc, relativeOffset) {
  const isCentral = signature === 0x02014b50;
  const header = new Uint8Array(isCentral ? 46 : 30);
  const view = new DataView(header.buffer);
  view.setUint32(0, signature, true);
  if (isCentral) {
    view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint32(16, crc, true); view.setUint32(20, size, true); view.setUint32(24, size, true); view.setUint16(28, nameBytes.length, true); view.setUint32(42, relativeOffset, true);
  } else {
    view.setUint16(4, 20, true); view.setUint32(14, crc, true); view.setUint32(18, size, true); view.setUint32(22, size, true); view.setUint16(26, nameBytes.length, true);
  }
  return header;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  bytes.forEach(byte => { c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); });
  return (c ^ 0xffffffff) >>> 0;
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 5 }) : "-";
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "-";
}

function unitLabel(unit) {
  return t(state.lang, unit) || unit;
}

function chartLabels() {
  return {
    probPlot: ui("probPlot"),
    time: ui("chartTime"),
    unit: unitLabel($("timeUnit").value),
    failureProbability: ui("chartFailureProbability"),
    cumulativeFailureProbability: ui("chartFailureProbability"),
    reliability: ui("chartReliability"),
    reliabilityCurve: ui("reliabilityCurve"),
    reliabilityRt: ui("reliabilityRt"),
    cumulativeFailureFt: ui("cumulativeFailureFt"),
    failure: ui("failure"),
    failureObservation: ui("failureObservation"),
    rightCensored: ui("rightCensored"),
    censored: ui("censoredObservation"),
    weibullLine: ui("weibullLine"),
    sample: ui("sample"),
    failureTime: ui("failureTime"),
    estimatedCumulativeFailure: ui("estimatedCumulativeFailure"),
    status: ui("statusColumn"),
    failureMode: ui("failureMode"),
    testCondition: ui("testCondition"),
    notProvided: ui("notProvided"),
    missionTime: ui("missionTime"),
    targetReliability: ui("targetReliability"),
    targetFailureProbability: ui("targetFailureProbability")
  };
}

function mtbfChartLabels() {
  return {
    time: ui("chartTime"),
    reliability: ui("chartReliability"),
    reliabilityCurve: ui("reliabilityCurve"),
    exponentialCurve: ui("exponentialCurve"),
    missionTime: ui("missionTime")
  };
}

function failureRateUnitLabel(unit) {
  const keys = {
    hours: "failureRateUnitHours",
    cycles: "failureRateUnitCycles",
    days: "failureRateUnitDays",
    minutes: "failureRateUnitMinutes",
    other: "failureRateUnitOther"
  };
  return ui(keys[unit] || "failureRateUnitOther");
}

function formatRate(value) {
  if (!Number.isFinite(Number(value))) return "-";
  const number = Number(value);
  return Math.abs(number) > 0 && Math.abs(number) < 0.001 ? number.toExponential(3) : fmt(number);
}

function localizeTargetStatus(status) {
  if (status === "Meets Target") return ui("meetsTarget");
  if (status === "Below Target") return ui("belowTarget");
  return ui("targetNotProvided");
}

function localizeTargetMessage(message) {
  if (message.includes("between 0 and 1")) return ui("targetInvalidMessage");
  if (message.includes("no target reliability")) return ui("targetNotProvidedMessage");
  if (message.includes("meets")) return ui("meetsTargetMessage");
  if (message.includes("below")) return ui("belowTargetMessage");
  return message;
}

function localizeRuntimeText(text) {
  if (state.lang !== "zh") return text;
  if (text.includes("Limited failure information")) return "失效数据较少，参数估计可能不稳定。";
  if (text.includes("No right-censored observations")) return "未检测到右删失数据。";
  if (text.includes("Weibull parameters cannot be estimated without observed failures")) return ui("zeroFailureNoFit");
  if (text.includes("invalid Time")) return text.replace("invalid Time", "非法 Time").replace("Time must be a finite positive number.", "Time 必须为有限正数。").replace("Row", "行");
  if (text.includes("unrecognized Status")) return text.replace("Row", "行").replace("unrecognized Status", "无法识别 Status");
  if (text.includes("Duplicate Sample ID")) return text.replace("Duplicate Sample ID", "重复 Sample ID").replace("at rows", "位于行");
  if (text.includes("All Time values are identical")) return "所有有效时间完全相同，无法估计 Weibull 参数。";
  if (text.includes("No valid records")) return "未找到有效记录。";
  return text;
}

function localizeCustomInputError(text) {
  if (state.lang !== "zh") return text;
  if (text.includes("Custom percentile")) return "自定义百分位必须大于 0 且小于 100。";
  if (text.includes("Custom time")) return "自定义时间必须为有限正数。";
  return text;
}

function localizeMTBFTargetStatus(status) {
  if (status === "Meets Target") return ui("meetsTarget");
  if (status === "Below Target") return ui("belowTarget");
  if (status === "Not Estimable") return ui("notEstimable");
  return ui("targetNotProvided");
}

function localizeMTBFTargetMessage(message = "") {
  if (state.lang !== "zh") return message || ui("mtbfNoTargetMessage");
  if (message.includes("no target MTBF")) return ui("mtbfNoTargetMessage");
  if (message.includes("finite positive")) return ui("targetMtbfInvalid");
  if (message.includes("not available")) return "MTBF 点估计不可用，因此未进行目标比较。";
  if (message.includes("meets")) return ui("mtbfMeetsTargetMessage");
  if (message.includes("below")) return ui("mtbfBelowTargetMessage");
  return message || ui("mtbfNoTargetMessage");
}

function localizeMTBFRuntimeText(text) {
  if (state.lang !== "zh") return text;
  if (text.includes("Total Time on Test")) return ui("totalExposureInvalid");
  if (text.includes("Failure Count")) return ui("failureCountInvalid");
  if (text.includes("Mission Time")) return ui("missionTimeInvalid");
  if (text.includes("Target MTBF")) return ui("targetMtbfInvalid");
  if (text.includes("zero-failure")) return ui("mtbfZeroMessage");
  if (text.includes("Unsupported time unit")) return "不支持所选时间单位。";
  if (text.includes("invalid Exposure Time")) return text.replace("Row", "行").replace(/invalid Exposure Time "[^"]*"\. Exposure Time must be a finite positive number\./, "暴露时间非法，必须为有限正数。");
  if (text.includes("unrecognized Status")) return text.replace("Row", "行").replace("unrecognized Status", "无法识别状态");
  if (text.includes("Duplicate Unit ID")) return text.replace("Duplicate Unit ID", "重复单元编号").replace("at rows", "位于行");
  if (text.includes("No valid unit exposure records")) return "未找到有效单元暴露记录。";
  return text;
}

function localizeDemoRuntimeText(text) {
  if (state.lang !== "zh") return text;
  const replacements = new Map([
    ["Target Reliability must be greater than 0 and less than 1.", "目标可靠度必须大于 0 且小于 100%。"],
    ["Confidence Level must be greater than 0 and less than 1.", "置信水平必须大于 0 且小于 100%。"],
    ["Allowable Failures must be a non-negative integer.", "允许失效数必须为非负整数。"],
    ["Units Tested must be a positive integer.", "已测试样品数必须为正整数。"],
    ["Observed Failures must be a non-negative integer.", "观察到的失效数必须为非负整数。"],
    ["Observed Failures cannot be greater than Units Tested.", "观察到的失效数不得大于已测试样品数。"],
    ["Target MTBF must be a finite positive number.", "目标 MTBF 必须为有限正数。"],
    ["Mission Time must be a finite positive number.", "任务时间必须为有限正数。"],
    ["Total Test Time must be a finite positive number.", "总测试时间必须为有限正数。"],
    ["Number of Units must be a finite positive number.", "样品数必须为有限正数。"],
    ["This estimate assumes no additional failures occur in the added units.", "该估计假设新增测试样品中不再发生额外失效。"],
    ["This estimate assumes no additional failures occur during the additional exposure.", "该估计假设新增暴露时间内不再发生额外失效。"],
    ["No additional units are required.", "无需增加样品。"],
    ["No additional exposure is required.", "无需增加暴露时间。"],
    ["Unable to find a sample size within the current maximum limit.", "无法在当前样本量上限内找到方案。"],
    ["Unable to calculate additional units within the current maximum limit.", "无法在当前样本量上限内计算需增加的样品数。"],
    ["Unable to bracket Poisson exposure factor within current limits.", "无法在当前限制内包围泊松暴露因子。"],
    ["Root solver did not converge.", "求根计算未收敛。"],
    ["Root is not bracketed within the provided bounds.", "求根区间未包围目标解。"]
  ]);
  let output = text;
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  return output;
}

function localizeInsightText(text) {
  if (state.lang !== "zh") return text;
  const replacements = new Map([
    ["Decreasing failure-rate behavior", "失效率随时间下降的行为"],
    ["Approximately constant failure-rate behavior", "近似恒定失效率行为"],
    ["Increasing failure-rate behavior", "失效率随时间上升的行为"],
    ["Possible early-life failure pattern.", "可能存在早期失效模式。"],
    ["Random failure pattern may be present.", "可能存在随机失效模式。"],
    ["Potential wear-out pattern.", "可能存在磨损失效模式。"],
    ["The Weibull shape parameter does not confirm the physical failure mechanism.", "Weibull 形状参数不能确认物理失效机理。"],
    ["The result does not confirm that all failures are random or independent.", "该结果不能确认所有失效都是随机或相互独立的。"],
    ["Physical failure analysis is required to confirm the mechanism.", "需要物理失效分析确认机理。"],
    ["manufacturing variation", "制造波动"],
    ["process defects", "过程缺陷"],
    ["screening weakness", "筛选不足"],
    ["aging", "老化"],
    ["fatigue", "疲劳"],
    ["material degradation", "材料退化"],
    ["No confirmed physical failure mechanism is identified by beta alone.", "不能仅凭 β 确认物理失效机理。"],
    ["No confirmed physical failure mechanism is identified by β alone.", "不能仅凭 β 确认物理失效机理。"],
    ["Review right-censoring, sample size, and test stress coverage.", "复核右删失、样本量和试验应力覆盖。"],
    ["Compare predicted reliability only against an explicit mission requirement or target.", "仅在存在明确任务要求或目标时比较预测可靠度。"]
  ]);
  let output = text.replace("The fitted Weibull shape beta is", "拟合 Weibull 形状参数 β 为").replace("The fitted Weibull shape β is", "拟合 Weibull 形状参数 β 为").replace("The configured random-failure band is", "配置的随机失效区间为");
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  output = output.replace("Review possible considerations:", "复核可能关注项：").replace("Do not claim a confirmed physical mechanism from beta alone.", "不要仅凭 beta 声称已确认物理机理。");
  return output;
}

function localizeDemoInsightText(text) {
  if (state.lang !== "zh") return text;
  const replacements = new Map([
    ["Waiting for calculation", "等待计算"],
    ["No engineering interpretation is generated until a real demonstration calculation is completed.", "完成真实可靠性验证计算后，才会生成工程解释。"],
    ["Required evidence calculated", "已计算所需证据"],
    ["Target demonstrated at the selected confidence level", "在所选置信水平下已证明达到目标"],
    ["Target not demonstrated at the selected confidence level", "在所选置信水平下尚未证明达到目标"],
    ["The result is based on the exact binomial model, the selected target reliability, and the selected confidence level.", "该结果基于精确二项模型、所选目标可靠度和置信水平。"],
    ["The result is based on the exponential constant failure-rate model, the selected target, and the selected confidence level.", "该结果基于指数分布恒定失效率模型、所选目标和置信水平。"],
    ["Independent pass/fail observations", "通过/失效观测相互独立"],
    ["Same mission definition for all units", "所有样品采用相同任务定义"],
    ["No time-to-failure modeling", "不进行失效时间建模"],
    ["Exponential constant failure-rate assumption", "指数分布恒定失效率假设"],
    ["Independent failure events", "失效事件相互独立"],
    ["Accumulated exposure time is treated as reliable", "累计暴露时间被视为可信"],
    ["No reliability growth evaluation", "不评估可靠性增长"],
    ["Statistical demonstration does not confirm a physical failure mechanism", "统计验证不确认物理失效机理"],
    ["No failure-rate trend evaluation", "不评估失效率趋势"],
    ["No repairable-system growth modeling", "不建模可维修系统增长"],
    ["Confirm mission definition", "确认任务定义"],
    ["Confirm failure classification", "确认失效分类"],
    ["Continue testing to close the evidence gap", "继续测试以缩小证据差距"],
    ["Review whether the exponential assumption is appropriate", "复核指数分布假设是否适用"],
    ["Use Life Data if failure times and censoring information are available", "如有失效时间和删失信息，请使用寿命数据模块"],
    ["Review the allowable-failure rule with stakeholders", "与相关方复核允许失效准则"],
    ["Use the lower confidence bound instead of an infinite point estimate", "使用置信下限，不使用无限大的点估计"]
  ]);
  let output = text;
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  output = output.replace("Required sample size is", "所需样本量为").replace("achieved confidence is", "实际达到的置信水平为").replace("Reliability lower bound is", "可靠度置信下限为").replace("achieved confidence at target is", "目标处实际达到的置信水平为").replace("Required total test time is", "所需累计测试时间为").replace("exposure factor is", "暴露因子为").replace("MTBF lower bound is", "MTBF 置信下限为");
  return output;
}

function localizeMTBFInsightText(text) {
  if (state.lang !== "zh") return text;
  const replacements = new Map([
    ["MTBF point estimate not available", "MTBF 点估计不可用"],
    ["The test accumulated operating exposure without an observed failure, but this does not establish infinite MTBF.", "试验累计了运行暴露时间且未观察到失效，但这并不代表 MTBF 无限大。"],
    ["No MTBF result is available.", "暂无 MTBF 结果。"],
    ["Limited failure information", "失效信息有限"],
    ["The MTBF point estimate is based on a small number of observed failures and may be unstable.", "MTBF 点估计基于较少失效数量，可能不稳定。"],
    ["MTBF point estimate calculated", "已计算 MTBF 点估计"],
    ["The estimate summarizes observed failure frequency under the constant failure-rate assumption.", "该估计在恒定失效率假设下概括观察到的失效频率。"],
    ["Observed MTBF meets the target point estimate", "观察 MTBF 达到目标点估计"],
    ["Observed MTBF is below the target point estimate", "观察 MTBF 低于目标点估计"],
    ["Exponential / constant failure-rate assumption", "指数分布 / 恒定失效率假设"],
    ["Failure events are treated as independent.", "失效事件按相互独立处理。"],
    ["Accumulated exposure time is treated as reliable.", "累计暴露时间被视为可信。"],
    ["The model does not evaluate changing failure rates.", "该模型不评估随时间变化的失效率。"],
    ["The result does not represent individual product lifetime.", "该结果不代表单个产品寿命。"],
    ["Unit-Level Data currently treats each row as one unit exposure record with a final Failure or Censored status. It does not model repeated failures of the same repairable system.", "当前单元级数据将每一行视为一个单元的暴露记录及最终 Failure 或 Censored 状态，不用于分析同一可维修系统的多次重复失效。"],
    ["Physical failure analysis is still required.", "仍需要物理失效分析。"],
    ["A confidence-based reliability demonstration is required to quantify zero-failure evidence.", "需要基于置信度的可靠性验证来量化零失效证据。"],
    ["The current comparison does not include statistical confidence bounds.", "当前比较不包含统计置信界限。"],
    ["Continue accumulating exposure.", "继续累计暴露时间。"],
    ["Review failure classification.", "复核失效分类。"],
    ["Consider reliability demonstration or confidence-bound analysis.", "考虑可靠性验证或置信界限分析。"],
    ["Review operating context and failure definitions.", "复核运行场景和失效定义。"],
    ["Check whether the constant failure-rate assumption is appropriate.", "检查恒定失效率假设是否适用。"],
    ["Use confidence-bound analysis before qualification claims.", "在资格判定前使用置信界限分析。"],
    ["Use Reliability Demonstration for zero-failure test evaluation.", "使用可靠性验证评估零失效试验。"],
    ["Continue accumulating exposure or define a target reliability and confidence level.", "继续累计暴露时间，或定义目标可靠性和置信水平。"]
  ]);
  let output = text;
  replacements.forEach((zh, en) => { output = output.replaceAll(en, zh); });
  return output.replace("T =", "T =").replace("r =", "r =");
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function escapeXml(value) {
  return escapeHtml(value);
}

init();
