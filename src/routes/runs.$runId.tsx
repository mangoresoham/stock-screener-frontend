import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ResultsTable } from "@/components/results-table";
import { api, ApiError, type RunStatus } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/runs/$runId")({
  head: ({ params }) => ({
    meta: [
      { title: `Run ${params.runId.slice(0, 8)} — Stock Screener` },
      { name: "description", content: "Screen run results with polling for background job completion." },
      { property: "og:title", content: `Run ${params.runId.slice(0, 8)} — Stock Screener` },
      { property: "og:description", content: "Screen run results with polling for background job completion." },
    ],
  }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();

  const q = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId),
    // Poll every 2.5s while queued/running; stop once terminal.
    refetchInterval: (query) => {
      const status = query.state.data?.status as RunStatus | undefined;
      return status === "completed" || status === "failed" ? false : 2500;
    },
    refetchIntervalInBackground: false,
  });

  const run = q.data;
  const isTerminal = run?.status === "completed" || run?.status === "failed";
  const passedCount = run?.passed_tickers?.length ?? 0;
  const totalCount = run?.results?.length ?? run?.universe?.member_count ?? 0;

  const onExport = async () => {
    try {
      await api.downloadExport(runId);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof ApiError ? e.detail : (e as Error).message });
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] p-6 space-y-4">
        {q.isLoading && !run && (
          <div className="text-sm text-muted-foreground">Loading run…</div>
        )}
        {q.error && !run && (
          <div className="text-sm text-fail">{(q.error as Error).message}</div>
        )}

        {run && (
          <>
            {/* Header strip: mode, broker, data window */}
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} showHint />
                    <span className="font-mono text-xs text-muted-foreground">{run.run_id}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <Field label="Mode" value={run.mode} />
                    <Field label="Broker" value={run.broker} />
                    <Field label="Universe" value={run.universe?.name ?? `${run.universe?.member_count ?? "—"} tickers`} />
                    <Field label="Data start" value={fmtDateTime(run.data_start_at)} warn={!run.data_start_at && isTerminal} />
                    <Field label="Data end" value={fmtDateTime(run.data_end_at)} warn={!run.data_end_at && isTerminal} />
                    <Field label="Started" value={fmtDateTime(run.started_at)} />
                    <Field label="Finished" value={fmtDateTime(run.finished_at)} />
                  </div>
                </div>
                {run.status === "completed" && (
                  <Button onClick={onExport} className="bg-signal text-signal-foreground hover:bg-signal/90">
                    <Download className="size-4" /> Download Excel
                  </Button>
                )}
              </div>
            </Card>

            {/* Headline */}
            {run.status === "completed" && (
              <div className="flex items-baseline gap-3">
                <div className="text-3xl font-semibold font-mono tabular text-pass">
                  {passedCount}
                  <span className="text-muted-foreground"> / {totalCount}</span>
                </div>
                <div className="text-sm text-muted-foreground">tickers passed</div>
              </div>
            )}
            {run.status === "failed" && (
              <Card className="p-4 border-fail/40 bg-fail/10">
                <div className="text-xs uppercase tracking-wide text-fail mb-1">Error</div>
                <div className="font-mono text-sm whitespace-pre-wrap">{run.error ?? "Unknown error"}</div>
              </Card>
            )}
            {(run.status === "queued" || run.status === "running") && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                {run.status === "queued" ? "Waiting for a worker to pick this up…" : "Screening in progress. Results will appear here once complete."}
              </Card>
            )}

            {/* Table */}
            {run.status === "completed" && (
              <ResultsTable rows={run.results ?? []} mode={run.mode} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-mono ${warn ? "text-warn" : ""}`}>{value}</span>
    </div>
  );
}
