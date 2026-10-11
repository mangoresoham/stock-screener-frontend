import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChartCandlestick, ChartLine, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDICATOR_LABELS, PriceChart, type ChartType, type IndicatorKey, type Timeframe } from "@/components/price-chart";
import { api, ApiError } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stocks/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — Stock Screener` },
      { name: "description", content: `${params.symbol} daily price chart with RSI and Comparative RS.` },
      { property: "og:title", content: `${params.symbol} — Stock Screener` },
      { property: "og:description", content: `${params.symbol} daily price chart with RSI and Comparative RS.` },
    ],
  }),
  component: StockPage,
});

const RANGES = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
  { key: "All", months: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const NO_INDICATOR = "none";
const NO_SIGNALS = "off";
// One mode's signals at a time: every mode on one chart was unreadable.
const SIGNAL_MODES = [
  { mode: "outperforming", label: "Outperforming" },
  { mode: "chandemo", label: "Chandemo" },
  { mode: "custom", label: "Custom" },
] as const;

// Bar dates are plain IST trading dates ("2026-08-28"): parse and print them as UTC so the
// viewer's own timezone can never shift one to the neighbouring day.
const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function cutoffFor(lastDate: string, months: number | null): string | null {
  if (months == null) return null;
  const d = new Date(`${lastDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function StockPage() {
  const { symbol } = Route.useParams();
  const ticker = symbol.toUpperCase();
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [indicator, setIndicator] = useState<IndicatorKey | null>("RSI");
  const [range, setRange] = useState<RangeKey>("6M");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [signalMode, setSignalMode] = useState<string>(NO_SIGNALS);
  const qc = useQueryClient();
  const [historyPolling, setHistoryPolling] = useState(false);

  const barsQ = useQuery({
    queryKey: ["bars", ticker, timeframe],
    queryFn: () => api.getDailyBars(ticker, timeframe),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  const indicatorQ = useQuery({
    // Chandemo is always weekly + monthly, whatever the chart's timeframe.
    queryKey: ["indicator", ticker, indicator, indicator === "Chandemo" ? "W+M" : timeframe],
    queryFn: () => api.getIndicator(ticker, indicator as IndicatorKey, timeframe),
    enabled: indicator != null && Boolean(barsQ.data?.length),
    staleTime: 5 * 60_000,
  });

  const signalsQ = useQuery({
    queryKey: ["signals", ticker],
    queryFn: () => api.getSignals(ticker),
    enabled: Boolean(barsQ.data?.length),
    staleTime: 60_000,
  });
  const signalCounts = useMemo(() => {
    const seen = new Map<string, Set<string>>();
    for (const s of signalsQ.data ?? []) seen.set(s.mode, (seen.get(s.mode) ?? new Set()).add(`${s.date}|${s.signal}`));
    return new Map([...seen].map(([mode, keys]) => [mode, keys.size]));
  }, [signalsQ.data]);
  // Memoised so the chart (which rebuilds when this changes) isn't rebuilt on every render.
  const modeSignals = useMemo(
    () => (signalMode === NO_SIGNALS ? undefined : (signalsQ.data ?? []).filter((s) => s.mode === signalMode)),
    [signalsQ.data, signalMode],
  );

  const loadHistory = useMutation({
    mutationFn: () => api.loadHistory(ticker),
    onSuccess: () => setHistoryPolling(true),
    onError: (e) => toast.error("Couldn't start the history load", { description: (e as Error).message }),
  });
  const historyQ = useQuery({
    queryKey: ["history-load", ticker],
    queryFn: () => api.getHistoryStatus(ticker),
    enabled: historyPolling,
    refetchInterval: 1500,
  });
  const historyStatus = historyQ.data?.status;
  useEffect(() => {
    if (!historyPolling || (historyStatus !== "done" && historyStatus !== "failed")) return;
    setHistoryPolling(false);
    if (historyStatus === "done") {
      void qc.invalidateQueries({ queryKey: ["bars", ticker] });
      void qc.invalidateQueries({ queryKey: ["indicator", ticker] });
      void qc.invalidateQueries({ queryKey: ["signals", ticker] });
      toast.success(`Loaded ${historyQ.data?.period ?? ""} of history for ${ticker}`);
    } else {
      toast.error("History load failed", { description: historyQ.data?.error ?? undefined });
    }
  }, [historyPolling, historyStatus, historyQ.data, qc, ticker]);
  const historyBusy = loadHistory.isPending || historyPolling;

  const bars = barsQ.data;
  const last = bars?.[bars.length - 1];
  const prev = bars?.[bars.length - 2];
  const dayChange = last && prev ? last.close - prev.close : null;
  const dayPct = dayChange != null && prev ? (dayChange / prev.close) * 100 : null;
  const visibleFrom = last ? cutoffFor(last.date, RANGES.find((r) => r.key === range)?.months ?? null) : null;
  const notFound = barsQ.error instanceof ApiError && barsQ.error.status === 404;
  // Already holds the 5y (1825-day) window the load fetches? A week's slack covers the
  // window starting on a holiday/weekend.
  const fiveYearsBack = last
    ? new Date(Date.parse(`${last.date}T00:00:00Z`) - (1825 - 7) * 86_400_000).toISOString().slice(0, 10)
    : null;
  const hasFiveYears = Boolean(bars?.length && fiveYearsBack && bars[0].date <= fiveYearsBack);

  return (
    <AppShell>
      {/* Exactly the viewport below the 45px app header, chart filling the rest: the page
          itself never scrolls, so hovering/zooming the chart can't drift the page around.
          The min-height only kicks in on very short windows. */}
      <div className="mx-auto flex h-[calc(100dvh-2.8125rem)] min-h-[480px] max-w-[1400px] flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-tight">{ticker}</h1>
            {last && (
              <p className="text-xs text-muted-foreground">
                NSE · daily · stored data through {fmtDay(last.date)}
                <span className="hidden sm:inline"> · drag to pan, scroll to zoom</span>
              </p>
            )}
          </div>
          {last && (
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-semibold">₹{fmtNumber(last.close)}</span>
              {dayChange != null && dayPct != null && (
                <span className={cn("text-sm", dayChange >= 0 ? "text-pass" : "text-fail")}>
                  {dayChange >= 0 ? "+" : ""}
                  {fmtNumber(dayChange)} ({dayChange >= 0 ? "+" : ""}
                  {dayPct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {barsQ.isLoading && <div role="status" className="text-sm text-muted-foreground">Loading price history…</div>}
        {notFound && (
          <Card className="p-6 text-sm text-muted-foreground">
            No stored price data for <span className="font-mono text-foreground">{ticker}</span> yet. Run a screen
            whose universe includes it, and its history is fetched and kept for next time.
          </Card>
        )}
        {barsQ.error && !notFound && (
          <div role="alert" className="text-sm text-fail">{(barsQ.error as Error).message}</div>
        )}

        {bars && bars.length > 0 && (
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
              <div role="group" aria-label="Chart type" className="flex rounded border">
                {(
                  [
                    { value: "candles", label: "Candles", icon: ChartCandlestick },
                    { value: "line", label: "Line", icon: ChartLine },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={chartType === value}
                    aria-label={label}
                    title={label}
                    onClick={() => setChartType(value)}
                    className={cn(
                      "flex h-9 w-10 items-center justify-center first:rounded-l last:rounded-r sm:h-8 sm:w-9",
                      chartType === value ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </button>
                ))}
              </div>

              <div role="group" aria-label="Timeframe" className="flex rounded border text-xs">
                {(["1D", "1W"] as const).map((tf) => (
                  <button
                    type="button"
                    key={tf}
                    aria-pressed={timeframe === tf}
                    title={tf === "1D" ? "Daily candles" : "Weekly candles"}
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      "h-9 w-10 font-mono first:rounded-l last:rounded-r sm:h-8 sm:w-9",
                      timeframe === tf ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <Select
                value={indicator ?? NO_INDICATOR}
                onValueChange={(v) => setIndicator(v === NO_INDICATOR ? null : (v as IndicatorKey))}
              >
                <SelectTrigger aria-label="Indicator" className="h-9 w-[170px] text-xs sm:h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INDICATOR_LABELS) as IndicatorKey[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {INDICATOR_LABELS[k]}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_INDICATOR} className="text-xs">
                    No indicator
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={signalMode} onValueChange={setSignalMode}>
                <SelectTrigger
                  aria-label="Screen signals"
                  title="Mark one screen mode's verdicts on the chart (click a marker to open its run)"
                  className={cn("h-9 w-[170px] text-xs sm:h-8", signalMode !== NO_SIGNALS && "border-signal/40 text-signal")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SIGNALS} className="text-xs">
                    Signals: off
                  </SelectItem>
                  {SIGNAL_MODES.map(({ mode, label }) => {
                    const n = signalCounts.get(mode) ?? 0;
                    return (
                      <SelectItem key={mode} value={mode} disabled={n === 0} className="text-xs">
                        {label} signals ({n})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={() => loadHistory.mutate()}
                disabled={historyBusy || hasFiveYears}
                title="Download the last 5 years of daily data for this stock (and NIFTY) from Yahoo"
                className="flex h-9 items-center gap-1.5 rounded border px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-60 disabled:hover:text-muted-foreground sm:h-8"
              >
                {historyBusy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <History aria-hidden className="size-3.5" />}
                {historyBusy ? "Loading 5Y…" : hasFiveYears ? "5Y loaded" : "Load 5Y history"}
              </button>

              <div role="group" aria-label="Visible range" className="ml-auto flex gap-0.5 text-xs">
                {RANGES.map((r) => (
                  <button
                    type="button"
                    key={r.key}
                    aria-pressed={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={cn(
                      "h-9 min-w-9 rounded px-2 font-mono sm:h-8",
                      range === r.key ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.key}
                  </button>
                ))}
              </div>
            </div>

            <PriceChart
              symbol={ticker}
              bars={bars}
              chartType={chartType}
              indicator={indicator}
              indicatorData={indicatorQ.data}
              signals={modeSignals}
              timeframe={timeframe}
              visibleFrom={visibleFrom}
            />
            {indicatorQ.error && (
              <div role="alert" className="border-t px-3 py-2 text-xs text-fail">
                {INDICATOR_LABELS[indicator as IndicatorKey]} unavailable: {(indicatorQ.error as Error).message}
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
