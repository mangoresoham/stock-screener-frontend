import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/brokers")({
  head: () => ({
    meta: [
      { title: "Brokers — Stock Screener" },
      { name: "description", content: "Broker authentication status and reauthentication." },
      { property: "og:title", content: "Brokers — Stock Screener" },
      { property: "og:description", content: "Broker authentication status and reauthentication." },
    ],
  }),
  component: BrokersPage,
});

function BrokersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brokers"], queryFn: api.listBrokers, refetchInterval: 15_000 });

  const reauth = useMutation({
    mutationFn: (name: string) => api.reauthBroker(name),
    onSuccess: (_b, name) => {
      toast.success("Reauth requested", { description: name });
      qc.invalidateQueries({ queryKey: ["brokers"] });
    },
    onError: (e, name) => {
      // 424 messages already contain the fix (e.g. Breeze login URL) — show verbatim.
      toast.error(`${name} reauth failed`, {
        description: e instanceof ApiError ? e.detail : (e as Error).message,
        duration: 15_000,
      });
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6 space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Brokers</h1>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Broker</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Rate limit / min</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide text-[10px]"></th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((b) => (
                <tr key={b.name} className="border-t">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", b.authenticated ? "bg-pass" : "bg-fail")} />
                      <span className={cn("font-mono text-[10px] uppercase tracking-wide", b.authenticated ? "text-pass" : "text-fail")}>
                        {b.authenticated ? "Authed" : "Not authed"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{b.name}</td>
                  <td className="px-3 py-2 font-mono text-right tabular">{b.rate_limit_per_minute}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={reauth.isPending && reauth.variables === b.name}
                      onClick={() => reauth.mutate(b.name)}
                    >
                      <RefreshCw className={cn("size-3", reauth.isPending && reauth.variables === b.name && "animate-spin")} />
                      Reauth
                    </Button>
                  </td>
                </tr>
              ))}
              {q.isLoading && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {q.error && (
                <tr><td colSpan={4} className="p-6 text-center text-fail">{(q.error as Error).message}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
