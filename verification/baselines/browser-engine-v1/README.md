# Browser Engine Reference Baseline v1

This directory freezes the observed behavior of the current browser-side
Reliability Engines before backend migration.

Baseline ID:

`browser-engine-reference-v1-20260730-dirty-53ce11e`

Included modules:

- Life Data Analysis
- MTBF
- Reliability Demonstration / Reliability Validation

ALT is explicitly excluded.

## Authority boundary

The migration acceptance baseline consists of:

- exact input payloads;
- Validation status, errors, warnings and normalized records;
- Calculation model, parameters, metrics, evidence and assumptions;
- Decision status and ordered Reason Codes;
- structured Engineering Insight;
- compatibility output still consumed by the current UI and reports;
- language-neutral numeric chart source data;
- report consumer payloads;
- null, missing-field, undefined and finite-number behavior.

English and Chinese labels, formatted text, HTML, CSS and SVG markup remain
presentation responsibilities. SVG hashes are retained only as browser
presentation references; a future backend is not required to generate SVG or
localized strings.

## Comparison policy

- Strings, booleans, nulls, integers, keys and array order are exact.
- Missing fields are different from null.
- Decision Reason Code order is exact.
- Floating-point comparison uses absolute tolerance `1e-12` and relative
  tolerance `1e-10`.
- Non-finite authority values are forbidden.
- Undefined values are captured explicitly and are forbidden in authority
  layers.

## Commands

Verify without writing:

```bash
npm run verify:browser-engine-baseline
```

Explicitly replace the golden baseline:

```bash
npm run update-golden:browser-engine-baseline
```

The update command is intentionally excluded from `npm test`. Suspected
calculation or Decision defects must be recorded separately and must not be
fixed by silently regenerating these files.
