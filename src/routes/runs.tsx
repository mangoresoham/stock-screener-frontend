import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/runs")({
  head: () => ({
    meta: [
      { title: "Past Runs — Stock Screener" },
      { name: "description", content: "Previously submitted stock screen runs." },
      { property: "og:title", content: "Past Runs — Stock Screener" },
      { property: "og:description", content: "Previously submitted stock screen runs." },
    ],
  }),
  component: RunsPage,
});

function RunsPage() {
  // Backed by GET /screens (server-side, DB-persisted) -- not client-only/localStorage,
  // so this list is consistent across browsers/devices and survives clearing site data.
  const q = useQuery({ queryKey: ["screens"], queryFn: api.listRuns });
  const runs = q.data ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Past Runs</h1>
          <p className="text-xs text-muted-foreground">Most recent screen runs, across all users of this backend.</p>
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Run ID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Mode</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Broker</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Universe</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Started</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {q.error && (
                <tr><td colSpan={6} className="p-6 text-center text-fail">{(q.error as Error).message}</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.run_id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-1.5 font-mono">
                    <Link
                      to="/runs/$runId"
                      params={{ runId: String(r.run_id) }}
                      className="text-signal hover:underline"
                    >
                      #{r.run_id}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-1.5 font-mono">{r.mode}</td>
                  <td className="px-3 py-1.5 font-mono">{r.broker}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {r.universe.name} · {r.universe.member_count}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{fmtDateTime(r.started_at)}</td>
                </tr>
              ))}
              {!q.isLoading && runs.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
