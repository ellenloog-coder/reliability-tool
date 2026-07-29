export function adaptDemonstrationFacadeResult(engineResult) {
  const compatibility = engineResult?.compatibility;
  if (engineResult?.validation?.status === "INVALID") {
    return {
      ok: false,
      validation: {
        errors: [...engineResult.validation.errors],
        warnings: [...engineResult.validation.warnings]
      },
      error: null,
      state: null
    };
  }
  if (engineResult?.calculation?.status === "ERROR") {
    return {
      ok: false,
      validation: {
        errors: [],
        warnings: [...(engineResult.validation?.warnings || [])]
      },
      error: engineResult.calculation.error,
      state: null
    };
  }
  return {
    ok: true,
    validation: compatibility.validation,
    error: null,
    state: {
      result: compatibility.result,
      insight: compatibility.insight
    }
  };
}

export function demonstrationKpiRows(model, view) {
  const { result, method, workflow, inputs } = model;
  const unit = view.unitLabel(inputs.timeUnit);
  if (!result) {
    return [
      [view.ui("demoMethod"), view.methodLabel()],
      [view.ui("workflow"), view.workflowLabel()],
      [
        view.ui("confidenceLevel"),
        view.displayPercent(view.normalizePercentInput(inputs.confidenceLevel))
      ],
      [view.ui("result"), "-"],
      [view.ui("demoEvidenceGap"), "-"]
    ];
  }
  if (result.method === "sample" && result.workflow === "plan") {
    return [
      [view.ui("requiredSampleSize"), result.requiredSampleSize],
      [view.ui("targetReliability"), view.pct(result.targetReliability)],
      [view.ui("confidenceLevel"), view.pct(result.confidenceLevel)],
      [view.ui("allowableFailures"), result.allowableFailures],
      [
        view.ui("achievedConfidence"),
        view.pct(result.achievedConfidenceAtRequiredN)
      ],
      [
        view.ui("missionTime"),
        result.missionTime
          ? `${view.fmt(result.missionTime)} ${unit}`
          : view.ui("notProvided")
      ],
      [view.ui("acceptanceRule"), view.acceptanceRule(result)]
    ];
  }
  if (result.method === "sample") {
    return [
      [view.ui("unitsTested"), result.unitsTested],
      [view.ui("observedFailures"), result.observedFailures],
      [view.ui("result"), view.demonstratedLabel(result.demonstrated)],
      [
        view.ui("reliabilityLowerBound"),
        view.pct(result.reliabilityLowerBound)
      ],
      [view.ui("targetReliability"), view.pct(result.targetReliability)],
      [view.ui("requiredConfidence"), view.pct(result.requiredConfidence)],
      [view.ui("observedPassRate"), view.pct(result.observedPassRate)],
      [
        view.ui("achievedConfidenceAtTarget"),
        view.pct(result.achievedConfidenceAtTarget)
      ],
      [
        view.ui("additionalUnitsRequired"),
        result.evidenceGap.additionalUnitsRequired
      ]
    ];
  }
  if (result.workflow === "plan") {
    return [
      [
        view.ui("requiredTotalTestTime"),
        `${view.fmt(result.requiredTotalTestTime)} ${unit}`
      ],
      [view.ui("targetMTBF"), `${view.fmt(result.targetMTBF)} ${unit}`],
      [
        view.ui("targetReliability"),
        result.targetReliability
          ? `${view.pct(result.targetReliability)} @ ${view.fmt(result.missionTime)} ${unit}`
          : view.ui("notProvided")
      ],
      [view.ui("confidenceLevel"), view.pct(result.confidenceLevel)],
      [view.ui("allowableFailures"), result.allowableFailures],
      [
        view.ui("estimatedTimePerUnit"),
        result.estimatedTimePerUnit
          ? `${view.fmt(result.estimatedTimePerUnit)} ${unit}`
          : view.ui("notProvided")
      ],
      [view.ui("acceptanceRule"), view.acceptanceRule(result)]
    ];
  }
  return [
    [view.ui("totalTestTime"), `${view.fmt(result.totalTestTime)} ${unit}`],
    [view.ui("observedFailures"), result.observedFailures],
    [view.ui("result"), view.demonstratedLabel(result.demonstrated)],
    [view.ui("mtbfLowerBound"), `${view.fmt(result.mtbfLowerBound)} ${unit}`],
    [view.ui("targetMTBF"), `${view.fmt(result.targetMTBF)} ${unit}`],
    [
      view.ui("reliabilityLowerBoundAtMission"),
      result.reliabilityLowerBoundAtMissionTime == null
        ? view.ui("notProvided")
        : view.pct(result.reliabilityLowerBoundAtMissionTime)
    ],
    [view.ui("requiredConfidence"), view.pct(result.requiredConfidence)],
    [
      view.ui("mtbfPointEstimate"),
      result.mtbfPointEstimate == null
        ? view.ui("pointEstimateNotEstimable")
        : `${view.fmt(result.mtbfPointEstimate)} ${unit}`
    ],
    [
      view.ui("achievedConfidenceAtTarget"),
      view.pct(result.achievedConfidenceAtTarget)
    ],
    [
      view.ui("additionalTestTimeRequired"),
      `${view.fmt(result.evidenceGap.additionalTotalTestTimeRequired)} ${unit}`
    ]
  ];
}

export function demonstrationGapRows(result, timeUnit, view) {
  if (!result || result.workflow !== "evaluate") return null;
  if (result.method === "sample") {
    return [
      [
        view.ui("additionalUnitsRequired"),
        result.evidenceGap.additionalUnitsRequired
      ],
      [
        view.ui("assumptions"),
        view.localizeRuntimeText(result.evidenceGap.assumption)
      ]
    ];
  }
  return [
    [
      view.ui("additionalTestTimeRequired"),
      `${view.fmt(result.evidenceGap.additionalTotalTestTimeRequired)} ${view.unitLabel(timeUnit)}`
    ],
    [
      view.ui("assumptions"),
      view.localizeRuntimeText(result.evidenceGap.assumption)
    ]
  ];
}
