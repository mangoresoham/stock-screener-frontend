import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api, ApiError, type Broker } from "@/lib/api";
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

// Only Breeze needs credentials entered/updated through this UI at all -- Angel
// authenticates headlessly from a TOTP seed already in the backend's .env (no daily
// step), and Yahoo needs no credentials whatsoever. The backend's PUT
// /brokers/{name}/credentials endpoint is broker-agnostic in shape, but showing this
// control for Angel/Yahoo would be misleading: nothing in either adapter reads from the
// credential store, so saving one there would silently do nothing.
const BROKERS_WITH_CREDENTIALS_UI = new Set(["breeze"]);

function BrokersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brokers"], queryFn: api.listBrokers, refetchInterval: 15_000 });
  const [credentialsFor, setCredentialsFor] = useState<Broker | null>(null);

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
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-xs">Broker</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide text-xs">Rate limit / min</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((b) => (
                <tr key={b.name} className="border-t">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", b.authenticated ? "bg-pass" : "bg-fail")} />
                      <span className={cn("font-mono text-xs uppercase tracking-wide", b.authenticated ? "text-pass" : "text-fail")}>
                        {b.authenticated ? "Authed" : "Not authed"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{b.name}</td>
                  <td className="px-3 py-2 font-mono text-right tabular">{b.rate_limit_per_minute}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {BROKERS_WITH_CREDENTIALS_UI.has(b.name) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setCredentialsFor(b)}
                      >
                        <KeyRound className="size-3" />
                        Credentials
                      </Button>
                    )}
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

      <CredentialsDialog broker={credentialsFor} onOpenChange={(open) => !open && setCredentialsFor(null)} />
    </AppShell>
  );
}

function CredentialsDialog({ broker, onOpenChange }: { broker: Broker | null; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [sessionToken, setSessionToken] = useState("");
  const [showApiFields, setShowApiFields] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const submit = useMutation({
    mutationFn: (credentials: Record<string, string>) => api.updateBrokerCredentials(broker!.name, credentials),
    onSuccess: () => {
      toast.success("Credentials saved and verified", { description: `${broker!.name} is now authenticated.` });
      qc.invalidateQueries({ queryKey: ["brokers"] });
      setSessionToken("");
      setApiKey("");
      setApiSecret("");
      setShowApiFields(false);
      onOpenChange(false);
    },
    onError: (e) => {
      // Saved credentials are NOT rolled back on a failed verify (see routers/brokers.py) --
      // if this was a bad paste, the error below (already containing the real login URL
      // for Breeze) is what to act on; the value is safely stored either way.
      toast.error("Saved, but verification failed", {
        description: e instanceof ApiError ? e.detail : (e as Error).message,
        duration: 20_000,
      });
    },
  });

  const handleSubmit = () => {
    const credentials: Record<string, string> = {};
    if (sessionToken.trim()) credentials.session_token = sessionToken.trim();
    if (apiKey.trim()) credentials.api_key = apiKey.trim();
    if (apiSecret.trim()) credentials.api_secret = apiSecret.trim();
    if (Object.keys(credentials).length === 0) {
      toast.error("Enter at least the session token");
      return;
    }
    submit.mutate(credentials);
  };

  const sessionUpdatedAt = broker?.credentials_updated_at?.session_token;

  return (
    <Dialog open={broker !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{broker?.name} credentials</DialogTitle>
          <DialogDescription>
            Breeze requires a fresh session token roughly once a day (ICICI's session expires at
            midnight or 24h, whichever is first). Log into Breeze in your browser, then paste the
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">API_Session</code>
            value from the address bar below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="session_token" className="text-xs uppercase tracking-wide text-muted-foreground">
              Session token
            </Label>
            <Input
              id="session_token"
              className="font-mono text-xs"
              placeholder="e.g. 55710007"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              autoFocus
            />
            {sessionUpdatedAt && (
              <p className="text-[11px] text-muted-foreground">
                Last updated {new Date(sessionUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>

          <button
            type="button"
            className="text-[11px] text-muted-foreground underline underline-offset-2"
            onClick={() => setShowApiFields((v) => !v)}
          >
            {showApiFields ? "Hide" : "Also update"} API key / secret (rarely needed)
          </button>

          {showApiFields && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="api_key" className="text-xs uppercase tracking-wide text-muted-foreground">
                  API key
                </Label>
                <Input
                  id="api_key"
                  className="font-mono text-xs"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_secret" className="text-xs uppercase tracking-wide text-muted-foreground">
                  API secret
                </Label>
                <Input
                  id="api_secret"
                  type="password"
                  className="font-mono text-xs"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Saving & verifying…" : "Save & verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
