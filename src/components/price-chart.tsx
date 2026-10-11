import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesMarker, SeriesType, Time } from "lightweight-charts";

import type { DailyBar, IndicatorSeries, ScreenSignal } from "@/lib/api";
import { fmtNumber } from "@/lib/format";

export type ChartType = "candles" | "line";
export type Timeframe = "1D" | "1W";
export type IndicatorKey = "RSI" | "Comparative_RS" | "Chandemo";

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  RSI: "RSI",
  Comparative_RS: "Comparative RS",
  Chandemo: "Chandemo (CMO)",
};

// Output fields drawn per indicator, with the token each line is coloured from.
const INDICATOR_LINES: Record<IndicatorKey, { field: string; label: string; color: string }[]> = {
  RSI: [{ field: "value", label: "RSI", color: "--signal" }],
  Comparative_RS: [
    { field: "crs", label: "CRS", color: "--signal" },
    { field: "crs_sma", label: "SMA", color: "--warn" },
  ],
  Chandemo: [
    { field: "weekly_cmo", label: "Weekly", color: "--signal" },
    { field: "monthly_cmo", label: "Monthly", color: "--warn" },
  ],
};
const DIGITS: Record<IndicatorKey, number> = { RSI: 2, Comparative_RS: 4, Chandemo: 2 };
// Oscillators keep their full scale instead of autoscaling to the visible wiggle.
const FIXED_RANGE: Partial<Record<IndicatorKey, [number, number]>> = { RSI: [0, 100], Chandemo: [-100, 100] };

// lightweight-charts paints on canvas and doesn't understand the oklch() tokens in
// styles.css, so resolve each token through a 1px canvas into plain rgba.
function tokenColor(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !raw) return `rgba(128, 128, 128, ${alpha})`;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Index of the last sorted date <= d, or -1. Used to put a date on the candle that
// contains it (a weekly bar is dated by its first trading day) and for step lookups.
function lastAtOrBefore(sorted: string[], d: string): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= d) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

