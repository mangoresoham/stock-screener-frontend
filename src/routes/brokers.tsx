import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react";

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

// Breeze and Angel both read every credential exclusively from the DB-backed store (see
// src/brokers/credential_store.py) -- no .env fallback -- so both get a Credentials control
// here. Yahoo needs no credentials whatsoever, so showing this control for it would be
// misleading: nothing in its adapter reads from the
// credential store, so saving one there would silently do nothing.
const BROKERS_WITH_CREDENTIALS_UI = new Set(["breeze", "angel"]);

interface CredentialFieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password";
  /** Rarely-changed fields tucked behind an "Also update" toggle, collapsed by default. */
  advanced?: boolean;
}

interface BrokerCredentialsConfig {
  description: string;
  fields: CredentialFieldSpec[];
}

const BROKER_CREDENTIALS_CONFIG: Record<string, BrokerCredentialsConfig> = {
  breeze: {
    description:
      "Breeze requires a fresh session token roughly once a day (ICICI's session expires at " +
      "midnight or 24h, whichever is first). Log into Breeze in your browser, then paste the " +
      "API_Session value from the address bar below.",
    fields: [
      { key: "session_token", label: "Session token", placeholder: "e.g. 55710007" },
      { key: "api_key", label: "API key", advanced: true },
      { key: "api_secret", label: "API secret", type: "password", advanced: true },
    ],
  },
  angel: {
    description:
      "Angel One authenticates headlessly from your API key, client ID, trading PIN, and TOTP " +
      "seed -- no daily re-login needed. The TOTP seed is the base32 string shown when you enable " +
      "API access, not a live 6-digit code.",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "e.g. A123456" },
      { key: "pin", label: "Trading PIN", type: "password" },
      { key: "totp_secret", label: "TOTP secret", type: "password", placeholder: "base32 seed" },
      { key: "api_key", label: "API key", advanced: true },
    ],
  },
};

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
          <div className="overflow-x-auto">
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
          </div>
        </Card>
      </div>

      <CredentialsDialog broker={credentialsFor} onOpenChange={(open) => !open && setCredentialsFor(null)} />
    </AppShell>
  );
}

function CredentialsDialog({ broker, onOpenChange }: { broker: Broker | null; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const config = broker ? BROKER_CREDENTIALS_CONFIG[broker.name] : undefined;
  const primaryFields = config?.fields.filter((f) => !f.advanced) ?? [];
  const advancedFields = config?.fields.filter((f) => f.advanced) ?? [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  // key_name -> masked hint ("••••••••7sck") once fetched via the eye button. Presence in
  // this map is what "revealed" means for a field -- toggling off just removes the entry
  // rather than re-fetching next time it's shown again.
  const [hints, setHints] = useState<Record<string, string>>({});

  // Reset local field state whenever a different broker's dialog opens, so stale values
  // from e.g. Breeze's session_token don't linger into Angel's dialog. Also auto-expands
  // the advanced section if any advanced field already has a stored value -- otherwise a
  // previously-saved api_key would sit invisibly behind a collapsed "Also update" toggle,
  // reading as "did that not save?" on every reopen.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (broker && broker.name !== openedFor) {
    setOpenedFor(broker.name);
    if (Object.keys(values).length > 0) setValues({});
    if (Object.keys(hints).length > 0) setHints({});
    const hasStoredAdvancedValue = advancedFields.some((f) => broker.credentials_updated_at?.[f.key]);
    if (showAdvanced !== hasStoredAdvancedValue) setShowAdvanced(hasStoredAdvancedValue);
  }

  const revealHint = useMutation({
    mutationFn: (keyName: string) => api.getCredentialHint(broker!.name, keyName),
    onSuccess: (data) => setHints((h) => ({ ...h, [data.key_name]: data.hint })),
    onError: (e) => {
      toast.error("Couldn't load hint", {
        description: e instanceof ApiError ? e.detail : (e as Error).message,
      });
    },
  });

  const submit = useMutation({
    mutationFn: (credentials: Record<string, string>) => api.updateBrokerCredentials(broker!.name, credentials),
    onSuccess: () => {
      toast.success("Credentials saved and verified", { description: `${broker!.name} is now authenticated.` });
      qc.invalidateQueries({ queryKey: ["brokers"] });
      setValues({});
      setShowAdvanced(false);
      setHints({}); // stale now -- whatever was revealed no longer matches the new value
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
    for (const field of config?.fields ?? []) {
      const v = values[field.key]?.trim();
      if (v) credentials[field.key] = v;
    }
    if (Object.keys(credentials).length === 0) {
      toast.error(`Enter at least ${primaryFields[0]?.label ?? "one field"}`);
      return;
    }
    submit.mutate(credentials);
  };

  const renderField = (field: CredentialFieldSpec, autoFocus = false) => {
    const updatedAt = broker?.credentials_updated_at?.[field.key];
    const isSet = Boolean(updatedAt);
    const hint = hints[field.key];
    const isRevealing = revealHint.isPending && revealHint.variables === field.key;
    return (
      <div key={field.key} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={field.key} className="text-xs uppercase tracking-wide text-muted-foreground">
            {field.label}
          </Label>
          {isSet && (
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] text-pass">
                <CheckCircle2 className="size-3" />
                Set
              </span>
              {/* GET .../credentials/{key}/reveal is called only on click, never passively
                  -- see routers/brokers.py's docstring for why this is a masked partial
                  hint (last 4 chars at most) and not the real value. */}
              <button
                type="button"
                title={hint ? "Hide hint" : "Show a masked hint of the saved value"}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={isRevealing}
                onClick={() =>
                  hint
                    ? setHints((h) => {
                        const { [field.key]: _drop, ...rest } = h;
                        return rest;
                      })
                    : revealHint.mutate(field.key)
                }
              >
                {isRevealing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : hint ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
              </button>
            </span>
          )}
        </div>
        <Input
          id={field.key}
          type={field.type ?? "text"}
          className="font-mono text-xs"
          placeholder={isSet ? "•".repeat(16) : field.placeholder}
          value={values[field.key] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          autoFocus={autoFocus}
        />
        {isSet && (
          <p className="text-[11px] text-muted-foreground">
            {hint && (
              <>
                Saved value ends in <span className="font-mono text-foreground">{hint}</span> ·{" "}
              </>
            )}
            Last updated {new Date(updatedAt!).toLocaleString()} — leave blank to keep it.
          </p>
        )}
      </div>
    );
  };

  const hasAnyStoredValue = Boolean(
    broker?.credentials_updated_at && Object.keys(broker.credentials_updated_at).length > 0
  );

  return (
    <Dialog open={broker !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{broker?.name} credentials</DialogTitle>
          <DialogDescription>{config?.description}</DialogDescription>
        </DialogHeader>

        {hasAnyStoredValue && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Fields marked <CheckCircle2 className="inline size-3 text-pass align-[-1px]" /> Set already have a
            value saved (never shown again, even here) — leave one blank to keep it, or type a new value to
            replace it.
          </p>
        )}

        <div className="space-y-3 py-2">
          {primaryFields.map((field, i) => renderField(field, i === 0))}

          {advancedFields.length > 0 && (
            <>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline underline-offset-2"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Also update"} {advancedFields.map((f) => f.label).join(" / ")} (rarely needed)
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-md border p-3">{advancedFields.map((field) => renderField(field))}</div>
              )}
            </>
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
