export function buildLifeDataReportPayload({
  compatibility,
  mapping,
  settings,
  charts,
  presentation
}) {
  return {
    validation: compatibility.validation,
    metrics: compatibility.metrics,
    insight: compatibility.insight,
    mapping,
    settings: presentation
      ? {
          ...settings,
          productName: presentation.productName,
          customPercentile: presentation.customPercentile,
          customTime: presentation.customTime,
          lang: presentation.lang
        }
      : settings,
    tables: presentation
      ? charts.uiTables
      : charts.reliabilityTable,
    curveMode: "reliability"
  };
}
