export function createDemoState() {
  return {
    method: "sample",
    workflow: "plan",
    targetDefinition: "mtbf",
    inputs: {
      targetReliability: "0.90",
      confidenceLevel: "0.90",
      allowableFailures: "0",
      missionTime: "",
      timeUnit: "hours",
      unitsTested: "",
      observedFailures: "",
      targetMTBF: "1000",
      totalTestTime: "",
      numberOfUnits: ""
    },
    validation: { errors: [], warnings: [] },
    result: null,
    insight: null,
    chartSvg: "",
    reportHtml: null
  };
}

export function invalidateDemoResult(state) {
  state.result = null;
  state.insight = null;
  state.chartSvg = "";
  state.reportHtml = null;
  return state;
}

export function resetDemoState(state) {
  const fresh = createDemoState();
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, fresh);
  return state;
}
