# Reliability Engine Contract v1.0

Status: **Frozen**

This document freezes the internal JavaScript contract for the lightweight
Reliability Tool. It is not an HTTP API, database schema, or SaaS interface.

The contract applies to:

- `analyzeLifeData(input)`
- `analyzeMTBF(input)`
- `analyzeDemonstration(input)`

## Unified result

Every Facade returns all six top-level fields:

```js
{
  validation,
  calculation,
  decision,
  insight,
  compatibility,
  metadata
}
```

`compatibility` is a required legacy boundary. Its module-specific contents
remain supported for the existing UI and reports, but are not a contract for
new internal consumers.

## Field notation

- **Required**: the property is always present.
- **Optional**: the property is present only for the applicable module or
  execution path.
- **Nullable**: the property is required but may explicitly contain `null`.
- `undefined`, `NaN`, positive infinity, and negative infinity are not valid
  values crossing the Facade boundary.

## Validation

```js
{
  status: "VALID" | "WARNING" | "INVALID",
  errors: String[],
  warnings: String[],
  counts?,          // Life Data
  records?,         // Life Data
  normalizedInput?  // MTBF
}
```

| Field | Presence | Nullable |
|---|---|---|
| `status` | Required | No |
| `errors` | Required | No |
| `warnings` | Required | No |
| `counts` | Optional, Life Data | No |
| `records` | Optional, Life Data | No |
| `normalizedInput` | Optional, MTBF | No |

`INVALID` terminates the pipeline. In that case `calculation`, `decision`, and
`insight` are all `null`.

## Calculation

Completed calculation:

```js
{
  status: "COMPLETED",
  model: String,
  metrics: Object,
  parameters?,
  supplementalMTBF?,
  evidence?,
  requirement?,
  assumptions?
}
```

Calculation failure:

```js
{
  status: "ERROR",
  error: {
    code: "CALCULATION_ERROR",
    message: String
  }
}
```

| Field | Presence | Nullable |
|---|---|---|
| `status` | Required | No |
| `model` | Required when completed | No |
| `metrics` | Required when completed | No |
| `error` | Required on calculation error | No |
| `parameters` | Optional, Life Data | No |
| `supplementalMTBF` | Optional, Life Data | No |
| `evidence` | Optional, Demonstration | No |
| `requirement` | Optional, Demonstration | No |
| `assumptions` | Optional, Demonstration | No |

Life Data uses `Weibull 2P MLE`; MTBF uses the existing exponential
constant-failure-rate model; Demonstration uses `Exact Binomial` or
`Exponential / Poisson`. Formulae and tolerances are outside the change scope
of this freeze and remain protected by numerical fixtures.

## Decision

```js
{
  status: String,
  reasonCodes: String[],
  requirement: Object,
  actualValue: Number | null,
  existingDecision: Object,
  actualEvidence?,
  evidenceGap?,
  limitations?
}
```

| Field | Presence | Nullable |
|---|---|---|
| `status` | Required | No |
| `reasonCodes` | Required | No |
| `requirement` | Required | No |
| `actualValue` | Required | Yes |
| `existingDecision` | Required legacy field | No |
| `actualEvidence` | Optional, Demonstration | No |
| `evidenceGap` | Optional, Demonstration | No |
| `limitations` | Optional, Demonstration | No |

Life Data and MTBF statuses:

```text
MEETS_REQUIREMENT
DOES_NOT_MEET_REQUIREMENT
NOT_EVALUATED
REVIEW_REQUIRED
```

Demonstration statuses:

```text
DEMONSTRATED
NOT_DEMONSTRATED
NOT_EVALUATED
REVIEW_REQUIRED
```

Demonstration evidence-gap statuses:

```text
NOT_AVAILABLE
SATISFIED
GAP_REMAINS
```

Status domains are intentionally module-specific in v1.0.

## Insight

```js
{
  explanationKeys: String[],
  recommendationKeys: String[],
  limitations: String[],
  parameters: Object
}
```

All four properties are required and non-null when Insight is produced.
The `*Keys` names are retained for compatibility; in v1.0 they may contain
canonical English message tokens as well as machine-readable reason codes.

Insight consumes Validation, Calculation, and Decision. It must not perform a
target comparison, confidence judgment, demonstrated judgment, or evidence-gap
judgment.

## Compatibility

```js
compatibility: Object
```

`compatibility` is always required and non-null. Its nested shape is
module-specific and may contain:

- historical Life Data fit, metrics, target comparison, MTBF, and Insight;
- historical MTBF input summary, result, target comparison, and Insight;
- historical Demonstration result, `demonstrated`, and Insight.

The boundary remains marked `@deprecated RELIABILITY_LEGACY_BOUNDARY`.
No legacy field may be removed without a separate major-version migration and
page/report regression evidence.

## Metadata and versions

```js
{
  engineVersion: "1.0.0",
  contractVersion: "1.0.0",
  fixtureVersion: "1.0.0",
  module: "life-data" | "mtbf" | "demonstration"
}
```

All metadata fields are required and non-null.

