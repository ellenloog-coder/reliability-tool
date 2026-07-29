export function adaptMTBFFacadeResult(engineResult, fallback = {}) {
  const compatibility = engineResult?.compatibility;
  const validation = compatibility?.validation
    || fallback.validation
    || null;
  const inputSummary = compatibility?.inputSummary
    || fallback.inputSummary
    || null;
  if (engineResult?.validation?.status === "INVALID") {
    return {
      ok: false,
      validation,
      inputSummary,
      error: null,
      state: null
    };
  }
  if (engineResult?.calculation?.status === "ERROR") {
    return {
      ok: false,
      validation,
      inputSummary,
      error: engineResult.calculation.error,
      state: null
    };
  }
  return {
    ok: true,
    validation,
    inputSummary,
    error: null,
    state: {
      result: compatibility.result,
      targetComparison: compatibility.targetComparison,
      insight: compatibility.insight
    }
  };
}

export function mtbfKpiRows(result, timeUnit, view) {
  if (!result) {
    return [
      ["MTBF", "-"],
      [view.ui("failureRate"), "-"],
      [view.ui("totalTimeOnTest"), "-"],
      [view.ui("failureCount"), "-"],
      ["R(t)", "-"]
    ];
  }
  const unit = view.unitLabel(timeUnit);
  return [
    [
      "MTBF",
      result.mtbf == null
        ? view.ui("notEstimable")
        : `${view.fmt(result.mtbf)} ${unit}`
    ],
    [
      view.ui("failureRate"),
      result.failureRate == null
        ? view.ui("notEstimable")
        : `${view.formatRate(result.failureRate)} ${view.failureRateUnitLabel(timeUnit)}`
    ],
    [view.ui("totalTimeOnTest"), `${view.fmt(result.totalExposure)} ${unit}`],
    [view.ui("failureCount"), view.fmt(result.failureCount)],
    [
      `R(${view.fmt(result.missionTime)})`,
      result.missionReliability == null
        ? view.ui("notEstimable")
        : view.pct(result.missionReliability)
    ],
    [
      `F(${view.fmt(result.missionTime)})`,
      result.missionFailureProbability == null
        ? view.ui("notEstimable")
        : view.pct(result.missionFailureProbability)
    ],
    [
      view.ui("censoredCount"),
      result.censoredCount ?? view.ui("notProvided")
    ],
    [view.ui("totalUnits"), result.totalUnits ?? view.ui("notProvided")],
    [view.ui("missionTime"), `${view.fmt(result.missionTime)} ${unit}`],
    [view.ui("model"), view.ui("constantFailureRate")]
  ];
}

export function mtbfExposureRows(input, inputMode, view) {
  if (!input) return null;
  return [
    [
      view.ui("inputMethod"),
      inputMode === "summary"
        ? view.ui("summaryInput")
        : view.ui("unitLevelData")
    ],
    [
      view.ui("totalTimeOnTest"),
      `${view.fmt(input.totalExposure)} ${view.unitLabel(input.timeUnit)}`
    ],
    [view.ui("failureCount"), view.fmt(input.failureCount)],
    [view.ui("censoredCount"), input.censoredCount ?? view.ui("notProvided")],
    [view.ui("totalUnits"), input.totalUnits ?? view.ui("notProvided")]
  ];
}

export function mtbfTargetRows(model, view) {
  const comparison = model.targetComparison || {
    status: "Target not provided",
    message: "Target comparison not performed — no target MTBF was provided."
  };
  return {
    warning: comparison.status === "Below Target",
    rows: [
      [
        view.ui("targetMTBF"),
        model.targetMTBF
          ? `${view.fmt(model.targetMTBF)} ${view.unitLabel(model.timeUnit)}`
          : view.ui("targetNotProvided")
      ],
      [view.ui("result"), view.localizeStatus(comparison.status)],
      [view.ui("targetComparison"), view.localizeMessage(comparison.message)],
      [view.ui("limitations"), view.ui("mtbfTargetLimit")]
    ]
  };
}
