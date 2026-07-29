# Reliability Engine Contract

The frozen Facade schema, field presence rules, version policy, and Reason
Code Registry are defined in
`docs/reliability-engine-contract-v1.0.md`. This document continues to describe
the architectural layer boundaries and dependency rules.

## Scope

This contract defines the internal architecture of the lightweight Reliability
Tool. It is an in-browser module contract, not an HTTP API, SaaS boundary, or
database model.

The supported analysis entry points are:

- `analyzeLifeData(input)`
- `analyzeMTBF(input)`
- `analyzeDemonstration(input)`

They are exported by `src/reliability/engine/index.js`.

`previewDemonstrationTarget(input)` is a non-analysis preview helper. It reuses
the existing requirement conversion for the input summary and does not produce
an analysis result or Decision.

## Required flow

```text
User Input
    ↓
Validation
    ↓
Calculation
    ↓
Decision
    ↓
Insight
    ↓
UI Adapter
    ↓
UI State / Charts / Report
```

The dependency direction is one way. Lower layers must not import or call
higher layers.

## Layer contracts

### 1. Validation

Question: Is the input sufficient and valid for this analysis?

```js
{
  status: "VALID" | "WARNING" | "INVALID",
  errors: [],
  warnings: [],
  // Module-specific normalized records, input, or counts may follow.
}
```

Rules:

- Validation may normalize input values and statuses.
- `INVALID` stops calculation, decision, and insight.
- Validation must not render UI or produce engineering conclusions.

### 2. Calculation

Question: What do the validated data calculate to?

```js
{
  status: "COMPLETED" | "ERROR",
  model: "...",
  parameters: {},
  metrics: {}
}
```

Module extensions such as `evidence`, `requirement`, `assumptions`, or
`supplementalMTBF` are allowed when their meaning is calculation-only.

Rules:

- Calculation owns statistical and numerical formulas.
- Calculation does not decide whether a requirement is met.
- Calculation does not create localized text or access the DOM.
- Existing numerical formulas and fixture tolerances are regression-locked.

### 3. Decision

Question: What engineering status follows from metrics and requirements?

```js
{
  status: "...",
  reasonCodes: [],
  requirement: {},
  actualValue: null
}
```

Demonstration decisions may additionally include:

```js
{
  actualEvidence: {},
  evidenceGap: {},
  limitations: []
}
```

Rules:

- Decision owns target comparison, boundary tolerance, demonstrated status,
  evidence-gap status, and invalid-metric decisions.
- Decision consumes structured values only.
- Decision must not import UI, adapters, i18n, plotting, or report modules.
- `reasonCodes` are stable machine-readable outcomes.

### 4. Insight

Question: How should the structured result be explained?

```js
{
  explanationKeys: [],
  recommendationKeys: [],
  limitations: [],
  parameters: {}
}
```

Rules:

- Insight consumes Validation + Calculation + Decision.
- Insight may interpret Weibull beta and explain model assumptions.
- Insight must not repeat target comparison, confidence judgment,
  demonstrated judgment, or evidence-gap judgment.
- Text localization remains outside the structured Insight contract.

### 5. UI Adapter

Question: How is a Facade result represented by the existing page state?

Adapters:

- `adapters/life-data-ui-adapter.js`
- `adapters/mtbf-ui-adapter.js`
- `adapters/demonstration-ui-adapter.js`

Responsibilities:

- Map Facade compatibility fields into the current UI state model.
- Preserve legacy page and report field names.
- Compose KPI rows and page-specific display models.
- Apply formatting through injected formatter and localization functions.

Rules:

- Adapters are pure functions and do not access the DOM.
- Adapters do not calculate Weibull, MTBF, binomial, Poisson, confidence, or
  engineering decisions.
- Adapters do not import Engine or Decision modules.

### 6. UI

`app.js` owns:

- Reading user input.
- Immediate input feedback and interaction state.
- Calling an Engine Facade.
- Calling a UI Adapter.
- Updating state.
- Rendering charts, page sections, and reports.

`app.js` must not directly invoke core analysis calculations or Decision rules.

The following remain UI-preview utilities rather than formal analysis entry
points:

- Default mission-time suggestion.
- MTBF unit-row exposure preview.
- Life Data target-gap visualization.
- Empty-state legacy Insight presentation.

These utilities must not override the Facade result after an analysis runs.

## Facade result

Every Facade returns:

```js
{
  validation: {},
  calculation: null | {},
  decision: null | {},
  insight: null | {},
  compatibility: {},
  metadata: {
    engineVersion: "1.0.0",
    contractVersion: "1.0.0",
    fixtureVersion: "1.0.0",
    module: "life-data" | "mtbf" | "demonstration"
  }
}
```

For invalid input:

```text
calculation = null
decision = null
insight = null
```

For calculation failure, `calculation.status` is `ERROR` and includes a
structured error code and message.

## Legacy boundary

Compatibility code is marked:

```text
@deprecated RELIABILITY_LEGACY_BOUNDARY
```

The marker means:

- The path remains supported for the current page and report.
- It must not receive new calculations, rules, or business decisions.
- New internal consumers must use structured contracts.
- Removal requires a separate migration phase and regression evidence.

Current legacy boundaries:

- `Decision.existingDecision`
- `toLegacyReliabilityTargetDecision()`
- `toLegacyMTBFTargetDecision()`
- `compareReliabilityTarget()`
- `compareTargetMTBF()`
- `evaluateDemonstrationResult()`
- Facade `compatibility`
- Legacy Insight fields:
  - `result`
  - `meaning`
  - `evidence`
  - `recommendedActions`
  - `flags`

## Migrated and remaining logic inventory

### Migrated to Engine

- Weibull 2P MLE orchestration and Life Data metrics
- Exponential MTBF analysis
- Sample and time Demonstration analysis
- Reliability and MTBF target decisions
- Demonstrated / Not Demonstrated and evidence-gap decisions
- Structured Life Data, MTBF, and Demonstration Insight
- Facade-to-UI legacy mapping through adapters

### Remaining outside Engine by design

- Parsing and column-selection interaction
- Immediate form validation feedback
- Chart and table rendering
- Target-gap visualization
- Report HTML composition and localization
- Download and print behavior

### Compatibility-only paths

- Historical metric objects containing `targetComparison`
- Historical Demonstration result field `demonstrated`
- Historical Insight text fields consumed by page/report templates
- Facade `compatibility` projections consumed by UI adapters

## Dependency rules enforced by tests

Architecture tests verify that:

1. `app.js` calls the three Facades and does not invoke core calculation
   functions or import Decision rules.
2. UI adapters do not import Engine, Decision, or calculation modules and do
   not contain statistical formula calls.
3. Decision modules do not import UI, adapters, i18n, report, plotting, or
   Insight modules.
4. Legacy paths carry the explicit deprecation marker.
5. The contract retains the required
   Validation → Calculation → Decision → Insight → Adapter → UI sequence.

## Change policy

Any future change to a structured field, status, or reason code requires:

- Unit tests for the changed layer.
- Golden fixture comparison for affected numerical outputs.
- Page and report compatibility tests.
- Full `npm test`.

No legacy field may be removed as part of an unrelated feature or refactor.
