import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/status-badge";
import { api, ApiError } from "@/lib/api";
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
  const qc = useQueryClient();
  // Backed by GET /screens (server-side, DB-persisted) -- not client-only/localStorage,
  // so this list is consistent across browsers/devices and survives clearing site data.
  const q = useQuery({ queryKey: ["screens"], queryFn: api.listRuns });
  const runs = q.data ?? [];

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<number[] | null>(null); // ids awaiting confirm

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(runs.map((r) => r.run_id)) : new Set());
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // Deletes are independent (no bulk endpoint on the backend -- see api.ts) --
      // allSettled so one failing id (e.g. already deleted from another tab) doesn't
      // stop the rest from going through.
      const outcomes = await Promise.allSettled(ids.map((id) => api.deleteRun(id)));
      const failed = outcomes
        .map((o, i) => ({ o, id: ids[i] }))
        .filter(({ o }) => o.status === "rejected");
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      setSelected(new Set());
      setPendingDelete(null);
      if (failed.length === 0) {
        toast.success(total === 1 ? "Run deleted" : `${total} runs deleted`, {
          description: "Fetched stock data was not affected.",
        });
      } else {
        toast.error(`${failed.length} of ${total} deletions failed`, {
          description: failed
            .map(({ o, id }) =>
              o.status === "rejected"
                ? `#${id}: ${o.reason instanceof ApiError ? o.reason.detail : String(o.reason)}`
                : "",
            )
            .join("; "),
          duration: 15_000,
        });
      }
    },
    onError: (e) => {
      setPendingDelete(null);
      toast.error("Delete failed", { description: e instanceof ApiError ? e.detail : (e as Error).message });
    },
  });

  const allSelected = runs.length > 0 && selected.size === runs.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Past Runs</h1>
            <p className="text-xs text-muted-foreground">Most recent screen runs, across all users of this backend.</p>
          </div>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={() => setPendingDelete(Array.from(selected))}
            >
              <Trash2 className="size-3" />
              Delete selected ({selected.size})
            </Button>
          )}
        </div>
        <Card className="p-0 overflow-hidden">
          {q.isLoading ? (
            <p role="status" className="p-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : q.error ? (
            <p role="alert" className="p-6 text-center text-xs text-fail">{(q.error as Error).message}</p>
          ) : runs.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No runs yet.</p>
          ) : (
            <>
              {/* Phones: one card per run -- an 8-column table at 375px is a sideways-scroll
                  puzzle. Same data and actions as the table below. */}
              <div className="md:hidden">
                <label className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                  Select all
                </label>
                <ul className="divide-y">
                  {runs.map((r) => (
                    <li key={r.run_id} className="flex items-start gap-3 px-3 py-3">
                      <Checkbox
                        className="mt-1"
                        checked={selected.has(r.run_id)}
                        onCheckedChange={(v) => toggleOne(r.run_id, Boolean(v))}
                        aria-label={`Select run #${r.run_id}`}
                      />
                      <Link
                        to="/runs/$runId"
                        params={{ runId: String(r.run_id) }}
                        className="min-w-0 flex-1 space-y-1 rounded"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium text-signal">#{r.run_id}</span>
                          <StatusBadge status={r.status} />
                        </span>
                        <span className="block font-mono text-xs">
                          {r.mode} · {r.broker}
                        </span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {r.universe.name} · {r.universe.member_count} · {fmtDateTime(r.started_at)}
                        </span>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="-mr-2 shrink-0 text-muted-foreground hover:text-fail"
                        onClick={() => setPendingDelete([r.run_id])}
                        aria-label={`Delete run #${r.run_id}`}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-xs">
                  <caption className="sr-only">Past screen runs</caption>
                  <thead className="bg-muted/40">
                    <tr>
                      <th scope="col" className="px-3 py-2 w-8">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => toggleAll(Boolean(v))}
                          aria-label="Select all runs"
                        />
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Run ID</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Status</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Mode</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Broker</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Universe</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Started</th>
                      <th scope="col" className="px-3 py-2 w-8"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.run_id} className="border-t hover:bg-accent/40">
                        <td className="px-3 py-1.5">
                          <Checkbox
                            checked={selected.has(r.run_id)}
                            onCheckedChange={(v) => toggleOne(r.run_id, Boolean(v))}
                            aria-label={`Select run #${r.run_id}`}
                          />
                        </td>
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
                        <td className="px-3 py-1.5 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-fail"
                            onClick={() => setPendingDelete([r.run_id])}
                            aria-label={`Delete run #${r.run_id}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.length === 1 ? `run #${pendingDelete[0]}` : `${pendingDelete?.length} runs`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the run{pendingDelete && pendingDelete.length > 1 ? "s" : ""} and{" "}
              {pendingDelete?.length === 1 ? "its" : "their"} per-ticker results. It does{" "}
              <strong>not</strong> delete any fetched stock (OHLCV) data — that stays cached and
              shared for future runs regardless. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-fail text-white hover:bg-fail/90"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
