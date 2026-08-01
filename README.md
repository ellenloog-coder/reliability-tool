# Reliability Analysis Tool

中文名称：可靠性分析工具

A lightweight, dependency-light reliability engineering tool for life data
analysis, MTBF analysis, and reliability demonstration — with engineering
insights, decision support, and bilingual English / 中文 interface.

Version:
15.10.0 (Beta)

Engine contract:
1.0.0 (frozen)

## Features

- Life Data analysis: Weibull MLE with censoring, probability plots,
  B-life / percentile estimates, mission reliability
- MTBF analysis: unit-level (CSV/TSV/XLSX) or summary (total time + failures)
  workflows, confidence estimates, mission-target comparison
- Reliability Demonstration: parameter-driven planning with decision rules,
  evidence and gap review
- Engineering insights: per-result interpretation, limitation notes, and
  knowledge-based guidance (see `knowledge/reliability/`)
- Reports and export: HTML export, PDF/print output, CSV/XLSX downloads;
  result tabs for summary, calculations, charts, limitations, and data
- Optional local backend: dependency-free Node server provides the Life Data
  authority in local development, with a full in-browser fallback
- Help drawer, AI quality assistant, and product feedback widget

## Data Privacy

- Analysis runs locally; imported or pasted data is not uploaded.
- The optional backend binds to `127.0.0.1` with CORS restricted to local
  origins only.
- Exported reports and files remain under your control.

## Architecture

- Frontend: single-page `index.html` plus modular `src/reliability/`
  (engine, adapters, decision, insight, plotting, report, i18n, state)
- Frozen engine contract v1.0: `docs/reliability-engine-contract-v1.0.md`
- Optional backend: `server/` — dependency-free Node,
  `POST /api/reliability/life-data/analyze`
- Examples and knowledge base: `examples/`, `knowledge/`

## Getting Started

```bash
npm run dev
```

Then open `http://127.0.0.1:8020/` (recommended for local development;
Life Data uses the backend as its authority).

Start only the backend:

```bash
npm run server
```

Serves on `http://127.0.0.1:8030/`. Configuration:

- `RELIABILITY_HOST`, `RELIABILITY_PORT`, `RELIABILITY_BODY_LIMIT_BYTES`
- `RELIABILITY_ALLOWED_ORIGINS` — comma-separated exact origins

Static hosting (browser-only, backend optional) also works:

```bash
python3 -m http.server 8000
```

See `server/README.md` for backend details.

## Validation

```bash
npm test                      # frontend engine suite (257 tests)
npm run test:backend          # backend suite (29 tests)
npm run test:life-data-parity # Life Data backend/browser parity (9 tests)
npm run verify:browser-engine-baseline  # frozen engine baseline
npm run verify:demonstration            # 63 reference fixtures + numerics
```

Independent Python reference scripts are kept under `verification/`
(`weibull_reference.py`, `mtbf_reference.py`, `demonstration_reference.py`).

## Beta Status

Controlled beta release. Validate outputs against your own quality
procedures; this tool does not replace company QMS processes.
