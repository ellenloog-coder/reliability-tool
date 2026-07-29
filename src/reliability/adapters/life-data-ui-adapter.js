export function adaptLifeDataFacadeResult(engineResult, fallback = {}) {
  const compatibility = engineResult?.compatibility;
  const validation = compatibility?.validation
    || fallback.validation
    || null;
  if (engineResult?.validation?.status === "INVALID") {
    return {
      ok: false,
      validation,
      error: null,
      state: null
    };
  }
  if (engineResult?.calculation?.status === "ERROR") {
    return {
      ok: false,
      validation,
      error: engineResult.calculation.error,
      state: null
    };
  }
  return {
    ok: true,
    validation,
    error: null,
    state: {
      fit: compatibility.fit,
      metrics: compatibility.metrics,
      mtbf: compatibility.mtbf,
      insight: compatibility.insight
    },
    page: {
      records: validation?.records || [],
      missionTime: compatibility.metrics?.missionTime ?? null
    }
  };
}

export function lifeDataKpiRows(metrics, timeUnit, view) {
  if (!metrics) {
    return [
      ["Model", "-"],
      ["β Shape", "-"],
      ["η Scale", "-"],
      ["B10 Life", "-"],
      ["Mission R(t)", "-"]
    ];
  }
  const unit = view.unitLabel(timeUnit);
  return [
    [view.ui("model"), "Weibull 2P"],
    [view.ui("betaShape"), view.fmt(metrics.beta)],
    [view.ui("etaScale"), `${view.fmt(metrics.eta)} ${unit}`],
    ["B10", `${view.fmt(metrics.b10)} ${unit}`],
    [
      `R(${view.fmt(metrics.missionTime)} ${unit})`,
      view.pct(metrics.missionReliability)
    ],
    ["B1", `${view.fmt(metrics.b1)} ${unit}`],
    ["B5", `${view.fmt(metrics.b5)} ${unit}`],
    ["B50", `${view.fmt(metrics.b50)} ${unit}`],
    [
      view.ui("missionFailureProbability"),
      view.pct(metrics.missionFailureProbability)
    ],
    [view.ui("totalSamples"), metrics.totalCount]
  ];
}
