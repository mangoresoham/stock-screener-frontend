import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlagBadge } from "@/components/status-badge";
import { api, type ModeSummary, type MoverKind } from "@/lib/api";
import { fmtDateTime, fmtNumber, fmtValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stock Screener" },
      { name: "description", content: "What the latest screen runs say: BUY / WATCH / EXIT and pass counts, and what changed." },
      { property: "og:title", content: "Dashboard — Stock Screener" },
      { property: "og:description", content: "What the latest screen runs say." },
    ],
  }),
  component: DashboardPage,
});

const MODE_LABEL: Record<string, string> = { outperforming: "Outperforming", chandemo: "Chandemo", custom: "Custom" };

// The counts each mode card shows, in order; each is clickable to list its tickers.
const KINDS: Record<string, { kind: MoverKind; label: string; tone?: string }[]> = {
  chandemo: [
    { kind: "new_buy", label: "New BUY", tone: "text-pass" },
    { kind: "buy", label: "BUY", tone: "text-pass" },
    { kind: "watch", label: "WATCH", tone: "text-warn" },
    { kind: "exit", label: "EXIT", tone: "text-fail" },
    { kind: "new_exit", label: "New EXIT", tone: "text-fail" },
    { kind: "dropped", label: "Left BUY" },
  ],
  default: [
    { kind: "passed", label: "Passed", tone: "text-signal" },
    { kind: "new_pass", label: "New", tone: "text-pass" },
    { kind: "dropped", label: "Dropped", tone: "text-fail" },
  ],
};

