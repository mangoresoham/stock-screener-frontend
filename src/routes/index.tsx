import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Database, Moon, ShieldCheck, Sun, Zap } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { PassFailBadge, CrossoverBadge } from "@/components/status-badge";
import { getCurrentTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stock Screener" },
      {
        name: "description",
        content: "A broker-agnostic NSE/BSE stock screener — outperforming, momentum, and fully custom scans against your own saved ticker lists.",
      },
      { property: "og:title", content: "Stock Screener" },
      {
        property: "og:description",
        content: "A broker-agnostic NSE/BSE stock screener — outperforming, momentum, and fully custom scans against your own saved ticker lists.",
      },
    ],
  }),
  component: IndexRoute,
});

function IndexRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Already logged in -- go straight to the app rather than showing marketing copy to
  // someone who's already past that point.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/run" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || isAuthenticated) return null;

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <Hero />
      <MockResults />
      <HowItWorks />
      <ModesGrid />
      <TrustStrip />
      <LandingFooter />
    </div>
  );
}

function LandingHeader() {
  // Read once on mount (matches Settings page's own theme toggle -- both write straight
  // to localStorage + the document class via setTheme(), no shared reactive store).
  const [theme, setThemeState] = useState<Theme>(getCurrentTheme);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="text-signal">◆</span> Screener
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <Link
            to="/login"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24 text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
        A broker-agnostic stock screener for NSE &amp; BSE
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-muted-foreground">
        Screen the Indian equity market against a benchmark-relative strength check, a
        two-timeframe momentum confluence, or conditions you define yourself — pulling live
        data from Angel One, ICICI Breeze, or Yahoo Finance, whichever you have access to.
      </p>
      <div className="mt-8 flex items-center justify-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground hover:bg-signal/90"
        >
          Log in
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

// A static, hand-built mock -- not the real ResultsTable component (which is wired to
// live TanStack Table state/sorting/API data) -- but built from the same components
// (PassFailBadge, CrossoverBadge) and the same table/grouped-header classes as
// src/components/results-table.tsx, so this reads as a preview of the real thing rather
// than a differently-styled marketing graphic.
const MOCK_ROWS = [
  { ticker: "RELIANCE", passed: true, crossover: true, stockRsi: 64.2, niftyRsi: 51.8, atrPct: 1.84 },
  { ticker: "TCS", passed: true, crossover: false, stockRsi: 58.6, niftyRsi: 51.8, atrPct: 1.32 },
  { ticker: "HDFCBANK", passed: false, crossover: false, stockRsi: 47.1, niftyRsi: 51.8, atrPct: 0.98 },
  { ticker: "ICICIBANK", passed: true, crossover: false, stockRsi: 61.9, niftyRsi: 51.8, atrPct: 1.61 },
  { ticker: "INFY", passed: false, crossover: false, stockRsi: 44.3, niftyRsi: 51.8, atrPct: 2.05 },
];

function MockResults() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold tracking-tight">What a finished scan looks like</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Illustrative example, not live data — pass/fail up front, a fresh-signal chip when
          it matters, dense enough to scan hundreds of rows fast.
        </p>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead className="bg-sidebar/95">
            <tr className="border-b">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Pass</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Ticker</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Signal</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Stock RSI</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">Nifty RSI</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide">ATR %</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.map((r) => (
              <tr key={r.ticker} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">
                  <PassFailBadge passed={r.passed} />
                </td>
                <td className="px-2 py-1.5 font-mono font-medium">{r.ticker}</td>
                <td className="px-2 py-1.5">{r.crossover && <CrossoverBadge kind="buy" />}</td>
                <td className="px-2 py-1.5 font-mono tabular">{r.stockRsi.toFixed(1)}</td>
                <td className="px-2 py-1.5 font-mono tabular text-muted-foreground">{r.niftyRsi.toFixed(1)}</td>
                <td className="px-2 py-1.5 font-mono tabular">{r.atrPct.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Pick a universe",
    body: "Upload a CSV of tickers, paste a list, or reuse one you've already saved — a universe is shared across every future run.",
  },
  {
    n: "2",
    title: "Pick a mode",
    body: "Outperforming, Chandemo, or Custom. Pick a broker to fetch from; everything else has a sensible default.",
  },
  {
    n: "3",
    title: "Get results",
    body: "Submit and watch it run — queued, then screening, then a sortable, filterable results table with a one-click Excel export.",
  },
];

function HowItWorks() {
  return (
    <section className="border-y bg-sidebar/30">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h2 className="text-center text-lg font-semibold tracking-tight mb-8">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="space-y-2">
              <div className="flex size-7 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-xs text-signal">
                {s.n}
              </div>
              <h3 className="text-sm font-medium">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Descriptions verbatim from the project's own knowledge base (article/knowledge-base.md
// §1), not invented marketing copy -- what each mode actually checks, plainly stated.
const MODES = [
  {
    name: "Outperforming",
    body: "RSI beats a NIFTY 50 benchmark, ATR% clears a volatility floor, and Comparative Relative Strength is above its own moving average. All three must hold.",
  },
  {
    name: "Chandemo",
    body: "A two-timeframe Chande Momentum Oscillator confluence check — monthly WATCH, weekly BUY (requiring WATCH), weekly EXIT — derived from a trader's own TradingView Pine Script.",
  },
  {
    name: "Custom",
    body: "Pick any registered indicator(s), a timeframe, and an arbitrary AND/OR-nestable condition tree — the engine evaluates it generically, no code required.",
  },
];

function ModesGrid() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <h2 className="text-center text-lg font-semibold tracking-tight mb-8">Three ways to screen</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <div key={m.name} className="rounded-lg border p-5 space-y-2">
            <h3 className="font-mono text-sm font-medium text-signal">{m.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Read-only, enforced in code",
    body: "This app can never place, modify, or cancel a trade of any kind. Not a setting — every broker call is checked against a hard allowlist before it ever leaves the server.",
  },
  {
    icon: Database,
    title: "Angel One, Breeze, or Yahoo Finance",
    body: "Pick whichever broker you have credentials for, per run. Historical data is cached once in TimescaleDB and shared across every future scan.",
  },
  {
    icon: Zap,
    title: "Fast repeat scans",
    body: "Only the gap since your last fetch is ever requested from the broker — a second run against the same universe is close to instant.",
  },
];

function TrustStrip() {
  return (
    <section className="border-y bg-sidebar/30">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <Icon className="size-5 text-signal" />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className={cn("mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground")}>
      <span className="flex items-center justify-center gap-1.5">
        <span className="text-signal">◆</span> Screener
      </span>
      <p className="mt-2">Read-only market data and screening. Not investment advice.</p>
    </footer>
  );
}
