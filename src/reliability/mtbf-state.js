export function createMTBFState() {
  return {
    inputMode: "summary",
    summary: { totalExposure: "", failureCount: "", timeUnit: "hours", missionTime: "", targetMTBF: "" },
    headers: [],
    rows: [],
    sourceName: "",
    sourceKey: "",
    mapping: {},
    validation: null,
    unitRecords: [],
    inputSummary: null,
    result: null,
    targetComparison: null,
    insight: null,
    curveSvg: "",
    reportHtml: null
  };
}

export function invalidateMTBFResult(state) {
  state.result = null;
  state.targetComparison = null;
  state.insight = null;
  state.curveSvg = "";
  state.reportHtml = null;
  return state;
}

export function resetMTBFState(state) {
  const fresh = createMTBFState();
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, fresh);
  return state;
}

export function loadMTBFUnitDataState(state, { headers, rows, sourceName, sourceKey, mapping }) {
  state.headers = headers;
  state.rows = rows;
  state.sourceName = sourceName;
  state.sourceKey = sourceKey || "";
  state.mapping = mapping || {};
  state.validation = null;
  state.unitRecords = [];
  return invalidateMTBFResult(state);
}