// Indicator values worth a column per mode; anything else falls back to the first few.
const KEY_VALUES: Record<string, string[]> = {
  outperforming: ["Stock_RSI", "Nifty_RSI", "ATR_Pct", "Comparative_RS"],
  chandemo: ["Weekly_CMO", "Monthly_CMO"],
};

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function DashboardPage() {
  const [universeId, setUniverseId] = useState<number | undefined>(undefined);
  const q = useQuery({
    queryKey: ["dashboard", universeId ?? "latest"],
    queryFn: () => api.dashboardSummary(universeId),
    placeholderData: (prev) => prev,
  });
  const d = q.data;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted-foreground">What the latest completed run of each mode says for one universe.</p>
          </div>
          {d && d.universes.length > 0 && (
            <Select value={d.universe ? String(d.universe.id) : undefined} onValueChange={(v) => setUniverseId(Number(v))}>
              <SelectTrigger aria-label="Universe" className="h-9 w-[240px] text-xs sm:h-8">
                <SelectValue placeholder="Choose a universe" />
              </SelectTrigger>
              <SelectContent>
                {d.universes.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                    {u.name} ({u.member_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {q.isLoading && <div role="status" className="text-sm text-muted-foreground">Loading…</div>}
        {q.error && <div role="alert" className="text-sm text-fail">{(q.error as Error).message}</div>}

        {d && (
          <>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Stocks tracked" value={d.data.instruments} sub={`${d.data.with_bars} with price data`} />
              <Stat
                label="Price data through"
                value={d.data.latest_bar_date ? fmtDay(d.data.latest_bar_date) : "—"}
                sub={d.data.stale ? `${d.data.stale} stocks over a week behind` : "all stocks current"}
                subTone={d.data.stale ? "text-warn" : undefined}
              />
              {d.modes
                .filter((m) => m.mode !== "custom")
                .map((m) => (
                  <ModeStat key={m.mode} m={m} />
                ))}
            </dl>

            {!d.universe && (
              <Card className="p-6 text-sm text-muted-foreground">
                No completed runs yet. <Link to="/run" className="text-signal hover:underline">Run a screen</Link> to fill
                the dashboard.
              </Card>
            )}
            {d.universe && d.modes.map((m) => <ModeCard key={`${m.mode}-${m.run?.id ?? "none"}`} m={m} />)}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub, subTone }: { label: string; value: string | number; sub?: string; subTone?: string }) {
  return (
    <Card className="p-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</dd>
      {sub && <dd className={cn("text-xs text-muted-foreground", subTone)}>{sub}</dd>}
    </Card>
  );
}

function ModeStat({ m }: { m: ModeSummary }) {
  const c = m.counts;
  if (!m.run) {
    const why = m.mode === "chandemo" ? "re-run needed after the 12 Oct fix" : "no run on this universe";
    return <Stat label={MODE_LABEL[m.mode]} value="—" sub={why} />;
  }
  if (m.mode === "chandemo") {
    return (
      <Card className="p-3">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Chandemo</dt>
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 font-mono tabular-nums">
          <span className="text-lg font-semibold text-pass">{c.buy ?? 0}</span>
          <span className="text-xs text-muted-foreground">BUY</span>
          <span className="text-lg font-semibold text-warn">{c.watch ?? 0}</span>
          <span className="text-xs text-muted-foreground">WATCH</span>
          <span className="text-lg font-semibold text-fail">{c.exit ?? 0}</span>
          <span className="text-xs text-muted-foreground">EXIT</span>
        </dd>
        <dd className="text-xs text-muted-foreground">
          {c.new_buy ?? 0} new BUY · {c.new_exit ?? 0} new EXIT
        </dd>
      </Card>
    );
  }
  return (
    <Stat
      label={MODE_LABEL[m.mode] ?? m.mode}
      value={`${c.passed ?? 0} / ${c.evaluated ?? 0}`}
      sub={c.new_pass != null ? `${c.new_pass} new · ${c.dropped} dropped vs previous run` : "passed / evaluated"}
    />
  );
}

function ModeCard({ m }: { m: ModeSummary }) {
  const kinds = KINDS[m.mode] ?? KINDS.default;
  const available = kinds.filter((k) => m.counts[k.kind] != null);
  const firstNonEmpty = available.find((k) => (m.counts[k.kind] ?? 0) > 0)?.kind ?? available[0]?.kind;
  const [picked, setPicked] = useState<MoverKind | undefined>(undefined);
  const kind = picked ?? firstNonEmpty;

  const movers = useQuery({
    queryKey: ["movers", m.run?.id, kind],
    queryFn: () => api.movers(m.run!.id, kind!),
    enabled: Boolean(m.run && kind),
    staleTime: 60_000,
  });

  const label = MODE_LABEL[m.mode] ?? m.mode;
  if (!m.run) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span>
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">
            {" "}
            · {m.mode === "chandemo"
              ? "no results since the 12 Oct 2026 calculation fix — re-run Chandemo on this universe."
              : "no completed run on this universe."}
          </span>
        </span>
        <Link to="/run" className="inline-flex items-center gap-1 text-xs text-signal hover:underline">
          Run screen <ArrowRight aria-hidden className="size-3" />
        </Link>
      </Card>
    );
  }

  const rows = movers.data?.rows ?? [];
  const valueCols = KEY_VALUES[m.mode] ?? Object.keys(rows[0]?.values ?? {}).filter((k) => k !== "Latest_Close").slice(0, 4);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{label}</h2>
          <p className="text-xs text-muted-foreground">
            Run #{m.run.id} · {fmtDateTime(m.run.finished_at)} · {m.run.broker_name}
            {m.counts.errors ? ` · ${m.counts.errors} errored` : ""}
            {m.previous_run_id ? ` · compared with run #${m.previous_run_id}` : " · no earlier run to compare"}
          </p>
        </div>
        <Link
          to="/runs/$runId"
          params={{ runId: String(m.run.id) }}
          className="inline-flex items-center gap-1 text-xs text-signal hover:underline"
        >
          Open run <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      <div role="group" aria-label={`${label} result groups`} className="flex flex-wrap gap-2 px-4 py-3">
        {available.map((k) => (
          <button
            type="button"
            key={k.kind}
            aria-pressed={kind === k.kind}
            onClick={() => setPicked(k.kind)}
            className={cn(
              "flex h-9 items-baseline gap-1.5 rounded border px-3 text-xs sm:h-8",
              kind === k.kind ? "border-signal/50 bg-signal/10" : "hover:bg-accent/60",
            )}
          >
            <span className={cn("self-center font-mono text-sm font-semibold tabular-nums", k.tone)}>{m.counts[k.kind]}</span>
            <span className="self-center text-muted-foreground">{k.label}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto border-t">
        {movers.isLoading && <div role="status" className="p-4 text-xs text-muted-foreground">Loading…</div>}
        {movers.data && rows.length === 0 && <div className="p-4 text-xs text-muted-foreground">None.</div>}
        {rows.length > 0 && (
          <table className="w-full text-xs">
            <caption className="sr-only">
              {label}: {available.find((k) => k.kind === kind)?.label}
            </caption>
            <thead className="sticky top-0 bg-sidebar text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Ticker</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Close</th>
                <th scope="col" className="px-3 py-2 font-medium">Verdict</th>
                {valueCols.map((v) => (
                  <th key={v} scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    {v.replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-t hover:bg-accent/40">
                  <td className="px-4 py-1.5">
                    <Link
                      to="/stocks/$symbol"
                      params={{ symbol: r.ticker }}
                      className="font-mono font-medium underline-offset-4 hover:text-signal hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtNumber(r.latest_close)}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex gap-1">
                      {r.flags.map((f) => (
                        <FlagBadge key={f} flag={f} />
                      ))}
                    </span>
                  </td>
                  {valueCols.map((v) => (
                    <td key={v} className="hidden px-3 py-1.5 text-right font-mono tabular-nums sm:table-cell">
                      {fmtValue(r.values[v])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
