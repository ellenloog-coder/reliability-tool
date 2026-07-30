# Reliability Backend — Step 2A

This is the minimal, dependency-free Node backend for Life Data Shadow Mode.
It does not replace the current browser authority path.

## Run

Start the complete local tool (frontend and backend):

```bash
npm run dev
```

Then open `http://127.0.0.1:8020/`. This is the recommended local
development command because Life Data uses the backend as its authority.

Start only the backend:

```bash
npm run server
```

Defaults:

- host: `127.0.0.1`
- port: `8030`
- JSON body limit: `1048576` bytes

Configuration:

- `RELIABILITY_HOST`
- `RELIABILITY_PORT`
- `RELIABILITY_BODY_LIMIT_BYTES`
- `RELIABILITY_ALLOWED_ORIGINS` — comma-separated exact origins

The default CORS policy permits only local `localhost` and `127.0.0.1`
development origins.

## Endpoint

```text
POST /api/reliability/life-data/analyze
Content-Type: application/json
```

The request uses the frozen browser input shape:

```json
{
  "rows": [
    { "Sample": "S1", "Time": 100, "Status": "Failure" },
    { "Sample": "S2", "Time": 200, "Status": "Censored" }
  ],
  "mapping": {
    "sampleId": "Sample",
    "time": "Time",
    "status": "Status"
  },
  "settings": {
    "timeUnit": "hours",
    "missionTime": 150,
    "targetReliability": 0.9
  },
  "presentation": {
    "language": "en"
  }
}
```

`presentation` is excluded from the fingerprint and analysis. Optional method
controls are accepted only when they express the frozen behavior:

- `settings.distribution`: omitted or `weibull-2p`
- `settings.confidenceLevel`: omitted, null, or empty
- `settings.bLifePercentiles`: omitted or `[0.01, 0.05, 0.1, 0.5]`

The current reference does not calculate Life Data confidence intervals,
Weibull 3P, alternative distributions, or configurable B-life sets. Requests
for those capabilities return `422 METHOD_NOT_APPLICABLE`.

## Response status

- `200`: recognized request with VALID or WARNING analysis
- `422`: row/field validation produced INVALID, or the requested method is not
  applicable
- `400`: malformed JSON structure or unknown contract field
- `413`: request body exceeds the configured limit
- `415`: unsupported Content-Type
- `403`: origin rejected by CORS policy
- `404`: route does not exist, including MTBF/Demonstration/ALT endpoints
- `500`: sanitized internal Engine failure

For row validation failures, the analysis response preserves:

```text
calculation = null
decision = null
insight = null
charts = null
report_payload = null
```

`validation.errors` and `validation.warnings` remain exact frozen strings and
ordering. `validation_issues` adds stable machine-readable codes without
changing the frozen Validation object.

## Shadow verification

```bash
npm run verify:browser-engine-baseline
npm run test:life-data-parity
npm run test:backend
```

The parity test reads the eight frozen Life Data JSON fixtures. It never calls
the browser Facade and never updates Golden files.

## Life Data authority configuration

The browser uses the Reliability Backend as the Life Data authority.
The default local URL is `http://127.0.0.1:8030`; non-local
deployments use the page origin and therefore require the API route to
be deployed on the same origin (or an explicit allowed Backend URL).

Configuration may be supplied before `app.js` loads:

```html
<script>
window.__RELIABILITY_CONFIG__ = {
  lifeData: {
    authoritySource: "backend",
    backendUrl: "https://reliability.example",
    timeoutMs: 10000,
    contractAllowlist: ["1.0.0"]
  }
};
</script>
```

There is no automatic browser-Engine fallback. An unavailable,
timed-out, stale, fingerprint-mismatched, or incompatible Backend
response is rejected and cannot produce a result or report.

Life Data request payloads are processed in memory and are not stored.
The server has no account system, database, third-party AI call, or
external analysis-service dependency.
