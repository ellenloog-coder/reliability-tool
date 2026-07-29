export function invalidateAnalysisState(state) {
  state.fit = null;
  state.metrics = null;
  state.mtbf = null;
  state.insight = null;
  state.plots = null;
  state.tables = null;
  state.reportHtml = null;
  return state;
}

export function resetLifeDataState(state) {
  state.headers = [];
  state.rows = [];
  state.sourceName = "";
  state.sourceKey = "";
  state.mapping = {};
  state.validation = null;
  return invalidateAnalysisState(state);
}

export function loadDataState(state, { headers, rows, sourceName, sourceKey, mapping }) {
  state.headers = headers;
  state.rows = rows;
  state.sourceName = sourceName;
  state.sourceKey = sourceKey || "";
  state.mapping = mapping || {};
  state.validation = null;
  return invalidateAnalysisState(state);
}
