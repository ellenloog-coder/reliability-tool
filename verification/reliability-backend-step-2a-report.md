# Reliability Backend Step 2A — Life Data Shadow Parity Report

## 1. Baseline Identity

| Field | Value |
|---|---|
| baseline_id | `browser-engine-reference-v1-20260730-dirty-53ce11e` |
| git_branch | `main` |
| git_commit | `53ce11ea9a1f4632a0fed7fc3b07f7c5104c4c8a` |
| upstream | `origin/main` |
| ahead / behind | `0 / 0` |
| working_tree_state | `DIRTY` |
| reference_engine_version | `1.0.0` |
| backend_engine_version | `1.0.0-shadow.1` |
| contract_version | `1.0.0` |
| fixture_version | `1.0.0` |
| captured_at | `2026-07-30T03:36:03Z` |

The migration used the preserved dirty local baseline documented by the Step 1
manifest. No reset, clean, destructive checkout, Golden regeneration, commit,
or push was performed.

## 2. Backend Architecture

- Runtime: Node.js `v26.0.0`, native `node:http`, ESM.
- Added dependencies: none.
- API: `POST /api/reliability/life-data/analyze`.
- Default binding: `127.0.0.1:8030`.
- The current static frontend remains unchanged and does not call the backend.
- The server has no database, ORM, account, authentication, container, queue,
  external API, or persistence.
- The server orchestration does not import or call the browser
  `analyzeLifeData()` Facade.
- Existing isomorphic pure validation, numerical, Decision, and Insight
  functions are reused to avoid creating a second long-term formula set.
- Parity is independently checked against frozen Step 1 JSON, not against a
  live browser Facade result.
- Server code has no `window`, `document`, `localStorage`, DOM, browser locale,
  Playwright, Puppeteer, or UI state dependency.

## 3. Runtime Path

```text
HTTP Request
→ adaptLifeDataRequest()
→ validateLifeDataInput()
→ calculateLifeData()
→ decideLifeData()
→ buildLifeDataInsight()
→ buildLifeDataCharts()
→ buildLifeDataReportPayload()
→ metadata + fingerprint
→ finite/undefined serialization guard
→ HTTP Response
```

## 4. API Contract

### Request

The request preserves the frozen `{rows, mapping, settings}` input shape.
Numeric strings and recognized status aliases normalize to the same semantic
input. Row order remains significant.

Optional presentation settings are excluded from analysis and fingerprinting.
Only frozen Weibull 2P, B1/B5/B10/B50 behavior is applicable. Life Data
confidence intervals remain unavailable because the reference does not
calculate them.

### Response

Successful analysis includes:

- `validation`
- `validation_issues`
- `calculation`
- `decision`
- `reason_codes`
- `insight`
- `warnings`
- `assumptions`
- `limitations`
- `charts`
- `report_payload`
- `compatibility`
- `metadata`

Invalid row input returns HTTP 422 while preserving:

```text
calculation = null
decision = null
insight = null
charts = null
report_payload = null
```

Transport status rules:

| Status | Meaning |
|---:|---|
| 200 | VALID/WARNING analysis, including frozen invalid-target Decision behavior |
| 400 | malformed structure or unknown field |
| 403 | rejected CORS origin |
| 404 | unavailable route, including MTBF/Demonstration/ALT |
| 405 | wrong method |
| 413 | JSON body exceeds configured limit |
| 415 | Content-Type is not `application/json` |
| 422 | INVALID data or unsupported method applicability |
| 500 | sanitized internal failure |

Default body limit is 1 MiB. Default CORS allows only local
`127.0.0.1`/`localhost` development origins. Error responses do not return
stack traces or local paths.

## 5. Parity Results

| Fixture ID | Validation | Calculation | Decision | Reason Codes | Insight | Charts | Report Payload | Result |
|---|---|---|---|---|---|---|---|---|
| life_early_failure | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_random_failure | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_wearout_failure | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_right_censored | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_limited_failure_data | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_target_meets | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_target_does_not_meet | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| life_invalid_empty_data | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**Life Data Shadow Parity: PASS — 8/8.**

