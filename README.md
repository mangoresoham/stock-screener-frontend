# 📈 Stock Screener — Frontend

The web UI for the **Modular Stock Screener** backend (a separate FastAPI repo) — submit
screens against NSE/BSE universes, watch them run in the background, and review/export
results.
Built with [Lovable](https://lovable.dev); this is a **separate repository** from the FastAPI
backend by design (see the backend's `REQUIREMENTS.md` "Notable decisions" section for why),
talking to it purely over REST.

> This repo has no backend of its own — every screen, universe, and broker-status call goes
> to a FastAPI service you run/deploy separately. See [Connecting to the backend](#-connecting-to-the-backend)
> below before expecting anything to load.

## Pages

| Route | Purpose |
|---|---|
| `/run` | Submit a screen — pick a saved universe or paste tickers, a mode (fetched live from the backend), a broker, and (for Custom mode) an indicator/condition builder. |
| `/runs/:runId` | Poll a run's status (`queued → running → completed/failed`), view results once done, download the Excel export. |
| `/runs` | "Past Runs" — every run recorded by the backend, most-recent-first. |
| `/universes` | Upload a CSV or paste a ticker list; browse saved universes. |
| `/brokers` | Live broker auth status (Breeze/Angel/Yahoo) with a manual re-auth trigger. |
| `/settings` | Override the backend URL / API key at runtime, and toggle dark/light appearance — all stored in this browser's `localStorage` without a rebuild. |

## ⚡ Quick Start

**Prerequisites**: Node.js, the backend running somewhere reachable (see its own README for
`docker compose up -d --build` or the local `venv` path).

```sh
npm install
npm run dev
```

Opens on `http://localhost:8080` by default (or whatever port Vite prints). With no
`VITE_API_BASE_URL` set, it defaults to `http://127.0.0.1:8000` — override via `.env` (see
below) or the `/settings` page at runtime.

## 🔧 Connecting to the backend

Two ways to point this at a backend, in order of precedence:

1. **`/settings` page** (runtime, no rebuild) — sets `localStorage` overrides for backend URL
   and API key. Useful for pointing the same deployed frontend at a different backend without
   redeploying.
2. **Build-time env vars** (`.env`, or Lovable Secrets when deployed there):
   - `VITE_API_BASE_URL` — the backend's base URL (e.g. `http://127.0.0.1:8000` locally, or
     wherever it's deployed). Defaults to `http://127.0.0.1:8000` if unset.
   - `VITE_API_KEY` — only needed if the backend has `API_KEY` set. Sent as `X-API-Key` on
     every request unconditionally; harmless if the backend doesn't check it.

**The backend must allow this frontend's origin via CORS** — set `CORS_ALLOWED_ORIGINS` in
the backend's `.env` to match wherever this app is actually served from (e.g.
`http://localhost:8080` for local dev), or every request will fail in the browser with a CORS
error despite the backend itself being reachable (`curl` from a terminal will look fine —
CORS is a browser-enforced check, not a server-side one).

## 🧠 What the backend actually does

Screens run as **background jobs**, not a blocking request: `POST /screens/run` returns
almost instantly with `status: "queued"`, and this app polls `GET /screens/:runId` until it's
`completed` or `failed`. There's no synchronous "wait for the result" call — every screen
submission immediately navigates to the run's detail page, which owns the polling.

Custom mode's indicator list, default parameters, and available condition fields are fetched
live from `GET /screens/indicators` — nothing about available indicators is hardcoded here, so
a new indicator added to the backend shows up automatically with no frontend change.

## 🛠️ Tech stack

- **TanStack Start** (React + Vite, file-based routing with SSR) — routes under `src/routes/`
- **TanStack Query** for all data fetching/polling, **TanStack Table** for the results grid
- **Tailwind CSS** + **shadcn/ui** components
- **react-hook-form** + **zod** for the run-config form
- API client: `src/lib/api.ts` (typed wrapper over the backend's REST endpoints) +
  `src/lib/config.ts` (backend URL/key resolution — env var → `localStorage` override)

## Building / deploying

```sh
npm run build    # production build (Nitro/Cloudflare target by default)
npm run preview  # preview the production build locally
```

Deployed and synced via Lovable's GitHub two-way sync — changes made in the Lovable editor
commit here automatically, and pushes to this repo sync back into Lovable.

## Credits

UI/UX design guidance used while building this app's styling and layout (typography scale,
table hierarchy, color/consistency reviews) came from the
[`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) Claude Code skill
by [nextlevelbuilder](https://github.com/nextlevelbuilder), vendored under `.claude/ui-ux-pro-max/`.