- `engineVersion` identifies calculation and orchestration implementation.
- `contractVersion` identifies this Facade schema and field semantics.
- `fixtureVersion` identifies the approved numerical regression baseline
  against which this Engine release is certified.

Version policy follows semantic versioning:

| Change | Required version change |
|---|---|
| Add an optional field without changing existing semantics | Contract minor |
| Add a backward-compatible enum or Reason Code | Contract minor |
| Correct documentation without changing behavior | Contract patch |
| Change implementation with identical contract and approved numerics | Engine patch/minor |
| Update or intentionally regenerate golden numerical baselines | Fixture version |
| Remove or rename a field | Contract major |
| Change field type, nullability, or meaning | Contract major |
| Change existing status or Reason Code meaning | Contract major |
| Remove a legacy compatibility field | Contract major and separate migration |

Engine, contract, and fixture versions advance independently.

## Reason Code Registry

Severity is the engineering significance of the code:

- `INFO`: expected or positive informational outcome.
- `WARNING`: unmet requirement, incomplete evidence, or review condition.
- `ERROR`: invalid requirement or metric that prevents a trustworthy decision.

### Life Data

| Code | Meaning | Severity |
|---|---|---|
| `TARGET_RELIABILITY_NOT_PROVIDED` | No target was supplied; no target decision was performed. | INFO |
| `TARGET_RELIABILITY_INVALID` | Target is outside the valid probability range. | WARNING |
| `MISSION_RELIABILITY_INVALID` | Mission reliability is unavailable or invalid. | ERROR |
| `MISSION_RELIABILITY_MEETS_TARGET` | Mission reliability meets the target. | INFO |
| `MISSION_RELIABILITY_BELOW_TARGET` | Mission reliability is below the target. | WARNING |

### MTBF

| Code | Meaning | Severity |
|---|---|---|
| `TARGET_MTBF_NOT_PROVIDED` | No target was supplied; no target decision was performed. | INFO |
| `TARGET_MTBF_INVALID` | Target is not a finite positive number. | WARNING |
| `MTBF_POINT_ESTIMATE_NOT_ESTIMABLE_ZERO_FAILURE` | No finite point estimate is available because zero failures were observed. | WARNING |
| `MTBF_METRIC_INVALID` | The metric required for the decision is invalid. | ERROR |
| `MTBF_MEETS_TARGET_POINT_ESTIMATE` | MTBF point estimate meets the target. | INFO |
| `MTBF_BELOW_TARGET_POINT_ESTIMATE` | MTBF point estimate is below the target. | WARNING |

### Demonstration

| Code | Meaning | Severity |
|---|---|---|
| `PLAN_WORKFLOW_DOES_NOT_EVALUATE_EVIDENCE` | Planning produces a test plan and does not evaluate evidence. | INFO |
| `CONFIDENCE_REQUIREMENT_MISSING_OR_INVALID` | Confidence requirement is missing or invalid. | ERROR |
| `TARGET_RELIABILITY_MISSING_OR_INVALID` | Reliability target is missing or invalid. | ERROR |
| `TARGET_MTBF_MISSING_OR_INVALID` | MTBF target is missing or invalid. | ERROR |
| `DEMONSTRATION_METRIC_INVALID` | Required lower-bound metric is invalid. | ERROR |
| `RELIABILITY_LOWER_BOUND_MEETS_TARGET` | Reliability lower bound meets target. | INFO |
| `RELIABILITY_LOWER_BOUND_BELOW_TARGET` | Reliability lower bound is below target. | WARNING |
| `MTBF_LOWER_BOUND_MEETS_TARGET` | MTBF lower bound meets target. | INFO |
| `MTBF_LOWER_BOUND_BELOW_TARGET` | MTBF lower bound is below target. | WARNING |
| `ACHIEVED_CONFIDENCE_MEETS_REQUIREMENT` | Achieved confidence meets requirement. | INFO |
| `ACHIEVED_CONFIDENCE_BELOW_REQUIREMENT` | Achieved confidence is below requirement. | WARNING |
| `ZERO_OBSERVED_FAILURES` | No failures were observed in the evidence. | INFO |
| `EVIDENCE_GAP_REMAINS` | Additional units or exposure are required. | WARNING |

The strings above are frozen. Existing strings must not be renamed,
normalized, or reused with a different meaning.

## Error, nullability, and numeric invariants

1. `INVALID` Validation requires all downstream structured layers to be null.
2. `ERROR` Calculation requires `decision` and `insight` to be null.
3. Completed Calculation requires non-null Decision and Insight.
4. Every numeric value crossing the Facade boundary is finite or explicitly
   `null`.
5. `actualValue` is the only common nullable Decision field.
6. Missing optional module extensions are omitted, not populated with
   invented values.
7. Reason Codes emitted by a Decision must exist in the registry and belong
   to the active module.

## Change control

Any contract change requires:

1. Contract schema tests.
2. A version-policy decision.
3. Numerical fixture regression.
4. Page and report compatibility regression.
5. Full `npm test`.

The v1.0 contract does not authorize changes to formulas, UI behavior,
Decision thresholds, Reason Code strings, or legacy compatibility.
