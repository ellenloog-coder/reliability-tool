# Life Data Visualization Audit

Date: 2026-07-19

## Current Completion Assessment

1. Probability Plot current coordinates: the existing SVG uses `ln(time)` on X and `ln[-ln(1-F)]` on Y.
2. X axis: internally log time; visible label is Time.
3. Y axis: internally Weibull probability scale; visible labels are cumulative failure percentages.
4. Failure plotting positions: current implementation uses Kaplan-Meier grouped survival estimates, which supports right-censored records better than median-rank positions.
5. Right-censored display: current implementation places censored markers at a transformed probability-like Y location based on current survival. This can be misread as a failure probability point and should be changed to a bottom rug marker.
6. Fitted line: current fitted line is generated from the active beta and eta values.
7. Reliability Curve: current curve is generated from active beta and eta values.
8. Mission Time marker: current marker is generated from the current mission time and plotted on the fitted curve.
9. Target Reliability: current Reliability Curve does not show a target reliability line or target gap.
10. Tooltip: current tooltips are minimal and do not include full engineering context, failure mode, test condition, or localized detail.
11. State invalidation: second data load, paste, mapping changes, reset, and rerun already clear or regenerate chart state; custom visualization controls are not yet present.
12. Report sync: report receives the same SVG strings as the page, but it does not yet include Life Percentiles, Selected Times, target gap, or probability-plot limitations.

## Required Fixes

- Keep Weibull probability coordinates, but make plotting-position output explicit and testable.
- Render right-censored observations as bottom rug markers rather than probability points.
- Add fuller localized SVG tooltips.
- Add compact probability-plot statistics and model-fit limitation text outside the plotting area.
- Add target reliability line and target gap to Reliability Curve.
- Add R(t) / F(t) curve toggle without refitting.
- Add Life Percentiles and Reliability at Selected Times tables.
- Synchronize report content with the upgraded visualization and tables.
- Keep Life Data status Available and avoid unsupported confidence interval, confidence band, or goodness-of-fit claims.