## 6. Numeric Diff Summary

| Fixtures | Compared numeric fields | Maximum absolute difference | Maximum relative difference | Tolerance | Result |
|---|---:|---:|---:|---|---|
| Life Data 8/8 | All frozen Calculation, Insight, Chart and Report payload numbers | 0 | 0 | abs `1e-12`, rel `1e-10` | PASS |

No tolerance was relaxed.

## 7. Contract Consistency

- Missing fields and null remain distinct for core calculation settings.
- Numeric strings normalize to their finite numeric semantic value.
- Zero, false, empty string, null, and missing are not generally interchangeable.
- Validation error/warning strings and ordering remain frozen.
- `validation_issues` adds codes without changing the frozen Validation object.
- Decision status and Reason Code order are exact.
- Non-finite numbers and undefined response values are rejected before
  serialization.
- Legacy compatibility remains present for migration parity.
- EN/CN labels, HTML, CSS, formatting, and SVG markup remain presentation
  responsibilities. Backend Charts are structured numeric data.

## 8. Fingerprint

- Algorithm: SHA-256.
- Canonical form: recursively key-sorted JSON.
- Array order: preserved.
- Numbers: finite JSON numbers, `-0` normalized to `0`.
- Numeric strings: normalized before canonicalization.
- Status aliases: normalized before canonicalization.
- Different source column names with equivalent mapping: same fingerprint.
- Unmapped row columns: excluded.
- Included: semantic rows, status/event, mapped engineering fields, unit,
  mission time, target, distribution and supported B-life method settings.
- Excluded: language, theme, display precision and other presentation settings.
- Core null and missing settings remain distinguishable.
- Repeated equivalent requests produced identical fingerprints.
- Row order or target changes produced different fingerprints.

## 9. Tests

| Test | Before | After |
|---|---:|---:|
| Step 1 baseline verification | PASS, Life 8 / MTBF 9 / Demonstration 9 | PASS, unchanged |
| Existing frontend tests | 241/241 | 241/241 |
| Backend tests | N/A | 28/28 |
| Life Data frozen parity | N/A | 8/8 fixtures plus manifest coverage test |
| Fingerprint/determinism | N/A | PASS |
| Finite/null/missing | N/A | PASS |
| Error/CORS/body limit | N/A | PASS |
| Real HTTP smoke | N/A | HTTP 200 PASS |

No tests were skipped.

## 10. Known Differences and Risks

Allowed nondeterministic fields:

- `metadata.analysis_id`
- `metadata.created_at`

Known reference behavior retained:

- Invalid/non-numeric mission time falls back to the reference default mission
  time instead of becoming a blocking Validation error.
- Invalid reliability target produces a valid calculation and
  `NOT_EVALUATED / TARGET_RELIABILITY_INVALID`.
- Life Data confidence intervals and formal fit statistics are unavailable.
- Legacy supplemental MTBF remains in the Life compatibility snapshot; this
  does not create an MTBF API or migrate the MTBF module.

Before a frontend authority switch:

- bind each response to input fingerprint and request/revision identity;
- reject stale/out-of-order responses;
- add timeout, cancellation and explicit network error states;
- define whether browser fallback is prohibited or visibly degraded;
- ensure UI, charts and report consume one backend response object;
- update current privacy copy that says analysis data is never uploaded;
- define same-origin deployment/proxy or approved CORS origins;
- require contract/backend version compatibility.

## 11. Recommendation

- Life Data Backend reached **8/8 Shadow Parity**.
- Step 2B can be planned, but authority switching must not occur until network
  state, stale-response protection, privacy wording, deployment origin, and
  explicit failure behavior are implemented and tested.
- MTBF, Reliability Demonstration, ALT, Evidence, Study/Revision, AI, UI and
  report rendering remain unchanged and out of Step 2A.
