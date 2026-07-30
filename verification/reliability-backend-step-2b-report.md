# Reliability Backend Step 2B — Life Data Authority Switch Protection Report

## 1. Baseline Identity

| Item | Value |
|---|---|
| Branch | `main` |
| Git commit | `53ce11ea9a1f4632a0fed7fc3b07f7c5104c4c8a` |
| Upstream | `origin/main`, ahead/behind `0/0` |
| Working tree | `DIRTY`; all pre-existing local modifications preserved |
| Baseline ID | `browser-engine-reference-v1-20260730-dirty-53ce11e` |
| Reference Engine | `1.0.0` |
| Backend Engine | `1.0.0-shadow.1` |
| Contract / Fixture | `1.0.0` / `1.0.0` |

No reset, checkout, clean, Golden update, commit, or push was
performed.

## 2. Scope

Step 2B switches **Life Data only** to the configured Reliability
Backend authority and adds request/snapshot protection. MTBF and
Reliability Demonstration retain their browser Facades; ALT remains
unavailable. No account, database, Study/Revision platform, AI,
Evidence module, PDF layout work, statistical formula change,
Decision Rule change, Reason Code change, or Golden update was
introduced.

## 3. Authority Source

- Life Data authority: `backend`.
- Local default: `http://127.0.0.1:8030`.
- Non-local default: same-origin Backend API.
- Runtime controls: Backend URL, authority source, timeout, Contract
  allowlist, and Backend version compatibility pattern.
- The browser reference Engine is not called by the Life Data user
  path and is not used as a silent fallback.
- A deployment without a reachable configured Backend displays an
  explicit service error and generates no result or report.

## 4. Request Protection

Every Life Data analysis owns a monotonic revision,
`client_request_id`, semantic SHA-256 `input_fingerprint`, UTC
`started_at`, `AbortController`, timeout, Contract allowlist, and
Backend version expectation.

Starting a new request aborts the previous request. A response is
accepted only if it is still current and its module, echoed request
ID, fingerprint, Contract version, Backend version, required fields,
nullability, and finite-number rules pass validation. Stale,
out-of-order, mismatched, malformed, or incompatible responses are
discarded before UI state changes. Timeout defaults to 10 seconds.

## 5. Snapshot Consistency

One immutable authority snapshot contains `validation`,
`validation_issues`, `calculation`, `decision`, `reason_codes`,
`insight`, `warnings`, `assumptions`, `limitations`, `charts`,
`report_payload`, `compatibility`, and `metadata`.

The page adapter consumes that snapshot. Charts render Backend
structured series; the browser performs only SVG coordinates, labels,
colors, tooltips, and responsive presentation. The report builder
consumes the same response's `report_payload`; it does not rerun Life
Data or scrape result values from the DOM.

UI, probability plot, R(t), F(t), and report actions publish the same
`analysis_id` and `input_fingerprint` as runtime provenance
attributes. No mixed calculation/Decision/chart/report source remains
in Backend authority mode.

## 6. Error Handling

Distinct protected states cover Backend unavailable, timeout,
superseded abort, HTTP 400, HTTP 415, validation 422, method 422,
HTTP 500, Contract mismatch, Backend version mismatch, fingerprint
mismatch, stale/out-of-order response, malformed JSON/response, and
missing required fields.

On network/system/Contract failure, loading clears, previous results
and provenance clear, Decision is absent, chart placeholders replace
old charts, report actions are disabled, and no browser fallback runs.

## 7. Privacy Copy

Life Data UI, hero text, User Manual, and FAQ now state that Life Data
inputs are sent to the configured Reliability Backend, no account or
application database is used, current Backend processing is in memory
without retaining input, and no third-party AI or external analysis
service is called. MTBF and Demonstration keep their current
browser-processing copy.

## 8. Tests

| Command | Result |
|---|---|
| `npm run verify:browser-engine-baseline` | PASS: Life Data 8, MTBF 9, Demonstration 9 |
| `npm test` | PASS: 257/257 |
| `npm run test:backend` | PASS: 29/29 |
| `npm run test:life-data-parity` | PASS: 9/9 tests; frozen fixtures 8/8 |

Real browser validation at `http://127.0.0.1:8020/` with Backend
`http://127.0.0.1:8030/`:

- Chinese and English Life Data success: PASS.
- Example unchanged: β `1.857`, η `2,128.3`, B10 `633.47`,
  R(1275) `67.96%`: PASS.
- Probability, R(t), and F(t) structured-data rendering: PASS.
- Page/charts/report action analysis ID and fingerprint equality: PASS.
- Rapid mission-time updates 1300 → 1400 retain only 1400: PASS.
- Backend outage clears old output/provenance, disables report, and
  reports no fallback: PASS.
- MTBF `10000 / 4` → `2500`: PASS.
- Demonstration 90%/90%/0 → 22 units: PASS.
- ALT boundary unchanged: PASS.
- Normal-path page console errors/warnings: none observed.

The in-app browser harness did not expose a Blob download event
reliably. Report construction, report enable/disable behavior,
provenance, existing report tests, and the normal export click path
were verified.

## 9. Files Changed

New:

- `src/reliability/backend-authority-config.js`
- `src/reliability/life-data-authority.js`
- `tests/life-data-authority-switch.test.js`
- `verification/reliability-backend-step-2b-report.md`

Modified:

- `index.html`
- `src/reliability/app.js`
- `src/reliability/probability-plot.js`
- `src/reliability/reliability-curve.js`
- `src/reliability/i18n.js`
- `src/reliability/help-content.js`
- `server/app.js`
- `server/routes/reliability.js`
- `server/reliability/life-data/analyze.js`
- `server/reliability/life-data/adapter.js`
- `server/reliability/life-data/charts.js`
- `server/reliability/life-data/report-payload.js`
- `server/test/api-contract.test.js`
- `server/test/helpers.js`
- `tests/app-engine-facade-phase4.test.js`
- `tests/reliability-architecture.test.js`
- `server/README.md`

The dirty worktree contains other pre-existing user changes that were
not cleaned or overwritten.

## 10. Known Risks

Resolved: silent fallback, stale/out-of-order overwrite,
request/input mismatch, mixed snapshot source, timeout/cancellation,
version rejection, and contradictory Life Data privacy copy.

Deployment confirmations remain:

- deploy the API with the production frontend or configure an allowed
  Backend URL;
- configure TLS and production CORS for intentional cross-origin use;
- confirm monitoring and availability expectations;
- confirm no-retention wording against final proxy/hosting logs;
- rerun this browser gate in the deployment environment.

## 11. Recommendation

Life Data can use the Backend as authority in local development and in
a production environment where endpoint, CORS/TLS, and no-retention
operations are confirmed.

Step 2C may begin after deployment configuration and environment smoke
testing are approved. The next minimum action is to deploy the current
Life Data Backend behind the intended production origin, verify
privacy/logging configuration, and rerun this browser gate there.
