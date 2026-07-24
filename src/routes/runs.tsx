import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getRecentRuns, type RecentRun } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/runs")({
  head: () => ({
    meta: [
      { title: "Past Runs — Stock Screener" },
      { name: "description", content: "Recently submitted stock screen runs." },
      { property: "og:title", content: "Past Runs — Stock Screener" },
      { property: "og:description", content: "Recently submitted stock screen runs." },
    ],
  }),
  component: RunsPage,
});

function RunsPage() {
  const [runs, setRuns] = useState<RecentRun[]>([]);
  useEffect(() => setRuns(getRecentRuns()), []);
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Past Runs</h1>
          <p className="text-xs text-muted-foreground">Recent runs submitted from this browser.</p>
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Run ID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Mode</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Broker</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Universe</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.run_id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-1.5 font-mono">
                    <Link to="/runs/$runId" params={{ runId: r.run_id }} className="text-signal hover:underline">
                      {r.run_id.slice(0, 12)}…
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 font-mono">{r.mode}</td>
                  <td className="px-3 py-1.5 font-mono">{r.broker}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.universe}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{fmtDateTime(r.submitted_at)}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
