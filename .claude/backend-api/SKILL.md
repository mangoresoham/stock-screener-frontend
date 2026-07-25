---
name: backend-api
description: Reference for how the Modular Stock Screener FastAPI backend works and how this frontend talks to it — endpoints, auth, the async queued/running/completed job model, error codes, result field shapes per mode, the Custom-mode spec/operator allowlist, and how to run/connect to the backend locally or via Docker. Use this whenever building, fixing, or debugging any feature in this repo that calls the backend API, so the contract doesn't have to be re-derived from scratch each session.
license: MIT
metadata:
  author: project
  version: "1.0.0"
---

# Backend API Reference

This frontend (`fast-screener-pro`) is a **separate repository** from the backend on
purpose (see the backend's `REQUIREMENTS.md` "Notable decisions" section) — it never
contains backend code, and talks to it purely over REST. This skill is the fast-reference
for that contract so you don't have to open the backend repo to remember how it behaves.

For the live, authoritative, exact-field-names contract, fetch `<BACKEND_URL>/openapi.json`
— this document is the "why it behaves this way" companion to that, not a replacement for it.

## Running / connecting to the backend

The backend is not managed from this repo. Whoever runs it locally does one of:
- `docker compose up -d --build` (in the backend repo) — brings up TimescaleDB, Redis, the
  API, and the ARQ worker together.
- Or three separate processes: `docker compose up -d timescaledb redis`, then
  `arq src.worker.WorkerSettings`, then `uvicorn src.api.app:app --reload --host 127.0.0.1`.

**This frontend needs the backend's `CORS_ALLOWED_ORIGINS` to include this frontend's own
origin** (e.g. `http://localhost:8080`), or every request fails in the browser with a CORS
error even though the backend itself is reachable (CORS is enforced by the browser, not
visible via `curl`/Postman — that's the first thing to check if requests fail silently in
dev tools but a raw `curl` to the same URL works fine).

Backend URL and API key resolution, in `src/lib/config.ts`:
1. `/settings` page overrides, stored in this browser's `localStorage` (highest priority,
   no rebuild needed).
2. Build-time `VITE_API_BASE_URL` / `VITE_API_KEY` env vars (defaults: base URL
   `http://127.0.0.1:8000`, no key).

## The async job model (the one thing to never forget)

`POST /screens/run` does **not** run the screen synchronously. It returns almost instantly
with `status: "queued"` — the actual screening (which can take minutes for a large universe)
happens in a separate ARQ worker process. `results`/`passed_tickers` are empty at this point,
not a bug.

The only way to find out when a run is actually done is to poll `GET /screens/{run_id}` —
`status` moves `queued` → `running` → `completed`/`failed`. This repo's convention (see
`src/routes/runs_.$runId.tsx`) is `refetchInterval` of ~2.5s while non-terminal, stopped once
terminal. Never design a UI flow around `POST /screens/run`'s response containing the actual
results — always navigate to the run's own page and let it poll.

## Auth

Send `X-API-Key: <key>` on every request if the backend has `API_KEY` configured (check
`/settings` or ask whoever deployed it). Harmless to send even if the backend has no key set
— `src/lib/api.ts`'s `request()` helper already does this unconditionally, so new endpoints
added to `api.ts` get it for free without extra code.

## Endpoints

