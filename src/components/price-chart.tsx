import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesMarker, SeriesType, Time } from "lightweight-charts";

import type { DailyBar, IndicatorSeries, ScreenSignal } from "@/lib/api";
import { fmtNumber } from "@/lib/format";

export type ChartType = "candles" | "line";
export type IndicatorKey = "RSI" | "Comparative_RS";

export const INDICATOR_LABELS: Record<IndicatorKey, string> = { RSI: "RSI", Comparative_RS: "Comparative RS" };

// Output fields drawn per indicator, with the token each line is coloured from.
const INDICATOR_LINES: Record<IndicatorKey, { field: string; label: string; color: string }[]> = {
  RSI: [{ field: "value", label: "RSI", color: "--signal" }],
  Comparative_RS: [
    { field: "crs", label: "CRS", color: "--signal" },
    { field: "crs_sma", label: "SMA", color: "--warn" },
  ],
};

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

// How each screen verdict is drawn on the price pane, TradingView-style.
const SIGNAL_STYLE: Record<
  ScreenSignal["signal"],
  { position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown" | "circle"; color: string }
> = {
  pass: { position: "belowBar", shape: "arrowUp", color: "--signal" },
  buy: { position: "belowBar", shape: "arrowUp", color: "--pass" },
  watch: { position: "aboveBar", shape: "circle", color: "--warn" },
  exit: { position: "aboveBar", shape: "arrowDown", color: "--fail" },
};

function signalLabel(s: Pick<ScreenSignal, "mode" | "signal">): string {
  if (s.signal !== "pass") return s.signal.toUpperCase();
  return s.mode === "outperforming" ? "Outperf" : s.mode === "custom" ? "Custom" : s.mode;
}

// One marker per (date, label): several runs often give the same verdict for the same
// candle. The marker keeps the latest run's id so clicking it opens that run.
function toMarkers(signals: ScreenSignal[]): SeriesMarker<Time>[] {
  const latest = new Map<string, ScreenSignal>();
  for (const s of signals) latest.set(`${s.date}|${signalLabel(s)}`, s);
  return [...latest.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((s) => {
      const style = SIGNAL_STYLE[s.signal];
      return {
        time: s.date as Time,
        position: style.position,
        shape: style.shape,
        color: tokenColor(style.color),
        text: signalLabel(s),
        id: String(s.run_id),
      };
    });
}

type Legend = { bar: DailyBar; prevClose: number | null; ind: Record<string, number | undefined>; sig: ScreenSignal[] };

export function PriceChart({
  symbol,
  bars,
  chartType,
  indicator,
  indicatorData,
  signals,
  visibleFrom,
}: {
  symbol: string;
  bars: DailyBar[];
  chartType: ChartType;
  indicator: IndicatorKey | null;
  indicatorData: IndicatorSeries | undefined;
  // Screen verdicts to mark on the price pane; empty/undefined hides them.
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

  // The chart is rebuilt whenever its data or type changes: a few hundred daily bars
  // redraw instantly, and it keeps the series/pane bookkeeping trivially correct.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    void import("lightweight-charts").then(({ createChart, createSeriesMarkers, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode, LineStyle }) => {
      if (disposed) return;
      const up = tokenColor("--pass");
      const down = tokenColor("--fail");
      const muted = tokenColor("--muted-foreground");
      const border = tokenColor("--border");

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
      if (signals?.length) createSeriesMarkers(price, toMarkers(signals));

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

      // field -> (date -> value), for the legend's crosshair lookups.
      const indicatorValues = new Map<string, Map<string, number>>();
      let rsiSeries: ISeriesApi<"Line"> | null = null;
      if (indicator && indicatorData) {
        for (const line of lines) {
          const s = chart.addSeries(
            LineSeries,
            {
              color: tokenColor(line.color),
              lineWidth: line.field === "value" || line.field === "crs" ? 2 : 1,
              priceLineVisible: false,
              priceFormat: indicator === "RSI" ? { type: "price", precision: 2, minMove: 0.01 } : { type: "price", precision: 4, minMove: 0.0001 },
              ...(indicator === "RSI" && { autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }),
            },
            1,
          );
          const points = indicatorData.fields[line.field] ?? [];
          s.setData(points.map((p) => ({ time: p.date as Time, value: p.value })));
          indicatorValues.set(line.field, new Map(points.map((p) => [p.date, p.value])));
          if (indicator === "RSI") rsiSeries = s;
        }
        if (rsiSeries) {
          for (const level of [70, 30]) {
            rsiSeries.createPriceLine({ price: level, color: muted, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          }
        }
        const panes = chart.panes();
        panes[0]?.setStretchFactor(3);
        panes[1]?.setStretchFactor(1);
      }

      if (visibleFrom) chart.timeScale().setVisibleRange({ from: visibleFrom as Time, to: bars[bars.length - 1].date as Time });
      else chart.timeScale().fitContent();

      const byDate = new Map(bars.map((b, i) => [b.date, i]));
      const signalsByDate = new Map<string, ScreenSignal[]>();
      for (const sg of signals ?? []) {
        const day = signalsByDate.get(sg.date) ?? [];
        if (!day.some((d) => signalLabel(d) === signalLabel(sg))) day.push(sg);
        signalsByDate.set(sg.date, day);
      }
      const legendAt = (date: string | undefined): Legend | null => {
        const i = date != null ? byDate.get(date) : bars.length - 1;
        if (i == null) return null;
        const ind: Record<string, number | undefined> = {};
        for (const [field, values] of indicatorValues) ind[field] = values.get(bars[i].date);
        return { bar: bars[i], prevClose: bars[i - 1]?.close ?? null, ind, sig: signalsByDate.get(bars[i].date) ?? [] };
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
      const ro = new ResizeObserver(() => requestAnimationFrame(placeIndicatorLegend));
      ro.observe(el);

      cleanup = () => {
        ro.disconnect();
        chart.unsubscribeCrosshairMove(onMove);
        chart.unsubscribeClick(onClick);
        chart.remove();
        chartRef.current = null;
      };
    });

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
          <span className="font-sans text-xs font-semibold text-foreground">{symbol} · 1D</span>
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
              key={signalLabel(sg)}
              className="rounded px-1 font-sans text-[10px] font-semibold"
              style={{ color: `var(${SIGNAL_STYLE[sg.signal].color})`, background: `color-mix(in oklch, var(${SIGNAL_STYLE[sg.signal].color}) 15%, transparent)` }}
            >
              {signalLabel(sg)}
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
                {legend.ind[l.field] == null ? "—" : fmtNumber(legend.ind[l.field], { digits: indicator === "RSI" ? 2 : 4 })}
              </span>
            </span>
          ))}
        </div>
      )}
      <span className="sr-only">
        {symbol} daily {chartType === "candles" ? "candlestick" : "line"} chart
        {indicator ? ` with ${INDICATOR_LABELS[indicator]} below` : ""}.
      </span>
    </div>
  );
}