// How each screen verdict is drawn: arrows for entries, a small dot for WATCH, and text
// only on the two verdicts that mean "act" -- the chart shows one mode at a time, so a
// plain arrow already says which screen passed it.
const SIGNAL_STYLE: Record<
  ScreenSignal["signal"],
  { position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown" | "circle"; color: string; text?: string; size?: number }
> = {
  pass: { position: "belowBar", shape: "arrowUp", color: "--signal" },
  buy: { position: "belowBar", shape: "arrowUp", color: "--pass", text: "BUY" },
  watch: { position: "aboveBar", shape: "circle", color: "--warn", size: 0.5 },
  exit: { position: "aboveBar", shape: "arrowDown", color: "--fail", text: "EXIT" },
};
const SIGNAL_NAME: Record<ScreenSignal["signal"], string> = { pass: "PASS", buy: "BUY", watch: "WATCH", exit: "EXIT" };

type PlacedSignal = ScreenSignal & { bar: string };
type Legend = { bar: DailyBar; prevClose: number | null; ind: Record<string, number | undefined>; sig: PlacedSignal[] };

export function PriceChart({
  symbol,
  bars,
  timeframe,
  chartType,
  indicator,
  indicatorData,
  signals,
  visibleFrom,
}: {
  symbol: string;
  bars: DailyBar[];
  timeframe: Timeframe;
  chartType: ChartType;
  indicator: IndicatorKey | null;
  indicatorData: IndicatorSeries | undefined;
  // Screen verdicts to mark on the price pane (already narrowed to one mode); empty hides them.
  signals: ScreenSignal[] | undefined;
  // First date to show (YYYY-MM-DD); null fits all data.
  visibleFrom: string | null;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [legend, setLegend] = useState<Legend | null>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const lines = indicator ? INDICATOR_LINES[indicator] : [];

  // The chart is rebuilt whenever its data or type changes: a few hundred bars redraw
  // instantly, and it keeps the series/pane bookkeeping trivially correct.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    void import("lightweight-charts").then(
      ({ createChart, createSeriesMarkers, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode, LineStyle, LineType }) => {
        if (disposed) return;
        const up = tokenColor("--pass");
        const down = tokenColor("--fail");
        const muted = tokenColor("--muted-foreground");
        const border = tokenColor("--border");
        const barDates = bars.map((b) => b.date);
        const snap = (d: string) => {
          const i = lastAtOrBefore(barDates, d);
          return i < 0 ? null : barDates[i];
        };

        const chart = createChart(el, {
          autoSize: true,
          layout: {
            background: { color: tokenColor("--card") },
            textColor: muted,
            fontFamily: getComputedStyle(document.body).fontFamily,
            fontSize: 11,
            panes: { separatorColor: border, separatorHoverColor: tokenColor("--accent") },
          },
          grid: { vertLines: { color: tokenColor("--border", 0.5) }, horzLines: { color: tokenColor("--border", 0.5) } },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: border },
          timeScale: { borderColor: border, rightOffset: 4, minBarSpacing: 1 },
          // Vertical swipes scroll the page on touch screens instead of being swallowed by
          // the chart; horizontal drags still pan it.
          handleScroll: { vertTouchDrag: false },
        });
        chartRef.current = chart;

        const priceData = bars.map((b) => ({ time: b.date as Time, open: b.open, high: b.high, low: b.low, close: b.close }));
        const price: ISeriesApi<SeriesType> =
          chartType === "candles"
            ? chart.addSeries(CandlestickSeries, {
                upColor: up,
                downColor: down,
                wickUpColor: up,
                wickDownColor: down,
                borderVisible: false,
              })
            : chart.addSeries(LineSeries, { color: tokenColor("--signal"), lineWidth: 2 });
        price.setData(chartType === "candles" ? priceData : priceData.map((b) => ({ time: b.time, value: b.close })));

        // Each signal goes on the candle containing its date; one marker per candle and
        // verdict, keeping the latest run's id so clicking it opens that run.
        const placed = new Map<string, PlacedSignal>();
        for (const s of signals ?? []) {
          const bar = snap(s.date);
          if (bar) placed.set(`${bar}|${s.signal}`, { ...s, bar });
        }
        const markers: SeriesMarker<Time>[] = [...placed.values()]
          .sort((a, b) => (a.bar < b.bar ? -1 : a.bar > b.bar ? 1 : 0))
          .map((s) => {
            const st = SIGNAL_STYLE[s.signal];
            return {
              time: s.bar as Time,
              position: st.position,
              shape: st.shape,
              color: tokenColor(st.color),
              text: st.text,
              size: st.size,
              id: String(s.run_id),
            };
          });
        if (markers.length) createSeriesMarkers(price, markers);

        // Volume as an overlay along the bottom fifth of the price pane, TradingView-style.
        const volume = chart.addSeries(HistogramSeries, {
          priceScaleId: "volume",
          priceFormat: { type: "volume" },
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        const volUp = tokenColor("--pass", 0.35);
        const volDown = tokenColor("--fail", 0.35);
        volume.setData(
          bars.map((b, i) => ({
            time: b.date as Time,
            value: b.volume,
            color: b.close >= (bars[i - 1]?.close ?? b.open) ? volUp : volDown,
          })),
        );

        // field -> sorted (bar date, value) pairs, for step lookups in the legend.
        const indicatorValues = new Map<string, { dates: string[]; values: number[] }>();
        if (indicator && indicatorData) {
          const range = FIXED_RANGE[indicator];
          const digits = DIGITS[indicator];
          let first: ISeriesApi<"Line"> | null = null;
          for (const line of lines) {
            const s = chart.addSeries(
              LineSeries,
              {
                color: tokenColor(line.color),
                lineWidth: line === lines[0] ? 2 : 1,
                // Chandemo's weekly/monthly values hold until the next close: steps, not slopes.
                lineType: indicator === "Chandemo" ? LineType.WithSteps : LineType.Simple,
                priceLineVisible: false,
                priceFormat: { type: "price", precision: digits, minMove: 10 ** -digits },
                ...(range && { autoscaleInfoProvider: () => ({ priceRange: { minValue: range[0], maxValue: range[1] } }) }),
              },
              1,
            );
            const byBar = new Map<string, number>();
            for (const p of indicatorData.fields[line.field] ?? []) {
              const bar = snap(p.date);
              if (bar) byBar.set(bar, p.value);
            }
            const dates = [...byBar.keys()];
            s.setData(dates.map((d) => ({ time: d as Time, value: byBar.get(d)! })));
            indicatorValues.set(line.field, { dates, values: dates.map((d) => byBar.get(d)!) });
            first ??= s;
          }
          // Threshold lines: RSI's 70/30, or the levels the backend sends (Chandemo's
          // watch/buy/exit), merged when two share a value.
          const levels = new Map<number, string[]>();
          if (indicator === "RSI") [70, 30].forEach((v) => levels.set(v, []));
          for (const [name, v] of Object.entries(indicatorData.levels ?? {})) levels.set(v, [...(levels.get(v) ?? []), name.toUpperCase()]);
          for (const [value, names] of levels) {
            first?.createPriceLine({
              price: value,
              color: muted,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: names.join("/"),
            });
          }
          const panes = chart.panes();
          panes[0]?.setStretchFactor(3);
          panes[1]?.setStretchFactor(1);
        }

        if (visibleFrom) chart.timeScale().setVisibleRange({ from: visibleFrom as Time, to: bars[bars.length - 1].date as Time });
        else chart.timeScale().fitContent();

        const byDate = new Map(bars.map((b, i) => [b.date, i]));
        const signalsByBar = new Map<string, PlacedSignal[]>();
        for (const s of placed.values()) signalsByBar.set(s.bar, [...(signalsByBar.get(s.bar) ?? []), s]);
        const legendAt = (date: string | undefined): Legend | null => {
          const i = date != null ? byDate.get(date) : bars.length - 1;
          if (i == null) return null;
          const ind: Record<string, number | undefined> = {};
          for (const [field, { dates, values }] of indicatorValues) {
            const j = lastAtOrBefore(dates, bars[i].date);
            ind[field] = j < 0 ? undefined : values[j];
          }
          return { bar: bars[i], prevClose: bars[i - 1]?.close ?? null, ind, sig: signalsByBar.get(bars[i].date) ?? [] };
        };
        setLegend(legendAt(undefined));
        const onMove = (p: MouseEventParams<Time>) => setLegend(legendAt(p.time as string | undefined) ?? legendAt(undefined));
        chart.subscribeCrosshairMove(onMove);
        // Clicking a signal marker opens the run that produced it.
        const onClick = (p: MouseEventParams<Time>) => {
          if (typeof p.hoveredObjectId === "string") void navigate({ to: "/runs/$runId", params: { runId: p.hoveredObjectId } });
        };
        chart.subscribeClick(onClick);

        // Indicator legend sits at the top of the lower pane, whose height changes on resize.
        const placeIndicatorLegend = () => setIndicatorTop(indicator ? (chart.panes()[0]?.getHeight() ?? 0) + 1 : null);
        // Placed now and again on the next frame: the chart lays its panes out in its own
        // resize handler, which may run after this one.
        const ro = new ResizeObserver(() => {
          placeIndicatorLegend();
          requestAnimationFrame(placeIndicatorLegend);
        });
        ro.observe(el);

        cleanup = () => {
          ro.disconnect();
          chart.unsubscribeCrosshairMove(onMove);
          chart.unsubscribeClick(onClick);
          chart.remove();
          chartRef.current = null;
        };
      },
    );

    return () => {
      disposed = true;
      cleanup();
    };
    // visibleFrom is applied by its own effect below, without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, chartType, indicator, indicatorData, signals]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || bars.length === 0) return;
    if (visibleFrom) chart.timeScale().setVisibleRange({ from: visibleFrom as Time, to: bars[bars.length - 1].date as Time });
    else chart.timeScale().fitContent();
  }, [visibleFrom, bars]);

  const change = legend && legend.prevClose != null ? legend.bar.close - legend.prevClose : null;
  const changePct = change != null && legend?.prevClose ? (change / legend.prevClose) * 100 : null;
  const tone = change == null ? "" : change >= 0 ? "text-pass" : "text-fail";

  return (
    <div className="relative min-h-[300px] w-full flex-1">
      <div ref={containerRef} className="absolute inset-0" />
      {legend && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 pr-16 font-mono text-[11px] tabular-nums">
          <span className="font-sans text-xs font-semibold text-foreground">
            {symbol} · {timeframe}
          </span>
          <span className="text-muted-foreground">
            O <span className={tone}>{fmtNumber(legend.bar.open)}</span>
          </span>
          <span className="text-muted-foreground">
            H <span className={tone}>{fmtNumber(legend.bar.high)}</span>
          </span>
          <span className="text-muted-foreground">
            L <span className={tone}>{fmtNumber(legend.bar.low)}</span>
          </span>
          <span className="text-muted-foreground">
            C <span className={tone}>{fmtNumber(legend.bar.close)}</span>
          </span>
          {change != null && changePct != null && (
            <span className={tone}>
              {change >= 0 ? "+" : ""}
              {fmtNumber(change)} ({change >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          )}
          <span className="text-muted-foreground">Vol {legend.bar.volume.toLocaleString("en-IN")}</span>
          {legend.sig.map((sg) => (
            <span
              key={sg.signal}
              className="rounded px-1 font-sans text-[10px] font-semibold"
              style={{
                color: `var(${SIGNAL_STYLE[sg.signal].color})`,
                background: `color-mix(in oklch, var(${SIGNAL_STYLE[sg.signal].color}) 15%, transparent)`,
              }}
            >
              {SIGNAL_NAME[sg.signal]}
            </span>
          ))}
        </div>
      )}
      {legend && indicator && indicatorData && indicatorTop != null && (
        <div
          className="pointer-events-none absolute left-2 z-10 flex flex-wrap items-baseline gap-x-2.5 font-mono text-[11px] tabular-nums"
          style={{ top: indicatorTop + 4 }}
        >
          <span className="font-sans text-xs font-medium text-foreground">
            {INDICATOR_LABELS[indicator]} {indicatorData.period}
          </span>
          {lines.map((l) => (
            <span key={l.field} className="text-muted-foreground">
              {lines.length > 1 && <>{l.label} </>}
              <span style={{ color: `var(${l.color})` }}>
                {legend.ind[l.field] == null ? "—" : fmtNumber(legend.ind[l.field], { digits: DIGITS[indicator] })}
              </span>
            </span>
          ))}
        </div>
      )}
      <span className="sr-only">
        {symbol} {timeframe === "1W" ? "weekly" : "daily"} {chartType === "candles" ? "candlestick" : "line"} chart
        {indicator ? ` with ${INDICATOR_LABELS[indicator]} below` : ""}.
      </span>
    </div>
  );
}