| Endpoint | Notes |
|---|---|
| `GET /health` | No auth required. Liveness only. |
| `GET /screens/modes` | `{mode, description}[]`. Populate mode pickers from this — never hardcode `"outperforming"`/`"chandemo"`/`"custom"`. |
| `GET /screens/indicators` | `{name, needs_benchmark, output_fields[], default_config{}}[]`. Populate Custom-mode indicator pickers from this — `output_fields` are the only valid `field` values for that indicator in a condition leaf. `default_config`'s keys vary per indicator (e.g. CMO's `cmo_period` vs. others' `period`) — render whatever keys are present, don't assume a fixed shape. |
| `POST /screens/run` | See "async job model" above. Body: `mode`, `broker` (default `"angel"`), exactly one of `universe_name`/`tickers[]`, optional `start_date`/`end_date` (ISO-8601 with timezone, both-or-neither, start < end). `mode: "custom"` additionally requires `interval`, `indicators[]` (`{name, period}`), `conditions{}` (see below). |
| `GET /screens/{run_id}` | Same response shape as `POST /screens/run`. 404 for an unknown id. |
| `GET /screens` | "Past Runs" list, most-recent-first, run-level metadata only (no `results[]`/`passed_tickers[]` — fetch the single-run endpoint for those). |
| `GET /screens/{run_id}/export` | Downloads a completed run as `.xlsx` (Results + a TradingView-format Passed_Tickers sheet). 404 if the run has no results yet. |
| `GET /universes` / `GET /universes/{name}` | List / full ticker detail. |
| `POST /universes` | Raw JSON `{name, tickers[]}`. |
| `POST /universes/upload` | Multipart CSV (+ optional `name` form field). Re-uploading identical content resolves to the same universe, no duplicate. |
| `GET /brokers` / `GET /brokers/{name}/status` | `{name, authenticated, rate_limit_per_minute}`. |
| `POST /brokers/{name}/reauth` | Evicts + re-authenticates. Can 424 with a message that already contains the actual fix (e.g. Breeze's manual login URL) — show it verbatim, never paraphrase. |

## Error status codes

| Code | Meaning | Handling |
|---|---|---|
| `400` / `422` | Malformed request | `detail` is already specific (e.g. "must provide exactly one of universe_name or tickers") — show it as-is. |
| `401` | Missing/wrong `X-API-Key` | Only relevant if the backend has `API_KEY` set. |
| `404` | Not found | Unknown `run_id`, universe name, or broker name. |
| `424` | An upstream broker failed to authenticate | Show `detail` verbatim — it already contains the fix. |
| `429` | The broker itself rate-limited a request | Rare, transient. Not the same as any per-request concurrency limit — there isn't one; excess load just queues longer in Redis. |

## Result row fields per mode

Common to all three: `Ticker`, `Status`, `Passed`. A failed row is
`{Ticker, Status: "Error: <reason>", Passed: false}` with no indicator fields — this means
that one ticker failed (e.g. a data fetch problem), not that the whole run failed.

- **`outperforming`**: `Latest_Close, Stock_RSI, Nifty_RSI, RSI_Passed, ATR_Pct, ATR_Passed, Comparative_RS, Comparative_RS_Passed, Crossover, Status, Passed`.
- **`chandemo`**: `Latest_Close, Monthly_CMO, Weekly_CMO, Watch, Buy, Exit, Crossover, Exit_Crossover, Status, Passed`. The actionable signal is `Buy`, not `Passed`'s twin — `Watch`/`Exit` are separate informational flags.
- **`custom`**: `Ticker` + whatever indicator columns were configured (named `{Indicator}_{field}`, e.g. `RSI_value`), plus `Status`, `Passed`, `Crossover`.

`Crossover` (and Chandemo's `Exit_Crossover`) mean the signal **just turned true this period**
— was false the period before. Distinct from "has been true for a while." Worth a distinct
badge in any UI that shows results, not just another boolean column.

## Custom mode: condition spec shape

```json
{
  "interval": "1day",
  "indicators": [{ "name": "RSI", "period": 14 }],
  "conditions": {
    "op": "AND",
    "conditions": [
      { "left": { "indicator": "RSI", "field": "value" }, "op": ">", "right": { "value": 50 } }
    ]
  }
}
```

- A condition node is either a **leaf** (`{left, op, right}`) or a **branch**
  (`{op: "AND"|"OR", conditions: [...]}`, nestable).
- A `left`/`right` ref is either `{indicator, field}` (an indicator's output, `field` must be
  one of that indicator's `output_fields` from `GET /screens/indicators`) or `{value: <number>}`
  — a **constant**, a fixed number instead of another indicator.
- **Operator allowlist is exactly `>`, `>=`, `<`, `<=`, `==`, `!=`** — this must match
  `src/screener/conditions.py`'s `_OPERATORS` in the backend precisely. There is no
  `crosses_above`/`crosses_below` or any other operator support server-side; a UI that offers
  one that isn't in this list will pass client-side validation and then fail with a 400 the
  moment it's actually submitted. (This exact mistake shipped once in
  `src/components/condition-builder.tsx`'s `OPS` array — check that file matches this list
  before adding new operators to the UI.)

## What's deliberately NOT covered here

Indicator formulas, default periods/thresholds, and the exact pass/fail math for
Outperforming/Chandemo modes live in the **backend's own README** ("Indicators & Screening
Criteria" section) — not duplicated here, since `GET /screens/indicators` is the live source
of truth for defaults and this skill would just go stale next to it. This skill is scoped to
"how the API behaves," not "what the numbers mean."
