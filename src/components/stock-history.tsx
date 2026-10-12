import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { FlagBadge } from "@/components/status-badge";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtNumber, fmtValue } from "@/lib/format";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<string, string> = { outperforming: "Outperforming", chandemo: "Chandemo", custom: "Custom" };
const MODES = ["outperforming", "chandemo", "custom"] as const;
type Mode = (typeof MODES)[number];

// The values shown inline per mode; the full set is in the row's tooltip.
const KEY_VALUES: Record<string, string[]> = {
  outperforming: ["Stock_RSI", "ATR_Pct", "Comparative_RS"],
  chandemo: ["Weekly_CMO", "Monthly_CMO"],
};

const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v: number | null | undefined) => (v == null ? "" : v > 0 ? "text-pass" : v < 0 ? "text-fail" : "");

function ModeFilter<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 text-xs">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded px-2.5 sm:h-8",
            value === o.value ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Every verdict any (analyzable) run gave this stock, newest first. */
export function FlagsTable({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState<"all" | Mode>("all");
  const q = useQuery({ queryKey: ["timeline", symbol], queryFn: () => api.getTimeline(symbol), staleTime: 60_000 });
  const entries = useMemo(() => [...(q.data ?? [])].reverse(), [q.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.mode] = (c[e.mode] ?? 0) + 1;
    return c;
  }, [entries]);
  const shown = mode === "all" ? entries : entries.filter((e) => e.mode === mode);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
        <ModeFilter
          label="Filter by mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all" as const, label: `All (${entries.length})` },
            ...MODES.filter((m) => counts[m]).map((m) => ({ value: m, label: `${MODE_LABEL[m]} (${counts[m]})` })),
          ]}
        />
        <span className="text-[11px] text-muted-foreground">Chandemo runs before the 12 Oct 2026 fix are hidden.</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {q.isLoading && <div role="status" className="p-4 text-xs text-muted-foreground">Loading…</div>}
        {q.error && <div role="alert" className="p-4 text-xs text-fail">{(q.error as Error).message}</div>}
        {q.data && shown.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">No screen run has evaluated {symbol} yet.</div>
        )}
        {shown.length > 0 && (
          <table className="w-full text-xs">
            <caption className="sr-only">Screen verdicts for {symbol}, newest first</caption>
            <thead className="sticky top-0 bg-sidebar text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Candle</th>
                <th scope="col" className="px-3 py-2 font-medium">Mode</th>
                <th scope="col" className="px-3 py-2 font-medium">Verdict</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Close</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Values</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Universe</th>
                <th scope="col" className="px-3 py-2 font-medium">Run</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const keys = KEY_VALUES[e.mode] ?? Object.keys(e.values).filter((k) => k !== "Latest_Close").slice(0, 3);
                return (
                  <tr
                    key={e.run_id}
                    className="border-t hover:bg-accent/40"
                    title={Object.entries(e.values).map(([k, v]) => `${k}: ${v}`).join("\n")}
                  >
                    <td className="px-3 py-1.5 font-mono tabular-nums">{fmtDay(e.date)}</td>
                    <td className="px-3 py-1.5">{MODE_LABEL[e.mode] ?? e.mode}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex gap-1">
                        {e.flags.map((f) => (
                          <FlagBadge key={f} flag={f} />
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtNumber(e.close)}</td>
                    <td className="hidden px-3 py-1.5 font-mono tabular-nums text-muted-foreground md:table-cell">
                      {keys
                        .filter((k) => e.values[k] != null)
                        .map((k) => `${k.replaceAll("_", " ")} ${fmtValue(e.values[k])}`)
                        .join(" · ")}
                    </td>
                    <td className="hidden max-w-[180px] truncate px-3 py-1.5 sm:table-cell">{e.universe}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <Link
                        to="/runs/$runId"
                        params={{ runId: String(e.run_id) }}
                        className="text-signal hover:underline"
                        title={`Finished ${fmtDateTime(e.run_finished_at)}`}
                      >
                        #{e.run_id}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

const REASON: Record<string, string> = { EXIT: "EXIT", WATCH: "BUY → WATCH", NONE: "BUY lapsed", FAIL: "Failed screen" };

/** Entries and exits for one mode, with a win-rate / average-return summary. */
export function TradesPanel({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState<Mode>("chandemo");
  const q = useQuery({ queryKey: ["trades", symbol, mode], queryFn: () => api.getTrades(symbol, mode), staleTime: 60_000 });
  const t = q.data;
  const trades = useMemo(() => [...(t?.trades ?? [])].reverse(), [t]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1.5">
        <ModeFilter label="Trade source" value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        {t && <span className="text-[11px] text-muted-foreground">{t.method}</span>}
      </div>
      {t && (
        <dl className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4">
          {[
            ["Trades", `${t.summary.trades}${t.summary.trades > t.summary.closed ? ` (${t.summary.trades - t.summary.closed} open)` : ""}`],
            ["Win rate", t.summary.win_rate == null ? "—" : `${Math.round(t.summary.win_rate * 100)}% (${t.summary.wins}/${t.summary.closed})`],
            ["Avg return", fmtPct(t.summary.avg_return_pct)],
            ["Avg hold", t.summary.avg_holding_days == null ? "—" : `${Math.round(t.summary.avg_holding_days)} days`],
          ].map(([label, value]) => (
            <div key={label} className="bg-card px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  label === "Avg return" && tone(t.summary.avg_return_pct),
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {q.isLoading && <div role="status" className="p-4 text-xs text-muted-foreground">Loading…</div>}
        {q.error && (
          <div role="alert" className="p-4 text-xs text-fail">
            {q.error instanceof ApiError ? q.error.detail : (q.error as Error).message}
          </div>
        )}
        {t && trades.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">
            No {MODE_LABEL[mode]} trades for {symbol}
            {mode === "chandemo" ? " in the stored price history (load 5Y history for a longer replay)." : " yet."}
          </div>
        )}
        {trades.length > 0 && (
          <table className="w-full text-xs">
            <caption className="sr-only">{MODE_LABEL[mode]} trades for {symbol}, newest first</caption>
            <thead className="sticky top-0 bg-sidebar text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Entry</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Entry ₹</th>
                <th scope="col" className="px-3 py-2 font-medium">Exit</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Exit ₹</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Why</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Return</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">NIFTY</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Days</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((tr) => (
                <tr key={tr.entry_date} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-1.5 font-mono tabular-nums">{fmtDay(tr.entry_date)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtNumber(tr.entry_price)}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">
                    {tr.open ? <FlagBadge flag="OPEN" /> : fmtDay(tr.exit_date)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{tr.open ? "—" : fmtNumber(tr.exit_price)}</td>
                  <td className="hidden px-3 py-1.5 sm:table-cell">{tr.exit_reason ? REASON[tr.exit_reason] ?? tr.exit_reason : "—"}</td>
                  <td className={cn("px-3 py-1.5 text-right font-mono tabular-nums", tone(tr.return_pct))}>
                    {fmtPct(tr.return_pct)}
                    {tr.open && <span className="text-muted-foreground"> *</span>}
                  </td>
                  <td className={cn("hidden px-3 py-1.5 text-right font-mono tabular-nums sm:table-cell", tone(tr.benchmark_return_pct))}>
                    {fmtPct(tr.benchmark_return_pct)}
                  </td>
                  <td className="hidden px-3 py-1.5 text-right font-mono tabular-nums md:table-cell">{tr.holding_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {trades.some((tr) => tr.open) && (
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">* Open trade, valued at the latest stored close.</p>
        )}
      </div>
    </Card>
  );
}
